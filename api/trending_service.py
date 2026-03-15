"""
Trending topic generation service using pytrends (Google Trends) + unified LLM service.
Fetches REAL-TIME trending data from Google Trends and uses Claude to filter/rank
by brand relevance.
"""
import json
import logging
import time
from datetime import timedelta, date

from django.utils import timezone

logger = logging.getLogger(__name__)


def _fetch_google_trends(keywords, geo='', brand_industry=''):
    """
    Fetch real-time trending data from Google Trends using pytrends.
    Returns list of {topic, score, source} dicts.
    """
    all_trends = []

    try:
        from pytrends.request import TrendReq
        pytrend = TrendReq(hl='en-US', tz=360, timeout=(10, 25))

        # 1. Get daily trending searches for the region
        try:
            region = geo if geo else 'united_states'
            daily_trends = pytrend.trending_searches(pn=region.lower())
            if daily_trends is not None and not daily_trends.empty:
                for _, row in daily_trends.head(20).iterrows():
                    topic = str(row.values[0]) if hasattr(row, 'values') else str(row)
                    if topic and topic != 'nan':
                        all_trends.append({
                            'topic': topic,
                            'score': 90,
                            'source': 'daily_trending',
                        })
            logger.info(f"Daily trending: {len(all_trends)} topics for region={region}")
        except Exception as e:
            logger.warning(f"Daily trending searches failed: {e}")

        # 2. Related queries for brand keywords (batches of 5)
        for i in range(0, min(len(keywords), 15), 5):
            batch = keywords[i:i + 5]
            if not batch:
                break
            try:
                pytrend.build_payload(batch, timeframe='now 7-d', geo=geo)
                related = pytrend.related_queries()
                for kw_name, data in related.items():
                    if data.get('rising') is not None and not data['rising'].empty:
                        for _, row in data['rising'].head(8).iterrows():
                            all_trends.append({
                                'topic': str(row['query']),
                                'score': min(float(row.get('value', 50)), 1000),
                                'source': 'rising',
                            })
                    if data.get('top') is not None and not data['top'].empty:
                        for _, row in data['top'].head(5).iterrows():
                            all_trends.append({
                                'topic': str(row['query']),
                                'score': float(row.get('value', 50)),
                                'source': 'top',
                            })
                time.sleep(1)  # Rate limit
            except Exception as e:
                logger.warning(f"Related queries failed for {batch}: {e}")

        # 3. Interest over time for seasonal/event keywords relevant to brand
        seasonal_keywords = _build_seasonal_keywords(brand_industry)
        if seasonal_keywords:
            try:
                pytrend.build_payload(seasonal_keywords[:5], timeframe='now 7-d', geo=geo)
                related = pytrend.related_queries()
                for kw_name, data in related.items():
                    if data.get('rising') is not None and not data['rising'].empty:
                        for _, row in data['rising'].head(5).iterrows():
                            all_trends.append({
                                'topic': str(row['query']),
                                'score': min(float(row.get('value', 50)), 1000),
                                'source': 'seasonal_rising',
                            })
            except Exception as e:
                logger.warning(f"Seasonal queries failed: {e}")

    except ImportError:
        logger.info("pytrends not installed — pip install pytrends")
    except Exception as e:
        logger.warning(f"pytrends initialization failed: {e}")

    # Deduplicate
    seen = set()
    unique = []
    for t in all_trends:
        low = t['topic'].lower().strip()
        if low and low not in seen and low != 'nan':
            seen.add(low)
            unique.append(t)

    logger.info(f"Total unique Google Trends: {len(unique)}")
    return unique[:60]


def _build_seasonal_keywords(industry=''):
    """Build seasonal search keywords based on current date + industry."""
    today = date.today()
    month = today.month
    keywords = []

    # Current month seasonal terms
    month_terms = {
        1: ['new year sale', 'winter fashion'],
        2: ['valentine gifts', 'valentine fashion'],
        3: ['eid collection', 'ramadan sale', 'spring fashion', 'women empowerment'],
        4: ['eid ul fitr', 'boishakh', 'spring sale'],
        5: ['summer collection', 'mother day gifts', 'eid al adha'],
        6: ['summer sale', 'father day', 'eid qurban'],
        7: ['summer fashion', 'monsoon sale'],
        8: ['back to school', 'fall preview'],
        9: ['fall fashion', 'autumn collection'],
        10: ['halloween', 'fall sale', 'diwali'],
        11: ['black friday', 'cyber monday', 'winter collection'],
        12: ['christmas sale', 'holiday gifts', 'new year eve'],
    }
    keywords.extend(month_terms.get(month, []))

    # Add industry-specific seasonal terms
    if industry:
        industry_low = industry.lower()
        if any(w in industry_low for w in ['fashion', 'cloth', 'dress', 'apparel', 'e-commerce', 'ecommerce', 'shop']):
            keywords.extend(['trending outfits', f'{_current_season()} fashion trends'])
        elif any(w in industry_low for w in ['food', 'restaurant', 'cafe']):
            keywords.extend(['food trends', 'viral recipes'])
        elif any(w in industry_low for w in ['tech', 'software', 'saas']):
            keywords.extend(['tech trends', 'AI tools'])

    return keywords[:5]


