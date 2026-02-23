import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

from accounts.permissions import IsWorkspaceAdmin, IsCreatorOrAbove, IsViewerOrAbove

from brands.models import (
    Brand, Workspace, ContentPillar, CompetitorProfile, CompetitorInsight,
    BrandTemplate, TrendingCache, ContentIdea, BrandDNAHistory, OverflowProgress
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

        try:
            from accounts.api_keys import get_openai_key
            import openai, json

            api_key = get_openai_key(request.user)
            if not api_key:
                return Response(
                    {'error': 'OpenAI API key not configured. Go to Settings to add your key.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            client = openai.OpenAI(api_key=api_key)
            all_insights = []

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

                prompt = f"""Analyze this competitor for my brand based on their ACTUAL page content.

MY BRAND:
- Name: "{brand.brand_name}"
- Industry: {brand.industry}
- Target Region: {brand.target_region}
- Content Pillars: {pillar_context}

COMPETITOR:
- URL/Handle: {profile.handle_or_url}
- Platform: {profile.get_platform_display()}
{page_context}

Based on the ACTUAL content from their site, provide 10 specific competitive insights.
Each insight MUST reference a specific page from the crawled URLs above.
Use DIFFERENT source_url values - pick the most relevant page URL for each insight.

For each insight provide:
- hook_text: A specific content strategy or post idea for MY brand to compete (max 200 chars)
- angle: Why this works based on what you see in their content (max 150 chars)
- format_type: Best format (text/image/video/carousel/reel/story)
- engagement_score: Effectiveness for MY brand (1-10)
- recommendation: Exact action step for "{brand.brand_name}" (max 200 chars)
- based_on: What specific part of their content inspired this insight (max 100 chars)
- source_url: The EXACT page URL from the list above that this insight is based on. MUST be one of the actual crawled URLs, not the base URL unless the insight is actually from the homepage.

Return as JSON array only."""

                response = client.chat.completions.create(
                    model='gpt-4o-mini',
                    messages=[
                        {'role': 'system', 'content': 'You are a competitive intelligence analyst. Analyze the actual page content provided. Each insight must reference a specific page URL from the crawled pages. Return only valid JSON arrays.'},
                        {'role': 'user', 'content': prompt},
                    ],
                    temperature=0.5,
                    max_tokens=4500,
                )

                raw = response.choices[0].message.content.strip()
                if raw.startswith('```'):
                    raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                    if raw.endswith('```'):
                        raw = raw[:-3]
                    raw = raw.strip()

                insights_data = json.loads(raw)

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
                        hook_text=hook_with_extras[:700],
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

            return Response({
                'message': f'Analysis complete for {profiles.count()} competitor(s), crawled {pages_crawled_total} pages',
                'brand_id': brand.id,
                'pages_crawled': pages_crawled_total,
                'insights': all_insights,
            })

        except Exception as e:
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
        prompt = f"""I have a {brand.industry} brand/business called "{brand.brand_name}" in {brand.target_region}.

{dna_context}{competitor_context}{trending_context}{learning_context}
Content pillars: {pillar_context}
{f'Focus pillar: {specific_pillar.name}' if specific_pillar else ''}
Platform: {platform_text}

Based on the above context — especially the trending topics — generate exactly {count} unique, actionable content ideas that I can post on social media to increase my brand visibility, engagement, and sales.

Each idea must be:
- Directly inspired by one of the trending topics or current events
- Tailored to my brand, industry, and target audience
- Ready to execute — specific enough to write a caption from

For each idea, return:
- title: A catchy, scroll-stopping title (max 80 chars, NO generic text like "Idea 1")
- hook: An attention-grabbing opening line that makes people stop scrolling
- angle: The unique perspective, story, or approach
- platform: Best platform for this idea (twitter/linkedin/facebook/instagram)
- goal: Content goal (leads/growth/authority)
- content_format: Format type (text/image/video/carousel/reel/thread)
- pillar_name: Which content pillar this fits
- engagement_tier: Expected engagement (high/mid/low)

Return as JSON array. Only return the JSON array, no other text."""

        try:
            from accounts.api_keys import get_openai_key
            import openai

            api_key = get_openai_key(request.user)
            if not api_key:
                return Response(
                    {'error': 'OpenAI API key not configured. Go to Settings to add your key.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {'role': 'system', 'content': 'You are a senior social media analyst and business development strategist. You analyze trending topics and create viral, high-converting content ideas that drive real business results — more followers, more engagement, more sales. Return only valid JSON arrays.'},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.85,
                max_tokens=3000,
            )

            import json
            raw = response.choices[0].message.content.strip()
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

            return Response({
                'brand_id': brand.id,
                'count_requested': count,
                'ideas': saved_ideas,
            })

        except openai.AuthenticationError:
            return Response({'error': 'Invalid OpenAI API key'}, status=status.HTTP_401_UNAUTHORIZED)
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

        from accounts.api_keys import get_openai_key
        import openai, json

        api_key = get_openai_key(request.user)
        if not api_key:
            return Response(
                {'error': 'No OpenAI API key configured.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        brand = idea.brand
        brand_context = f"Brand: {brand.brand_name}"
        if brand.industry:
            brand_context += f", Industry: {brand.industry}"
        if brand.voice_tone:
            brand_context += f", Voice: {brand.voice_tone}"

        pillar_context = ''
        if idea.pillar:
            pillar_context = f", Content Pillar: {idea.pillar.name}"

        prompt = f"""Regenerate a single content idea with a fresh angle.

{brand_context}{pillar_context}

Original idea to improve:
- Title: {idea.title}
- Hook: {idea.hook}
- Angle: {idea.angle}
- Platform: {idea.platform}
- Goal: {idea.goal}
- Format: {idea.content_format}

{f'Additional instructions: {request.data.get("instructions", "")}' if request.data.get("instructions") else ''}

Create a completely new version with a different hook and angle, keeping the same platform, goal, and format.

Return JSON:
{{"title": "...", "hook": "...", "angle": "...", "goal": "...", "content_format": "...", "engagement_tier": "high|medium|low"}}
"""

        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {'role': 'system', 'content': 'You are an expert social media strategist. Return only valid JSON.'},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.9,
                max_tokens=500,
                response_format={'type': 'json_object'},
            )
            result = json.loads(response.choices[0].message.content)
        except openai.AuthenticationError:
            return Response({'error': 'Invalid OpenAI API key'}, status=status.HTTP_401_UNAUTHORIZED)
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

        try:
            from .trending_service import generate_trending_for_brand
            result = generate_trending_for_brand(brand_id, request.user)
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
