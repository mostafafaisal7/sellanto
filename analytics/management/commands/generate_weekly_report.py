"""
Weekly Report Generator Management Command
- Aggregate weekly analytics
- LLM-generated recommendations
- A/B test results
- Run Sunday midnight
"""
import json
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Avg, Sum, Count, Max, F
from datetime import timedelta

from brands.models import Brand, WeeklyReport
from analytics.models import PostAnalytics, LearningSignal
from posts.models import Post, PostCaption

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate weekly reports for all active brands'

    def handle(self, *args, **options):
        now = timezone.now()
        period_end = now.date()
        period_start = period_end - timedelta(days=7)

        brands = Brand.objects.filter(workspace__is_active=True)
        generated = 0

        for brand in brands:
            # Check if report already exists for this period
            existing = WeeklyReport.objects.filter(
                brand=brand,
                period_start=period_start,
                period_end=period_end,
            ).exists()
            if existing:
                continue

            # Aggregate analytics for the week
            analytics = PostAnalytics.objects.filter(
                post__brand=brand,
                fetched_at__date__gte=period_start,
                fetched_at__date__lte=period_end,
            )

            posts = Post.objects.filter(
                brand=brand,
                posted_at__date__gte=period_start,
                posted_at__date__lte=period_end,
            )

            # Find winners (top 3 by engagement)
            winners = list(
                analytics.order_by('-engagement_rate').values(
                    'post_id', 'platform', 'engagement_rate', 'impressions', 'likes'
                )[:3]
            )

            # Find losers (bottom 3)
            losers = list(
                analytics.order_by('engagement_rate').values(
                    'post_id', 'platform', 'engagement_rate', 'impressions', 'likes'
                )[:3]
            )

            # Best hooks from winning posts
            winner_ids = [w['post_id'] for w in winners]
            best_hooks = list(
                Post.objects.filter(id__in=winner_ids).values_list('hook', flat=True)
            )

            # Pillar performance
            pillar_perf = {}
            for pillar in brand.content_pillars.filter(is_active=True):
                pillar_analytics = analytics.filter(post__pillar=pillar)
                agg = pillar_analytics.aggregate(
                    avg_engagement=Avg('engagement_rate'),
                    total_posts=Count('post_id', distinct=True),
                )
                pillar_perf[pillar.name] = {
                    'avg_engagement': round(agg['avg_engagement'] or 0, 2),
                    'total_posts': agg['total_posts'],
                    'target_percentage': pillar.target_percentage,
                }

            # Overall aggregates
            agg = analytics.aggregate(
                avg_engagement=Avg('engagement_rate'),
                total_impressions=Sum('impressions'),
                total_likes=Sum('likes'),
                total_shares=Sum('shares'),
            )

            data = {
                'total_posts': posts.count(),
                'avg_engagement_rate': round(agg['avg_engagement'] or 0, 2),
                'total_impressions': agg['total_impressions'] or 0,
                'total_likes': agg['total_likes'] or 0,
                'total_shares': agg['total_shares'] or 0,
            }

            # A/B test results for this week
            ab_test_results = self._compute_ab_results(brand, period_start, period_end)

            # LLM-generated recommendations
            recommendations, test_plan = self._generate_llm_recommendations(
                brand, data, winners, losers, pillar_perf, ab_test_results
            )

            report = WeeklyReport.objects.create(
                brand=brand,
                workspace=brand.workspace,
                period_start=period_start,
                period_end=period_end,
                data=data,
                winners=winners,
                losers=losers,
                best_hooks=[h for h in best_hooks if h],
                best_times={},  # Populated by best_time_service
                pillar_performance=pillar_perf,
                ab_test_results=ab_test_results,
                recommendations=recommendations,
                test_plan=test_plan,
            )

            # Extract learning signals from winners
            for w in winners:
                LearningSignal.objects.create(
                    brand=brand,
                    signal_type='best_hook',
                    reference_id=str(w['post_id']),
                    data_json=w,
                )

            # Notify workspace owner
            try:
                from accounts.services.notification_service import notify_weekly_report
                notify_weekly_report(brand.workspace.owner, brand, report)
            except Exception as e:
                logger.error(f"Failed to send weekly report notification for {brand.brand_name}: {e}")

            generated += 1

        self.stdout.write(
            self.style.SUCCESS(f'Weekly reports generated: {generated} brands')
        )

    def _compute_ab_results(self, brand, period_start, period_end):
        """Compare A/B tagged captions for posts published this week."""
        ab_captions = PostCaption.objects.filter(
            post__brand=brand,
            post__posted_at__date__gte=period_start,
            post__posted_at__date__lte=period_end,
            is_ab_test=True,
        ).select_related('post')

        if not ab_captions.exists():
            return {}

        # Group by post
        post_groups = {}
        for cap in ab_captions:
            pid = cap.post_id
            if pid not in post_groups:
                post_groups[pid] = {'A': [], 'B': []}
            label = cap.ab_label or 'A'
            post_groups[pid].setdefault(label, []).append(cap)

        results = []
        for post_id, labels in post_groups.items():
            if not labels.get('A') or not labels.get('B'):
                continue

            # Get analytics for this post
            post_analytics = PostAnalytics.objects.filter(
                post_id=post_id, snapshot_type='48h',
            ).first()

            er = float(post_analytics.engagement_rate) if post_analytics else 0

            cap_a = labels['A'][0]
            cap_b = labels['B'][0]

            results.append({
                'post_id': post_id,
                'variant_a': cap_a.body[:100] if cap_a.body else '',
                'variant_b': cap_b.body[:100] if cap_b.body else '',
                'selected': cap_a.ab_label if cap_a.is_selected else cap_b.ab_label,
                'engagement_rate': er,
            })

        return {'tests': results, 'total': len(results)}

    def _generate_llm_recommendations(self, brand, data, winners, losers, pillar_perf, ab_results):
        """Use LLM to generate strategic recommendations and test plan."""
        try:
            from accounts.api_keys import get_openai_key
            import openai

            api_key = get_openai_key(brand.workspace.owner)
            if not api_key:
                return [], {}

            summary = (
                f"Brand: {brand.brand_name}, Industry: {brand.industry or 'general'}\n"
                f"This week: {data['total_posts']} posts, "
                f"avg engagement {data['avg_engagement_rate']}%, "
                f"{data['total_impressions']} impressions, "
                f"{data['total_likes']} likes, {data['total_shares']} shares.\n"
            )

            if winners:
                summary += f"Top posts engagement: {[w.get('engagement_rate', 0) for w in winners]}\n"
            if losers:
                summary += f"Lowest posts engagement: {[l.get('engagement_rate', 0) for l in losers]}\n"
            if pillar_perf:
                summary += f"Pillar performance: {json.dumps(pillar_perf)}\n"
            if ab_results.get('tests'):
                summary += f"A/B tests run: {ab_results['total']}\n"

            prompt = f"""{summary}

Based on this weekly performance data, provide:
1. 3-5 actionable recommendations for next week
2. A test plan with 3-5 experiments to run

Return JSON:
{{"recommendations": ["rec1", "rec2", ...], "test_plan": {{"experiments": [{{"title": "...", "hypothesis": "...", "metric": "..."}}]}}}}
"""

            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {'role': 'system', 'content': 'You are a social media analytics strategist. Return only valid JSON.'},
                    {'role': 'user', 'content': prompt},
                ],
                temperature=0.7,
                max_tokens=1000,
                response_format={'type': 'json_object'},
            )
            result = json.loads(response.choices[0].message.content)
            return (
                result.get('recommendations', []),
                result.get('test_plan', {}),
            )

        except Exception as e:
            logger.error(f"LLM recommendation generation failed for {brand.brand_name}: {e}")
            return [], {}