def _current_season():
    month = date.today().month
    if month in (3, 4, 5):
        return 'spring'
    elif month in (6, 7, 8):
        return 'summer'
    elif month in (9, 10, 11):
        return 'fall'
    return 'winter'


def generate_trending_for_brand(brand_id, user, override_prompt=None, think_harder=False):
    """
    Generate trending topics for a brand using real Google Trends data + Claude.

    1. Build search keywords from Brand DNA + Pillars
    2. Fetch REAL trending data from Google Trends (daily trending + related queries)
    3. Use Claude to filter, rank, and contextualize by brand relevance
    4. Save results to TrendingCache
    """
    from brands.models import Brand, TrendingCache, CompetitorInsight

    brand = Brand.objects.get(id=brand_id)
    pillars = brand.content_pillars.filter(is_active=True)

    # --- Step 1: Build keywords from DNA + Pillars ---
    keywords = []
    dna = brand.brand_dna or {}

    if dna.get('keywords'):
        keywords += dna['keywords'][:5]
    if dna.get('content_themes'):
        keywords += dna['content_themes'][:3]
    if dna.get('industry'):
        keywords.append(dna['industry'])

    for p in pillars[:5]:
        keywords.append(p.name)

    # Add brand name and industry
    if brand.brand_name and brand.brand_name not in keywords:
        keywords.insert(0, brand.brand_name)
    if brand.industry and brand.industry not in keywords:
        keywords.append(brand.industry)

    # Deduplicate
    seen = set()
    unique_kw = []
    for kw in keywords:
        low = kw.lower().strip()
        if low and low not in seen:
            seen.add(low)
            unique_kw.append(kw.strip())
    keywords = unique_kw[:15]

    if not keywords:
        keywords = [brand.brand_name, brand.industry]

    # --- Step 2: Resolve geo region ---
    geo = ''
    if brand.target_region:
        region_map = {
            'usa': 'US', 'us': 'US', 'united states': 'US',
            'uk': 'GB', 'united kingdom': 'GB',
            'india': 'IN', 'bangladesh': 'BD',
            'global': '', 'worldwide': '',
        }
        geo = region_map.get(brand.target_region.lower().strip(), '')

    today_str = date.today().strftime('%B %d, %Y')

    # --- Step 3: Fetch REAL Google Trends data ---
    all_trends = _fetch_google_trends(keywords, geo, brand.industry or '')

    logger.info(f"Google Trends returned {len(all_trends)} topics for brand {brand.brand_name}")

    # --- Step 4: Use Claude to filter + rank ---
    from accounts.services.llm_service import get_llm_service
    service = get_llm_service(user)

    if not service._resolve_provider():
        logger.warning(f"No AI API key for user {user.id} — using raw trends fallback")
        return _save_raw_trends(brand, all_trends, keywords, geo)

    try:
        pillar_names = [p.name for p in pillars]
        competitor_insights = CompetitorInsight.objects.filter(
            competitor_profile__brand=brand
        ).order_by('-engagement_score')[:10]
        insight_texts = [ci.hook_text.split(' ||REC||')[0][:100] for ci in competitor_insights]

        # User feedback for learning
        from brands.models import TrendFeedback
        feedback_qs = TrendFeedback.objects.filter(brand=brand)
        accepted_topics = list(feedback_qs.filter(is_accepted=True).values_list('topic_text', flat=True)[:20])
        rejected_topics = list(feedback_qs.filter(is_accepted=False).values_list('topic_text', flat=True)[:20])
        feedback_context = ''
        if accepted_topics:
            feedback_context += f"\n\n═══ USER FEEDBACK — ACCEPTED TOPICS (generate MORE like these) ═══\n{chr(10).join(f'- {t}' for t in accepted_topics)}"
        if rejected_topics:
            feedback_context += f"\n\n═══ USER FEEDBACK — REJECTED TOPICS (AVOID these and similar topics) ═══\n{chr(10).join(f'- {t}' for t in rejected_topics)}"

        # Format trends by source
        daily_trending = [t['topic'] for t in all_trends if t['source'] == 'daily_trending']
        rising_queries = [t['topic'] for t in all_trends if t['source'] in ('rising', 'seasonal_rising')]
        top_queries = [t['topic'] for t in all_trends if t['source'] == 'top']

        # Build brand DNA summary
        dna_summary = ''
        if dna:
            parts = []
            if dna.get('description'):
                parts.append(f"Description: {dna['description']}")
            if dna.get('niche'):
                parts.append(f"Niche: {dna['niche']}")
            if dna.get('products') or dna.get('services'):
                items = dna.get('products') or dna.get('services') or []
                if isinstance(items, list):
                    parts.append(f"Products/Services: {', '.join(str(i) for i in items[:10])}")
            if dna.get('target_audience'):
                audience = dna['target_audience']
                if isinstance(audience, list):
                    parts.append(f"Target Audience: {', '.join(str(a) for a in audience[:5])}")
                else:
                    parts.append(f"Target Audience: {audience}")
            if dna.get('keywords'):
                parts.append(f"Keywords: {', '.join(dna['keywords'][:10])}")
            if dna.get('content_themes'):
                parts.append(f"Content Themes: {', '.join(dna['content_themes'][:8])}")
            if dna.get('tone') or dna.get('brand_voice'):
                parts.append(f"Brand Voice: {dna.get('tone') or dna.get('brand_voice')}")
            dna_summary = '\n'.join(parts)

        system_prompt = """You are a real-time social media trend analyst. You receive REAL Google Trends data and must identify the most relevant trending opportunities for a specific brand.

Your job:
1. Analyze the real-time Google Trends data provided
2. Cross-reference with the brand's products, audience, and niche
3. Pick trends that the brand can actually create content about
4. Add brand-specific context to make each topic actionable

You prioritize:
- REAL data from Google Trends over guessing
- Brand-specific relevance — every topic must connect to what the brand sells
- Timeliness — topics that are trending RIGHT NOW
- Actionability — each topic should clearly suggest content to create

Return ONLY valid JSON — no markdown, no commentary."""

        prompt = f"""<context>
Today's date: {today_str}
Brand: "{brand.brand_name}"
Industry: {brand.industry}
Region: {brand.target_region or 'Global'}
Website: {brand.website_url or 'N/A'}
</context>

<brand_dna>
{dna_summary or 'No Brand DNA available — use industry and brand name to infer.'}
</brand_dna>

<content_pillars>
{chr(10).join(f'- {p}' for p in pillar_names) if pillar_names else 'No content pillars defined.'}
</content_pillars>

<competitor_insights>
{chr(10).join(f'- {t}' for t in insight_texts) if insight_texts else 'No competitor data.'}
</competitor_insights>

<google_trends_data>
DAILY TRENDING SEARCHES ({brand.target_region or 'Global'} — real-time):
{json.dumps(daily_trending[:20], indent=2) if daily_trending else 'No daily trending data available'}

RISING QUERIES (related to brand keywords — gaining momentum):
{json.dumps(rising_queries[:20], indent=2) if rising_queries else 'No rising queries found'}

TOP QUERIES (most searched related to brand keywords):
{json.dumps(top_queries[:15], indent=2) if top_queries else 'No top queries found'}
</google_trends_data>
{feedback_context}

<instructions>
1. Study the brand DNA to understand what "{brand.brand_name}" sells and who its audience is.
2. From the REAL Google Trends data above, identify topics relevant to this brand.
3. For topics from Google Trends, adapt them to the brand's niche (e.g., if "Eid" is trending and the brand sells dresses → "Eid dress collection trends" or "Eid outfit ideas for women").
4. You may also add 2-3 topics based on your knowledge of current events if they are highly relevant to the brand, even if not in the Google data.
5. Generate exactly 15 topics. Each must be specific and actionable for THIS brand.
6. For each topic:
   a. Write a specific, actionable topic title
   b. Assign a volume score (0-100) — use Google Trends data to inform scores
   c. Explain WHY this topic is relevant to the brand right now
   d. Classify into a category
7. Order by volume_score descending.
</instructions>

<output_format>
{{
  "topics": [
    {{
      "topic": "<specific trending topic title for this brand>",
      "volume_score": <0-100>,
      "relevance_explanation": "<why this matters for the brand right now>",
      "category": "<seasonal | cultural | industry | viral | evergreen>"
    }}
  ]
}}
</output_format>

<constraints>
- Exactly 15 topics.
- Prefer topics backed by REAL Google Trends data.
- Volume scores should reflect actual search volume — higher for daily trending, lower for niche.
- Every topic MUST directly relate to the brand's products, services, or audience.
- Topics must be specific enough to create content about this week.
- Return valid JSON only.
</constraints>"""

        if override_prompt:
            prompt = override_prompt

        llm_result = service.chat_completion(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': prompt},
            ],
            temperature=0.7,
            max_tokens=5000 if think_harder else 2500,
            response_format={'type': 'json_object'},
            thinking_budget=10000 if think_harder else 0,
        )

        if not llm_result.success:
            raise Exception(llm_result.error)

        content = llm_result.content.strip()
        parsed = json.loads(content)

        # Handle both direct array and wrapped object
        if isinstance(parsed, dict):
            topics = parsed.get('topics', parsed.get('data', parsed.get('trending', [])))
            if not isinstance(topics, list):
                for v in parsed.values():
                    if isinstance(v, list):
                        topics = v
                        break
                else:
                    topics = []
        else:
            topics = parsed if isinstance(parsed, list) else []

        if not topics:
            logger.warning(f"LLM returned no topics for brand {brand.brand_name}")
            return _save_raw_trends(brand, all_trends, keywords, geo)

        # --- Step 5: Save to TrendingCache ---
        TrendingCache.objects.filter(brand=brand).delete()

        expires = timezone.now() + timedelta(hours=12)
        created = []
        for t in topics[:15]:
            if not isinstance(t, dict):
                continue
            obj = TrendingCache.objects.create(
                platform=t.get('platform', 'google'),
                topic=str(t.get('topic', ''))[:500],
                volume_score=min(float(t.get('volume_score', 50)), 100),
                region=geo or 'global',
                brand=brand,
                relevance_explanation=str(t.get('relevance_explanation', ''))[:500],
                expires_at=expires,
            )
            created.append({
                'id': obj.id,
                'topic': obj.topic,
                'volume_score': obj.volume_score,
                'platform': obj.platform,
                'relevance_explanation': obj.relevance_explanation,
                'category': t.get('category', 'industry'),
            })

        from brands.models import PromptHistory
        PromptHistory.save_prompt(brand, 'trending', prompt)

        return {
            'success': True,
            'brand_id': brand.id,
            'count': len(created),
            'source': 'google_trends+llm' if all_trends else 'llm',
            'topics': created,
            'google_trends_count': len(all_trends),
            'used_prompt': prompt,
            'provider': getattr(llm_result, 'provider', 'claude'),
            'model_used': getattr(llm_result, 'model', ''),
        }

    except json.JSONDecodeError as e:
        logger.error(f"LLM returned invalid JSON: {e}")
        return _save_raw_trends(brand, all_trends, keywords, geo)
    except Exception as e:
        logger.error(f"LLM trending generation failed: {e}", exc_info=True)
        return _save_raw_trends(brand, all_trends, keywords, geo)


