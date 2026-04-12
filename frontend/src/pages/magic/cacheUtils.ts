/**
 * 🔑 Magic Mode Cache Key Utility
 *
 * CRITICAL: This module provides a SINGLE SOURCE OF TRUTH for cache key generation.
 * Both AIWorkingScreen (save) and MagicModePage (lookup) MUST use this same function.
 *
 * Previous Bug: Two different algorithms caused cache lookups to never work.
 * Fix: Unified implementation ensures save and lookup use identical keys.
 */

export const MAGIC_QUESTION_OPTIONS = {
  industry: [
    'Digital Marketing Agency',
    'E-commerce / Online Store',
    'SaaS / Software Company',
    'Local Service Business',
    'Consulting / Freelancing',
    'Other',
  ],
  goal: [
    'Get more customers / leads',
    'Build brand awareness',
    'Drive website traffic',
    'Establish thought leadership',
    'Showcase products / services',
  ],
  tone: [
    'Professional & Authoritative',
    'Friendly & Approachable',
    'Bold & Provocative',
    'Educational & Helpful',
    'Fun & Casual',
  ],
  platforms: [
    'LinkedIn',
    'Instagram',
    'Facebook',
    'Twitter / X',
    'TikTok',
  ],
  colors: [
    'Blue tones (trust, professional)',
    'Red/Orange (energy, bold)',
    'Green (growth, nature)',
    'Purple (creative, premium)',
    'Dark/Minimal (sleek, modern)',
    'Use colors from my website',
  ],
};

export interface CacheKeyResult {
  cacheKey: string;
  userId: number;
}

/**
 * Build cache key from user answers for Magic Mode post lookup/save.
 *
 * Algorithm:
 * 1. Convert each answer string to its option index (1-based)
 * 2. For multi-select (platforms), sort indices and concatenate
 * 3. Join with "/" to create key: "2/2/1/12/1"
 * 4. Append sanitized custom text if "Other" selected
 *
 * @param answers - User's selected answers from questions
 * @param customAnswers - Custom text for "Other" options
 * @param userId - Current user ID for security validation
 * @returns { cacheKey, userId } - Cache key string and user ID
 *
 * @example
 * // User selects: E-commerce, Build awareness, Professional, LinkedIn+Instagram, Blue
 * buildMagicCacheKey(
 *   { industry: 'E-commerce / Online Store', goal: 'Build brand awareness', ... },
 *   {},
 *   123
 * )
 * // Returns: { cacheKey: "2/2/1/12/1", userId: 123 }
 */
export function buildMagicCacheKey(
  answers: Record<string, string | string[]>,
  customAnswers?: Record<string, string>,
  userId?: number
): CacheKeyResult {
  if (!userId) {
    throw new Error('[CacheUtils] No user ID provided for cache key generation');
  }

  const encoded: Record<string, string> = {};

  // Encode each question's answer to option indices
  Object.keys(MAGIC_QUESTION_OPTIONS).forEach((questionId) => {
    const answer = answers[questionId];
    const options = MAGIC_QUESTION_OPTIONS[questionId as keyof typeof MAGIC_QUESTION_OPTIONS];

    if (!answer) {
      encoded[questionId] = '0';
      return;
    }

    // Handle both single-select (string) and multi-select (array)
    const selectedValues = Array.isArray(answer) ? answer : [answer];
    const indices: number[] = [];

    selectedValues.forEach((value) => {
      const index = options.indexOf(value);
      if (index !== -1) {
        indices.push(index + 1); // 1-based indexing (0 means not selected)
      } else {
        console.warn(`[CacheUtils] Answer "${value}" not found in options for ${questionId}`);
      }
    });

    // Sort indices for consistent ordering (important for multi-select)
    // e.g., ['Instagram', 'LinkedIn'] and ['LinkedIn', 'Instagram'] → same key "12"
    encoded[questionId] = indices.sort((a, b) => a - b).join('');

    // Default to '0' if no valid indices found
    if (!encoded[questionId]) {
      encoded[questionId] = '0';
    }
  });

  // Build cache key in fixed order
  let cacheKey = `${encoded.industry}/${encoded.goal}/${encoded.tone}/${encoded.platforms}/${encoded.colors}`;

  // Append custom "Other" text if present (sanitized for URL safety)
  if (customAnswers?.industry_other) {
    const sanitized = customAnswers.industry_other
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
      .substring(0, 50);            // Limit length

    if (sanitized) {
      cacheKey += `/${sanitized}`;
    }
  }

  console.log(`[CacheUtils] Generated cache key for user ${userId}:`, cacheKey);
  console.log('[CacheUtils] Answer encoding:', encoded);

  return { cacheKey, userId };
}
