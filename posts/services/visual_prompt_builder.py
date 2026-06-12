"""Visual prompt builders for Magic Mode image + video generation.

These services synthesise everything the magic pipeline already knows about
a post (brand DNA, content idea, generated caption, trending topics,
platform, colour palette, product context) into ONE focused visual prompt
that gets sent to Imagen or Veo.

Without this, the pipeline sends thin string templates like
`Create a professional social media image for: "<title>". <hook>` to the
image model — and the result rarely matches the caption that was generated
alongside it. With this, each generation call carries the full strategic
context, so the visual reinforces the caption instead of drifting away
from it.

Both builders are designed to fail soft: if the LLM call fails, they
return the supplied fallback string so the pipeline never blocks on
prompt enrichment.

Billing: not gated. The cost is absorbed into the already-paid image /
video generation features.
"""

from __future__ import annotations

import logging
import time as _time
from typing import Any, Iterable

from accounts.services.llm_service import get_llm_service
from accounts.services.prompt_resolver import resolve_prompt, save_execution

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────


def _truthy_lines(items: Iterable[Any]) -> str:
    """Join non-empty items as "- <item>" lines; return '' if nothing."""
    out = [str(x).strip() for x in items if x is not None and str(x).strip()]
    return '\n'.join(f'- {x}' for x in out) if out else ''


def _join_or_dash(items: Iterable[Any]) -> str:
    out = [str(x).strip() for x in items if x is not None and str(x).strip()]
    return ', '.join(out) if out else '—'


def _dna_field(dna: dict, key: str) -> str:
    val = (dna or {}).get(key)
    if val is None:
        return ''
    if isinstance(val, list):
        return ', '.join(str(x) for x in val if str(x).strip())
    return str(val).strip()


# ──────────────────────────────────────────────────────────────────────
# Image builder
# ──────────────────────────────────────────────────────────────────────


IMAGE_SYSTEM_PROMPT = (
    "You are a senior creative director who writes single-paragraph image "
    "generation prompts. You read the brand DNA, the content idea, the "
    "actual social caption that will accompany the post, and trending "
    "themes — then write ONE concise prompt (60-110 words) describing "
    "exactly what the image should show.\n\n"
    "Hard rules:\n"
    "- Anchor every visual choice to the caption's subject. If the caption "
    "talks about Mondays, the image must read 'Monday'.\n"
    "- Honour the brand voice and colour palette.\n"
    "- Reference trending themes only when they reinforce the post.\n"
    "- Lead with the dominant visual subject (a person, an object, a "
    "scene) so the model commits to a focal point.\n"
    "- When the brief includes a <text_overlay> block asking for text, "
    "describe that text being rendered prominently and artistically into "
    "the composition (typography style, placement, hierarchy). When the "
    "brief explicitly says no text, your prompt must contain zero "
    "references to typography, letters, words, signage, or numbers.\n"
    "- Do NOT include hashtags, calls to action, or platform names.\n"
    "- Output the prompt and nothing else — no preamble, no headers, no "
    "quotation marks around it."
)


