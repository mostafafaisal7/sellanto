# ai_image/smart_prompt_builder.py

"""
Smart Prompt Builder
Generates AI image prompts that match product style characteristics.

This module builds intelligent prompts based on product image analysis to ensure
the AI-generated backgrounds perfectly complement the uploaded product images.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def build_product_aware_prompt(
    original_prompt: str,
    product_analysis: Dict,
    product_type: str = '',
    background_style: str = 'clean'
) -> str:
    """
    Build AI image generation prompt that matches product style.

    Args:
        original_prompt: User's original prompt/description
        product_analysis: Analysis results from ProductStyleAnalyzer containing:
            - dominant_colors: List of hex colors
            - color_temperature: 'warm', 'cool', or 'neutral'
            - lighting_type: Detected lighting style
            - style_mood: Overall style classification
            - brightness: 0-1 value
            - contrast: 0-1 value
        product_type: Type of product (e.g., "handmade jewelry")
        background_style: Desired background style ('clean', 'lifestyle', 'studio', 'abstract')

    Returns:
        Enhanced prompt string optimized for style-matching background generation
    """
    try:
        # Extract analysis data with fallbacks
        colors = product_analysis.get('dominant_colors', [])
        lighting = product_analysis.get('lighting_type', 'balanced lighting')
        mood = product_analysis.get('style_mood', 'professional')
        temp = product_analysis.get('color_temperature', 'neutral')
        brightness = product_analysis.get('brightness', 0.5)
        contrast = product_analysis.get('contrast', 0.5)

        # Build color palette description
        color_desc = _get_color_description(colors, temp)

        # Get lighting description
        light_desc = _get_lighting_description(lighting, brightness, contrast)

        # Get style/mood description
        style_desc = _get_style_description(mood)

        # Get background surface description
        surface_desc = _get_surface_description(background_style, mood)

        # Get environment description based on temperature
        env_desc = _get_environment_description(temp)

        # Build comprehensive prompt
        enhanced = f"""
<task>
Generate a professional product photography background that perfectly complements the uploaded product.
The background must match the product's visual style, colors, and lighting characteristics.
</task>

<product_context>
Product Type: {product_type or 'Product'}
Detected Style: {mood}
Color Temperature: {temp}
Lighting Character: {lighting}
Brightness Level: {_brightness_level(brightness)}
</product_context>

<scene_requirements>
{original_prompt}

Visual Style:
- {style_desc}
- {color_desc}
- {env_desc}

Lighting:
- {light_desc}
- Maintain consistent lighting direction and quality
- Subtle highlights and shadows for depth and dimension
- Professional photography lighting setup

Surface & Background:
- {surface_desc}
- Create depth through subtle bokeh, gentle gradients, or tasteful environmental elements
- Premium high-end aesthetic appropriate for professional product photography
- Smooth transitions and professional finish

Composition:
- CRITICAL: EMPTY CENTER AREA where the product will be composited
- Background elements should frame and enhance the center without cluttering
- Visual balance with thoughtful use of negative space
- Professional composition that draws attention to where product will be placed
</scene_requirements>

