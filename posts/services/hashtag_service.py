"""
Hashtag Generation Service
- LLM-based generation with 30/40/30 tier ratio (high/mid/niche)
- Banned hashtag filtering
- Platform-specific count limits
"""
import json
import logging

from accounts.services.llm_service import get_llm_service, UnifiedLLMService

from posts.models import PostHashtag, BannedHashtag

logger = logging.getLogger(__name__)

# Platform hashtag limits
PLATFORM_LIMITS = {
    'instagram': 20,
    'linkedin': 5,
    'twitter': 3,
    'facebook': 3,
}


def generate_hashtags(
    post, platform,
    api_key=None, count=None, topic=None,
    override_prompt=None, user=None, think_harder=False,
    idea=None,
    trending_topics=None,
    product_context=None,
):
    """Generate hashtags for a post using LLM with tier distribution.

    Args:
        idea: optional dict {'title','hook','angle'} — the content idea this
            post was generated from. Lets the LLM pick tags aligned with the
            strategic angle, not just the caption.
        trending_topics: optional list[str] — the trending themes that
            anchored the idea, so the chosen tags can ride a current wave.
        product_context: optional dict {'product_type','features',
            'background_style'} — passed when the post features a real
            product, so tags can reflect the product category.

    Returns tuple of (list of created PostHashtag objects, used_prompt string).
    """
    # Build the LLM service: prefer user-based, fall back to raw key
    if user:
        service = get_llm_service(user)
    elif api_key:
        service = UnifiedLLMService(openai_key=api_key)
    else:
        logger.warning("No API key or user available for hashtag generation")
        return [], ''

    # Determine count based on platform defaults
    if count is None:
        count = PLATFORM_LIMITS.get(platform, 10)

    # Get banned hashtags for this brand
    banned_tags = set()
    if post.brand:
        banned_tags = set(
            BannedHashtag.objects.filter(brand=post.brand).values_list('tag', flat=True)
        )

    # Build context for LLM
    caption_text = post.caption or ''
    brand_context = ''
    if post.brand:
        brand_context = f"Brand: {post.brand.brand_name}, Industry: {post.brand.industry or 'general'}"
    if post.pillar:
        brand_context += f", Content Pillar: {post.pillar.name}"

    # Media context — describe the visual asset so hashtags reflect image/video themes.
    media_context = ''
    try:
        media_list = post.media_files_list or []
    except Exception:
        media_list = []
    if media_list:
        video_exts = ('.mp4', '.webm', '.mov', '.ogg', '.m4v')
        media_lines = []
        for idx, m in enumerate(media_list[:4]):
            if not isinstance(m, str):
                continue
            lower = m.lower().split('?')[0].split('#')[0]
            media_type = 'video' if lower.endswith(video_exts) or 'video' in lower else 'image'
            # Keep filename hint short — full data URLs are useless for hashtag context.
            hint = m if not m.startswith('data:') else f'{media_type} (inline data)'
            if len(hint) > 200:
                hint = hint[-200:]
            media_lines.append(f"- {media_type}: {hint}")
        if media_lines:
            media_context = "Attached media (use the visual subject matter when picking hashtags):\n" + "\n".join(media_lines)

    # Strategic context — the idea this post was built on, the trending
    # themes it rides, and any product details. Lets the LLM pick tags that
    # span all four signals (idea + trending + product + caption) instead
    # of relying on caption keywords alone.
    idea_block = ''
    if idea:
        idea_block = (
            "Content idea (the strategic angle behind this post):\n"
            f"- title: {idea.get('title') or '—'}\n"
            f"- hook:  {idea.get('hook') or '—'}\n"
            f"- angle: {idea.get('angle') or '—'}"
        )

    trending_block = ''
    if trending_topics:
        bullets = '\n'.join(f"- {str(t).strip()}" for t in trending_topics if str(t).strip())
        if bullets:
            trending_block = "Trending themes the idea is anchored on:\n" + bullets

    product_block = ''
    if product_context:
        product_block = (
            "Product featured in this post:\n"
            f"- product_type: {product_context.get('product_type') or '—'}\n"
            f"- features:     {product_context.get('features') or '—'}\n"
            f"- background:   {product_context.get('background_style') or '—'}"
        )

    high_count = int(count * 0.3)
    mid_count = int(count * 0.4)
    niche_count = count - high_count - mid_count

    prompt = f"""<task>
Generate exactly {count} hashtags for a {platform} post using a 3-tier volume distribution strategy.
</task>

<context>
Brand: {brand_context}
Caption: {caption_text[:500]}
{f'Topic: {topic}' if topic else ''}
{media_context}
{idea_block}
{trending_block}
{product_block}
</context>

<tier_distribution>
| Tier | Count | Volume Target |
|------|-------|---------------|
| high_volume | {high_count} | 100k+ posts |
| mid_volume | {mid_count} | 10k-100k posts |
| niche | {niche_count} | <10k posts |
</tier_distribution>

<instructions>
1. Analyze ALL of these signals together — the caption text, the content idea (title/hook/angle),
   the trending themes the idea is riding, the product (if any), AND the attached media. Your
   tag selection must reflect the full strategic context, not just keyword matches from the caption.
2. Pick tags that span multiple signals: e.g. at least one tag should reflect the idea's angle,
   at least one a trending theme (when listed), and at least one the product category (when present).
3. Distribute across volume tiers as specified.
4. Return WITHOUT the # symbol.
</instructions>

<output_format>
{{
  "hashtags": [
    {{
      "tag": "<hashtag without #>",
      "tier": "<high_volume | mid_volume | niche>",
      "estimated_volume": <number>
    }}
  ]
}}
</output_format>

<constraints>
- Exactly {count} hashtags total.
- No # symbol in tag values.
- EXCLUDE these banned hashtags: {', '.join(banned_tags) if banned_tags else 'none'}
- Platform limits: instagram=20, linkedin=5, twitter=3, facebook=3.
- Return valid JSON only.
</constraints>"""

    if override_prompt:
        prompt = override_prompt

    try:
        messages = [
            {"role": "system", "content": "You are a social media growth strategist who engineers hashtag strategies for maximum discoverability. You understand that hashtag strategy is not just about relevance — it's about strategic placement across volume tiers to balance reach (high-volume) with discoverability (niche).\n\nYour approach:\n- High-volume tags (100k+ posts): Cast a wide net, ride popular conversations\n- Mid-volume tags (10k-100k): Sweet spot for appearing in top posts\n- Niche tags (<10k): Low competition, high chance of ranking at top\n\nYou never suggest banned, spam-flagged, or irrelevant hashtags.\n\nReturn ONLY valid JSON — no markdown, no commentary."},
            {"role": "user", "content": prompt}
        ]

        result = service.chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2000 if think_harder else 1500,
            response_format={"type": "json_object"},
            thinking_budget=10000 if think_harder else 0,
        )

        if not result.success:
            raise Exception(result.error)

        result_text = result.content
        parsed = json.loads(result_text)
        hashtags_data = parsed.get('hashtags', [])

    except Exception as e:
        logger.error(f"Hashtag generation failed: {e}")
        return [], prompt

    # Clear existing hashtags for this platform
    PostHashtag.objects.filter(post=post, platform=platform).delete()

    # Create hashtag objects
    created = []
    for item in hashtags_data:
        tag = item.get('tag', '').strip().lstrip('#').lower()
        if not tag or tag in banned_tags:
            continue

        ht = PostHashtag.objects.create(
            post=post,
            platform=platform,
            tag=tag,
            tier=item.get('tier', 'mid_volume'),
            estimated_volume=item.get('estimated_volume', 0),
            is_selected=True,
        )
        created.append(ht)

    # Update post checklist
    post.update_checklist()
    return created, prompt