class ImageVisualPromptBuilder:
    """Synthesise a rich image prompt from full magic-mode context."""

    PROMPT_TYPE = 'visual_prompt_image'

    @staticmethod
    def _build_user_message(
        *,
        brand,
        idea: dict,
        caption: str,
        platform: str,
        color_choices: list[str] | None,
        trending_topics: list[str] | None,
        image_style_hint: str,
        product_context: dict | None,
        with_copy: bool = False,
        copy_text: str = '',
    ) -> str:
        dna = (getattr(brand, 'brand_dna', None) or {}) if brand else {}
        brand_name = _dna_field(dna, 'brand_name') or (getattr(brand, 'brand_name', '') or '')
        industry = _dna_field(dna, 'industry') or (getattr(brand, 'industry', '') or '')

        product_block = ''
        if product_context:
            product_block = (
                f"\n<product>\n"
                f"product_type: {product_context.get('product_type') or '—'}\n"
                f"features: {product_context.get('features') or '—'}\n"
                f"background_style: {product_context.get('background_style') or 'clean'}\n"
                f"</product>\n\n"
                f"NOTE: A real product photo will be composited onto this image. "
                f"Treat your prompt as the BACKGROUND / setting — keep the centre "
                f"empty for the product. Do NOT describe the product itself.\n"
            )
        else:
            # Fall back to products_services from brand DNA so images represent
            # the actual business even when no product image was uploaded.
            dna_products = _dna_field(dna, 'products_services')
            if dna_products:
                product_block = (
                    f"\n<key_products>\n"
                    f"{dna_products[:400]}\n"
                    f"</key_products>\n\n"
                    f"INSTRUCTION: The image MUST visually feature or represent the "
                    f"product/service listed in <key_products>. Do not show generic "
                    f"objects — show the specific offering relevant to the caption.\n"
                )

        # Text-overlay block — explicit signal to the LLM about whether the
        # image must carry on-image text or stay purely visual.
        text_overlay_block = ''
        clean_copy = (copy_text or '').strip()
        if with_copy and clean_copy:
            text_overlay_block = (
                f"\n<text_overlay>\n"
                f"render_this_text: \"{clean_copy}\"\n"
                f"instruction: This text MUST appear prominently in the image, "
                f"professionally typeset and integrated into the composition like "
                f"a graphic-design poster. Describe the typography (style, weight, "
                f"placement), and keep the rest of the scene composed so the text "
                f"is the focal element.\n"
                f"</text_overlay>\n"
            )
        else:
            text_overlay_block = (
                "\n<text_overlay>\n"
                "instruction: No text, typography, letters, numbers, or "
                "watermarks of any kind in the image. The image must be purely "
                "visual.\n"
                "</text_overlay>\n"
            )

        return f"""<brand>
name: {brand_name or '—'}
industry: {industry or '—'}
tagline: {_dna_field(dna, 'tagline') or '—'}
voice: {_dna_field(dna, 'brand_voice') or '—'}
target_audience: {_dna_field(dna, 'target_audience') or '—'}
brand_values: {_dna_field(dna, 'brand_values') or '—'}
brand_color_theme: {_dna_field(dna, 'color_theme') or '—'}
keywords: {_dna_field(dna, 'keywords') or '—'}
</brand>

<content_idea>
title: {idea.get('title') or '—'}
hook: {idea.get('hook') or '—'}
angle: {idea.get('angle') or '—'}
</content_idea>

<caption_for_this_post>
{(caption or '—').strip()[:1200]}
</caption_for_this_post>

<trending_themes>
{_truthy_lines(trending_topics or []) or '(none)'}
</trending_themes>

<delivery_context>
platform: {platform or 'instagram'}
brand_palette_to_use: {_join_or_dash(color_choices or [])}
image_style_hint: {image_style_hint or '—'}
</delivery_context>
{product_block}{text_overlay_block}
<task>
Write ONE image-generation prompt (60-110 words) that makes the image
unmistakably reinforce the caption above, in this brand's voice and
palette. Open with the dominant visual subject. Honour the text_overlay
block above exactly. No hashtags, no CTAs.
</task>"""

    @classmethod
    def build(
        cls,
        *,
        user,
        brand,
        idea: dict,
        caption: str,
        platform: str = 'instagram',
        color_choices: list[str] | None = None,
        trending_topics: list[str] | None = None,
        image_style_hint: str = '',
        product_context: dict | None = None,
        with_copy: bool = False,
        copy_text: str = '',
        fallback: str,
    ) -> str:
        """Return an LLM-synthesised image prompt, or `fallback` on any failure."""
        try:
            user_msg = cls._build_user_message(
                brand=brand, idea=idea or {}, caption=caption or '',
                platform=platform, color_choices=color_choices,
                trending_topics=trending_topics,
                image_style_hint=image_style_hint,
                product_context=product_context,
                with_copy=with_copy,
                copy_text=copy_text,
            )

            # Admin-override hook: lets prompt admins rewrite the user message
            # without a code deploy. Falls back to our hand-written one.
            resolved_user_msg, was_override = resolve_prompt(
                user, cls.PROMPT_TYPE, user_msg,
                {
                    'brand_name': getattr(brand, 'brand_name', '') or '',
                    'caption': caption or '',
                    'platform': platform or '',
                },
                return_meta=True,
            )

            service = get_llm_service(user)
            t0 = _time.monotonic()
            result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': IMAGE_SYSTEM_PROMPT},
                    {'role': 'user', 'content': resolved_user_msg},
                ],
                temperature=0.5,
                max_tokens=600,
            )
            latency_ms = int((_time.monotonic() - t0) * 1000)

            save_execution(
                user, cls.PROMPT_TYPE,
                f"SYSTEM:\n{IMAGE_SYSTEM_PROMPT}\n\nUSER:\n{resolved_user_msg}",
                response_received=(result.content if result and result.success else ''),
                was_override=was_override,
                model_used=getattr(result, 'model', '') or '',
                tokens_in=getattr(result, 'input_tokens', 0) or 0,
                tokens_out=getattr(result, 'output_tokens', 0) or 0,
                latency_ms=latency_ms,
                success=bool(result and result.success),
                error_message=(result.error or '') if result else '',
                brand=brand,
            )

            if result and result.success and (result.content or '').strip():
                return result.content.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning('ImageVisualPromptBuilder failed: %s', exc)
        return fallback


# ──────────────────────────────────────────────────────────────────────
# Video builder
# ──────────────────────────────────────────────────────────────────────


