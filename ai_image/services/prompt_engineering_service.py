# ai_image/services/prompt_engineering_service.py
"""
Image Prompt Engineering Service — Uses Claude to generate optimized,
brand-consistent image prompts for OpenAI DALL-E / Gemini Imagen.

Architecture:
    Claude (text AI) generates the image prompt → DALL-E/Gemini renders the image.

Based on:
    - brand_image_prompt_engineer.md (9-layer prompt architecture)
    - reprompting-and-master-prompt-evolution.md (failure taxonomy & correction patterns)
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Failure Taxonomy ──────────────────────────────────────────────────

FAILURE_TAXONOMY = {
    'C1': {'name': 'COLOR_WRONG', 'desc': 'Dominant colors don\'t match brand palette'},
    'C2': {'name': 'COLOR_DULL', 'desc': 'Colors are washed out, desaturated, or muddy'},
    'C3': {'name': 'COLOR_OVER', 'desc': 'Colors are over-saturated or neon'},
    'S1': {'name': 'STYLE_MISMATCH', 'desc': 'Art style doesn\'t match brand identity'},
    'S2': {'name': 'STYLE_GENERIC', 'desc': 'Looks like generic stock photography'},
    'L1': {'name': 'LAYOUT_CLUTTERED', 'desc': 'Too many elements, no visual hierarchy'},
    'L2': {'name': 'LAYOUT_NO_SAFE_ZONE', 'desc': 'No clean space for text overlay'},
    'L3': {'name': 'LAYOUT_SUBJECT_SMALL', 'desc': 'Main subject is tiny or lost'},
    'L4': {'name': 'LAYOUT_WRONG_ANGLE', 'desc': 'Camera angle is wrong for the purpose'},
    'A1': {'name': 'ARTIFACT_DISTORTION', 'desc': 'Melted shapes, extra limbs, warped objects'},
    'A2': {'name': 'ARTIFACT_TEXT', 'desc': 'AI generated unwanted text/letters in image'},
    'A3': {'name': 'ARTIFACT_EXTRA_OBJECTS', 'desc': 'Unexpected objects in the scene'},
    'M1': {'name': 'MOOD_WRONG', 'desc': 'Emotional tone doesn\'t match intent'},
    'M2': {'name': 'MOOD_FLAT', 'desc': 'No visual impact, no emotion, boring'},
    'B1': {'name': 'BACKGROUND_BUSY', 'desc': 'Background competes with subject'},
    'B2': {'name': 'BACKGROUND_WRONG', 'desc': 'Setting/environment is wrong'},
    'T1': {'name': 'TEXTURE_PLASTIC', 'desc': 'Surfaces look fake, plasticky, or CG'},
    'T2': {'name': 'TEXTURE_WRONG', 'desc': 'Materials don\'t match description'},
    'P1': {'name': 'PROMPT_IGNORED', 'desc': 'Model clearly ignored a key instruction'},
    'P2': {'name': 'PROMPT_REWRITTEN', 'desc': 'API revised_prompt changed critical intent'},
}

# ── Correction Patches (appended to prompts to fix failures) ──────

CORRECTION_PATCHES = {
    'C1': 'IMPORTANT: The dominant colors in this image MUST be {correct_colors}. Do NOT use {wrong_colors}. The brand palette must be clearly visible.',
    'C2': 'IMPORTANT: Increase color vibrancy and saturation. Colors should feel fresh, vivid, and energetic — not washed out or muted.',
    'C3': 'IMPORTANT: Reduce saturation. Colors should feel natural and refined, not neon or electric. Tone down all colors by approximately 30%.',
    'S1': 'IMPORTANT: This must be {correct_style}. Do NOT render as {wrong_style}.',
    'S2': 'IMPORTANT: This should NOT look like generic stock photography. Add brand personality through unique color grading, creative prop arrangement, or a distinctive angle.',
    'L1': 'IMPORTANT: Simplify significantly. Remove ALL secondary objects and background details. Keep ONLY the main subject against a clean, simple background. Maximum 2-3 elements in the entire frame.',
    'L2': 'IMPORTANT: The {position} {percentage}% of the image MUST be completely empty — no objects, no patterns, no details. Just a smooth, uniform gradient or solid color suitable for text overlay.',
    'L3': 'IMPORTANT: Make the main subject MUCH larger. It should fill at least 50-60% of the frame. Bring the camera closer.',
    'L4': 'IMPORTANT: Camera angle must be {correct_angle}. Do NOT use {wrong_angle}.',
    'A1': 'IMPORTANT: All objects must be physically realistic with clean, precise edges. No warping, no melting, no impossible geometry.',
    'A2': 'CRITICAL: Do NOT generate ANY text, letters, numbers, words, characters, or symbols anywhere in the image. The image must be completely text-free.',
    'A3': 'IMPORTANT: Include ONLY the objects explicitly described. Do NOT add any additional items, props, or decorative elements.',
    'M1': 'IMPORTANT: The emotional mood must be {correct_mood}. Adjust lighting accordingly. This should feel {correct_mood}, NOT {wrong_mood}.',
    'M2': 'IMPORTANT: Increase visual drama. Add stronger contrast between light and shadow. Create a clear focal point that draws the eye.',
    'B1': 'IMPORTANT: Background must be extremely simple — a smooth gradient, a solid color, or a very subtly textured surface. NO detailed environments.',
    'B2': 'IMPORTANT: The setting must be {correct_setting}. Do NOT place the subject in {wrong_setting}.',
    'T1': 'IMPORTANT: All surfaces should have realistic, natural textures. Avoid any CG or rendered appearance.',
    'T2': 'IMPORTANT: Materials must match the description exactly. If described as matte, it must be matte, not glossy.',
    'P1': 'CRITICAL — HIGHEST PRIORITY: {ignored_instruction}',
    'P2': 'CRITICAL: The following instruction must NOT be altered or simplified: {critical_instruction}',
}

# ── Platform Aspect Ratios ────────────────────────────────────────

PLATFORM_SPECS = {
    'instagram_feed': {'ratio': '1:1', 'size': '1080x1080', 'desc': 'Instagram Feed Post'},
    'instagram_portrait': {'ratio': '4:5', 'size': '1080x1350', 'desc': 'Instagram Portrait Post'},
    'instagram_story': {'ratio': '9:16', 'size': '1080x1920', 'desc': 'Instagram Story/Reel'},
    'facebook': {'ratio': '1:1', 'size': '1080x1080', 'desc': 'Facebook Post'},
    'linkedin': {'ratio': '1.91:1', 'size': '1200x628', 'desc': 'LinkedIn Post'},
    'twitter': {'ratio': '16:9', 'size': '1600x900', 'desc': 'X/Twitter Post'},
    'pinterest': {'ratio': '2:3', 'size': '1000x1500', 'desc': 'Pinterest Pin'},
    'youtube_thumbnail': {'ratio': '16:9', 'size': '1280x720', 'desc': 'YouTube Thumbnail'},
    'tiktok': {'ratio': '9:16', 'size': '1080x1920', 'desc': 'TikTok Video Cover'},
}

# ── System Prompt for Claude (Image Prompt Engineering) ───────────

IMAGE_PROMPT_ENGINEER_SYSTEM = """You are an expert AI Image Prompt Engineer specializing in generating high-quality, brand-consistent image prompts for OpenAI's DALL-E and Google's Imagen image generation APIs. Your purpose is to help brands produce scroll-stopping, on-brand social media visuals at scale.

