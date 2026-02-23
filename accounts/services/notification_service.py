"""
Centralized Notification Service
- Create notifications for all system events
- Handles in-app and email channels
"""
import logging

from accounts.models import SystemNotification

logger = logging.getLogger(__name__)


def notify(user, event_type, title, message='', data_json=None, channel='in_app'):
    """Create a system notification for a user.

    Args:
        user: User model instance
        event_type: One of SystemNotification.EVENT_TYPE_CHOICES
        title: Notification title (max 200 chars)
        message: Optional notification body
        data_json: Optional dict of additional data
        channel: 'in_app', 'email', or 'both'

    Returns:
        SystemNotification instance
    """
    if data_json is None:
        data_json = {}

    notification = SystemNotification.objects.create(
        user=user,
        event_type=event_type,
        title=title,
        message=message,
        data_json=data_json,
        channel=channel,
    )

    # If channel includes email, trigger email (stub for now)
    if channel in ('email', 'both'):
        _send_email_notification(user, title, message)

    logger.info(f"Notification created: {event_type} for {user.username}")
    return notification


def notify_post_submitted(post, submitted_by):
    """Notify relevant users when a post is submitted for approval."""
    # Notify workspace owner/admins
    if post.brand and post.brand.workspace:
        owner = post.brand.workspace.owner
        if owner != submitted_by:
            notify(
                user=owner,
                event_type='post_submitted',
                title=f'Post submitted for approval',
                message=f'{submitted_by.username} submitted a post for review.',
                data_json={'post_id': post.id},
            )


def notify_post_approved(post, approved_by):
    """Notify post creator when approved."""
    if post.user != approved_by:
        notify(
            user=post.user,
            event_type='post_approved',
            title='Your post has been approved',
            message=f'{approved_by.username} approved your post.',
            data_json={'post_id': post.id},
        )


def notify_changes_requested(post, reviewer, comment):
    """Notify post creator when changes are requested."""
    notify(
        user=post.user,
        event_type='changes_requested',
        title='Changes requested on your post',
        message=comment,
        data_json={'post_id': post.id},
    )


def notify_post_rejected(post, rejected_by, reason):
    """Notify post creator when rejected."""
    notify(
        user=post.user,
        event_type='post_rejected',
        title='Your post was rejected',
        message=f'Reason: {reason}',
        data_json={'post_id': post.id, 'reason': reason},
    )


def notify_post_published(post):
    """Notify creator when post is published."""
    notify(
        user=post.user,
        event_type='post_published',
        title='Post published successfully',
        data_json={'post_id': post.id},
    )


def notify_publish_failed(post, error_message):
    """Notify creator when post publish fails."""
    notify(
        user=post.user,
        event_type='publish_failed',
        title='Post publish failed',
        message=error_message,
        data_json={'post_id': post.id},
        channel='both',
    )


def notify_new_comment(post, comment):
    """Notify post creator of new comment."""
    notify(
        user=post.user,
        event_type='new_comment',
        title=f'New comment on your post',
        message=f'{comment.author_name}: {comment.body[:100]}',
        data_json={'post_id': post.id, 'comment_id': comment.id},
    )


def notify_weekly_report(user, brand, report):
    """Notify user about weekly report."""
    notify(
        user=user,
        event_type='weekly_report',
        title=f'Weekly report ready for {brand.brand_name}',
        data_json={'brand_id': brand.id, 'report_id': report.id},
    )


def notify_approval_reminder(post, approver, hours_pending):
    """Send approval reminder notification."""
    event = 'approval_reminder_12h' if hours_pending <= 12 else 'approval_escalation_24h'
    notify(
        user=approver,
        event_type=event,
        title=f'Approval pending for {hours_pending}h',
        message=f'A post has been waiting for approval for {hours_pending} hours.',
        data_json={'post_id': post.id},
        channel='both',
    )


def notify_post_scheduled(post, scheduled_by):
    """Notify creator when post is scheduled."""
    notify(
        user=post.user,
        event_type='post_scheduled',
        title='Post scheduled',
        message=f'Your post has been scheduled by {scheduled_by.username}.',
        data_json={'post_id': post.id},
    )


def notify_captions_ready(post):
    """Notify creator when captions are generated."""
    notify(
        user=post.user,
        event_type='captions_ready',
        title='Captions generated',
        message=f'Caption variants are ready for your post.',
        data_json={'post_id': post.id},
    )


