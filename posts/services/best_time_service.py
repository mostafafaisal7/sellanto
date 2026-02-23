"""
Best Time Suggestion Service
- Analyze past post performance for optimal posting times
- Fallback to industry defaults if insufficient data
"""
import logging
from collections import defaultdict
from django.db.models import Avg
from django.utils import timezone
from datetime import timedelta

from analytics.models import PostAnalytics
from brands.models import BestTimeSuggestion

logger = logging.getLogger(__name__)

# Industry defaults (UTC hours) when insufficient data
INDUSTRY_DEFAULTS = {
    'twitter': [
        (1, 13, 0.8), (2, 10, 0.75), (3, 15, 0.7), (4, 12, 0.7),
        (5, 9, 0.65),
    ],
    'linkedin': [
        (2, 10, 0.85), (3, 10, 0.8), (4, 10, 0.75), (2, 12, 0.7),
        (3, 8, 0.65),
    ],
    'facebook': [
        (3, 13, 0.8), (4, 11, 0.75), (5, 10, 0.7), (1, 15, 0.65),
    ],
    'instagram': [
        (2, 11, 0.85), (3, 11, 0.8), (4, 14, 0.75), (5, 10, 0.7),
        (1, 9, 0.65),
    ],
}

MIN_POSTS_FOR_ANALYSIS = 30


def compute_best_times(brand, platform=None):
    """Analyze post performance and update BestTimeSuggestion records.

    Args:
        brand: Brand model instance
        platform: Optional platform filter

    Returns:
        list: BestTimeSuggestion objects
    """
    platforms = [platform] if platform else ['twitter', 'linkedin', 'facebook', 'instagram']
    suggestions = []

    for plat in platforms:
        analytics = PostAnalytics.objects.filter(
            post__brand=brand,
            platform=plat,
        ).select_related('post')

        if analytics.count() < MIN_POSTS_FOR_ANALYSIS:
            # Use industry defaults
            suggestions.extend(_apply_defaults(brand, plat))
            continue

        # Group by day_of_week + hour and compute average engagement
        time_performance = defaultdict(list)
        for a in analytics:
            post_time = a.post.scheduled_time
            if post_time:
                key = (post_time.weekday(), post_time.hour)
                time_performance[key].append(a.engagement_rate)

        # Calculate average engagement per slot and rank
        scored = []
        for (dow, hour), rates in time_performance.items():
            avg_rate = sum(rates) / len(rates)
            scored.append((dow, hour, avg_rate))

        scored.sort(key=lambda x: x[2], reverse=True)

        # Clear existing suggestions for this platform
        BestTimeSuggestion.objects.filter(brand=brand, platform=plat).delete()

        # Create top 5 suggestions
        for dow, hour, score in scored[:5]:
            suggestion = BestTimeSuggestion.objects.create(
                brand=brand,
                platform=plat,
                day_of_week=dow,
                hour_utc=hour,
                score=round(score, 3),
                source='analytics',
            )
            suggestions.append(suggestion)

    return suggestions


def _apply_defaults(brand, platform):
    """Apply industry default posting times."""
    BestTimeSuggestion.objects.filter(
        brand=brand, platform=platform, source='industry_default'
    ).delete()

    defaults = INDUSTRY_DEFAULTS.get(platform, [])
    created = []

    for dow, hour, score in defaults:
        suggestion = BestTimeSuggestion.objects.create(
            brand=brand,
            platform=platform,
            day_of_week=dow,
            hour_utc=hour,
            score=score,
            source='industry_default',
        )
        created.append(suggestion)

    return created
