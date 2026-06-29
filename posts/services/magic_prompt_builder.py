"""Unified caption + AI image/video prompt generator for the Magic Link pipeline.

Replaces the separate captionService + visualPromptService calls with a single
Claude Opus agent that reads ALL context (brand DNA, Q&A answers, trending topics,
idea) and returns a coherent {caption, hashtags, prompt} triple where the image
perfectly illustrates the caption.
"""
from __future__ import annotations

import logging
from typing import Any

from accounts.services.llm_service import get_llm_service, extract_json_object

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an expert social media content strategist and AI image/video prompt engineer.
You receive complete brand intelligence, user context, and a content idea.
You output TWO things simultaneously — a social caption AND a visual generation prompt —
written as a coherent pair where the image/video perfectly illustrates the caption.

Rules:
- Caption: platform-native length, matches the specified tone, engaging and authentic,
  no AI clichés ("dive into", "unleash", "game-changer", etc.). Reference the idea
  and brand. End with a blank line then 3-5 relevant hashtags.
- Prompt: 60-110 words for image, 80-130 words for video. Open with the dominant
  visual subject. Honour brand visual DNA. Be specific about lighting, composition,
  colour palette. No vague filler words.
- Both must feel like they were designed together — same mood, same subject, same moment.
- Return ONLY valid JSON with no markdown fences or extra text:
  {"caption": "...", "hashtags": ["tag1", "tag2", ...], "prompt": "..."}\
