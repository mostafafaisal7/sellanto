"""
Analytics Sync Management Command
- Fetch metrics from platform APIs every 6 hours
- Create 24h/48h snapshots
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from posts.models import Post
from analytics.models import PostAnalytics
from django.db.models import Avg


class Command(BaseCommand):
    help = 'Sync post analytics from platform APIs and create snapshots'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours-back',
            type=int,
            default=72,
            help='How many hours back to look for posts to sync',
        )

    def handle(self, *args, **options):
        hours_back = options['hours_back']
        since = timezone.now() - timedelta(hours=hours_back)

        # Get all published posts within the window
        posts = Post.objects.filter(
            status='posted',
            posted_at__gte=since,
            posted_at__isnull=False,
        )

        synced = 0
        for post in posts:
            hours_since_posted = (timezone.now() - post.posted_at).total_seconds() / 3600

            # Determine snapshot type
            if hours_since_posted <= 26:
                snapshot_type = '24h'
            elif hours_since_posted <= 50:
                snapshot_type = '48h'
            else:
                snapshot_type = 'daily'

            # Check if we already have this snapshot
            existing = PostAnalytics.objects.filter(
                post=post,
                snapshot_type=snapshot_type,
            ).exists()

            if not existing:
                platforms = post.platforms_list
                for platform in platforms:
                    # Stub: In production, fetch real metrics from platform APIs
                    # For now, create empty snapshots that can be populated later
                    PostAnalytics.objects.create(
                        post=post,
                        platform=platform,
                        platform_post_id=getattr(post, f'{platform}_post_id', '') or '',
                        snapshot_type=snapshot_type,
                        impressions=0,
                        reach=0,
                        engagement_rate=0,
                        likes=0,
                        comments_count=0,
                        shares=0,
                        clicks=0,
                        saves=0,
                    )
                    synced += 1

        self.stdout.write(
            self.style.SUCCESS(f'Analytics sync complete: {synced} snapshots created for {posts.count()} posts')
        )

        # V1.2.1 — Repurpose auto-trigger for 48h snapshots
        winners_flagged = 0
        snapshots_48h = PostAnalytics.objects.filter(
            post__in=posts,
            snapshot_type='48h',
            engagement_rate__gt=0,
        ).select_related('post', 'post__brand')

        for snapshot in snapshots_48h:
            brand = snapshot.post.brand
            if not brand:
                continue

            # Get brand average engagement rate
            brand_avg = PostAnalytics.objects.filter(
                post__brand=brand,
                snapshot_type='48h',
            ).aggregate(avg_er=Avg('engagement_rate'))['avg_er'] or 0

            threshold = brand_avg * 1.5
            if snapshot.engagement_rate > threshold and threshold > 0:
                # Flag as winner
                from analytics.models import LearningSignal
                already_flagged = LearningSignal.objects.filter(
                    brand=brand,
                    signal_type='winner',
                    reference_id=str(snapshot.post.id),
                ).exists()

                if not already_flagged:
                    LearningSignal.objects.create(
                        brand=brand,
                        signal_type='winner',
                        reference_id=str(snapshot.post.id),
                        data_json={
                            'post_id': snapshot.post.id,
                            'engagement_rate': float(snapshot.engagement_rate),
                            'brand_avg': float(brand_avg),
                            'hook': (snapshot.post.hook or '')[:200],
                            'insight': (
                                f"Post engagement ({snapshot.engagement_rate:.1f}%) exceeds "
                                f"brand average ({brand_avg:.1f}%) by 1.5x."
                            ),
                        },
                    )
                    winners_flagged += 1

                    # Send notifications
                    try:
                        from accounts.services.notification_service import (
                            notify_winner_detected, notify_repurpose_suggestion,
                        )
                        notify_winner_detected(snapshot.post, brand)
                        notify_repurpose_suggestion(snapshot.post)
                    except Exception:
                        pass

        if winners_flagged:
            self.stdout.write(
                self.style.SUCCESS(f'Winner detection: {winners_flagged} new winners flagged')
            )
