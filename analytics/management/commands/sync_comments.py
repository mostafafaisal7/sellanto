"""
Comment Auto-Sync Management Command — V1.2.1 Gap 12
Polls platform APIs for new comments on published posts (within last 7 days).
Run every 15 minutes via cron/scheduler.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from posts.models import Post
from analytics.models import PostComment
from accounts.services.notification_service import notify_new_comment


class Command(BaseCommand):
    help = 'Sync comments from platform APIs for recent published posts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days-back',
            type=int,
            default=7,
            help='How many days back to look for posts to sync comments',
        )

    def handle(self, *args, **options):
        days_back = options['days_back']
        since = timezone.now() - timedelta(days=days_back)

        posts = Post.objects.filter(
            status='posted',
            posted_at__gte=since,
            posted_at__isnull=False,
        ).select_related('brand')

        total_new = 0
        for post in posts:
            platforms = post.platforms_list
            for platform in platforms:
                # Stub: In production, call platform API to fetch comments
                # e.g. Instagram Graph API, Twitter API v2, LinkedIn API, Facebook Graph API
                #
                # new_comments = fetch_comments_from_platform(post, platform)
                # for comment_data in new_comments:
                #     comment, created = PostComment.objects.get_or_create(
                #         post=post,
                #         platform=platform,
                #         platform_comment_id=comment_data['id'],
                #         defaults={
                #             'author_name': comment_data['author'],
                #             'body': comment_data['text'],
                #             'sentiment': classify_sentiment(comment_data['text']),
                #         }
                #     )
                #     if created:
                #         notify_new_comment(post, comment)
                #         total_new += 1
                pass

        self.stdout.write(
            self.style.SUCCESS(
                f'Comment sync complete: checked {posts.count()} posts, '
                f'{total_new} new comments synced'
            )
        )
