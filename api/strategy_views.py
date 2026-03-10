import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.utils import timezone

from accounts.services.diamond_service import pre_check, deduct_diamonds

logger = logging.getLogger(__name__)

from accounts.permissions import IsWorkspaceAdmin, IsCreatorOrAbove, IsViewerOrAbove

from brands.models import (
    Brand, Workspace, ContentPillar, CompetitorProfile, CompetitorInsight,
    BrandTemplate, TrendingCache, ContentIdea, BrandDNAHistory, OverflowProgress,
    PromptHistory,
)
from .serializers import (
    ContentPillarSerializer, CompetitorProfileSerializer,
    CompetitorInsightSerializer, BrandTemplateSerializer,
    TrendingCacheSerializer, ContentIdeaDetailSerializer,
    GenerateIdeasRequestSerializer,
)


def get_or_create_brand(user):
    """Get user's primary brand, or auto-create workspace + brand if none exists."""
    brand = Brand.objects.filter(user=user, is_primary=True).first()
    if brand:
        return brand
    brand = Brand.objects.filter(user=user).first()
    if brand:
        return brand
    # Auto-create workspace and brand for users who don't have one
    workspace = Workspace.objects.filter(owner=user).first()
    if not workspace:
        workspace = Workspace.objects.create(owner=user, name=f"{user.username}'s Workspace")
    brand = Brand.objects.create(
        workspace=workspace,
        user=user,
        brand_name=f"{user.username}'s Brand",
        industry='General',
        target_region='Global',
        is_primary=True,
    )
    return brand


class ContentPillarViewSet(viewsets.ModelViewSet):
    serializer_class = ContentPillarSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def get_queryset(self):
        return ContentPillar.objects.filter(
            brand__user=self.request.user
        )

    def perform_create(self, serializer):
        # Auto-assign user's brand if not provided
        if not serializer.validated_data.get('brand'):
            brand = get_or_create_brand(self.request.user)
            serializer.save(brand=brand)
            return
        serializer.save()

    @action(detail=False, methods=['get'], url_path='by-brand/(?P<brand_id>[^/.]+)')
    def by_brand(self, request, brand_id=None):
        pillars = ContentPillar.objects.filter(
            brand_id=brand_id, brand__user=request.user
        )
        serializer = self.get_serializer(pillars, many=True)
        return Response(serializer.data)


class PillarComplianceView(APIView):
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(id=brand_id, workspace__owner=request.user)
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        pillars = brand.content_pillars.filter(is_active=True)
        total_posts = brand.posts.count()
        compliance = []

        for pillar in pillars:
            pillar_posts = pillar.posts.count()
            actual_pct = round((pillar_posts / total_posts) * 100, 1) if total_posts > 0 else 0
            deviation = actual_pct - pillar.target_percentage
            compliance.append({
                'pillar_id': pillar.id,
                'pillar_name': pillar.name,
                'color_code': pillar.color_code,
                'target_percentage': pillar.target_percentage,
                'actual_percentage': actual_pct,
                'deviation': round(deviation, 1),
                'post_count': pillar_posts,
                'status': 'on_track' if abs(deviation) <= 5 else ('over' if deviation > 0 else 'under'),
            })

        return Response({
            'brand_id': brand.id,
            'total_posts': total_posts,
            'pillars': compliance,
        })


class CompetitorProfileViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitorProfileSerializer
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def get_queryset(self):
        return CompetitorProfile.objects.filter(
            brand__user=self.request.user
        )

    def perform_create(self, serializer):
        if not serializer.validated_data.get('brand'):
            brand = get_or_create_brand(self.request.user)
            serializer.save(brand=brand)
            return
        serializer.save()

    @action(detail=False, methods=['get'], url_path='by-brand/(?P<brand_id>[^/.]+)')
    def by_brand(self, request, brand_id=None):
        profiles = CompetitorProfile.objects.filter(
            brand_id=brand_id, brand__user=request.user
        )
        serializer = self.get_serializer(profiles, many=True)
        return Response(serializer.data)


def _fetch_page_content(url):
    """Fetch and extract text content from a URL."""
    import requests
    from bs4 import BeautifulSoup

    if not url.startswith('http'):
        url = 'https://' + url

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Remove scripts, styles
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
            tag.decompose()

        # Get page title
        title = soup.title.string if soup.title else ''

        # Get meta description
        meta_desc = ''
        meta_tag = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
        if meta_tag:
            meta_desc = meta_tag.get('content', '')

        # Get main text content
        text = soup.get_text(separator='\n', strip=True)
        # Clean up excessive whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        text = '\n'.join(lines[:150])  # Limit to first 150 lines

        return {
            'success': True,
            'title': title[:200],
            'description': meta_desc[:500],
            'content': text[:4000],  # Limit content for API
            'url': url,
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'url': url,
        }


def _crawl_site_pages(base_url, max_pages=8):
    """Crawl multiple pages from a site, discovering internal links.
    Returns list of {url, title, content} for each page found."""
    import requests
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin, urlparse
    import time

    if not base_url.startswith('http'):
        base_url = 'https://' + base_url

    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc

    visited = set()
    to_visit = [base_url]
    pages = []

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    skip_patterns = (
        '/login', '/signup', '/register', '/cart', '/checkout',
        '/admin', '/wp-admin', '/feed', '/rss', '/account', '/my-account',
        '/wp-json', '/xmlrpc', '?add-to-cart', '/wishlist',
    )
    skip_extensions = (
        '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
        '.mp3', '.mp4', '.zip', '.css', '.js', '.xml', '.json', '.ico',
    )

    while to_visit and len(pages) < max_pages:
        url = to_visit.pop(0)
        url = url.split('#')[0].rstrip('/')

        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
            if resp.status_code != 200:
                continue
            content_type = resp.headers.get('Content-Type', '')
            if 'text/html' not in content_type:
                continue

            soup = BeautifulSoup(resp.text, 'html.parser')

            # Extract links BEFORE removing nav/footer (links are often there)
            for link in soup.find_all('a', href=True):
                href = link['href']
                full_url = urljoin(url, href).split('#')[0].split('?')[0].rstrip('/')
                parsed = urlparse(full_url)
                lower_url = full_url.lower()

                if (parsed.netloc == base_domain
                        and full_url not in visited
                        and parsed.scheme in ('http', 'https')
                        and not any(p in lower_url for p in skip_patterns)
                        and not any(lower_url.endswith(ext) for ext in skip_extensions)):
                    to_visit.append(full_url)

            # Now remove non-content tags
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'iframe']):
                tag.decompose()

            title = soup.title.string.strip() if soup.title and soup.title.string else ''
            main = soup.find('main') or soup.find('article') or soup.find('body')
            text = main.get_text(separator='\n', strip=True) if main else soup.get_text(separator='\n', strip=True)

            lines = [l.strip() for l in text.splitlines() if l.strip() and len(l.strip()) > 3]
            text = '\n'.join(lines[:100])

            if len(text) > 80:
                pages.append({
                    'url': url,
                    'title': title[:200],
                    'content': text[:2500],
                })

            time.sleep(0.3)  # Be polite
        except Exception:
            continue

    return pages


