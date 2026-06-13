# video_studio/services/optimizer.py

"""
Veo Prompt Optimizer
Uses Claude (via UnifiedLLMService) to enhance prompts for Veo video generation.
Gemini is reserved for image/video generation only; all text goes through Claude.
"""


class GeminiPromptOptimizer:
    """
    Use Claude to optimize prompts for Veo video generation.
    """

    def __init__(self, api_key=None):
        pass  # api_key no longer needed — Claude key is fetched from GlobalAPIKey

    def optimize_prompt_for_veo(self, user_prompt, brand=None, product_category=None, platform=None):
        """
        Use Claude to refine user prompt for better Veo results.
        Falls back to the original prompt if Claude is unavailable.
        """
        try:
            from accounts.services.llm_service import get_llm_service

            optimization_request = self._build_optimization_prompt(
                user_prompt, brand, product_category, platform
            )

            service = get_llm_service(None)
            result = service.chat_completion(
                messages=[{"role": "user", "content": optimization_request}],
                max_tokens=300,
                temperature=0.7,
            )

            if not result.success:
                return user_prompt

            optimized = result.content.strip()
            optimized = optimized.replace('```', '').replace('**', '').strip()

            if len(optimized) > 500:
                optimized = optimized[:497] + '...'

            return optimized

        except Exception as e:
            print(f"Prompt optimization failed: {e}")
            return user_prompt

    def _build_optimization_prompt(self, user_prompt, brand, product_category, platform):
        """
        Build the prompt for Gemini to optimize the Veo prompt

        Args:
            user_prompt (str): Original prompt
            brand (Brand): Brand instance
            product_category (str): Product category
            platform (str): Target platform

        Returns:
            str: Optimization request prompt
        """
        brand_name = brand.brand_name if brand else "the brand"
        industry = brand.industry if (brand and hasattr(brand, 'industry')) else "general"
        voice_tone = brand.voice_tone if (brand and hasattr(brand, 'voice_tone')) else "professional"

        platform_guidance = ""
        if platform:
            platform_styles = {
                'instagram': 'vibrant, eye-catching, stop-scroll worthy',
                'tiktok': 'trendy, fast-paced, authentic',
                'youtube': 'engaging, hook-first, watch-time optimized',
                'amazon': 'informative, professional, feature-focused',
            }
            platform_guidance = f"\nTarget Platform: {platform} ({platform_styles.get(platform, 'professional')})"

        optimization_prompt = f"""You are an expert prompt engineer for AI video generation using Google Veo 3.1.

USER INPUT:
- Original Prompt: "{user_prompt}"
- Brand: {brand_name} ({industry} industry)
- Product Category: {product_category or 'general product'}
- Brand Voice: {voice_tone}{platform_guidance}

TASK:
Rewrite this prompt to maximize Veo 3.1's video generation capabilities. Make it cinematically detailed and technically precise.

INCLUDE:
1. **Camera Movements**: Specific cinematography (dolly, crane, orbit, pan, tilt, etc.)
2. **Lighting**: Precise lighting style (golden hour, studio softbox, dramatic spotlight, etc.)
3. **Composition**: Framing guidance (rule of thirds, centered, symmetrical, etc.)
4. **Motion Details**: Speed and smoothness of movement
5. **Audio Cues**: Ambient sound, music style, or silence
6. **Visual Style**: Maintain brand voice ({voice_tone}) and industry standards ({industry})

CONSTRAINTS:
- Keep it under 500 characters total
- Be specific but natural-sounding
- Focus on visual and technical details
- No explanations, just the optimized prompt
- Make it cinematically compelling

EXAMPLE TRANSFORMATION:
Input: "Show headphones rotating"
Output: "Cinematic dolly shot orbiting 360° around premium wireless headphones on minimalist white surface. Slow, smooth camera movement with subtle speed variation. Studio softbox lighting creating soft shadows. Product centered, rule of thirds composition. Subtle ambient whoosh sound. Modern, sleek aesthetic matching premium tech brand positioning. Professional product videography style."

Now optimize the user's prompt. Return ONLY the optimized prompt, no other text:
"""

        return optimization_prompt

    def batch_optimize_prompts(self, prompts_list, brand=None, product_category=None):
        """
        Optimize multiple prompts in batch

        Args:
            prompts_list (list): List of prompt strings
            brand (Brand): Brand instance
            product_category (str): Product category

        Returns:
            list: List of optimized prompts
        """
        optimized = []

        for prompt in prompts_list:
            optimized_prompt = self.optimize_prompt_for_veo(
                user_prompt=prompt,
                brand=brand,
                product_category=product_category
            )
            optimized.append(optimized_prompt)

        return optimized

    def suggest_prompt_variations(self, base_prompt, num_variations=3):
        """Generate variations of a prompt for A/B testing using Claude."""
        try:
            from accounts.services.llm_service import get_llm_service

            variation_request = f"""Generate {num_variations} creative variations of this video prompt for A/B testing.

Base Prompt: "{base_prompt}"

Create {num_variations} different versions that:
1. Maintain the core idea
2. Vary camera angles, lighting, and mood
3. Each should be distinctly different for testing
4. Keep each under 400 characters
5. Make them cinematically detailed

Return ONLY the {num_variations} prompts, numbered 1-{num_variations}, no other text.
"""

            service = get_llm_service(None)
            result = service.chat_completion(
                messages=[{"role": "user", "content": variation_request}],
                max_tokens=600,
                temperature=0.9,
            )

            if not result.success:
                return [base_prompt] * num_variations

            text = result.content.strip()
            variations = []
            for line in text.split('\n'):
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-')):
                    cleaned = line.lstrip('0123456789.-) ').strip()
                    if cleaned:
                        variations.append(cleaned)

            return variations[:num_variations] if variations else [base_prompt]

        except Exception as e:
            print(f"Failed to generate variations: {e}")
            return [base_prompt] * num_variations


