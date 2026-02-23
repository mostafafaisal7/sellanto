"""
Hashtag Generation Service
- LLM-based generation with 30/40/30 tier ratio (high/mid/niche)
- Banned hashtag filtering
- Platform-specific count limits
"""
import openai
import json
import logging

from posts.models import PostHashtag, BannedHashtag

logger = logging.getLogger(__name__)

# Platform hashtag limits
PLATFORM_LIMITS = {
    'instagram': 20,
    'linkedin': 5,
    'twitter': 3,
    'facebook': 3,
}


def generate_hashtags(post, platform, api_key, count=None, topic=None):
    """Generate hashtags for a post using LLM with tier distribution.

    Returns list of created PostHashtag objects.
    """
    if not api_key:
        logger.warning("No OpenAI API key available for hashtag generation")
        return []

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

    prompt = f"""Generate exactly {count} hashtags for a {platform} post.

Context:
{brand_context}
Caption: {caption_text[:500]}
{f'Topic: {topic}' if topic else ''}

Rules:
- Return hashtags WITHOUT the # symbol
- Organize into three tiers:
  * high_volume ({int(count * 0.3)} tags): Popular, broad reach hashtags (100k+ posts)
  * mid_volume ({int(count * 0.4)} tags): Moderately popular, relevant hashtags (10k-100k posts)
  * niche ({count - int(count * 0.3) - int(count * 0.4)} tags): Specific, low-competition hashtags (<10k posts)
- Banned hashtags to EXCLUDE: {', '.join(banned_tags) if banned_tags else 'none'}

Return JSON format:
{{"hashtags": [{{"tag": "hashtagname", "tier": "high_volume|mid_volume|niche", "estimated_volume": 50000}}]}}
"""

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a social media hashtag expert. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )

        result_text = response.choices[0].message.content
        result = json.loads(result_text)
        hashtags_data = result.get('hashtags', [])

    except Exception as e:
        logger.error(f"Hashtag generation failed: {e}")
        return []

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
    return created
