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

    # Pull extended brand DNA fields if passed through
    visual_style = brand_context.get('visual_style', '')
    mood = brand_context.get('mood', '')
    brand_values = brand_context.get('brand_values', '')
    keywords = brand_context.get('keywords', '')

    system_prompt = """You are a senior brand copywriter who writes SHORT, ACCURATE text overlays for social media graphics.

ABSOLUTE RULES — violating any of these makes the output worthless:
1. Perfect English: zero spelling errors, zero grammar errors, no repeated words.
2. Concise: maximum 6 words per line, maximum 2 lines. Shorter is always better.
3. Derived from context: every suggestion must reflect the brand, idea, and caption — never generic slogans.
4. Professional tone: polished, clear, on-brand — as if a top-tier design agency wrote it.
5. Return ONLY valid JSON, no markdown, no explanations."""

    user_prompt = f"""Generate {count} distinct, professional text overlay suggestions for a brand image or video.

<brand>
Name: {brand_name or '—'}
Industry: {industry or '—'}
Target Audience: {target_audience or '—'}
Voice / Tone: {voice_tone or '—'}
Visual Style: {visual_style or '—'}
Mood: {mood or '—'}
Brand Values: {brand_values or '—'}
Keywords: {keywords or '—'}
</brand>

<post_context>
Caption (extract the core message from this): {caption_text[:600] if caption_text else '—'}
Content Idea: {idea_context[:300] if idea_context else '—'}
Trending Topics: {trending_topics[:200] if trending_topics else '—'}
Visual Description: {image_description[:200] if image_description else '—'}
CTA: {cta_text or '—'}
</post_context>

TASK: Read the caption and idea above. Identify the single strongest message (benefit, emotion, or hook). Write {count} short overlay phrases that each express that message from a DIFFERENT angle. Every phrase must be grammatically perfect English, max 6 words per line, max 2 lines total.

Return JSON:
{{"suggestions": [
  {{"text": "Two Line\\nHeadline Here", "style": "bold", "recommended_layout": "bottom_banner"}},
  {{"text": "Single Line Copy", "style": "minimal", "recommended_layout": "center"}},
  ...
]}}

Styles: bold, inspirational, question, cta, minimal
Layouts: center, bottom_banner, top_banner
Use \\n only when a second line genuinely adds impact."""

    try:
        service = get_llm_service(user)
        result = service.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
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
            text = str(s.get('text', '')).strip()
            if not text or not _is_quality_text(text):
                continue
            cleaned.append({
                'text': text[:120],
                'style': s.get('style', 'bold') if s.get('style') in valid_styles else 'bold',
                'recommended_layout': s.get('recommended_layout', 'bottom_banner') if s.get('recommended_layout') in valid_layouts else 'bottom_banner',
            })

        if not cleaned:
            return _fallback_suggestions(brand_name, count)
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


def _is_quality_text(text: str) -> bool:
    """
    Reject obviously garbled overlay text before it reaches the renderer.
    Checks: no duplicate consecutive words, each line ≤ 9 words, total ≤ 18 words,
    and no suspiciously long 'words' that indicate hallucination.
    """
    lines = [ln.strip() for ln in text.replace('\\n', '\n').split('\n') if ln.strip()]
    if len(lines) > 2:
        return False
    all_words = []
    for line in lines:
        words = line.split()
        if len(words) > 9:
            return False
        # Reject any single token longer than 20 chars (likely garbled)
        if any(len(w) > 20 for w in words):
            return False
        all_words.extend(words)
    if len(all_words) > 18:
        return False
    # Reject consecutive duplicate words (e.g. "for for", "the the")
    lower = [w.lower().strip('.,!?') for w in all_words]
    for i in range(len(lower) - 1):
        if lower[i] and lower[i] == lower[i + 1]:
            return False
    return True


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