class CompetitorCrawlView(APIView):
    """Analyze competitors by reading their page content with AI insights"""
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        competitor_id = request.data.get('competitor_id')
        if competitor_id:
            profiles = brand.competitor_profiles.filter(id=competitor_id)
        else:
            profiles = brand.competitor_profiles.all()

        if not profiles.exists():
            return Response({'error': 'No competitor profiles configured'}, status=status.HTTP_400_BAD_REQUEST)

        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'competitor_analysis')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            from accounts.services.llm_service import get_llm_service
            import json

            service = get_llm_service(request.user)
            all_insights = []
            all_used_prompts = []

            # Get brand context
            pillars = brand.content_pillars.filter(is_active=True)
            pillar_names = [p.name for p in pillars]
            pillar_context = ', '.join(pillar_names) if pillar_names else 'Not set'

            pages_crawled_total = 0

            for profile in profiles:
                # Step 1: Crawl multiple pages from the competitor's site
                site_pages = _crawl_site_pages(profile.handle_or_url, max_pages=8)

                if site_pages:
                    # Build content from all crawled pages with their URLs
                    pages_text = ""
                    page_urls = []
                    for i, pg in enumerate(site_pages):
                        page_urls.append(pg['url'])
                        pages_text += f"\n--- PAGE {i+1}: {pg['url']} ---\n"
                        pages_text += f"Title: {pg['title']}\n"
                        pages_text += f"{pg['content'][:1500]}\n"

                    page_context = f"""
CRAWLED {len(site_pages)} PAGES FROM THIS COMPETITOR'S SITE:
{pages_text}

AVAILABLE PAGE URLs ON THIS SITE:
{chr(10).join(page_urls)}
"""
                    pages_crawled_total += len(site_pages)
                else:
                    # Fallback to single page fetch
                    page_data = _fetch_page_content(profile.handle_or_url)
                    if page_data['success']:
                        page_context = f"""
FETCHED FROM {page_data['url']}:
Title: {page_data['title']}
Description: {page_data['description']}
Content:
{page_data['content']}
"""
                        pages_crawled_total += 1
                    else:
                        page_context = f"""
NOTE: Could not fetch content from {profile.handle_or_url} (Error: {page_data.get('error', 'unknown')}).
Analyze based on the URL/handle name only.
"""

                prompt = f"""<context>
My brand: "{brand.brand_name}"
Industry: {brand.industry}
Region: {brand.target_region}
My content pillars: {pillar_context}

Competitor: {profile.handle_or_url}
Platform: {profile.get_platform_display()}
</context>

<crawled_pages>
{page_context}
</crawled_pages>

<instructions>
STEP 1 — EXTRACT FACTS (do this first, silently):
Read every crawled page carefully. Extract ONLY what is explicitly stated:
- What does this competitor actually sell? (exact product categories, not assumptions)
- What type of brand is it? (luxury, budget, streetwear, ethnic, etc. — based on products and pricing)
- Pricing: Are prices shown? What currency? What price ranges? Any discounts/sale sections?
- Offers: Free delivery? Discount codes? Seasonal sales? Bundle deals? Loyalty programs?
- Delivery: What shipping options exist? (standard, express, same-day, free shipping threshold)
- Returns: What is the exact return/exchange policy?
- Payment: What payment methods are accepted?
- Unique features: Customization options? Subscription? Gift cards? Sizing guides? Reviews section?

STEP 2 — IDENTIFY GAPS AND STRENGTHS:
Compare what the competitor HAS vs what they are MISSING or doing POORLY.
- A "gap" means the page content does NOT mention it at all.
- A "strength" means the page explicitly shows/promotes it.
- NEVER claim a competitor lacks something if the crawled pages show they have it.
- NEVER claim a competitor has something if the crawled pages don't show it.

STEP 3 — GENERATE 10 INSIGHTS:
Create exactly 10 competitive insights for my brand. Each insight must include:
a. **hook_text**: A compelling content hook for my brand. Must reference specific competitor data.
b. **angle**: Strategic approach — WHY this insight matters and what competitor data supports it.
c. **format_type**: Recommended format (post, carousel, video, story, reel, thread, infographic, blog).
d. **engagement_score**: 1-10 honest rating. Spread scores realistically — max 2-3 insights can be 9-10.
e. **recommendation**: Specific, actionable step. Include details: what to create, which platform, what data to highlight.
f. **based_on**: Quote or paraphrase the ACTUAL content from the competitor's pages that supports this insight. Include specific details like prices, product names, policies found.
g. **source_url**: The EXACT URL from the crawled pages where you found this evidence.

INSIGHT CATEGORIES — include a mix of:
- Pricing & offers (competitor's discounts, free delivery thresholds, sale strategy)
- Product gaps (categories they lack that my brand can exploit)
- Content strategy (what types of content they create vs. miss)
- Customer experience (return policy, payment options, loyalty programs)
- Messaging & positioning (how they talk to customers, what tone they use)
</instructions>

<output_format>
Return ONLY a JSON array of exactly 10 objects:
[
  {{
    "hook_text": "<compelling content hook with specific details>",
    "angle": "<strategic angle backed by competitor evidence>",
    "format_type": "<post|carousel|video|story|reel|thread|infographic|blog>",
    "engagement_score": <1-10>,
    "recommendation": "<specific actionable recommendation with details>",
    "based_on": "<quote or paraphrase ACTUAL content from competitor pages — include prices, product names, policies>",
    "source_url": "<exact URL from crawled pages>"
  }}
]
</output_format>

<critical_rules>
- ACCURACY IS THE #1 PRIORITY. Every claim must be backed by crawled page evidence.
- NEVER say "competitor lacks X" if the crawled pages show X exists.
- NEVER say "competitor has X" if the crawled pages don't mention X.
- If a feature is not found in crawled pages, say "not found on crawled pages" — do NOT assume it doesn't exist.
- based_on field MUST contain specific evidence: exact prices, product names, policy details, or direct quotes.
- Every source_url MUST be from the crawled pages list — never fabricate URLs.
- Vary engagement_scores: use 5-6 for basic insights, 7-8 for good ones, 9-10 only for exceptional opportunities.
- Include at least 3 insights about pricing, offers, discounts, or delivery strategies.
- Return valid JSON array only — no markdown, no commentary.
</critical_rules>"""

                if override_prompt:
                    prompt = override_prompt

                result = service.chat_completion(
                    messages=[
                        {'role': 'system', 'content': """You are a senior competitive intelligence analyst specializing in e-commerce and social media marketing in South Asia (Bangladesh, India).

Your core skill is extracting ACCURATE, SPECIFIC business intelligence from competitor websites:
- Product categories, pricing ranges, discount strategies, and seasonal offers
- Delivery options, return policies, payment methods, and customer experience features
- Content gaps and messaging weaknesses that can be exploited
- Loyalty programs, gift cards, customization options, and unique selling points

ACCURACY RULES (non-negotiable):
1. You ONLY state facts that are DIRECTLY EVIDENCED in the crawled page content.
2. If a page shows prices, quote the actual price range and currency.
3. If a page shows a discount/sale, quote the exact offer (e.g., "30% off", "Buy 2 Get 1 Free").
4. If a page shows delivery options, state exactly what is offered.
5. NEVER claim a competitor "lacks" or "doesn't have" something unless you have read ALL their crawled pages and confirmed it is absent.
6. If you're unsure whether a feature exists, say "not found on crawled pages" — never assume.
7. When a competitor DOES have a feature, acknowledge it as a strength — do not pretend it doesn't exist.

You think like a business owner, not an academic. Your insights help brands find real competitive advantages: better pricing, better delivery, better offers, better content.

Return ONLY valid JSON array — no markdown, no commentary."""},
                        {'role': 'user', 'content': prompt},
                    ],
                    temperature=0.5,
                    max_tokens=9000 if think_harder else 4500,
                    thinking_budget=10000 if think_harder else 0,
                )

                if not result.success:
                    return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)

                deduct_diamonds(user=request.user, feature='competitor_analysis', provider='claude', raw_tokens=result.tokens_used if hasattr(result, 'tokens_used') else 0)

                all_used_prompts.append({
                    'competitor': profile.handle_or_url,
                    'prompt': prompt,
                })

                raw = result.content
                if raw.startswith('```'):
                    raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                    if raw.endswith('```'):
                        raw = raw[:-3]
                    raw = raw.strip()

                insights_data = json.loads(raw)

                # Handle both array and object-wrapped responses
                if isinstance(insights_data, dict):
                    # LLM wrapped the array in an object — extract the list
                    for v in insights_data.values():
                        if isinstance(v, list):
                            insights_data = v
                            break
                    else:
                        insights_data = []

                # Delete old insights
                profile.insights.all().delete()

                for item in insights_data[:10]:
                    recommendation = item.get('recommendation', '')
                    based_on = item.get('based_on', '')
                    source_url = item.get('source_url', profile.handle_or_url)
                    # Store extra fields in hook_text with separators
                    hook_with_extras = item.get('hook_text', '')
                    if recommendation:
                        hook_with_extras += f' ||REC|| {recommendation}'
                    if based_on:
                        hook_with_extras += f' ||SRC|| {based_on}'
                    if source_url:
                        hook_with_extras += f' ||URL|| {source_url}'

                    insight = CompetitorInsight.objects.create(
                        competitor_profile=profile,
                        hook_text=hook_with_extras[:1000],
                        angle=item.get('angle', '')[:200],
                        format_type=item.get('format_type', 'text')[:50],
                        engagement_score=min(float(item.get('engagement_score', 5)), 10),
                    )
                    all_insights.append({
                        'id': insight.id,
                        'competitor': profile.handle_or_url,
                        'platform': profile.platform,
                        'hook_text': item.get('hook_text', ''),
                        'angle': insight.angle,
                        'format_type': insight.format_type,
                        'engagement_score': insight.engagement_score,
                        'recommendation': recommendation,
                        'based_on': based_on,
                        'source_url': source_url,
                    })

                profile.last_crawled_at = timezone.now()
                profile.save(update_fields=['last_crawled_at'])

            # Save prompts to history
            from brands.models import PromptHistory
            combined_prompt = '\n---\n'.join(all_used_prompts) if all_used_prompts else ''
            PromptHistory.save_prompt(brand, 'competitors', combined_prompt)

            return Response({
                'message': f'Analysis complete for {profiles.count()} competitor(s), crawled {pages_crawled_total} pages',
                'brand_id': brand.id,
                'pages_crawled': pages_crawled_total,
                'insights': all_insights,
                'used_prompts': all_used_prompts,
            })

        except Exception as e:
            logger.exception(f"CompetitorCrawlView error for brand {brand_id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CompetitorInsightsView(APIView):
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        insights = CompetitorInsight.objects.filter(
            competitor_profile__brand=brand
        ).select_related('competitor_profile')[:50]

        data = []
        for insight in insights:
            # Parse recommendation, based_on, source_url from hook_text separators
            hook = insight.hook_text
            recommendation = ''
            based_on = ''
            source_url = insight.competitor_profile.handle_or_url

            if ' ||URL|| ' in hook:
                parts = hook.split(' ||URL|| ', 1)
                hook = parts[0]
                source_url = parts[1]

            if ' ||SRC|| ' in hook:
                parts = hook.split(' ||SRC|| ', 1)
                hook = parts[0]
                based_on = parts[1]

            if ' ||REC|| ' in hook:
                parts = hook.split(' ||REC|| ', 1)
                hook = parts[0]
                recommendation = parts[1]

            data.append({
                'id': insight.id,
                'competitor': insight.competitor_profile.handle_or_url,
                'platform': insight.competitor_profile.platform,
                'hook_text': hook,
                'angle': insight.angle,
                'format_type': insight.format_type,
                'engagement_score': insight.engagement_score,
                'recommendation': recommendation,
                'based_on': based_on,
                'source_url': source_url,
                'extracted_at': insight.extracted_at.isoformat(),
            })

        return Response(data)


class BrandTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = BrandTemplateSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceAdmin]

    def get_queryset(self):
        return BrandTemplate.objects.filter(
            brand__workspace__owner=self.request.user
        )


