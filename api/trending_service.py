"""
Trending topic generation service using pytrends (Google Trends) + OpenAI.
Generates brand-relevant trending topics based on Brand DNA, Content Pillars,
Competitors, and CURRENT seasonal/cultural context.
"""
import json
import logging
from datetime import timedelta, date

from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_seasonal_context(target_region=''):
    """
    Build a seasonal/cultural context string based on the current date & region.
    Returns upcoming holidays, cultural events, and seasonal moments
    that brands should be aware of for content creation.
    """
    today = date.today()
    month = today.month
    day = today.day
    region = (target_region or '').lower().strip()

    events = []

    # ── Global / multi-region events by month ──
    if month == 1:
        if day <= 7:
            events.append(('New Year', 'NOW', 'Resolutions, fresh starts, year-ahead planning'))
        events.append(('Winter season content', 'NOW', 'Cold weather, cozy vibes, indoor activities'))
    elif month == 2:
        if day <= 14:
            events.append(('Valentine\'s Day (Feb 14)', 'THIS WEEK' if day >= 8 else 'COMING SOON', 'Love, relationships, gifting, self-care'))
        events.append(('International Mother Language Day (Feb 21)', 'NOW' if 18 <= day <= 23 else 'THIS MONTH', 'Culture, language, identity'))
    elif month == 3:
        events.append(('International Women\'s Day (Mar 8)', 'NOW' if 5 <= day <= 10 else 'THIS MONTH', 'Women empowerment, equality, inspiration'))
        events.append(('Spring season begins', 'NOW', 'New beginnings, outdoor activities, fresh energy'))
        if day >= 15:
            events.append(('World Water Day (Mar 22)', 'COMING SOON', 'Sustainability, environment'))
    elif month == 4:
        events.append(('Earth Day (Apr 22)', 'NOW' if 19 <= day <= 24 else 'THIS MONTH', 'Environment, sustainability, green living'))
        events.append(('Spring content', 'NOW', 'Outdoor activities, gardening, wellness'))
    elif month == 5:
        events.append(('Mother\'s Day', 'THIS MONTH', 'Mothers, family, gratitude, gifting'))
        if day >= 15:
            events.append(('Summer approaching', 'COMING SOON', 'Travel planning, summer vibes'))
    elif month == 6:
        events.append(('Father\'s Day', 'THIS MONTH', 'Fathers, family, gifting'))
        events.append(('Summer season', 'NOW', 'Travel, vacation, outdoor activities, beach, summer fashion'))
        events.append(('World Environment Day (Jun 5)', 'NOW' if 3 <= day <= 7 else 'THIS MONTH', 'Sustainability, eco-friendly'))
    elif month == 7:
        events.append(('Summer peak', 'NOW', 'Travel, vacation, outdoor activities, summer sales'))
    elif month == 8:
        events.append(('Back to School', 'NOW', 'Education, supplies, new academic year preparation'))
        if day >= 20:
            events.append(('Fall/Autumn approaching', 'COMING SOON', 'Season change, harvest'))
    elif month == 9:
        events.append(('Fall/Autumn season', 'NOW', 'Cozy content, harvest, seasonal change'))
        events.append(('International Literacy Day (Sep 8)', 'NOW' if 6 <= day <= 10 else 'THIS MONTH', 'Education, reading'))
    elif month == 10:
        events.append(('Halloween (Oct 31)', 'NOW' if day >= 20 else 'THIS MONTH', 'Costumes, spooky content, creative posts'))
        events.append(('Breast Cancer Awareness Month', 'NOW', 'Health, awareness, pink ribbon'))
        events.append(('Mental Health Awareness', 'NOW', 'Wellbeing, self-care'))
    elif month == 11:
        if day >= 20:
            events.append(('Black Friday / Cyber Monday', 'THIS WEEK', 'Sales, deals, shopping, ecommerce'))
        events.append(('Thanksgiving', 'THIS MONTH', 'Gratitude, family, giving'))
        events.append(('Year-end planning', 'NOW', 'Yearly wrap-up, goal setting'))
    elif month == 12:
        events.append(('Christmas (Dec 25)', 'NOW' if day >= 15 else 'THIS MONTH', 'Holidays, gifting, celebrations, festive content'))
        events.append(('New Year\'s Eve (Dec 31)', 'NOW' if day >= 25 else 'COMING SOON', 'Year in review, resolutions, celebrations'))
        events.append(('Holiday season', 'NOW', 'Shopping, gifting, end-of-year sales'))

    # ── Islamic calendar events (approximate — shifts ~11 days/year) ──
    # 2026 approximate dates (Ramadan ~Feb 18 to Mar 19, Eid al-Fitr ~Mar 20)
    # These are rough estimates — the actual dates depend on moon sighting
    year = today.year
    if year == 2026:
        ram_start = date(2026, 2, 18)
        ram_end = date(2026, 3, 19)
        eid_fitr = date(2026, 3, 20)
        eid_adha = date(2026, 5, 27)
    elif year == 2027:
        ram_start = date(2027, 2, 7)
        ram_end = date(2027, 3, 8)
        eid_fitr = date(2027, 3, 9)
        eid_adha = date(2027, 5, 16)
    else:
        # Generic fallback
        ram_start = date(year, 3, 1)
        ram_end = date(year, 3, 30)
        eid_fitr = date(year, 3, 31)
        eid_adha = date(year, 6, 7)

    if ram_start - timedelta(days=7) <= today <= ram_start:
        events.append(('Ramadan starting soon', 'THIS WEEK', 'Ramadan preparation, iftar planning, spiritual content, Ramadan deals'))
    elif ram_start <= today <= ram_end:
        week_num = (today - ram_start).days // 7 + 1
        events.append((f'Ramadan (Week {week_num})', 'NOW — ACTIVE', 'Iftar recipes, spiritual reflection, Ramadan offers, sehri tips, charity/zakat, community'))
        if (ram_end - today).days <= 10:
            events.append(('Eid al-Fitr approaching', 'COMING SOON', 'Eid preparation, Eid shopping, Eid fashion, gifts, Eid greetings'))
    elif eid_fitr <= today <= eid_fitr + timedelta(days=5):
        events.append(('Eid al-Fitr', 'NOW — ACTIVE', 'Eid Mubarak, celebration, family gatherings, Eid fashion, Eid food, gifts'))
    elif eid_fitr - timedelta(days=10) <= today < eid_fitr:
        events.append(('Eid al-Fitr approaching', 'THIS WEEK', 'Eid preparation, Eid shopping, fashion, gifts, Eid menus'))

    if eid_adha - timedelta(days=14) <= today <= eid_adha + timedelta(days=4):
        if today < eid_adha:
            events.append(('Eid al-Adha approaching', 'COMING SOON', 'Sacrifice, Hajj season, Eid shopping, family'))
        else:
            events.append(('Eid al-Adha', 'NOW — ACTIVE', 'Eid Mubarak, Qurbani, family gatherings, celebration'))

    # ── Region-specific events ──
    if region in ('bd', 'bangladesh'):
        if month == 2 and 19 <= day <= 22:
            events.append(('Shaheed Dibosh / Language Movement Day (Feb 21)', 'NOW', 'Bengali language, national pride, cultural identity'))
        if month == 3 and 24 <= day <= 27:
            events.append(('Independence Day Bangladesh (Mar 26)', 'NOW', 'National pride, freedom, patriotism'))
        if month == 4 and 12 <= day <= 16:
            events.append(('Pohela Boishakh / Bengali New Year (Apr 14)', 'NOW', 'Bengali culture, new year celebration, Mangal Shobhajatra'))
        if month == 12 and 14 <= day <= 17:
            events.append(('Victory Day Bangladesh (Dec 16)', 'NOW', 'National pride, Bijoy Dibosh'))

    if region in ('in', 'india'):
        if month == 1 and 24 <= day <= 27:
            events.append(('Republic Day India (Jan 26)', 'NOW', 'National pride, patriotism'))
        if month == 8 and 13 <= day <= 16:
            events.append(('Independence Day India (Aug 15)', 'NOW', 'National pride, freedom'))
        if month == 10 or month == 11:
            events.append(('Diwali season', 'NOW/COMING', 'Festival of lights, celebration, shopping, sweets, family'))
        if month == 3 and 10 <= day <= 20:
            events.append(('Holi', 'NOW/COMING', 'Festival of colors, celebration, joy'))

    if region in ('us', 'usa', 'united states'):
        if month == 7 and 1 <= day <= 5:
            events.append(('Independence Day USA (Jul 4)', 'NOW', 'Patriotism, BBQ, fireworks, summer'))
        if month == 2:
            events.append(('Super Bowl season', 'NOW', 'Football, parties, game day content, Super Bowl ads'))
            events.append(('Black History Month', 'NOW', 'African American heritage, culture, history'))

    if region in ('gb', 'uk', 'united kingdom'):
        if month == 4 or month == 5:
            events.append(('Spring Bank Holiday', 'COMING', 'Holiday weekend, spring activities'))

    return events