def notify_images_ready(post):
    """Notify creator when images are generated."""
    notify(
        user=post.user,
        event_type='images_ready',
        title='Images generated',
        message=f'Creative assets are ready for your post.',
        data_json={'post_id': post.id},
    )


def notify_video_rendering(post):
    """Notify creator when video rendering starts."""
    notify(
        user=post.user,
        event_type='video_rendering',
        title='Video rendering started',
        message='Your video is being rendered. We\'ll notify you when it\'s ready.',
        data_json={'post_id': post.id},
    )


def notify_video_ready(post):
    """Notify creator when video is ready."""
    notify(
        user=post.user,
        event_type='video_ready',
        title='Video ready',
        message='Your video has been rendered and is ready to use.',
        data_json={'post_id': post.id},
    )


def notify_batch_complete(user, batch_summary):
    """Notify creator when a batch operation completes."""
    notify(
        user=user,
        event_type='batch_complete',
        title='Batch operation complete',
        message=batch_summary,
    )


def notify_winner_detected(post, brand):
    """Notify when a top-performing post is detected."""
    # Notify creator
    notify(
        user=post.user,
        event_type='winner_detected',
        title='Winner post detected!',
        message='Your post is in the top 20% by engagement. Consider repurposing it!',
        data_json={'post_id': post.id, 'brand_id': brand.id},
    )
    # Also notify workspace owner if different
    if brand.workspace and brand.workspace.owner != post.user:
        notify(
            user=brand.workspace.owner,
            event_type='winner_detected',
            title='Winner post detected!',
            message=f'A post by {post.user.username} is performing exceptionally well.',
            data_json={'post_id': post.id, 'brand_id': brand.id},
        )


def notify_repurpose_suggestion(post):
    """Suggest repurposing a well-performing post."""
    notify(
        user=post.user,
        event_type='repurpose_suggestion',
        title='Repurpose this winner?',
        message='This post performed well. Consider converting it to a carousel, thread, or reel.',
        data_json={'post_id': post.id},
    )


def notify_token_expiring(user, platform, days_remaining):
    """Notify when a platform OAuth token is about to expire."""
    notify(
        user=user,
        event_type='token_expiring',
        title=f'{platform} token expiring soon',
        message=f'Your {platform} connection will expire in {days_remaining} days. Please reconnect.',
        data_json={'platform': platform, 'days_remaining': days_remaining},
        channel='both',
    )


def notify_daily_limit_warning(user, usage_percent):
    """Notify when daily generation limit approaches 80%."""
    notify(
        user=user,
        event_type='daily_limit_warning',
        title='Daily generation limit approaching',
        message=f'You\'ve used {usage_percent}% of your daily generation limit.',
        data_json={'usage_percent': usage_percent},
    )


def notify_reply_sla_breach(comment, hours_waiting):
    """Notify when a comment exceeds the reply SLA."""
    post = comment.post
    user = post.user
    notify(
        user=user,
        event_type='reply_sla_breach',
        title='Comment reply overdue',
        message=(
            f'A comment on your post has been waiting {hours_waiting}h for a reply. '
            f'Comment by {comment.author_name or "someone"}: "{(comment.body or "")[:80]}"'
        ),
        data_json={
            'comment_id': comment.id,
            'post_id': post.id,
            'hours_waiting': hours_waiting,
        },
    )


def _send_email_notification(user, title, message):
    """Send email notification using Django's send_mail."""
    if not user.email:
        logger.warning(f"Cannot send email to {user.username}: no email address")
        return

    try:
        from django.core.mail import send_mail
        from django.conf import settings

        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">SaleAnto</h2>
            </div>
            <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <h3 style="color: #111827;">{title}</h3>
                <p style="color: #4b5563; line-height: 1.6;">{message}</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">
                    This is an automated notification from SaleAnto. Do not reply to this email.
                </p>
            </div>
        </div>
        """

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@saleanto.com')

        send_mail(
            subject=f'[SaleAnto] {title}',
            message=message,
            from_email=from_email,
            recipient_list=[user.email],
            html_message=html_body,
            fail_silently=True,
        )
        logger.info(f"Email notification sent: {title} to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send email to {user.email}: {e}")
