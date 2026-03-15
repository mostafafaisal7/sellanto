"""
Copy Generation Service
Uses Claude (via UnifiedLLMService) to generate short marketing copy
for text overlay on brand images.
"""

import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def generate_copy_suggestions(
    user,
    caption_text: str = '',
    brand_context: Optional[Dict] = None,
    image_description: str = '',
    cta_text: str = '',
    idea_context: str = '',
    trending_topics: str = '',
    count: int = 5,
) -> List[Dict]:
    """
    Generate short marketing copy suggestions for image overlay.

    Returns list of dicts: [{text, style, recommended_layout}, ...]
    """
    from accounts.services.llm_service import get_llm_service

    brand_context = brand_context or {}
    brand_name = brand_context.get('brand_name', '')
    industry = brand_context.get('industry', '')
    target_audience = brand_context.get('target_audience', '')
    voice_tone = brand_context.get('voice_tone', '')

    system_prompt = """You are a senior copywriter specializing in social media graphics and brand imagery.
Generate short, punchy text overlays for brand images. These are NOT social media captions — they are
SHORT headline text that will be overlaid directly on the image, like a professional graphic designer would create.

CRITICAL RULES:
- Maximum 8 words per line, maximum 2 lines total
- Each suggestion MUST be UNIQUE and DIFFERENT from the others — vary the angle, hook, and message
- The copy MUST be directly derived from the caption content and idea context — NOT generic marketing slogans
- Extract key phrases, hooks, CTAs, product names, or emotional triggers from the caption
- Consider the brand voice and industry context
- Return ONLY valid JSON, no markdown or extra text"""

    user_prompt = f"""Generate {count} UNIQUE text overlay suggestions for a brand image.

<brand_context>
Brand: {brand_name}
Industry: {industry}
Target Audience: {target_audience}
Brand Voice: {voice_tone}
</brand_context>

<content_context>
Caption (PRIMARY — derive copy from this): {caption_text[:500] if caption_text else 'N/A'}
Idea Context: {idea_context[:300] if idea_context else 'N/A'}
Trending Topics: {trending_topics[:200] if trending_topics else 'N/A'}
Image Prompt: {image_description[:300] if image_description else 'N/A'}
CTA: {cta_text if cta_text else 'N/A'}
</content_context>

IMPORTANT: Each copy text must be a DIFFERENT take on the caption's message. Extract different hooks, angles, or key phrases from the caption. Do NOT repeat similar patterns or generic slogans.

Return JSON in this exact format:
{{"suggestions": [
  {{"text": "Your Bold Headline Here", "style": "bold", "recommended_layout": "center"}},
  {{"text": "Inspire Your Audience", "style": "inspirational", "recommended_layout": "bottom_banner"}},
  ...
]}}

Each suggestion must use a different style from: bold, inspirational, question, cta, minimal
Each must use a recommended_layout from: center, bottom_banner, top_banner"""

    try:
        service = get_llm_service(user)
        result = service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        response_text = result.get('content', '').strip()

        # Parse JSON response
        data = json.loads(response_text)
        suggestions = data.get('suggestions', [])

        # Validate and clean suggestions
        valid_styles = {'bold', 'inspirational', 'question', 'cta', 'minimal'}
        valid_layouts = {'center', 'bottom_banner', 'top_banner'}
        cleaned = []
        for s in suggestions[:count]:
            cleaned.append({
                'text': str(s.get('text', ''))[:200],
                'style': s.get('style', 'bold') if s.get('style') in valid_styles else 'bold',
                'recommended_layout': s.get('recommended_layout', 'bottom_banner') if s.get('recommended_layout') in valid_layouts else 'bottom_banner',
            })

        return cleaned

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse copy suggestions JSON: {e}")
        # Return fallback suggestions
        return _fallback_suggestions(brand_name, count)
    except Exception as e:
        logger.error(f"Copy generation failed: {e}")
        return _fallback_suggestions(brand_name, count)