def _format_seasonal_context(events):
    """Format seasonal events list into a prompt-friendly string."""
    if not events:
        return 'No major seasonal events detected.'

    lines = []
    for name, timing, description in events:
        lines.append(f'  - [{timing}] {name}: {description}')
    return '\n'.join(lines)


def generate_trending_for_brand(brand_id, user):
    """
    Generate trending topics for a brand using pytrends + OpenAI filtering.

    1. Build search keywords from Brand DNA + Pillars
    2. Detect current seasonal/cultural events
    3. Query Google Trends via pytrends for related rising/top queries
    4. Use OpenAI to filter & rank by relevance to the brand + current moment
    5. Save results to TrendingCache with brand FK
    """
    from brands.models import Brand, TrendingCache, CompetitorInsight
    from accounts.api_keys import get_openai_key

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

    # Deduplicate and limit
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

    # --- Step 2: Detect seasonal/cultural context ---
    geo = ''
    if brand.target_region:
        region_map = {
            'usa': 'US', 'us': 'US', 'united states': 'US',
            'uk': 'GB', 'united kingdom': 'GB',
            'india': 'IN', 'bangladesh': 'BD',
            'global': '', 'worldwide': '',
        }
        geo = region_map.get(brand.target_region.lower().strip(), '')

    seasonal_events = _get_seasonal_context(geo)
    seasonal_text = _format_seasonal_context(seasonal_events)
    today_str = date.today().strftime('%B %d, %Y')  # e.g., "February 22, 2026"

    # --- Step 3: Query pytrends (optional, fast-fail) ---
    all_trends = []
    try:
        from pytrends.request import TrendReq
        pytrend = TrendReq(hl='en-US', tz=360, timeout=(5, 15))

        # Single batch of top 5 keywords
        batch = keywords[:5]
        try:
            pytrend.build_payload(batch, timeframe='now 7-d', geo=geo)
            related = pytrend.related_queries()
            for kw_name, data in related.items():
                if data.get('rising') is not None and not data['rising'].empty:
                    for _, row in data['rising'].head(5).iterrows():
                        all_trends.append({
                            'topic': str(row['query']),
                            'score': min(float(row.get('value', 50)), 1000),
                            'source': 'rising',
                        })
                if data.get('top') is not None and not data['top'].empty:
                    for _, row in data['top'].head(3).iterrows():
                        all_trends.append({
                            'topic': str(row['query']),
                            'score': float(row.get('value', 50)),
                            'source': 'top',
                        })
        except Exception as e:
            logger.warning(f"pytrends batch query failed for {batch}: {e}")
    except ImportError:
        logger.info("pytrends not installed — skipping Google Trends, using AI generation")
    except Exception as e:
        logger.warning(f"pytrends initialization failed: {e}")

    # Deduplicate trends
    seen_topics = set()
    unique_trends = []
    for t in all_trends:
        low = t['topic'].lower()
        if low not in seen_topics:
            seen_topics.add(low)
            unique_trends.append(t)
    all_trends = unique_trends[:40]

    logger.info(f"pytrends returned {len(all_trends)} trends for brand {brand.brand_name}")

    # --- Step 4: Use OpenAI to filter + rank with seasonal awareness ---
    api_key = get_openai_key(user)
    if not api_key:
        logger.warning(f"No OpenAI key for user {user.id} — using raw trends fallback")
        return _save_raw_trends(brand, all_trends, keywords, geo, seasonal_events)

    try:
        import openai
        client = openai.OpenAI(api_key=api_key)

        pillar_names = [p.name for p in pillars]
        competitor_insights = CompetitorInsight.objects.filter(
            competitor_profile__brand=brand
        ).order_by('-engagement_score')[:10]
        insight_texts = [ci.hook_text.split(' ||REC||')[0][:100] for ci in competitor_insights]

        trend_list = json.dumps([t['topic'] for t in all_trends], indent=2) if all_trends else 'No Google Trends data available'

        prompt = f"""You are a social media trend analyst. Today's date is {today_str}.

Given a brand's context, the CURRENT seasonal/cultural moment, and Google Trends data, generate the TOP 15 most relevant trending topics for this brand's content strategy RIGHT NOW.

═══ BRAND CONTEXT ═══
Brand: {brand.brand_name}
Industry: {brand.industry}
Target Region: {brand.target_region or 'Global'}
Target Audience: {dna.get('target_audience', 'general')}
Brand Voice: {dna.get('brand_voice', 'professional')}
Content Pillars: {', '.join(pillar_names) if pillar_names else 'Not set'}
Brand Values: {', '.join(dna.get('brand_values', [])[:5]) if dna.get('brand_values') else 'Not set'}
Competitor Strategies: {'; '.join(insight_texts[:5]) if insight_texts else 'None analyzed yet'}

═══ CURRENT SEASONAL & CULTURAL CONTEXT ({today_str}) ═══
{seasonal_text}

═══ GOOGLE TRENDS DATA ═══
{trend_list}

═══ INSTRUCTIONS ═══
Generate exactly 15 trending topics. Your response MUST include:
- At least 4-5 topics tied to the CURRENT seasonal/cultural events listed above (Ramadan content, Eid prep, seasonal campaigns, etc.) — these should be the highest-scored topics
- The remaining topics should be industry-specific trends, viral social media themes, or Google Trends-based topics relevant to the brand
- Each topic should be specific and actionable for social media content (not generic like "post more")
- volume_score should reflect CURRENT relevance: seasonal/active events = 80-95, industry trends = 50-80, evergreen = 30-50
- category should classify the topic: "seasonal", "cultural", "industry", "viral", "evergreen"

Return a JSON object:
{{"topics": [{{"topic": "specific topic name", "volume_score": 0-100, "relevance_explanation": "1-sentence why this matters NOW for the brand", "platform": "google", "category": "seasonal|cultural|industry|viral|evergreen"}}]}}"""

        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2500,
            response_format={'type': 'json_object'},
        )

        content = response.choices[0].message.content.strip()
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
            logger.warning(f"OpenAI returned no topics for brand {brand.brand_name}")
            return _save_raw_trends(brand, all_trends, keywords, geo, seasonal_events)

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

        return {
            'success': True,
            'brand_id': brand.id,
            'count': len(created),
            'source': 'pytrends+openai' if all_trends else 'openai',
            'topics': created,
        }

    except json.JSONDecodeError as e:
        logger.error(f"OpenAI returned invalid JSON: {e}")
        return _save_raw_trends(brand, all_trends, keywords, geo, seasonal_events)
    except Exception as e:
        logger.error(f"OpenAI trending generation failed: {e}", exc_info=True)
        return _save_raw_trends(brand, all_trends, keywords, geo, seasonal_events)