<critical_constraints>
- Do NOT generate ANY product, object, item, or subject in the foreground or center
- The center and foreground MUST remain completely clear for product placement
- Match the detected color palette and temperature: {temp} tones {_format_colors(colors[:3])}
- Complement the product's {lighting} characteristics
- Absolutely NO text, logos, watermarks, or graphics
- Focus exclusively on creating a cohesive, style-matched backdrop that enhances the product
- Ensure the background doesn't compete with or overshadow where the product will be
</critical_constraints>
""".strip()

        return enhanced

    except Exception as e:
        logger.error(f"Smart prompt building failed: {e}")
        # Fallback to basic prompt
        return _fallback_prompt(original_prompt, background_style)


def get_style_aware_negative_prompt(
    product_analysis: Dict,
    existing_negative: str = ''
) -> str:
    """
    Generate negative prompt based on product analysis to avoid style conflicts.

    Args:
        product_analysis: Analysis results from ProductStyleAnalyzer
        existing_negative: Existing negative prompt to append to

    Returns:
        Enhanced negative prompt
    """
    try:
        base_negatives = [
            "product in center",
            "product in foreground",
            "foreground object",
            "central subject",
            "cluttered composition",
            "busy scene",
            "text overlay",
            "logo",
            "watermark",
            "branding",
            "graphics",
        ]

        # Add style-specific negatives
        mood = product_analysis.get('style_mood', '')

        if 'minimalist' in mood.lower():
            base_negatives.extend([
                'busy patterns',
                'excessive details',
                'ornate elements',
                'complex textures',
                'cluttered background'
            ])
        elif 'dramatic' in mood.lower():
            base_negatives.extend([
                'flat lighting',
                'washed out colors',
                'overexposed',
                'dull atmosphere'
            ])
        elif 'moody' in mood.lower():
            base_negatives.extend([
                'bright harsh lighting',
                'overexposed highlights',
                'cheerful colors'
            ])

        # Add temperature-specific negatives
        temp = product_analysis.get('color_temperature', '')
        if temp == 'warm':
            base_negatives.append('cold blue tones')
        elif temp == 'cool':
            base_negatives.append('warm orange tones')

        all_negatives = ', '.join(base_negatives)

        if existing_negative:
            return f"{existing_negative}, {all_negatives}"
        return all_negatives

    except Exception as e:
        logger.error(f"Negative prompt generation failed: {e}")
        return existing_negative or "product in center, text, logo"


# Helper functions for prompt building

def _get_color_description(colors: list, temperature: str) -> str:
    """Generate color palette description"""
    if not colors:
        return "Neutral color palette with subtle tones"

    color_list = ', '.join(colors[:3])
    temp_adj = {
        'warm': 'warm and inviting',
        'cool': 'cool and sophisticated',
        'neutral': 'balanced and versatile'
    }

    return f"Color palette {temp_adj.get(temperature, 'harmonious')} with accents of {color_list}"


def _get_lighting_description(lighting_type: str, brightness: float, contrast: float) -> str:
    """Generate detailed lighting description"""
    lighting_map = {
        'soft natural lighting': 'Gentle natural light with soft, diffused shadows',
        'hard studio lighting': 'Crisp studio lighting with well-defined shadows and highlights',
        'dramatic low-key lighting': 'Dramatic directional lighting with deep shadows and strong contrast',
        'balanced diffused lighting': 'Even, diffused lighting without harsh shadows',
    }

    base_desc = lighting_map.get(lighting_type, 'Professional balanced lighting')

    # Add brightness modifier
    if brightness > 0.75:
        base_desc += ', bright and airy atmosphere'
    elif brightness < 0.35:
        base_desc += ', subdued and intimate mood'

    return base_desc


def _get_style_description(mood: str) -> str:
    """Generate style/mood description"""
    style_map = {
        'modern minimalist': 'Clean, modern minimalist aesthetic with simple geometric elements and pristine surfaces',
        'bold dramatic': 'Bold, dramatic styling with strong visual contrast and impactful composition',
        'moody atmospheric': 'Atmospheric, moody environment with depth and subtle tonal variations',
        'balanced professional': 'Professional, balanced composition with timeless appeal',
    }

    return style_map.get(mood, 'Professional product photography aesthetic')


def _get_surface_description(background_style: str, mood: str) -> str:
    """Generate surface/background description"""
    surface_map = {
        'clean': 'Pristine white or light neutral surface with seamless, distraction-free appearance',
        'lifestyle': 'Natural textured surface (marble, wood, linen, or fabric) with organic appeal',
        'studio': 'Professional seamless backdrop with subtle gradients and smooth transitions',
        'abstract': 'Artistic abstract background with flowing shapes and creative visual interest',
    }

    base = surface_map.get(background_style, 'Clean, professional surface')

    # Enhance based on mood
    if 'minimalist' in mood:
        base += ', emphasizing simplicity and negative space'
    elif 'dramatic' in mood:
        base += ', with strong visual impact'

    return base


def _get_environment_description(temperature: str) -> str:
    """Generate environment/mood description based on color temperature"""
    temp_env = {
        'warm': 'Warm, inviting environment with comfortable, approachable feel',
        'cool': 'Cool, sophisticated setting with modern, professional atmosphere',
        'neutral': 'Balanced, versatile setting with universal appeal',
    }

    return temp_env.get(temperature, 'Professional setting')


def _brightness_level(brightness: float) -> str:
    """Convert brightness value to descriptive text"""
    if brightness > 0.75:
        return 'High (Bright, airy)'
    elif brightness > 0.5:
        return 'Medium (Balanced)'
    elif brightness > 0.3:
        return 'Low-Medium (Subdued)'
    else:
        return 'Low (Moody, dramatic)'


def _format_colors(colors: list) -> str:
    """Format color list for prompt"""
    if not colors:
        return ""
    return f"({', '.join(colors)})"


def _fallback_prompt(original_prompt: str, background_style: str) -> str:
    """Fallback prompt if analysis fails"""
    return f"""
Create a professional product photography background.

Requirements:
- {background_style.capitalize()} background style
- {original_prompt}
- Professional lighting
- Empty center area for product placement

Constraints:
- NO products, objects, or subjects in the center/foreground
- NO text, logos, or watermarks
- Focus on creating a clean backdrop
""".strip()
