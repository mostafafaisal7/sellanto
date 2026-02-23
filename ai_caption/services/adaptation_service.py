"""
Caption Adaptation Service
- Platform-specific copy adaptation
- Character limit enforcement
- Tone adaptation per platform
"""
import openai
import json
import logging

from posts.models import PostCaption

logger = logging.getLogger(__name__)

PLATFORM_GUIDELINES = {
    'twitter': {
        'max_chars': 280,
        'tone': 'concise, punchy, conversational',
        'notes': 'Use short sentences. Thread if needed. Hashtags inline.',
    },
    'linkedin': {
        'max_chars': 3000,
        'tone': 'professional, insightful, thought-leadership',
        'notes': 'Use line breaks for readability. Lead with a hook. End with a CTA or question.',
    },
    'facebook': {
        'max_chars': 63206,
        'tone': 'casual, conversational, community-oriented',
        'notes': 'Use emojis sparingly. Ask questions to drive engagement. Keep under 250 chars for best reach.',
    },
    'instagram': {
        'max_chars': 2200,
        'tone': 'visual, authentic, storytelling',
        'notes': 'Front-load the hook. Use line breaks. Hashtags in first comment or end. Include CTAs.',
    },
}


def adapt_caption(source_caption, target_platform, api_key, brand=None):
    """Adapt a caption for a specific platform.

    Returns the adapted PostCaption object.
    """
    if not api_key:
        # Fallback: simple truncation
        return _simple_adapt(source_caption, target_platform)

    guidelines = PLATFORM_GUIDELINES.get(target_platform, PLATFORM_GUIDELINES['facebook'])

    brand_context = ''
    if brand:
        brand_context = f"Brand voice: {brand.voice_tone or 'professional'}"

    prompt = f"""Adapt this caption for {target_platform}.

Original caption:
{source_caption.body}

Platform guidelines:
- Max characters: {guidelines['max_chars']}
- Tone: {guidelines['tone']}
- Notes: {guidelines['notes']}
{brand_context}

Rules:
- Keep the core message intact
- Adapt tone and length for the platform
- Stay within character limit
- If the original has a CTA, adapt it for the platform

Return JSON:
{{"adapted_body": "...", "cta_text": "..."}}
"""

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a social media copywriter. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        body = result.get('adapted_body', source_caption.body)
        cta = result.get('cta_text', source_caption.cta_text)

    except Exception as e:
        logger.error(f"Caption adaptation failed: {e}")
        return _simple_adapt(source_caption, target_platform)

    # Enforce character limit
    max_chars = guidelines['max_chars']
    if len(body) > max_chars:
        body = body[:max_chars - 3] + '...'

    adapted = PostCaption.objects.create(
        post=source_caption.post,
        platform=target_platform,
        variant_number=source_caption.variant_number,
        body=body,
        cta_text=cta,
        tone=guidelines['tone'].split(',')[0].strip(),
    )

    source_caption.post.update_checklist()
    return adapted


def _simple_adapt(source_caption, target_platform):
    """Fallback adaptation with simple truncation."""
    guidelines = PLATFORM_GUIDELINES.get(target_platform, {})
    max_chars = guidelines.get('max_chars', 5000)
    body = source_caption.body

    if len(body) > max_chars:
        body = body[:max_chars - 3] + '...'

    adapted = PostCaption.objects.create(
        post=source_caption.post,
        platform=target_platform,
        variant_number=source_caption.variant_number,
        body=body,
        cta_text=source_caption.cta_text,
        tone=source_caption.tone,
    )
    return adapted