def _save_raw_trends(brand, trends, keywords, geo='global', seasonal_events=None):
    """Fallback: save raw pytrends results + seasonal events without OpenAI."""
    from brands.models import TrendingCache

    TrendingCache.objects.filter(brand=brand).delete()
    expires = timezone.now() + timedelta(hours=12)
    created = []

    # First: add seasonal event topics (highest priority)
    if seasonal_events:
        for name, timing, description in seasonal_events[:5]:
            topic_text = f"{name} — {description.split(',')[0]}"
            obj = TrendingCache.objects.create(
                platform='google',
                topic=topic_text[:500],
                volume_score=90 if 'NOW' in timing else 75,
                region=geo or 'global',
                brand=brand,
                relevance_explanation=f'{timing}: {description}',
                expires_at=expires,
            )
            created.append({
                'id': obj.id,
                'topic': obj.topic,
                'volume_score': obj.volume_score,
                'platform': obj.platform,
                'relevance_explanation': obj.relevance_explanation,
                'category': 'seasonal',
            })

    # Then: add Google Trends data
    if trends:
        for t in trends[:max(15 - len(created), 5)]:
            obj = TrendingCache.objects.create(
                platform='google',
                topic=t['topic'][:500],
                volume_score=min(t.get('score', 50), 100),
                region=geo or 'global',
                brand=brand,
                relevance_explanation='Trending on Google',
                expires_at=expires,
            )
            created.append({
                'id': obj.id,
                'topic': obj.topic,
                'volume_score': obj.volume_score,
                'platform': obj.platform,
                'relevance_explanation': obj.relevance_explanation,
                'category': 'industry',
            })

    # Fill remaining slots with keywords
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
        'source': 'pytrends+seasonal' if trends else 'seasonal+keywords',
        'topics': created,
    }
