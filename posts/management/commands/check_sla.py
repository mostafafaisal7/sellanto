"""
SLA Escalation Management Command
- 12h → reminder to approver
- 24h → escalate to Owner + Admin
- 48h → flag as stale
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from posts.models import Post
from brands.models import ApprovalLog
from analytics.models import PostComment
from accounts.models import UserRole
from accounts.services.notification_service import notify_approval_reminder, notify_reply_sla_breach


class Command(BaseCommand):
    help = 'Check approval SLA and send escalation notifications'

    def handle(self, *args, **options):
        now = timezone.now()

        pending_posts = Post.objects.filter(
            status='pending_approval',
            submitted_at__isnull=False,
        ).select_related('user', 'brand__workspace__owner')

        escalated_12h = 0
        escalated_24h = 0
        flagged_stale = 0

        for post in pending_posts:
            hours_pending = (now - post.submitted_at).total_seconds() / 3600

            if hours_pending >= 48:
                # Flag as stale
                ApprovalLog.objects.get_or_create(
                    post=post,
                    action='escalated',
                    defaults={
                        'acted_by': post.user,
                        'comment': 'Auto-flagged: Approval pending for 48+ hours (stale)',
                    }
                )
                flagged_stale += 1

                if post.brand and post.brand.workspace:
                    notify_approval_reminder(post, post.brand.workspace.owner, int(hours_pending))

            elif hours_pending >= 24:
                # Escalate to owner + admin
                if post.brand and post.brand.workspace:
                    owner = post.brand.workspace.owner
                    # Only notify if we haven't already sent 24h escalation
                    existing = ApprovalLog.objects.filter(
                        post=post, action='escalated',
                        comment__contains='24h'
                    ).exists()
                    if not existing:
                        ApprovalLog.objects.create(
                            post=post,
                            action='escalated',
                            acted_by=post.user,
                            comment='Auto-escalation: Approval pending for 24+ hours',
                        )
                        notify_approval_reminder(post, owner, 24)
                        escalated_24h += 1

            elif hours_pending >= 12:
                # Reminder to assigned approvers (not owner)
                existing = ApprovalLog.objects.filter(
                    post=post, action='escalated',
                    comment__contains='12h'
                ).exists()
                if not existing:
                    if post.brand and post.brand.workspace:
                        ws = post.brand.workspace
                        approvers = UserRole.objects.filter(
                            workspace=ws, role='approver'
                        ).select_related('user')
                        if approvers.exists():
                            for role_obj in approvers:
                                notify_approval_reminder(post, role_obj.user, 12)
                        else:
                            # Fallback: notify workspace owner if no approvers assigned
                            notify_approval_reminder(post, ws.owner, 12)
                        escalated_12h += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'SLA check complete: {escalated_12h} 12h reminders, '
                f'{escalated_24h} 24h escalations, {flagged_stale} stale flags'
            )
        )

        # V1.2.1 — Reply SLA check (default 2 hours)
        reply_sla_hours = 2
        sla_cutoff = now - timedelta(hours=reply_sla_hours)

        unreplied = PostComment.objects.filter(
            replied=False,
            fetched_at__lte=sla_cutoff,
        ).select_related('post', 'post__user', 'post__brand')

        reply_breaches = 0
        for comment in unreplied[:50]:
            hours_waiting = (now - comment.fetched_at).total_seconds() / 3600
            try:
                notify_reply_sla_breach(comment, int(hours_waiting))
                reply_breaches += 1
            except Exception:
                pass

        if reply_breaches:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Reply SLA: {reply_breaches} comments breached {reply_sla_hours}h reply SLA'
                )
            )
