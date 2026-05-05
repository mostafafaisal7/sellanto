"""Per-user Magic Mode prompt override resolver.

Each Magic Mode prompt call site builds its default text as an f-string AND a
plain `vars_dict` of the same variables. It then routes through `resolve_prompt`
which looks up an active `UserPromptOverride` row. If found, it renders the
admin-edited template via `.format(**vars_dict)`. Any error (missing variable,
malformed template) silently falls back to the default and is logged so admins
can see what went wrong.

Usage at a call site:
    from accounts.services.prompt_resolver import resolve_prompt

    default_system = f"You are a strategist for {brand.brand_name}..."
    vars_dict = {'brand_name': brand.brand_name, 'industry': brand.industry, ...}
    system_prompt = resolve_prompt(
        request.user, 'idea_system', default_system, vars_dict
    )
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# Variable schema per prompt type.
# Used by the admin UI to (a) show available {variable} chips next to the
# editor and (b) warn the admin when a saved override is missing a variable
# the runtime expects. The runtime does NOT enforce these — soft-fail wins.
PROMPT_SCHEMA: dict[str, list[str]] = {
    'idea_system': [],  # System prompt for idea generation has no interpolation
    'idea_user': [
        'brand_name', 'industry', 'target_region', 'platform_text',
        'pillar_context', 'specific_pillar_line', 'dna_context',
        'competitor_context', 'trending_context', 'learning_context',
        'count',
    ],
    'caption_system': [
        'tone_description', 'platform_guidelines',
        'emoji_setting', 'cta_setting', 'hashtag_setting',
    ],
    'image_refiner': [
        'context_block', 'user_prompt',
    ],
    'brand_dna': [
        'existing_dna', 'website_url', 'website_content',
    ],
    'video_prompt': [
        'user_prompt', 'brand_name', 'industry', 'voice_tone',
        'visual_style', 'mood', 'primary_color', 'color_palette',
        'lighting', 'temperature',
    ],
}


def resolve_prompt(
    user: Any,
    prompt_type: str,
    default_text: str,
    vars_dict: dict[str, Any] | None = None,
) -> str:
    """Return user's override (rendered) if active, else `default_text`.

    Soft-fail: any exception during override formatting falls back to the
    default and is logged via `logger.warning`. The default is returned
    already-rendered (call sites build it via f-string), so `vars_dict` is
    only needed when an override exists.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        return default_text

    try:
        # Local import to avoid model-loading import cycles.
        from accounts.models import UserPromptOverride
        override = (
            UserPromptOverride.objects
            .filter(user=user, prompt_type=prompt_type, is_active=True)
            .first()
        )
        if override is None:
            return default_text
        if not vars_dict:
            return override.prompt_text
        return override.prompt_text.format(**vars_dict)
    except KeyError as missing:
        logger.warning(
            'prompt_override fallback (missing var) user=%s type=%s missing=%s',
            getattr(user, 'id', None), prompt_type, missing,
        )
        return default_text
    except Exception as exc:  # noqa: BLE001 — fall back on any error
        logger.warning(
            'prompt_override fallback user=%s type=%s err=%s',
            getattr(user, 'id', None), prompt_type, exc,
        )
        return default_text


def get_default_preview(prompt_type: str) -> str:
    """Static preview snippets shown in the admin UI when no override exists.

    These are NOT used at runtime — the actual default at each call site is
    interpolated dynamically. These are documentation strings so admins
    have a sense of what the default does. Keep them short.
    """
    return _DEFAULT_PREVIEWS.get(prompt_type, '(no preview)')


_DEFAULT_PREVIEWS: dict[str, str] = {
    'idea_system': (
        'You are a senior social media strategist and creative director who generates '
        'content ideas that are specific, actionable, and strategically grounded...'
    ),
    'idea_user': (
        '<context>\nBrand: "{brand_name}"\nIndustry: {industry}\n'
        'Region: {target_region}\nPlatform(s): {platform_text}\n'
        'Content pillars: {pillar_context}\n...\n</context>\n\n'
        '<instructions>\nGenerate exactly {count} content ideas...\n</instructions>'
    ),
    'caption_system': (
        '<role>\nYou are an elite social media content creator and conversion '
        'copywriter...\n</role>\n\n<current_style>\nWriting style: '
        '{tone_description}\n</current_style>\n\n<platform_guidelines>\n'
        '{platform_guidelines}\n</platform_guidelines>'
    ),
    'image_refiner': (
        'You are an expert at crafting concise image generation prompts...\n\n'
        'Brand context:\n{context_block}\n\n'
        "User's image direction: {user_prompt}"
    ),
    'brand_dna': (
        '<task>\nEnhance the existing Brand DNA using website content...\n</task>\n\n'
        '<existing_dna>\n{existing_dna}\n</existing_dna>\n\n'
        '<website_data>\nURL: {website_url}\nContent: {website_content}\n</website_data>'
    ),
    'video_prompt': (
        '{user_prompt}\n\nVisual Style: {visual_style}\nBrand Color: {primary_color}\n'
        'Lighting: {lighting}\nMood: {mood}, {voice_tone}'
    ),
}