def _save_raw_trends(brand, trends, keywords, geo='global'):
    """Fallback: save raw Google Trends results without LLM filtering."""
    from brands.models import TrendingCache

    TrendingCache.objects.filter(brand=brand).delete()
    expires = timezone.now() + timedelta(hours=12)
    created = []

    # Save Google Trends data directly
    if trends:
        for t in trends[:15]:
            obj = TrendingCache.objects.create(
                platform='google',
                topic=t['topic'][:500],
                volume_score=min(t.get('score', 50), 100),
                region=geo or 'global',
                brand=brand,
                relevance_explanation=f"Trending on Google ({t.get('source', 'unknown')})",
                expires_at=expires,
            )
            created.append({
                'id': obj.id,
                'topic': obj.topic,
                'volume_score': obj.volume_score,
                'platform': obj.platform,
                'relevance_explanation': obj.relevance_explanation,
                'category': 'viral' if t.get('source') == 'daily_trending' else 'industry',
            })

    # Fill remaining with brand keywords
    remaining = 15 - len(created)
    if remaining > 0:
        dna = brand.brand_dna or {}
        base_topics = list(keywords)
        if dna.get('content_themes'):
            for theme in dna['content_themes']:
                if theme not in base_topics:
                    base_topics.append(theme)

        for idx, kw in enumerate(base_topics[:remaining]):
            obj = TrendingCache.objects.create(
                platform='google',
                topic=kw,
                volume_score=max(60 - idx * 4, 20),
                region=geo or 'global',
                brand=brand,
                relevance_explanation=f'Based on your brand keywords and {brand.industry} industry',
                expires_at=expires,
            )
            created.append({
                'id': obj.id,
                'topic': obj.topic,
                'volume_score': obj.volume_score,
                'platform': obj.platform,
                'relevance_explanation': obj.relevance_explanation,
                'category': 'evergreen',
            })

    return {
        'success': True,
        'brand_id': brand.id,
        'count': len(created),
        'source': 'google_trends_raw' if trends else 'keywords',
        'topics': created,
        'used_prompt': '',
    }