PROMPT ARCHITECTURE — Every prompt you produce MUST follow this 9-layer structure, written as a single flowing paragraph (NOT as labeled sections):

LAYER 1 — FORMAT & PLATFORM: State the image format, dimensions/aspect ratio, and platform context.
LAYER 2 — SUBJECT & SCENE: Describe the primary subject and scene in vivid, specific detail. Be concrete.
LAYER 3 — ART STYLE & AESTHETIC: Define the visual style, artistic approach, and aesthetic feel.
LAYER 4 — COLOR & PALETTE: Explicitly state the color palette with descriptive names and hex codes.
LAYER 5 — COMPOSITION & LAYOUT: Describe spatial arrangement, focal points, depth of field, camera angle, text overlay space.
LAYER 6 — LIGHTING & ATMOSPHERE: Specify lighting direction, quality, temperature, and mood.
LAYER 7 — TEXTURES & MATERIALS: Describe surface qualities and tactile details for realism.
LAYER 8 — BRAND CONSISTENCY ANCHOR: Include the brand style tag for consistency across all prompts.
LAYER 9 — NEGATIVE PROMPT / EXCLUSIONS: Explicitly state what to avoid.

RULES:
- NEVER generate vague or generic prompts. Every prompt must be specific enough that two different models would produce visually similar outputs.
- ALWAYS write prompts as a single natural-language paragraph — no bullet points, labels, or headers inside the prompt.
- CRITICAL — SUBJECT IS LOCKED: The "USER'S REQUIRED SUBJECT" field in the creative brief is the user's required visual intent. It defines WHAT appears in the image. Your job is to enrich HOW it looks (style, colours, lighting, composition) using the brand DNA — NOT to replace, reinterpret, or overrule the subject. If the user says "a woman relaxing in a spa", the output MUST feature a woman relaxing in a spa.
- NEVER substitute the subject with a generic brand scene. The subject must be the dominant focal element of the output prompt.
- ALWAYS layer brand context (palette, style, mood, lighting) on top of the user's subject — not instead of it.
- ALWAYS consider the "thumb-stop test" — will this image make someone stop scrolling?
- ALWAYS include negative exclusions to minimize unwanted artifacts.
- AVOID prompt cliches like "stunning", "beautiful", "amazing" — use precise, descriptive language.
- AVOID requesting readable text in images — AI-generated text is unreliable.
- For product images, describe the product's physical attributes in detail (shape, material, finish, size).

