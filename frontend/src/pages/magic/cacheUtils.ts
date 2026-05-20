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
  product_mode: [
    'Yes - I have product images',
    'No - AI generates everything',
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
    'Custom color',
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

  // Build cache key in fixed order (product_mode added after tone, before platforms)
  let cacheKey = `${encoded.industry}/${encoded.goal}/${encoded.tone}/${encoded.product_mode || '2'}/${encoded.platforms}/${encoded.colors}`;

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

  // Append custom color text if "Custom color" was selected, so different
  // custom colors don't collide on the same cache key.
  if (customAnswers?.colors_other) {
    const sanitized = customAnswers.colors_other
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    if (sanitized) {
      cacheKey += `/c-${sanitized}`;
    }
  }

  console.log(`[CacheUtils] Generated cache key for user ${userId}:`, cacheKey);
  console.log('[CacheUtils] Answer encoding:', encoded);

  return { cacheKey, userId };
}

/**
 * 🔍 Robust JSON array parsing for backend TextField data
 * Handles both actual arrays and JSON-stringified arrays from Django TextField
 */
function parseJsonArray(data: any, fieldName: string, fallback: any[] = []): any[] {
  try {
    if (Array.isArray(data)) return data;

    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed || trimmed === '[]') return fallback;

      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : fallback;
    }

    console.warn(`[CacheUtils] Unexpected type for ${fieldName}:`, typeof data, data);
    return fallback;
  } catch (error) {
    console.error(`[CacheUtils] Failed to parse ${fieldName}:`, data, error);
    return fallback;
  }
}

export interface CachedPost {
  id: number;
  title: string;
  platform: string;
  imageOverlay: string;
  imageStyle: string;
  caption: string;
  imageUrl?: string;
  status: 'ready' | 'approved' | 'published' | 'scheduled';
  approvedPlatforms?: string[];
}

/**
 * Lookup cached Magic Mode posts from database
 *
 * @param answers - User's selected answers
 * @param customAnswers - Custom text for "Other" options
 * @param userId - Current user ID
 * @returns Array of cached posts if found, empty array if not found or error
 *
 * @example
 * const posts = await lookupCachedPosts(store.answers, store.customAnswers, userId);
 * if (posts.length > 0) {
 *   // Cache hit - load existing posts
 * } else {
 *   // Cache miss - generate new posts
 * }
 */
export async function lookupCachedPosts(
  answers: Record<string, string | string[]>,
  customAnswers: Record<string, string>,
  userId: number
): Promise<CachedPost[]> {
  try {
    // Build cache key
    const { cacheKey } = buildMagicCacheKey(answers, customAnswers, userId);
    console.log('[CacheUtils] Looking up cached posts with key:', cacheKey);

    // Fetch from backend
    const { api } = await import('../../services');
    const response = await api.get(`/magic/posts/${userId}/${cacheKey}/`);

    if (response.data && response.data.posts && response.data.posts.length > 0) {
      console.log('[CacheUtils] Cache HIT - Found', response.data.posts.length, 'existing posts');

      // Convert backend posts to MagicPost format
      const posts: CachedPost[] = response.data.posts.map((p: any) => {
        const platforms = parseJsonArray(p.platforms, 'platforms', ['LinkedIn']);
        const mediaFiles = parseJsonArray(p.media_files, 'media_files', []);

        return {
          id: p.id,
          title: p.caption ? (p.caption.substring(0, 50) + (p.caption.length > 50 ? '...' : '')) : 'Post',
          platform: platforms[0] || 'LinkedIn',
          imageOverlay: '',
          imageStyle: '',
          caption: p.caption || '',
          imageUrl: mediaFiles[0] || undefined,
          status: p.status === 'draft' ? 'ready' : p.status,
          approvedPlatforms: p.status === 'approved' ? platforms : undefined,
        };
      });

      return posts;
    } else {
      console.log('[CacheUtils] Cache MISS - No posts found');
      return [];
    }
  } catch (error) {
    console.error('[CacheUtils] Cache lookup failed:', error);
    return [];
  }
}
