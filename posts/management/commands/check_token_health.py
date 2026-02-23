"""
Token Health Check Management Command — V1.2.1
Checks platform OAuth tokens expiring within 7 days and sends notifications.
Run daily via cron/scheduler.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from platforms.models import SocialAccount
from accounts.services.notification_service import notify_token_expiring


class Command(BaseCommand):
    help = 'Check platform OAuth tokens nearing expiry and notify users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Warn about tokens expiring within this many days (default: 7)',
        )

    def handle(self, *args, **options):
        days = options['days']
        now = timezone.now()
        cutoff = now + timedelta(days=days)

        expiring = SocialAccount.objects.filter(
            token_expires_at__isnull=False,
            token_expires_at__lte=cutoff,
            token_expires_at__gt=now,
        ).select_related('user')

        notified = 0
        for account in expiring:
            days_remaining = (account.token_expires_at - now).days
            try:
                notify_token_expiring(
                    user=account.user,
                    platform=account.platform,
                    days_remaining=max(days_remaining, 0),
                )
                notified += 1
            except Exception as e:
                self.stderr.write(f'Failed to notify {account.user.username} for {account.platform}: {e}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Token health check complete: {notified} expiring tokens notified '
                f'(within {days} days)'
            )
        )