class TrendingTopicsView(APIView):
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request):
        platform = request.query_params.get('platform', '')
        region = request.query_params.get('region', 'global')

        queryset = TrendingCache.objects.filter(
            expires_at__gt=timezone.now()
        )
        if platform:
            queryset = queryset.filter(platform=platform)
        if region != 'all':
            queryset = queryset.filter(region=region)

        serializer = TrendingCacheSerializer(queryset[:50], many=True)
        return Response(serializer.data)


class GenerateIdeasView(APIView):
    """Generate content ideas using LLM with pillar context"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request):
        serializer = GenerateIdeasRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=data['brand_id']
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        count = data.get('count', 10)
        platform = data.get('platform', 'all')
        pillar_id = data.get('pillar_id')

        # Get pillars context
        pillars = brand.content_pillars.filter(is_active=True)
        pillar_names = [p.name for p in pillars]
        pillar_context = ', '.join(pillar_names) if pillar_names else 'General content'

        specific_pillar = None
        if pillar_id:
            specific_pillar = pillars.filter(id=pillar_id).first()

        # V1.2.1 — Fetch learning signals for context
        from analytics.models import LearningSignal
        learning_signals = LearningSignal.objects.filter(
            brand=brand, applied=False
        ).order_by('-created_at')[:10]

        learning_context = ''
        if learning_signals:
            winning_items = []
            for sig in learning_signals:
                winning_items.append(
                    f"- {sig.signal_type}: {sig.insight[:150]}"
                )
            learning_context = f"""
Past winning patterns (use these to inform your ideas):
{chr(10).join(winning_items)}
"""

        # V1.3 — Brand DNA context
        dna_context = ''
        dna = brand.brand_dna or {}
        if dna:
            dna_context = f"""