# Preset camera movements and lighting styles

CAMERA_MOVEMENTS = {
    'orbit': 'Smooth 360-degree orbital camera movement around subject',
    'dolly_in': 'Slow dolly-in push towards subject, building intimacy',
    'dolly_out': 'Dolly-out pull-back revealing environment',
    'crane_up': 'Crane shot rising upward from low to high angle',
    'crane_down': 'Crane shot descending from high to low angle',
    'pan_left': 'Horizontal pan from right to left',
    'pan_right': 'Horizontal pan from left to right',
    'tilt_up': 'Vertical tilt upward',
    'tilt_down': 'Vertical tilt downward',
    'tracking': 'Tracking shot following subject movement',
    'handheld': 'Handheld camera with subtle natural shake',
    'static': 'Static locked-off camera, no movement',
    'zoom_in': 'Gradual zoom in to emphasize detail',
    'zoom_out': 'Zoom out to reveal context',
}

LIGHTING_STYLES = {
    'studio': 'Professional studio softbox lighting with controlled shadows',
    'natural': 'Natural window light, soft and realistic',
    'golden_hour': 'Golden hour sunset lighting, warm and cinematic',
    'dramatic': 'Dramatic spotlight with high contrast and deep shadows',
    'soft': 'Soft diffused lighting, even and flattering',
    'backlit': 'Backlit with rim lighting creating glowing outline',
    'neon': 'Neon colored lighting, vibrant and modern',
    'overhead': 'Overhead top-down lighting',
    'low_key': 'Low-key dramatic lighting with dark shadows',
    'high_key': 'High-key bright lighting, minimal shadows',
}


def get_camera_movement_description(movement_name):
    """Get detailed camera movement description"""
    return CAMERA_MOVEMENTS.get(movement_name, '')


def get_lighting_description(lighting_name):
    """Get detailed lighting style description"""
    return LIGHTING_STYLES.get(lighting_name, '')