VIDEO_SYSTEM_PROMPT = (
    "You are a senior creative director writing video generation prompts "
    "for Google Veo. You receive the user's seed idea (what they want to "
    "make), the brand DNA (who they are), one content idea (a creative "
    "angle), and trending themes.\n\n"
    "Synthesise these into ONE rich 80-130 word prompt that:\n"
    "1. Preserves the user's seed idea as the central subject — what they "
    "typed is the story; everything else is supporting context.\n"
    "2. Layers brand voice and visual identity (colour, mood, style).\n"
    "3. Includes 1-2 specific motion or shot cues (e.g., 'slow dolly in', "
    "'handheld follow shot', 'static medium close-up').\n"
    "4. Opens with the dominant visual subject so Veo commits to a focal "
    "point.\n\n"
    "Do NOT add music cues, hashtags, CTAs, platform names, or "
    "'no text' instructions (those are handled downstream). Output the "
    "prompt and nothing else."
)


class VideoVisualPromptBuilder:
    """Synthesise a rich video prompt from magic-mode context.

    Unlike the image builder, the user's typed seed prompt is the *primary*
    subject; the brand DNA, idea, and trending themes are layered on top.
    """

    PROMPT_TYPE = 'visual_prompt_video'

    @staticmethod
    def _build_user_message(
        *,
        brand,
        user_prompt: str,
        idea: dict | None,
        trending_topics: list[str] | None,
        has_reference_image: bool,
    ) -> str:
        dna = (getattr(brand, 'brand_dna', None) or {}) if brand else {}
        idea = idea or {}

        ref_note = ''
        if has_reference_image:
            ref_note = (
                "\nNOTE: A real product photo will be composited into the "
                "centre of this video. Treat your prompt as the BACKGROUND "
                "/ setting — keep the centre clear for the product. Do NOT "
                "describe the product itself.\n"
            )

        dna_products = _dna_field(dna, 'products_services')
        products_section = ''
        if not has_reference_image and dna_products:
            products_section = (
                f"\n<key_products>\n{dna_products[:400]}\n</key_products>\n"
                f"INSTRUCTION: Feature or represent this product/service visually — "
                f"not a generic scene.\n"
            )

        return f"""<user_seed_prompt>
{(user_prompt or '—').strip()[:1000]}
</user_seed_prompt>

<brand>
name: {_dna_field(dna, 'brand_name') or (getattr(brand, 'brand_name', '') or '—')}
industry: {_dna_field(dna, 'industry') or (getattr(brand, 'industry', '') or '—')}
voice: {_dna_field(dna, 'brand_voice') or '—'}
target_audience: {_dna_field(dna, 'target_audience') or '—'}
brand_values: {_dna_field(dna, 'brand_values') or '—'}
brand_color_theme: {_dna_field(dna, 'color_theme') or '—'}
</brand>{products_section}

<creative_idea>
title: {idea.get('title') or '—'}
hook: {idea.get('hook') or '—'}
angle: {idea.get('angle') or '—'}
</creative_idea>

<trending_themes>
{_truthy_lines(trending_topics or []) or '(none)'}
</trending_themes>
{ref_note}
<task>
Write ONE video-generation prompt (80-130 words). The user's seed prompt
above is the central subject — preserve its intent and key nouns. Layer
brand voice and a 1-2 word motion/shot cue. Open with the dominant
visual subject. No hashtags, no CTAs, no 'no text' instructions.
</task>"""

    @classmethod
    def build(
        cls,
        *,
        user,
        brand,
        user_prompt: str,
        idea: dict | None = None,
        trending_topics: list[str] | None = None,
        has_reference_image: bool = False,
        fallback: str,
    ) -> str:
        """Return an LLM-synthesised video prompt, or `fallback` on any failure."""
        try:
            user_msg = cls._build_user_message(
                brand=brand, user_prompt=user_prompt or '',
                idea=idea, trending_topics=trending_topics,
                has_reference_image=has_reference_image,
            )

            resolved_user_msg, was_override = resolve_prompt(
                user, cls.PROMPT_TYPE, user_msg,
                {
                    'brand_name': getattr(brand, 'brand_name', '') or '',
                    'user_prompt': user_prompt or '',
                },
                return_meta=True,
            )

            service = get_llm_service(user)
            t0 = _time.monotonic()
            result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': VIDEO_SYSTEM_PROMPT},
                    {'role': 'user', 'content': resolved_user_msg},
                ],
                temperature=0.5,
                max_tokens=600,
            )
            latency_ms = int((_time.monotonic() - t0) * 1000)

            save_execution(
                user, cls.PROMPT_TYPE,
                f"SYSTEM:\n{VIDEO_SYSTEM_PROMPT}\n\nUSER:\n{resolved_user_msg}",
                response_received=(result.content if result and result.success else ''),
                was_override=was_override,
                model_used=getattr(result, 'model', '') or '',
                tokens_in=getattr(result, 'input_tokens', 0) or 0,
                tokens_out=getattr(result, 'output_tokens', 0) or 0,
                latency_ms=latency_ms,
                success=bool(result and result.success),
                error_message=(result.error or '') if result else '',
                brand=brand,
            )

            if result and result.success and (result.content or '').strip():
                return result.content.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning('VideoVisualPromptBuilder failed: %s', exc)
        return fallback