OUTPUT FORMAT:
1. Brand Style Anchor (reusable tag for this brand)
2. Image Prompt (full 9-layer prompt as a single flowing paragraph)
3. 2-3 Prompt Variations (vary scene/angle/mood, keep brand style consistent)

IMPORTANT: Respond with valid JSON in this exact format:
{
    "brand_style_anchor": "...",
    "primary_prompt": "...",
    "variations": ["...", "...", "..."],
    "platform_notes": "..."
}"""

# ── Re-Prompting System Prompt ────────────────────────────────────

REPROMPT_SYSTEM = """You are an expert AI Image Prompt Engineer specializing in diagnosing and fixing failed image generation prompts.

FAILURE TAXONOMY — Use these codes to classify problems:
C1: COLOR_WRONG - Dominant colors don't match brand palette
C2: COLOR_DULL - Colors washed out or muddy
C3: COLOR_OVER - Colors over-saturated or neon
S1: STYLE_MISMATCH - Art style doesn't match brand
S2: STYLE_GENERIC - Looks like generic stock
L1: LAYOUT_CLUTTERED - Too many elements
L2: LAYOUT_NO_SAFE_ZONE - No clean space for text
L3: LAYOUT_SUBJECT_SMALL - Subject too small
L4: LAYOUT_WRONG_ANGLE - Wrong camera angle
A1: ARTIFACT_DISTORTION - Warped or melted shapes
A2: ARTIFACT_TEXT - Unwanted text appeared
A3: ARTIFACT_EXTRA_OBJECTS - Unexpected objects
M1: MOOD_WRONG - Wrong emotional tone
M2: MOOD_FLAT - No visual impact
B1: BACKGROUND_BUSY - Background competes
B2: BACKGROUND_WRONG - Wrong setting
T1: TEXTURE_PLASTIC - Surfaces look fake
T2: TEXTURE_WRONG - Materials don't match
P1: PROMPT_IGNORED - Key instruction ignored
P2: PROMPT_REWRITTEN - API altered critical intent