"""


def _dna_field(dna: dict, key: str) -> str:
    val = dna.get(key, '')
    if isinstance(val, list):
        return ', '.join(str(v) for v in val if v)
    return str(val).strip() if val else ''


class MagicPromptBuilder:

    @classmethod
    def build(
        cls,
        *,
        user,
        brand,
        idea: dict,
        platform: str,
        tone: str,
        questions_answers: dict,
        trending_topics: list,
        color_choices: list | None = None,
        product_context: dict | None = None,
        has_product_image: bool = False,
        with_copy: bool = False,
        overlay_text: str = '',
        content_type: str = 'image',
        fallback_caption: str = '',
        fallback_prompt: str = '',
    ) -> dict:
        """Return {'caption': str, 'hashtags': list[str], 'prompt': str}.

        On any failure returns the fallback values so the pipeline never blocks.
        """
        try:
            dna: dict = getattr(brand, 'brand_dna', None) or {}

            user_msg = cls._build_user_message(
                dna=dna,
                idea=idea,
                platform=platform,
                tone=tone,
                questions_answers=questions_answers,
                trending_topics=trending_topics,
                color_choices=color_choices or [],
                product_context=product_context,
                has_product_image=has_product_image,
                with_copy=with_copy,
                overlay_text=overlay_text,
                content_type=content_type,
            )

            service = get_llm_service(user)
            result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': _SYSTEM_PROMPT},
                    {'role': 'user', 'content': user_msg},
                ],
                model='claude-opus-4-8',
                temperature=0.4,
                max_tokens=2000,
                thinking_budget=8000,
            )

            if not result.success:
                logger.warning('[MagicPromptBuilder] LLM call failed: %s', result.error)
                return cls._fallback(fallback_caption, fallback_prompt)

            data = extract_json_object(result.content)
            if not isinstance(data, dict):
                logger.warning('[MagicPromptBuilder] Could not parse JSON from response')
                return cls._fallback(fallback_caption, fallback_prompt)

            caption = str(data.get('caption') or fallback_caption).strip()
            hashtags_raw = data.get('hashtags') or []
            hashtags = [str(h).strip().lstrip('#') for h in hashtags_raw if h]
            prompt = str(data.get('prompt') or fallback_prompt).strip()

            return {'caption': caption, 'hashtags': hashtags, 'prompt': prompt}

        except Exception as exc:
            logger.error('[MagicPromptBuilder] Unexpected error: %s', exc, exc_info=True)
            return cls._fallback(fallback_caption, fallback_prompt)

    @staticmethod
    def _fallback(caption: str, prompt: str) -> dict:
        return {'caption': caption, 'hashtags': [], 'prompt': prompt}

    @classmethod
    def _build_user_message(
        cls,
        *,
        dna: dict,
        idea: dict,
        platform: str,
        tone: str,
        questions_answers: dict,
        trending_topics: list,
        color_choices: list,
        product_context: dict | None,
        has_product_image: bool,
        with_copy: bool,
        overlay_text: str,
        content_type: str,
    ) -> str:
        is_video = content_type == 'video'
        prompt_word_range = '80-130' if is_video else '60-110'
        media_type = 'video' if is_video else 'image'
        camera_instruction = (
            'Include 1-2 Veo camera movement cues (e.g. dolly in, crane up, slow pan).'
            if is_video else ''
        )

        # --- brand DNA block ---
        dna_lines = [
            f"name: {_dna_field(dna, 'brand_name') or _dna_field(dna, 'name')}",
            f"industry: {_dna_field(dna, 'industry')}",
            f"tagline: {_dna_field(dna, 'tagline')}",
            f"description: {_dna_field(dna, 'description')}",
            f"products_services: {_dna_field(dna, 'products_services')}",
            f"target_audience: {_dna_field(dna, 'target_audience')}",
            f"brand_voice: {_dna_field(dna, 'brand_voice')}",
            f"brand_values: {_dna_field(dna, 'brand_values')}",
            f"unique_selling_points: {_dna_field(dna, 'unique_selling_points')}",
            f"color_theme: {_dna_field(dna, 'color_theme')}",
            f"keywords: {_dna_field(dna, 'keywords')}",
        ]
        # Visual DNA (from deep crawl — highest fidelity)
        for vis_field in ('visual_style', 'color_palette_hex', 'visual_mood', 'photography_style', 'image_subjects'):
            val = _dna_field(dna, vis_field)
            if val:
                dna_lines.append(f"{vis_field}: {val}")

        dna_block = '\n'.join(dna_lines)

        # --- user context block ---
        qa = questions_answers or {}
        platforms_val = qa.get('platforms', platform)
        if isinstance(platforms_val, list):
            platforms_val = ', '.join(str(p) for p in platforms_val)
        colors_val = ', '.join(str(c) for c in color_choices) if color_choices else qa.get('colors', '—')

        user_ctx = (
            f"business_type: {qa.get('industry', '—')}\n"
            f"main_goal: {qa.get('goal', '—')}\n"
            f"desired_tone: {qa.get('tone', tone)}\n"
            f"platforms: {platforms_val}\n"
            f"brand_colors: {colors_val}\n"
            f"include_text_overlay: {with_copy}"
        )

        # --- idea block ---
        idea_block = (
            f"title: {idea.get('title', '')}\n"
            f"hook: {idea.get('hook', '')}\n"
            f"angle: {idea.get('angle', '')}\n"
            f"platform: {platform}"
        )

        # --- trending block ---
        if trending_topics:
            trending_lines = '\n'.join(f'- {t}' for t in trending_topics)
        else:
            trending_lines = '(none)'

        # --- product / overlay conditional blocks ---
        product_block = ''
        if has_product_image and product_context:
            product_block = (
                '\n<product_image>\n'
                'A real product photo will be composited into the generated visual.\n'
                f"Product type: {product_context.get('product_type', '')}\n"
                f"Features: {product_context.get('features', '')}\n"
                f"Background style: {product_context.get('background_style', 'clean')}\n"
                'CRITICAL: The visual prompt MUST describe a background/setting ONLY.\n'
                'Keep the CENTRE of the scene EMPTY — the product will be placed there.\n'
                'Do NOT describe or draw the product itself.\n'
                '</product_image>'
            )

        overlay_block = ''
        if with_copy and overlay_text:
            overlay_block = (
                '\n<text_overlay>\n'
                f'The following text MUST appear on the {media_type} with PREMIUM graphic-design quality:\n'
                f'"{overlay_text}"\n\n'
                f'Typography specification (describe ALL of these in the visual prompt):\n'
                f'- Font: Bold extended sans-serif (Futura Bold / DIN Bold / Bebas Neue style), ALL-CAPS\n'
                f'- Letter-spacing: Wide tracking — generous breathing room between letters\n'
                f'- Color: Pure white (#FFFFFF)\n'
                f'- Background: Semi-transparent dark gradient scrim behind the text zone\n'
                f'  (black at 60–70% opacity, feathered/fading edges — not a hard-edged box)\n'
                f'- Shadow: Soft 2–3px drop shadow in black at 30% opacity for depth\n'
                f'- Position: Upper-center of the {media_type}, with 15–20% padding from edges\n'
                f'- The area behind the text must be kept visually simple/dark so the text pops\n'
                f'Quality reference: premium food delivery app promotional banner (Deliveroo / Uber Eats campaign standard)\n'
                f'The text must be PERFECTLY legible, correctly spelled, and look like it was designed\n'
                f'by a senior art director. This is the hero element of the composition.\n'
                '</text_overlay>'
            )
        elif not with_copy:
            overlay_block = (
                '\n<text_overlay>\n'
                f'NO text, typography, letters, numbers, or watermarks of any kind in the {media_type}.\n'
                'State this explicitly in the visual prompt.\n'
                '</text_overlay>'
            )

        # --- assemble ---
        msg = (
            f'<brand_dna>\n{dna_block}\n</brand_dna>\n\n'
            f'<user_context>\n{user_ctx}\n</user_context>\n\n'
            f'<content_idea>\n{idea_block}\n</content_idea>\n\n'
            f'<trending_topics>\n{trending_lines}\n</trending_topics>'
            f'{product_block}'
            f'{overlay_block}\n\n'
            f'<output_task>\n'
            f'Generate for a {platform} post:\n\n'
            f'1. caption — {platform}-native caption in "{tone}" tone. Engaging, authentic, '
            f'no AI clichés. Reference the idea and the brand. '
            f'End with a blank line then 3-5 relevant hashtags.\n'
            f'2. hashtags — the same hashtags as a JSON array (without # prefix).\n'
            f'3. prompt — {prompt_word_range}-word {media_type} generation prompt. '
            f'Open with the dominant visual subject. Honour brand visual DNA (use actual hex '
            f'colors if color_palette_hex is provided). Be specific about lighting, '
            f'composition, atmosphere. {camera_instruction}\n\n'
            f'Return ONLY: {{"caption": "...", "hashtags": [...], "prompt": "..."}}\n'
            f'</output_task>'
        )
        return msg