Brand DNA:
- Voice/Tone: {dna.get('brand_voice', 'professional')}
- Target Audience: {dna.get('target_audience', 'general')}
- USPs: {', '.join(dna.get('unique_selling_points', [])[:5])}
- Content Themes: {', '.join(dna.get('content_themes', [])[:5])}
- Brand Values: {', '.join(dna.get('brand_values', [])[:5])}
- CTA Style: {dna.get('cta_style', '')}
"""

        # V1.3 — Competitor insights context
        competitor_context = ''
        comp_insights = CompetitorInsight.objects.filter(
            competitor_profile__brand=brand
        ).order_by('-engagement_score')[:10]
        if comp_insights.exists():
            insight_items = []
            for ci in comp_insights:
                hook = ci.hook_text.split(' ||REC||')[0][:120]
                insight_items.append(f"- {hook} (score: {ci.engagement_score}/10)")
            competitor_context = f"""
Top competitor strategies to differentiate from:
{chr(10).join(insight_items)}
"""

        # V1.3 — Trending topics context (user-selected take priority)
        trending_context = ''
        user_selected_trends = data.get('trending_topics', [])
        if user_selected_trends:
            trending_items = [f"- {t}" for t in user_selected_trends[:10]]
            trending_context = f"""
USER-SELECTED trending topics (MUST incorporate these into the ideas):
{chr(10).join(trending_items)}
Each idea should be inspired by or directly related to one of these selected trending topics.
"""
        else:
            trending = TrendingCache.objects.filter(
                brand=brand, expires_at__gt=timezone.now()
            ).order_by('-volume_score')[:10]
            if trending.exists():
                trending_items = [f"- {t.topic} (score: {t.volume_score})" for t in trending]
                trending_context = f"""
Current trending topics relevant to your brand:
{chr(10).join(trending_items)}
Incorporate these trends where appropriate.
"""

        # Build prompt
        platform_text = platform if platform != 'all' else 'all platforms (Twitter, LinkedIn, Facebook, Instagram)'
        prompt = f"""<context>
Brand: "{brand.brand_name}"
Industry: {brand.industry}
Region: {brand.target_region}
Platform(s): {platform_text}
Content pillars: {pillar_context}
{f'Focus pillar: {specific_pillar.name}' if specific_pillar else ''}
</context>

<data_signals>
Brand DNA: {dna_context}
Competitor insights: {competitor_context}
Trending topics: {trending_context}
Past performance signals: {learning_context}
</data_signals>

<instructions>
Think step by step:

1. ANALYZE all data signals to identify:
   - High-opportunity topics (trending + relevant to brand)
   - Competitor gaps (things competitors aren't covering well)
   - Audience pain points and aspirations
   - Seasonal or timely angles

2. GENERATE exactly {count} content ideas. For each idea:
   a. Map it to a specific content pillar from the pillars above
   b. Choose a creative framework:
      - Storytelling (customer journey, founder story, behind-the-scenes)
      - Contrarian (challenge conventional wisdom in the industry)
      - Data-driven (surprising stat + insight + action)
      - Listicle (numbered tips, mistakes, tools, examples)
      - Social proof (testimonial, case study, result showcase)
      - Trend-riding (timely angle on current conversation)
      - Educational (how-to, explainer, myth-busting)
   c. Write a hook that would work as the first line of a real post
   d. Specify a concrete content format
   e. Rate the expected engagement tier honestly

3. DIVERSIFY: Ensure variety across hook types, content formats, pillars, and funnel stages (awareness, engagement, conversion, retention).
</instructions>

<output_format>
Return ONLY a JSON array of exactly {count} objects:
[
  {{
    "title": "<specific, descriptive 5-10 word title>",
    "hook": "<the actual scroll-stopping first line, ready to use>",
    "angle": "<the strategic angle or unique perspective, 1-2 sentences>",
    "platform": "<target platform>",
    "goal": "<awareness | engagement | conversion | education>",
    "content_format": "<carousel | reel | story | post | thread | video | poll | infographic>",
    "pillar_name": "<matching content pillar name>",
    "engagement_tier": "<high | medium | low>"
  }}
]
</output_format>

<constraints>
- All ideas must map to provided content pillars.
- No two ideas should have the same hook type AND content format.
- Hooks must be specific to the brand — not generic templates.
- Rate engagement tiers honestly — not everything is "high."
- Return valid JSON array only.
</constraints>"""

        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)
        if override_prompt:
            prompt = override_prompt

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'strategy_ideas')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            from accounts.services.llm_service import get_llm_service

            service = get_llm_service(request.user)
            result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': 'You are a senior social media strategist and creative director who generates content ideas that are specific, actionable, and strategically grounded.\n\nYour ideas are NOT generic "post about X" suggestions. Each idea is detailed enough that a content creator could execute it without additional briefing.\n\nYour approach combines:\n- Data signals (trending topics, competitor gaps, past performance)\n- Audience psychology (what makes people stop, save, share, and comment)\n- Content strategy (pillar balance, funnel alignment, platform optimization)\n- Creative frameworks (storytelling, contrarian takes, data-driven hooks, behind-the-scenes, social proof, UGC-inspired, educational series)\n\nYou understand that the best content ideas are at the intersection of:\n1. What the brand wants to say\n2. What the audience wants to hear\n3. What the platform rewards\n\nCRITICAL OUTPUT RULES:\n- Return ONLY a valid JSON array — no markdown, no commentary\n- Each idea must be specific enough to execute immediately\n- No duplicate angles or overlapping ideas'},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.85,
                max_tokens=6000 if think_harder else 3000,
                thinking_budget=10000 if think_harder else 0,
            )

            if not result.success:
                return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)

            deduct_diamonds(user=request.user, feature='strategy_ideas', provider='claude', raw_tokens=result.tokens_used if hasattr(result, 'tokens_used') else 0)

            import json
            raw = result.content
            # Strip markdown code fences if present
            if raw.startswith('```'):
                raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                if raw.endswith('```'):
                    raw = raw[:-3]
                raw = raw.strip()

            ideas_data = json.loads(raw)

            # Save ideas to database and build response
            import uuid
            batch_id = str(uuid.uuid4())[:8]
            saved_ideas = []

            for idx, idea_raw in enumerate(ideas_data[:count]):
                pillar_match = None
                if specific_pillar:
                    pillar_match = specific_pillar
                elif idea_raw.get('pillar_name'):
                    pillar_match = pillars.filter(name__icontains=idea_raw['pillar_name']).first()

                idea = ContentIdea.objects.create(
                    brand=brand,
                    user=request.user,
                    title=idea_raw.get('title', f'Idea {idx+1}')[:300],
                    hook=idea_raw.get('hook', ''),
                    angle=idea_raw.get('angle', '')[:300],
                    platform=idea_raw.get('platform', 'instagram').lower()[:20],
                    goal=idea_raw.get('goal', 'growth').lower()[:20],
                    content_format=idea_raw.get('content_format', 'text').lower()[:20],
                    status='new',
                    pillar=pillar_match,
                    engagement_tier=idea_raw.get('engagement_tier', 'mid')[:10],
                    source='ai_generated',
                    batch_id=batch_id,
                    generation_run=idx + 1,
                )
                saved_ideas.append({
                    'id': idea.id,
                    'title': idea.title,
                    'hook': idea.hook,
                    'angle': idea.angle,
                    'platform': idea.platform,
                    'goal': idea.goal,
                    'content_format': idea.content_format,
                    'pillar_name': pillar_match.name if pillar_match else '',
                    'engagement_tier': idea.engagement_tier,
                    'source': idea.source,
                    'status': idea.status,
                })

            # Mark learning signals as applied
            if learning_signals:
                LearningSignal.objects.filter(
                    id__in=[s.id for s in learning_signals]
                ).update(applied=True)

            # Save prompt to history
            from brands.models import PromptHistory
            PromptHistory.save_prompt(brand, 'ideas', prompt)

            return Response({
                'brand_id': brand.id,
                'count_requested': count,
                'ideas': saved_ideas,
                'used_prompt': prompt,
            })

        except json.JSONDecodeError:
            return Response({'error': 'Failed to parse AI response'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RegenerateIdeaView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, idea_id):
        try:
            idea = ContentIdea.objects.get(
                id=idea_id, brand__workspace__owner=request.user
            )
        except ContentIdea.DoesNotExist:
            return Response({'error': 'Idea not found'}, status=status.HTTP_404_NOT_FOUND)

        from accounts.services.llm_service import get_llm_service
        import json

        service = get_llm_service(request.user)

        brand = idea.brand
        brand_context = f"Brand: {brand.brand_name}"
        if brand.industry:
            brand_context += f", Industry: {brand.industry}"
        if brand.voice_tone:
            brand_context += f", Voice: {brand.voice_tone}"

        pillar_context = ''
        if idea.pillar:
            pillar_context = f", Content Pillar: {idea.pillar.name}"

        additional_instructions = request.data.get("instructions", "")
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        prompt = f"""<task>
Regenerate this content idea with a completely fresh creative direction.
</task>

<original_idea>
- Title: {idea.title}
- Hook: {idea.hook}
- Angle: {idea.angle}
- Platform: {idea.platform}
</original_idea>

<brand_context>
{brand_context}{pillar_context}
</brand_context>

<instructions>
Think step by step:
1. UNDERSTAND the original idea's core topic and strategic goal.
2. IDENTIFY what creative approach the original used (e.g., question hook + educational angle + curiosity appeal).
3. CHOOSE a deliberately DIFFERENT combination:
   - Different hook type (if original was a question, use a bold statement or stat)
   - Different angle (if original was educational, try emotional or contrarian)
   - Different emotional appeal (if original used curiosity, try FOMO or empathy)
4. WRITE the new version — it should feel like it came from a different creative team.
{f'5. FOLLOW these additional instructions: {additional_instructions}' if additional_instructions else ''}
</instructions>

<output_format>
Return ONLY this JSON:
{{
  "title": "<new title>",
  "hook": "<new hook — ready to use as the first line of a post>",
  "angle": "<new strategic angle>",
  "goal": "<awareness | engagement | conversion | education>",
  "content_format": "<carousel | reel | story | post | thread | video | poll>",
  "engagement_tier": "<high | medium | low>"
}}
</output_format>"""

        if override_prompt:
            prompt = override_prompt

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'idea_regenerate')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            llm_result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': 'You are a creative director who can take any content idea and reimagine it with a completely different creative execution — different hook, different angle, different emotional appeal — while keeping the strategic intent intact.\n\nYou think in terms of creative pivots:\n- If the original was educational, try emotional storytelling\n- If the original asked a question, try a bold, contrarian claim\n- If the original was serious, try humor or relatability\n- If the original was broad, try hyper-specific\n\nCRITICAL OUTPUT RULES:\n- Return ONLY valid JSON — no markdown, no commentary\n- The new version must feel like a brand-new idea, not a rewording'},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.9,
                max_tokens=1000 if think_harder else 500,
                response_format={'type': 'json_object'},
                thinking_budget=10000 if think_harder else 0,
            )
            if not llm_result.success:
                return Response({'error': llm_result.error}, status=status.HTTP_400_BAD_REQUEST)

            deduct_diamonds(user=request.user, feature='idea_regenerate', provider='claude', raw_tokens=llm_result.tokens_used if hasattr(llm_result, 'tokens_used') else 0)

            result = json.loads(llm_result.content)
        except Exception as e:
            return Response({'error': f'Regeneration failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Update the idea with regenerated content
        idea.title = result.get('title', idea.title)
        idea.hook = result.get('hook', idea.hook)
        idea.angle = result.get('angle', idea.angle)
        idea.goal = result.get('goal', idea.goal)
        idea.content_format = result.get('content_format', idea.content_format)
        idea.engagement_tier = result.get('engagement_tier', idea.engagement_tier)
        idea.generation_run += 1
        idea.save()

        return Response({
            'id': idea.id,
            'title': idea.title,
            'hook': idea.hook,
            'angle': idea.angle,
            'platform': idea.platform,
            'goal': idea.goal,
            'content_format': idea.content_format,
            'engagement_tier': idea.engagement_tier,
            'generation_run': idea.generation_run,
            'used_prompt': prompt,
        })


class AddIdeaToCalendarView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, idea_id):
        try:
            idea = ContentIdea.objects.get(
                id=idea_id, brand__workspace__owner=request.user
            )
        except ContentIdea.DoesNotExist:
            return Response({'error': 'Idea not found'}, status=status.HTTP_404_NOT_FOUND)

        from posts.models import Post
        post = Post.objects.create(
            user=request.user,
            caption=idea.hook or idea.title,
            scheduled_time=timezone.now(),
            status='draft',
            idea=idea,
            brand=idea.brand,
            pillar=idea.pillar,
            hook=idea.hook,
            angle=idea.angle,
            format_type=idea.content_format or '',
            goal=idea.goal or '',
        )
        idea.status = 'used'
        idea.post = post
        idea.save()
        post.update_checklist()

        return Response({
            'message': 'Idea added to calendar as draft',
            'post_id': post.id,
        }, status=status.HTTP_201_CREATED)


# ============================================================
# V1.3 NEW VIEWS — Trending, DNA History, Overflow, Idea History
# ============================================================


class GenerateTrendingView(APIView):
    """Generate trending topics for a brand using pytrends + OpenAI"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'trending_generation')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            from .trending_service import generate_trending_for_brand
            override_prompt = request.data.get('override_prompt', '')
            think_harder = request.data.get('think_harder', False)
            result = generate_trending_for_brand(brand_id, request.user, override_prompt=override_prompt or None, think_harder=think_harder)

            deduct_diamonds(user=request.user, feature='trending_generation', provider='claude', raw_tokens=0)

            return Response(result)
        except Exception as e:
            logger.error(f"Trending generation failed for brand {brand_id}: {e}", exc_info=True)
            return Response(
                {'error': f'Trending generation failed: {str(e)}', 'topics': []},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BrandTrendingTopicsView(APIView):
    """Get cached trending topics for a specific brand"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        topics = TrendingCache.objects.filter(
            brand_id=brand_id,
            expires_at__gt=timezone.now()
        ).order_by('-volume_score')[:30]

        data = [{
            'id': t.id,
            'platform': t.platform,
            'topic': t.topic,
            'volume_score': t.volume_score,
            'region': t.region,
            'relevance_explanation': t.relevance_explanation,
            'expires_at': t.expires_at.isoformat(),
        } for t in topics]

        return Response({'brand_id': brand_id, 'count': len(data), 'topics': data})


class BrandDNAHistoryView(APIView):
    """List and manage DNA generation history for a brand"""
    permission_classes = [IsAuthenticated]

    def get(self, request, brand_id):
        history = BrandDNAHistory.objects.filter(
            brand_id=brand_id,
            brand__user=request.user
        ).order_by('-generated_at')[:20]

        data = [{
            'id': h.id,
            'website_url': h.website_url,
            'source': h.source,
            'is_active': h.is_active,
            'generated_at': h.generated_at.isoformat(),
            'brand_name': h.dna_data.get('brand_name', ''),
            'industry': h.dna_data.get('industry', ''),
        } for h in history]

        return Response({'brand_id': brand_id, 'history': data})


class RestoreDNAView(APIView):
    """Restore a previous DNA version as the active one"""
    permission_classes = [IsAuthenticated]

    def post(self, request, brand_id, history_id):
        try:
            brand = Brand.objects.get(id=brand_id, user=request.user)
            history_entry = BrandDNAHistory.objects.get(id=history_id, brand=brand)
        except (Brand.DoesNotExist, BrandDNAHistory.DoesNotExist):
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Deactivate all, activate this one
        BrandDNAHistory.objects.filter(brand=brand).update(is_active=False)
        history_entry.is_active = True
        history_entry.save()

        # Restore to brand
        brand.brand_dna = history_entry.dna_data
        brand.brand_dna_generated_at = history_entry.generated_at
        brand.brand_dna_source = history_entry.source
        brand.website_url = history_entry.website_url
        brand.save()

        return Response({
            'message': 'DNA restored successfully',
            'dna_data': brand.brand_dna,
            'generated_at': brand.brand_dna_generated_at.isoformat() if brand.brand_dna_generated_at else None,
        })


class OverflowProgressView(APIView):
    """Get or update overflow flow progress"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        progress, created = OverflowProgress.objects.get_or_create(user=request.user)
        return Response({
            'current_step': progress.current_step,
            'completed_steps': progress.completed_steps,
            'dna_completed': progress.dna_completed,
            'pillars_completed': progress.pillars_completed,
            'competitors_completed': progress.competitors_completed,
            'trending_completed': progress.trending_completed,
            'selected_idea_ids': progress.selected_idea_ids,
            'idea_media_preferences': progress.idea_media_preferences,
            'selected_caption_ids': progress.selected_caption_ids,
            'generated_media_ids': progress.generated_media_ids,
            'created_post_id': progress.created_post_id,
            'is_completed': progress.is_completed,
            'is_skipped': progress.is_skipped,
            'brand_id': progress.brand_id,
        })

    def put(self, request):
        progress, _ = OverflowProgress.objects.get_or_create(user=request.user)
        data = request.data

        for field in [
            'current_step', 'dna_completed', 'pillars_completed',
            'competitors_completed', 'trending_completed',
            'selected_idea_ids', 'idea_media_preferences',
            'selected_caption_ids', 'generated_media_ids',
            'created_post_id', 'is_completed', 'brand_id',
        ]:
            if field in data:
                setattr(progress, field, data[field])

        # Auto-manage completed_steps
        if data.get('current_step') and data['current_step'] not in progress.completed_steps:
            prev = data['current_step'] - 1
            if prev > 0 and prev not in progress.completed_steps:
                progress.completed_steps.append(prev)

        if data.get('is_completed'):
            progress.completed_at = timezone.now()

        progress.save()
        return Response({'message': 'Progress updated', 'current_step': progress.current_step})


class OverflowSkipView(APIView):
    """Skip the overflow flow"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        progress, _ = OverflowProgress.objects.get_or_create(user=request.user)
        progress.is_skipped = True
        progress.save()
        return Response({'message': 'Overflow flow skipped'})


class IdeaHistoryView(APIView):
    """List all historical ideas for the user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand_id = request.query_params.get('brand_id')
        status_filter = request.query_params.get('status', '')
        platform = request.query_params.get('platform', '')
        search = request.query_params.get('search', '')

        ideas = ContentIdea.objects.filter(
            Q(brand__user=request.user) | Q(user=request.user)
        ).select_related('pillar', 'brand')

        if brand_id:
            ideas = ideas.filter(brand_id=brand_id)
        if status_filter:
            ideas = ideas.filter(status=status_filter)
        if platform:
            ideas = ideas.filter(platform=platform)
        if search:
            ideas = ideas.filter(Q(title__icontains=search) | Q(hook__icontains=search))

        ideas = ideas.order_by('-created_at')[:100]

        data = [{
            'id': i.id,
            'title': i.title,
            'hook': i.hook,
            'angle': i.angle,
            'platform': i.platform,
            'goal': i.goal,
            'content_format': i.content_format,
            'status': i.status,
            'pillar_name': i.pillar.name if i.pillar else '',
            'engagement_tier': i.engagement_tier,
            'source': i.source,
            'media_preference': i.media_preference,
            'brand_name': i.brand.brand_name if i.brand else '',
            'created_at': i.created_at.isoformat(),
        } for i in ideas]

        return Response({'count': len(data), 'ideas': data})


# ============================================================
# V1.4 NEW VIEWS — Competitor Suggest, Pillar Generate, Trend Feedback
# ============================================================


class SuggestCompetitorsView(APIView):
    """AI-suggest competitors based on brand DNA + industry + region"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request):
        brand_id = request.data.get('brand_id')
        count = request.data.get('count', 5)
        if not brand_id:
            return Response({'error': 'brand_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user), id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        from accounts.services.llm_service import get_llm_service

        dna = brand.brand_dna or {}
        existing = list(CompetitorProfile.objects.filter(brand=brand).values_list('handle_or_url', flat=True))
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'competitor_suggest')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        try:
            service = get_llm_service(request.user)

            system_prompt = """You are a competitive intelligence researcher with deep knowledge of the global business landscape. You specialize in identifying direct, indirect, and aspirational competitors for brands across industries.

Your suggestions are ALWAYS real, verifiable companies — never fabricated.
You prioritize companies that have active, monitorable online presences.

CRITICAL: If you are not confident a company exists or cannot verify its handle/URL, do NOT include it. Accuracy is more important than hitting the requested count.

Return ONLY valid JSON — no markdown, no commentary."""

            prompt = f"""<task>
Suggest real competitor companies for competitive analysis and monitoring.
</task>

<context>
Brand: "{brand.brand_name}"
Industry: {brand.industry}
Region: {brand.target_region}
</context>

<existing_competitors>
Already added (DO NOT suggest): {', '.join(existing) if existing else 'None'}
</existing_competitors>

<instructions>
Think step by step:

1. IDENTIFY the competitive landscape for "{brand.brand_name}" in {brand.industry} within {brand.target_region}.
2. CONSIDER three categories:
   - **Direct competitors** (same product/service, same audience)
   - **Indirect competitors** (different product, overlapping audience)
   - **Aspirational competitors** (industry leaders to learn from)
3. SUGGEST exactly {count} real, verifiable companies.
4. For each, choose the platform where they are MOST ACTIVE and monitorable.
5. Provide their actual handle or URL — not a guess.

IMPORTANT: Only suggest companies you are confident are real. If unsure about a handle or URL, use their website URL instead.
</instructions>

<output_format>
{{
  "competitors": [
    {{
      "name": "<real company name>",
      "platform": "<website | twitter | linkedin | facebook | instagram>",
      "handle_or_url": "<verified URL or @handle>",
      "reason": "<1-2 sentence explanation of competitive relevance>"
    }}
  ]
}}
</output_format>

<constraints>
- ONLY real, existing companies — never fabricate.
- Platform must be: website, twitter, linkedin, facebook, or instagram.
- Do NOT duplicate any name in the existing competitors list.
- If unsure of a social handle, default to the company's website URL.
- Return valid JSON only.
</constraints>"""

            if override_prompt:
                prompt = override_prompt

            llm_result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.3,
                max_tokens=3000 if think_harder else 1500,
                response_format={'type': 'json_object'},
                thinking_budget=10000 if think_harder else 0,
            )

            if not llm_result.success:
                return Response({'error': llm_result.error}, status=status.HTTP_400_BAD_REQUEST)

            deduct_diamonds(user=request.user, feature='competitor_suggest', provider='claude', raw_tokens=llm_result.tokens_used if hasattr(llm_result, 'tokens_used') else 0)

            import json
            result = json.loads(llm_result.content)
            suggestions = result.get('competitors', [])

            # Save prompt to history
            from brands.models import PromptHistory
            full_prompt = f"SYSTEM:\n{system_prompt}\n\nUSER:\n{prompt}"
            PromptHistory.save_prompt(brand, 'suggest_competitors', full_prompt)

            return Response({
                'brand_id': brand.id,
                'count': len(suggestions),
                'suggestions': suggestions,
                'used_prompt': full_prompt,
            })

        except Exception as e:
            logger.error(f"Competitor suggestion failed: {e}", exc_info=True)
            return Response(
                {'error': f'Suggestion failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GeneratePillarsView(APIView):
    """AI-generate content pillars based on brand DNA + competitors + trends"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user), id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        count = request.data.get('count', 5)
        focus_areas = request.data.get('focus_areas', [])
        override_prompt = request.data.get('override_prompt', '')
        think_harder = request.data.get('think_harder', False)

        from accounts.services.llm_service import get_llm_service

        # Diamond Token pre-check
        can_afford, cost, balance = pre_check(request.user, 'pillar_generation')
        if not can_afford:
            return Response({
                'error': 'Insufficient Diamond Tokens',
                'diamond_cost': cost,
                'diamond_balance': balance,
                'code': 'INSUFFICIENT_DIAMONDS',
            }, status=402)

        dna = brand.brand_dna or {}

        # Build concise Brand DNA summary for pillar generation
        dna_parts = []
        if dna.get('description'):
            dna_parts.append(f"Description: {dna['description'][:200]}")
        if dna.get('target_audience'):
            dna_parts.append(f"Target audience: {dna['target_audience'][:150]}")
        if dna.get('products_services'):
            items = dna['products_services'] if isinstance(dna['products_services'], list) else [dna['products_services']]
            dna_parts.append(f"Products/Services: {', '.join(items[:8])}")
        if dna.get('unique_selling_points'):
            usps = dna['unique_selling_points'] if isinstance(dna['unique_selling_points'], list) else [dna['unique_selling_points']]
            dna_parts.append(f"USPs: {', '.join(usps[:5])}")
        if dna.get('brand_voice'):
            dna_parts.append(f"Brand voice: {dna['brand_voice'][:100]}")
        if dna.get('brand_values'):
            vals = dna['brand_values'] if isinstance(dna['brand_values'], list) else [dna['brand_values']]
            dna_parts.append(f"Brand values: {', '.join(vals[:5])}")
        if dna.get('content_themes'):
            themes = dna['content_themes'] if isinstance(dna['content_themes'], list) else [dna['content_themes']]
            dna_parts.append(f"Content themes: {', '.join(themes[:5])}")
        if dna.get('keywords'):
            kws = dna['keywords'] if isinstance(dna['keywords'], list) else [dna['keywords']]
            dna_parts.append(f"Keywords: {', '.join(kws[:8])}")
        if dna.get('cta_style'):
            dna_parts.append(f"CTA style: {dna['cta_style'][:80]}")
        if dna.get('competitor_positioning'):
            dna_parts.append(f"Positioning: {dna['competitor_positioning'][:150]}")
        dna_context = '\n'.join(dna_parts) if dna_parts else 'No Brand DNA generated yet'

        existing_qs = ContentPillar.objects.filter(brand=brand)
        existing_pillars = list(existing_qs.values_list('name', flat=True))
        existing_pct_sum = sum(existing_qs.values_list('target_percentage', flat=True))
        remaining_pct = max(100 - existing_pct_sum, 0)

        # If existing pillars already fill 100%, rebalance all to make room
        rebalance = existing_pct_sum >= 100 and len(existing_pillars) > 0

        # Gather competitor insights
        insights = CompetitorInsight.objects.filter(
            competitor_profile__brand=brand
        ).order_by('-engagement_score')[:15]
        insight_texts = [ci.hook_text.split(' ||REC||')[0][:100] for ci in insights]

        # Gather trending topics
        trending = TrendingCache.objects.filter(
            brand=brand, expires_at__gt=timezone.now()
        ).order_by('-volume_score')[:10]
        trending_texts = [t.topic for t in trending]

        total_pillars = len(existing_pillars) + count

        try:
            import json
            service = get_llm_service(request.user)

            if rebalance:
                pct_instruction = f"""Percentages for the NEW {count} pillars must sum to {round(100 * count / total_pillars)}.
The existing {len(existing_pillars)} pillars will be rebalanced so ALL pillars together sum to exactly 100."""
            elif remaining_pct > 0:
                pct_instruction = f"Percentages for these {count} new pillars must sum to exactly {remaining_pct} (existing pillars use {existing_pct_sum}%)."
            else:
                pct_instruction = f"Percentages must sum to exactly 100."

            system_prompt = """You are a content strategy architect who designs balanced content pillar frameworks for social media brands. Your pillars are not vague categories — they are strategic content territories that guide what to create, why, and how it serves the brand's goals.

A great pillar framework:
- Covers the full content funnel (awareness > consideration > conversion > retention)
- Balances audience value with business objectives
- Creates clear, non-overlapping content categories
- Is specific enough to guide daily content decisions
- Is flexible enough to accommodate trends and timely content

Return ONLY valid JSON — no markdown, no commentary."""

            prompt = f"""<task>
Generate a content pillar strategy framework for a brand's social media presence.
Use the Brand DNA to deeply understand the business before designing pillars.
</task>

<brand_dna>
{dna_context}
</brand_dna>

<context>
Brand: "{brand.brand_name}"
Industry: {brand.industry}
Competitor strategies: {'; '.join(insight_texts[:5]) if insight_texts else 'None analyzed yet'}
Trending topics: {', '.join(trending_texts[:5]) if trending_texts else 'None'}
Existing pillars (DO NOT duplicate): {', '.join(existing_pillars) if existing_pillars else 'None'}
{f'Focus areas to emphasize: {", ".join(focus_areas)}' if focus_areas else ''}
</context>

<instructions>
1. Read the Brand DNA carefully — understand the products, audience, voice, values, and positioning.
2. Analyze the brand's industry, competitors, and trends.
3. Design exactly {count} content pillars that align with the brand's DNA and form a balanced strategy.
4. For each pillar:
   a. Name: 2-4 words, specific and descriptive (e.g., "Customer Wins" not "Engagement").
   b. Description: What types of content fall here AND why it matters strategically.
   c. Target percentage: What share of total content this pillar should receive.
   d. Color code: A unique hex color for visual differentiation.
5. {pct_instruction}
6. Include a mix of: educational, promotional, community-building, and authority content.
7. Pillars should reflect the brand's products, audience interests, and unique positioning from the DNA.
</instructions>

<output_format>
{{
  "pillars": [
    {{
      "name": "<2-4 word pillar name>",
      "description": "<what content fits here + strategic purpose>",
      "target_percentage": <integer>,
      "color_code": "<#hex>"
    }}
  ]
}}
</output_format>

<constraints>
- No pillar should overlap thematically with another.
- Do NOT duplicate existing pillars listed above.
- Return valid JSON only.
</constraints>"""

            if override_prompt:
                prompt = override_prompt

            llm_result = service.chat_completion(
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.5,
                max_tokens=3000 if think_harder else 1500,
                response_format={'type': 'json_object'},
                thinking_budget=10000 if think_harder else 0,
            )

            if not llm_result.success:
                return Response({'error': llm_result.error}, status=status.HTTP_400_BAD_REQUEST)

            deduct_diamonds(user=request.user, feature='pillar_generation', provider='claude', raw_tokens=llm_result.tokens_used if hasattr(llm_result, 'tokens_used') else 0)

            result = json.loads(llm_result.content)
            pillars_data = result.get('pillars', [])

            # Force-normalize percentages so new + existing = 100
            new_pct_sum = sum(p.get('target_percentage', 0) for p in pillars_data) or 1
            if rebalance:
                # Rebalance existing pillars
                target_existing = round(100 * len(existing_pillars) / total_pillars)
                target_new = 100 - target_existing
                for ep in existing_qs:
                    ep.target_percentage = max(1, round(target_existing / len(existing_pillars)))
                    ep.save(update_fields=['target_percentage'])
                for p in pillars_data:
                    p['target_percentage'] = max(1, round(p.get('target_percentage', 0) * target_new / new_pct_sum))
            else:
                available = remaining_pct if remaining_pct > 0 else 100
                for p in pillars_data:
                    p['target_percentage'] = max(1, round(p.get('target_percentage', 0) * available / new_pct_sum))

            # Final adjustment to hit exactly 100%
            all_existing_pct = sum(existing_qs.values_list('target_percentage', flat=True)) if rebalance else existing_pct_sum
            total_new_pct = sum(p.get('target_percentage', 0) for p in pillars_data)
            diff = 100 - all_existing_pct - total_new_pct
            if diff != 0 and pillars_data:
                pillars_data[0]['target_percentage'] = max(1, pillars_data[0].get('target_percentage', 0) + diff)

            created_pillars = []
            for p in pillars_data:
                pillar = ContentPillar.objects.create(
                    brand=brand,
                    name=p.get('name', 'Untitled'),
                    description=p.get('description', ''),
                    target_percentage=p.get('target_percentage', 0),
                    color_code=p.get('color_code', '#6B7280'),
                )
                created_pillars.append(pillar)

            # Save prompt to history
            from brands.models import PromptHistory
            PromptHistory.save_prompt(brand, 'pillars', prompt)

            serializer = ContentPillarSerializer(created_pillars, many=True)
            return Response({
                'brand_id': brand.id,
                'count': len(created_pillars),
                'pillars': serializer.data,
                'used_prompt': prompt,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Pillar generation failed: {e}", exc_info=True)
            return Response(
                {'error': f'Pillar generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class TrendFeedbackView(APIView):
    """Submit or retrieve trend feedback for learning"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user), id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        topic_text = request.data.get('topic_text', '').strip()
        is_accepted = request.data.get('is_accepted')
        source_trending_id = request.data.get('source_trending_id')

        if not topic_text or is_accepted is None:
            return Response(
                {'error': 'topic_text and is_accepted are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from brands.models import TrendFeedback
        feedback, created = TrendFeedback.objects.update_or_create(
            brand=brand,
            topic_text=topic_text,
            defaults={
                'is_accepted': is_accepted,
                'source_trending_id': source_trending_id,
            },
        )

        return Response({
            'id': feedback.id,
            'topic_text': feedback.topic_text,
            'is_accepted': feedback.is_accepted,
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user), id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        from brands.models import TrendFeedback
        feedback = TrendFeedback.objects.filter(brand=brand).order_by('-created_at')[:200]
        data = [{
            'id': f.id,
            'topic_text': f.topic_text,
            'is_accepted': f.is_accepted,
            'source_trending_id': f.source_trending_id,
            'created_at': f.created_at.isoformat(),
        } for f in feedback]

        return Response({'brand_id': brand.id, 'count': len(data), 'feedback': data})


class ManualTrendView(APIView):
    """Add a manual trending topic"""
    permission_classes = [IsAuthenticated, IsCreatorOrAbove]

    def post(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user), id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        topic = request.data.get('topic', '').strip()
        relevance_explanation = request.data.get('relevance_explanation', '')

        if not topic:
            return Response({'error': 'topic is required'}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import timedelta
        trend = TrendingCache.objects.create(
            platform='manual',
            topic=topic[:500],
            volume_score=50,
            region=brand.target_region or 'global',
            brand=brand,
            relevance_explanation=relevance_explanation[:500] if relevance_explanation else 'Manually added by user',
            expires_at=timezone.now() + timedelta(hours=24),
        )

        return Response({
            'id': trend.id,
            'topic': trend.topic,
            'platform': trend.platform,
            'volume_score': trend.volume_score,
            'relevance_explanation': trend.relevance_explanation,
            'expires_at': trend.expires_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class PromptHistoryView(APIView):
    """Get prompt history for a brand + feature"""
    permission_classes = [IsAuthenticated, IsViewerOrAbove]

    def get(self, request, brand_id):
        try:
            brand = Brand.objects.get(
                Q(user=request.user) | Q(workspace__owner=request.user),
                id=brand_id
            )
        except Brand.DoesNotExist:
            return Response({'error': 'Brand not found'}, status=status.HTTP_404_NOT_FOUND)

        feature = request.query_params.get('feature', '')
        valid_features = [c[0] for c in PromptHistory.FEATURE_CHOICES]

        if feature and feature not in valid_features:
            return Response(
                {'error': f'Invalid feature. Choose from: {", ".join(valid_features)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = PromptHistory.objects.filter(brand=brand)
        if feature:
            qs = qs.filter(feature=feature)

        entries = qs.order_by('-created_at')[:10]

        return Response({
            'brand_id': brand.id,
            'feature': feature or 'all',
            'history': [
                {
                    'id': e.id,
                    'feature': e.feature,
                    'prompt_text': e.prompt_text,
                    'created_at': e.created_at.isoformat(),
                }
                for e in entries
            ],
        })