RE-PROMPT RULES:
- NEVER rewrite the entire prompt. PATCH it.
- Apply targeted correction patches at the END of the prompt.
- Maximum 2 patches per re-prompt attempt.
- Maximum 3 total attempts before redesigning.
- The correction addresses ONLY the specific failure.

IMPORTANT: Respond with valid JSON:
{
    "failure_codes": ["C1", "L1"],
    "diagnosis": "One-sentence diagnosis",
    "corrected_prompt": "Original prompt + correction patches appended",
    "patches_applied": ["patch1 text", "patch2 text"],
    "attempt_number": 1,
    "recommendation": "one-off or systemic"
}"""


class ImagePromptEngineerService:
    """Uses Claude (via UnifiedLLMService) to generate optimized,
    brand-consistent image prompts for DALL-E / Gemini Imagen."""

    def __init__(self, user=None):
        self.user = user

    def _get_llm_service(self):
        from accounts.services.llm_service import get_llm_service
        return get_llm_service(self.user)

    def generate_brand_style_anchor(self, brand) -> str:
        """Generate a reusable Brand Style Anchor tag from Brand DNA."""
        service = self._get_llm_service()

        brand_info = {
            'name': brand.brand_name,
            'industry': getattr(brand, 'industry', ''),
            'description': getattr(brand, 'description', ''),
        }

        # Extract from Brand DNA if available
        dna = getattr(brand, 'brand_dna', None)
        if isinstance(dna, dict):
            brand_info.update({
                'brand_voice': dna.get('brand_voice', ''),
                'brand_values': dna.get('brand_values', ''),
                'color_theme': dna.get('color_theme', ''),
                'target_audience': dna.get('target_audience', ''),
                'content_themes': dna.get('content_themes', ''),
            })

        messages = [
            {
                'role': 'system',
                'content': (
                    'You are a brand visual identity specialist. '
                    'Generate a compact 1-2 sentence Brand Style Anchor — '
                    'a reusable visual DNA summary for image generation prompts. '
                    'Format: [BrandName Brand Style: style, palette, textures, lighting, mood, motif.] '
                    'Respond with ONLY the anchor text, nothing else.'
                ),
            },
            {
                'role': 'user',
                'content': f'Brand details:\n{_format_dict(brand_info)}',
            },
        ]

        result = service.chat_completion(
            messages=messages,
            temperature=0.5,
            max_tokens=200,
        )

        if result.success:
            return result.content.strip()
        logger.error('Brand style anchor generation failed: %s', result.error)
        return f'[{brand.brand_name} Brand Style: professional, modern, clean]'

    def generate_image_prompt(
        self,
        brand,
        content_context: Dict,
        platform: str = 'instagram_feed',
        user=None,
        think_harder: bool = False,
    ) -> Dict:
        """
        Generate a 9-layer structured image prompt using Claude.

        Args:
            brand: Brand model instance
            content_context: {
                'content_type': str,  # e.g. 'product_showcase', 'lifestyle', 'promo'
                'subject': str,       # What to show
                'key_message': str,   # CTA or headline
                'mood': str,          # e.g. 'bright', 'elegant', 'energetic'
                'must_include': list,  # Required elements
                'must_exclude': list,  # Elements to avoid
                'text_overlay': bool,  # Whether to reserve space for text
                'text_position': str,  # 'top', 'bottom', 'left', 'right'
            }
            platform: Platform key from PLATFORM_SPECS
            user: User instance for LLM service

        Returns:
            Dict with brand_style_anchor, primary_prompt, variations, platform_notes
        """
        if user:
            self.user = user

        service = self._get_llm_service()
        platform_spec = PLATFORM_SPECS.get(platform, PLATFORM_SPECS['instagram_feed'])

        # Build brand context
        brand_info = _build_brand_context(brand)

        # Build the creative brief
        idea_context = (content_context.get('idea_context') or '').strip()
        brief = f"""CREATIVE BRIEF:
Platform: {platform_spec['desc']} ({platform_spec['ratio']}, {platform_spec['size']})
Content Type: {content_context.get('content_type', 'general social media post')}
USER'S REQUIRED SUBJECT (LOCKED — MUST APPEAR IN OUTPUT PROMPT): {content_context.get('subject', 'brand visual')}
Idea / Content Angle: {idea_context or '—'}
Key Message: {content_context.get('key_message', '')}
Mood: {content_context.get('mood', 'brand default')}
Must Include: {', '.join(content_context.get('must_include', [])) or 'none specified'}
Must Exclude: {', '.join(content_context.get('must_exclude', [])) or 'none specified'}
Text Overlay Space: {'Yes — reserve ' + content_context.get('text_position', 'top') + ' area' if content_context.get('text_overlay') else 'No'}

BRAND CONTEXT (enrich the subject's visual style with this — do NOT replace the subject):
{_format_dict(brand_info)}"""

        messages = [
            {'role': 'system', 'content': IMAGE_PROMPT_ENGINEER_SYSTEM},
            {'role': 'user', 'content': brief},
        ]

        result = service.chat_completion(
            messages=messages,
            temperature=0.4,
            max_tokens=4000 if think_harder else 2000,
            response_format={'type': 'json_object'},
            thinking_budget=10000 if think_harder else 0,
        )

        if result.success:
            try:
                import json
                parsed = json.loads(result.content)
                return {
                    'brand_style_anchor': parsed.get('brand_style_anchor', ''),
                    'primary_prompt': parsed.get('primary_prompt', ''),
                    'variations': parsed.get('variations', []),
                    'platform_notes': parsed.get('platform_notes', ''),
                    'platform': platform,
                    'platform_spec': platform_spec,
                }
            except (json.JSONDecodeError, KeyError) as e:
                logger.error('Failed to parse image prompt JSON: %s', e)
                # Fallback: return raw content as prompt
                return {
                    'brand_style_anchor': '',
                    'primary_prompt': result.content,
                    'variations': [],
                    'platform_notes': '',
                    'platform': platform,
                    'platform_spec': platform_spec,
                }

        logger.error('Image prompt generation failed: %s', result.error)
        return {
            'error': result.error,
            'brand_style_anchor': '',
            'primary_prompt': '',
            'variations': [],
            'platform_notes': '',
        }

    def reprompt_image(
        self,
        original_prompt: str,
        failure_description: str,
        brand=None,
        attempt_number: int = 1,
        user=None,
        think_harder: bool = False,
    ) -> Dict:
        """
        Apply targeted correction patches to fix a failed image prompt.

        Args:
            original_prompt: The prompt that produced the bad image
            failure_description: What went wrong (user description or auto-detected)
            brand: Optional brand for context
            attempt_number: Current attempt (max 3)
            user: User instance

        Returns:
            Dict with failure_codes, diagnosis, corrected_prompt, patches, recommendation
        """
        if attempt_number > 3:
            return {
                'error': 'Maximum 3 re-prompt attempts reached. Consider redesigning the creative brief.',
                'corrected_prompt': original_prompt,
                'attempt_number': attempt_number,
            }

        if user:
            self.user = user

        service = self._get_llm_service()

        brand_context = ''
        if brand:
            brand_info = _build_brand_context(brand)
            brand_context = f'\n\nBRAND CONTEXT:\n{_format_dict(brand_info)}'

        messages = [
            {'role': 'system', 'content': REPROMPT_SYSTEM},
            {
                'role': 'user',
                'content': f"""ORIGINAL PROMPT:
{original_prompt}

FAILURE DESCRIPTION:
{failure_description}

ATTEMPT NUMBER: {attempt_number}{brand_context}

Diagnose the failure, classify it, and generate a corrected prompt with targeted patches.""",
            },
        ]

        result = service.chat_completion(
            messages=messages,
            temperature=0.4,
            max_tokens=4000 if think_harder else 2000,
            response_format={'type': 'json_object'},
            thinking_budget=10000 if think_harder else 0,
        )

        if result.success:
            try:
                import json
                parsed = json.loads(result.content)
                parsed['attempt_number'] = attempt_number
                return parsed
            except (json.JSONDecodeError, KeyError) as e:
                logger.error('Failed to parse re-prompt JSON: %s', e)
                return {
                    'corrected_prompt': original_prompt,
                    'error': f'Parse error: {e}',
                    'attempt_number': attempt_number,
                }

        logger.error('Re-prompt generation failed: %s', result.error)
        return {
            'corrected_prompt': original_prompt,
            'error': result.error,
            'attempt_number': attempt_number,
        }

    def diagnose_failure(
        self,
        image_description: str,
        original_prompt: str,
        revised_prompt: Optional[str] = None,
        user=None,
        think_harder: bool = False,
    ) -> Dict:
        """
        Use Claude to analyze a failed image and classify the failure.

        Args:
            image_description: What the generated image looks like
            original_prompt: What was requested
            revised_prompt: The API's revised prompt (if available)
            user: User instance

        Returns:
            Dict with failure_codes, diagnosis, severity, recommendation
        """
        if user:
            self.user = user

        service = self._get_llm_service()

        revised_section = ''
        if revised_prompt:
            revised_section = f'\n\nREVISED PROMPT (from API):\n{revised_prompt}'

        messages = [
            {'role': 'system', 'content': REPROMPT_SYSTEM},
            {
                'role': 'user',
                'content': f"""DIAGNOSE THIS IMAGE FAILURE:

ORIGINAL PROMPT:
{original_prompt}{revised_section}

WHAT THE IMAGE LOOKS LIKE:
{image_description}

Classify the failure using the taxonomy codes. Respond with JSON:
{{
    "failure_codes": ["C1", "L1"],
    "diagnosis": "One-sentence diagnosis",
    "severity": "minor|moderate|major",
    "is_systemic": false,
    "recommendation": "Specific fix recommendation"
}}""",
            },
        ]

        result = service.chat_completion(
            messages=messages,
            temperature=0.3,
            max_tokens=1000 if think_harder else 500,
            response_format={'type': 'json_object'},
            thinking_budget=10000 if think_harder else 0,
        )

        if result.success:
            try:
                import json
                return json.loads(result.content)
            except (json.JSONDecodeError, KeyError) as e:
                logger.error('Failed to parse diagnosis JSON: %s', e)

        return {
            'failure_codes': [],
            'diagnosis': 'Unable to diagnose automatically',
            'error': result.error if not result.success else 'Parse error',
        }


# ── Helpers ───────────────────────────────────────────────────────

def _build_brand_context(brand) -> Dict:
    """Extract brand context for prompt engineering."""
    info = {
        'brand_name': brand.brand_name,
        'industry': getattr(brand, 'industry', ''),
    }

    dna = getattr(brand, 'brand_dna', None)
    if isinstance(dna, dict):
        for key in ['brand_voice', 'brand_values', 'color_theme',
                     'target_audience', 'content_themes', 'tagline',
                     'description', 'unique_selling_points']:
            val = dna.get(key, '')
            if val:
                info[key] = val

    return info


def _format_dict(d: Dict) -> str:
    """Format a dict as readable key-value lines."""
    lines = []
    for k, v in d.items():
        if v:
            label = k.replace('_', ' ').title()
            lines.append(f'  {label}: {v}')
    return '\n'.join(lines)