def generate_ai_styles(
    user,
    copy_text: str,
    brand_context: Optional[Dict] = None,
    count: int = 4,
) -> List[Dict]:
    """
    AI generates diverse professional typography style configs for the given copy text.
    Each style is a complete rendering config (font, color, position, opacity, effects).

    Returns list of dicts ready to pass to render_copy_overlay().
    """
    from accounts.services.llm_service import get_llm_service

    brand_context = brand_context or {}
    brand_name = brand_context.get('brand_name', '')
    industry = brand_context.get('industry', '')

    system_prompt = """You are a senior graphic designer specializing in social media brand imagery and typography.
Given a copy text and brand context, generate distinct professional typography style configurations.
Each style should look completely different — vary the font, color palette, position, background opacity, and alignment.
Think like a designer creating mood boards with different aesthetic directions.

Return ONLY valid JSON, no markdown."""

    user_prompt = f"""Create {count} distinct typography styles for this copy text overlay on a brand image:

Copy text: "{copy_text}"
Brand: {brand_name or 'General'}
Industry: {industry or 'General'}

Return JSON:
{{"styles": [
  {{
    "name": "Bold Impact",
    "description": "High contrast white on dark strip",
    "font_style": "bebas_neue",
    "text_color": "#FFFFFF",
    "position": "bottom_banner",
    "overlay_opacity": 70,
    "text_alignment": "center",
    "add_text_shadow": true
  }},
  ...
]}}

Available font_style: montserrat_bold, montserrat_regular, playfair_bold, roboto_bold, bebas_neue
Available position: center, bottom_banner, top_banner, top_bottom_split
Available text_alignment: left, center, right
overlay_opacity: 0-100
text_color: any hex color

Make each style VERY different — mix elegant serif with bold sans-serif, light vs dark text, minimal vs heavy backgrounds, centered vs left-aligned. Think: luxury, urban, minimalist, editorial, etc."""

    try:
        service = get_llm_service(user)
        result = service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.9,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )

        response_text = result.get('content', '').strip()
        data = json.loads(response_text)
        styles = data.get('styles', [])

        valid_fonts = {'montserrat_bold', 'montserrat_regular', 'playfair_bold', 'roboto_bold', 'bebas_neue'}
        valid_positions = {'center', 'bottom_banner', 'top_banner', 'top_bottom_split'}
        valid_alignments = {'left', 'center', 'right'}

        cleaned = []
        for s in styles[:count]:
            cleaned.append({
                'name': str(s.get('name', 'Style'))[:50],
                'description': str(s.get('description', ''))[:100],
                'font_style': s.get('font_style', 'montserrat_bold') if s.get('font_style') in valid_fonts else 'montserrat_bold',
                'text_color': s.get('text_color', '#FFFFFF') if isinstance(s.get('text_color'), str) and s.get('text_color', '').startswith('#') else '#FFFFFF',
                'position': s.get('position', 'bottom_banner') if s.get('position') in valid_positions else 'bottom_banner',
                'overlay_opacity': max(0, min(100, int(s.get('overlay_opacity', 60)))),
                'text_alignment': s.get('text_alignment', 'center') if s.get('text_alignment') in valid_alignments else 'center',
                'add_text_shadow': bool(s.get('add_text_shadow', True)),
            })

        return cleaned

    except Exception as e:
        logger.error(f"AI style generation failed: {e}")
        return _fallback_styles(count)


def _fallback_styles(count: int) -> List[Dict]:
    """Fallback styles if AI generation fails."""
    defaults = [
        {'name': 'Bold Impact', 'description': 'White text, dark strip', 'font_style': 'bebas_neue', 'text_color': '#FFFFFF', 'position': 'bottom_banner', 'overlay_opacity': 70, 'text_alignment': 'center', 'add_text_shadow': True},
        {'name': 'Elegant Serif', 'description': 'Gold on transparent', 'font_style': 'playfair_bold', 'text_color': '#F59E0B', 'position': 'center', 'overlay_opacity': 40, 'text_alignment': 'center', 'add_text_shadow': True},
        {'name': 'Clean Minimal', 'description': 'Light text, subtle strip', 'font_style': 'montserrat_regular', 'text_color': '#F8FAFC', 'position': 'top_banner', 'overlay_opacity': 30, 'text_alignment': 'left', 'add_text_shadow': False},
        {'name': 'Urban Bold', 'description': 'High contrast black on white', 'font_style': 'roboto_bold', 'text_color': '#000000', 'position': 'bottom_banner', 'overlay_opacity': 85, 'text_alignment': 'center', 'add_text_shadow': False},
    ]
    return defaults[:count]


def _fallback_suggestions(brand_name: str, count: int) -> List[Dict]:
    """Return generic fallback suggestions if AI generation fails."""
    fallbacks = [
        {"text": f"{brand_name or 'Your Brand'} — Redefined", "style": "bold", "recommended_layout": "center"},
        {"text": "Elevate Your Style", "style": "inspirational", "recommended_layout": "bottom_banner"},
        {"text": "Ready For Something New?", "style": "question", "recommended_layout": "top_banner"},
        {"text": "Shop Now", "style": "cta", "recommended_layout": "bottom_banner"},
        {"text": "Less Is More", "style": "minimal", "recommended_layout": "center"},
    ]
    return fallbacks[:count]
