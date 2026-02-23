"""
Learning Signal Extractor
- Extract signals from weekly reports and analytics
- Feed into idea generation context
"""
import logging
from django.db.models import Avg, Count

from analytics.models import PostAnalytics, LearningSignal
from posts.models import Post

logger = logging.getLogger(__name__)


def extract_learning_signals(brand):
    """Extract learning signals from brand analytics.

    Analyzes:
    - Best performing hooks
    - Best posting times
    - Best content formats
    - Best content pillars
    - A/B test winners

    Returns:
        list: Created LearningSignal objects
    """
    signals = []

    # Best hooks: Posts with engagement_rate > 2x brand average
    avg_engagement = PostAnalytics.objects.filter(
        post__brand=brand
    ).aggregate(avg=Avg('engagement_rate'))['avg'] or 0

    if avg_engagement > 0:
        high_performers = PostAnalytics.objects.filter(
            post__brand=brand,
            engagement_rate__gte=avg_engagement * 2,
        ).select_related('post')[:5]

        for pa in high_performers:
            if pa.post.hook:
                signal, created = LearningSignal.objects.get_or_create(
                    brand=brand,
                    signal_type='best_hook',
                    reference_id=str(pa.post.id),
                    defaults={
                        'data_json': {
                            'hook': pa.post.hook,
                            'engagement_rate': pa.engagement_rate,
                            'platform': pa.platform,
                        }
                    }
                )
                if created:
                    signals.append(signal)

    # Best content format
    format_perf = Post.objects.filter(
        brand=brand, format_type__gt=''
    ).values('format_type').annotate(
        avg_engagement=Avg('post_analytics__engagement_rate'),
        count=Count('id'),
    ).order_by('-avg_engagement')

    if format_perf:
        best_format = format_perf[0]
        signal, created = LearningSignal.objects.get_or_create(
            brand=brand,
            signal_type='best_format',
            reference_id=best_format['format_type'],
            defaults={
                'data_json': {
                    'format_type': best_format['format_type'],
                    'avg_engagement': best_format['avg_engagement'] or 0,
                    'sample_size': best_format['count'],
                }
            }
        )
        if created:
            signals.append(signal)

    # Best pillar
    pillar_perf = Post.objects.filter(
        brand=brand, pillar__isnull=False
    ).values('pillar__name', 'pillar_id').annotate(
        avg_engagement=Avg('post_analytics__engagement_rate'),
        count=Count('id'),
    ).order_by('-avg_engagement')

    if pillar_perf:
        best = pillar_perf[0]
        signal, created = LearningSignal.objects.get_or_create(
            brand=brand,
            signal_type='best_pillar',
            reference_id=str(best['pillar_id']),
            defaults={
                'data_json': {
                    'pillar_name': best['pillar__name'],
                    'avg_engagement': best['avg_engagement'] or 0,
                    'sample_size': best['count'],
                }
            }
        )
        if created:
            signals.append(signal)

    # A/B test winners
    from posts.models import PostCaption
    ab_posts = PostCaption.objects.filter(
        post__brand=brand, is_ab_test=True
    ).values_list('post_id', flat=True).distinct()

    for post_id in ab_posts:
        variants = PostCaption.objects.filter(post_id=post_id, is_ab_test=True)
        best_variant = None
        best_rate = 0

        for v in variants:
            pa = PostAnalytics.objects.filter(
                post_id=post_id, platform=v.platform
            ).order_by('-engagement_rate').first()
            if pa and pa.engagement_rate > best_rate:
                best_rate = pa.engagement_rate
                best_variant = v

        if best_variant:
            signal, created = LearningSignal.objects.get_or_create(
                brand=brand,
                signal_type='ab_winner',
                reference_id=str(best_variant.id),
                defaults={
                    'data_json': {
                        'post_id': post_id,
                        'winning_label': best_variant.ab_label,
                        'engagement_rate': best_rate,
                        'body_preview': best_variant.body[:100],
                    }
                }
            )
            if created:
                signals.append(signal)

    logger.info(f"Extracted {len(signals)} new learning signals for {brand.brand_name}")
    return signals


def get_active_signals(brand, limit=10):
    """Get unapplied learning signals for content generation context."""
    return list(
        LearningSignal.objects.filter(
            brand=brand, applied=False
        ).order_by('-created_at')[:limit].values('signal_type', 'data_json')
    )


def mark_signals_applied(signal_ids):
    """Mark signals as applied after use in content generation."""
    LearningSignal.objects.filter(id__in=signal_ids).update(applied=True)
