"""
Refund flow: user requests → admin approves/rejects → Stripe processes.

Lifecycle of `PaymentRequest.refund_status`:

  ''         (initial)
    │
    │ user calls request_refund()
    ▼
  'requested'
    │
    ├── admin calls reject_refund()  ─►  'rejected'  (end state)
    │
    │ admin calls approve_refund()
    ▼
  'processing'   (stripe.Refund.create called)
    │
    │ webhook: charge.refunded ─►  'refunded'   (end state)
    │ webhook: refund.updated failed ─►  'failed'  (end state)

Auto-cascade policy (per user decision): refunds do NOT automatically
deduct diamonds or downgrade plans. Admin adjusts those manually via
the existing diamond admin tools / AdminUpdatePlanView.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

import stripe
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from accounts.models import PaymentRequest
from accounts.services import stripe_service

log = logging.getLogger(__name__)

# How long after the original charge a refund is requestable.
REFUND_WINDOW_DAYS = 90


def request_refund(
    *, payment_request: PaymentRequest, user: User, reason: str,
) -> dict[str, Any]:
    """User-initiated refund request. Validates eligibility and queues
    for admin review. Does NOT call Stripe.
    """
    if payment_request.user_id != user.id:
        return {'ok': False, 'error': 'You can only request refunds on your own payments.'}

    if payment_request.payment_provider != 'stripe':
        return {
            'ok': False,
            'error': 'Only Stripe payments are refundable here. Contact support for other methods.',
        }
    if payment_request.status != 'approved':
        return {
            'ok': False,
            'error': f'Cannot refund a {payment_request.status!r} payment.',
        }
    if payment_request.refund_status not in {'', 'rejected', 'failed'}:
        return {
            'ok': False,
            'error': f'Refund already {payment_request.refund_status!r}.',
        }

    age = timezone.now() - payment_request.created_at
    if age > timedelta(days=REFUND_WINDOW_DAYS):
        return {
            'ok': False,
            'error': f'Refund window is {REFUND_WINDOW_DAYS} days. This payment is too old.',
        }

    reason = (reason or '').strip()
    if len(reason) < 10:
        return {'ok': False, 'error': 'Please describe the reason (10+ characters).'}

    with transaction.atomic():
        payment_request.refund_status = 'requested'
        payment_request.refund_reason = reason
        payment_request.refund_requested_at = timezone.now()
        payment_request.refund_amount_usd = payment_request.revenue_usd or payment_request.amount_usd
        # Clear stale review data from any prior rejected attempt.
        payment_request.refund_admin_notes = ''
        payment_request.refund_reviewed_at = None
        payment_request.refund_reviewed_by = None
        payment_request.save(update_fields=[
            'refund_status', 'refund_reason', 'refund_requested_at',
            'refund_amount_usd', 'refund_admin_notes',
            'refund_reviewed_at', 'refund_reviewed_by', 'updated_at',
        ])

    # Notify admin (best-effort; doesn't block).
    _notify_admin_refund_requested(payment_request)

    return {
        'ok': True,
        'refund_status': payment_request.refund_status,
        'refund_amount_usd': str(payment_request.refund_amount_usd),
    }


def approve_refund(
    *, payment_request: PaymentRequest, admin_user: User, admin_notes: str = '',
) -> dict[str, Any]:
    """Admin approves a pending refund. Calls Stripe to actually process.

    Stripe will fire `charge.refunded` when the money lands; the webhook
    handler flips `refund_status` to 'refunded' at that point.
    """
    if payment_request.refund_status != 'requested':
        return {
            'ok': False,
            'error': f'Cannot approve a request that is {payment_request.refund_status!r}.',
        }
    if not payment_request.stripe_payment_intent_id:
        return {
            'ok': False,
            'error': 'This payment has no Stripe Payment Intent recorded — cannot refund automatically.',
        }

    stripe_mod = stripe_service._client()
    refund_amount_cents = int((payment_request.refund_amount_usd or 0) * 100)

    try:
        refund = stripe_mod.Refund.create(
            payment_intent=payment_request.stripe_payment_intent_id,
            amount=refund_amount_cents or None,  # None = full refund
            metadata={
                'user_id': str(payment_request.user_id),
                'payment_request_id': str(payment_request.id),
                'admin_user_id': str(admin_user.id),
            },
            reason='requested_by_customer',
        )
    except stripe.error.StripeError as exc:
        log.exception('refund_service: Stripe rejected refund for PR#%s', payment_request.id)
        with transaction.atomic():
            payment_request.refund_status = 'failed'
            payment_request.refund_admin_notes = (
                f'Stripe refund call failed: {exc}\n\nAdmin notes: {admin_notes}'
            )
            payment_request.refund_reviewed_at = timezone.now()
            payment_request.refund_reviewed_by = admin_user
            payment_request.save(update_fields=[
                'refund_status', 'refund_admin_notes',
                'refund_reviewed_at', 'refund_reviewed_by', 'updated_at',
            ])
        return {'ok': False, 'error': str(exc)}

    with transaction.atomic():
        payment_request.refund_status = 'processing'
        payment_request.stripe_refund_id = refund.id
        payment_request.refund_admin_notes = admin_notes
        payment_request.refund_reviewed_at = timezone.now()
        payment_request.refund_reviewed_by = admin_user
        payment_request.save(update_fields=[
            'refund_status', 'stripe_refund_id', 'refund_admin_notes',
            'refund_reviewed_at', 'refund_reviewed_by', 'updated_at',
        ])

    log.info(
        'refund_service: approved PR#%s refund=%s amount=%s admin=%s',
        payment_request.id, refund.id, refund_amount_cents, admin_user.id,
    )
    return {
        'ok': True,
        'refund_status': payment_request.refund_status,
        'stripe_refund_id': refund.id,
    }


def reject_refund(
    *, payment_request: PaymentRequest, admin_user: User, admin_notes: str,
) -> dict[str, Any]:
    """Admin rejects a pending refund. No Stripe call."""
    if payment_request.refund_status != 'requested':
        return {
            'ok': False,
            'error': f'Cannot reject a request that is {payment_request.refund_status!r}.',
        }
    admin_notes = (admin_notes or '').strip()
    if not admin_notes:
        return {'ok': False, 'error': 'Rejection requires admin notes explaining why.'}

    with transaction.atomic():
        payment_request.refund_status = 'rejected'
        payment_request.refund_admin_notes = admin_notes
        payment_request.refund_reviewed_at = timezone.now()
        payment_request.refund_reviewed_by = admin_user
        payment_request.save(update_fields=[
            'refund_status', 'refund_admin_notes',
            'refund_reviewed_at', 'refund_reviewed_by', 'updated_at',
        ])

    _notify_user_refund_rejected(payment_request)

    return {
        'ok': True,
        'refund_status': payment_request.refund_status,
    }


# ---------------------------------------------------------------------------
# Webhook-driven status updates (called from stripe_service.py)
# ---------------------------------------------------------------------------

def mark_refunded_from_webhook(
    *, payment_intent_id: str, stripe_refund_id: str = '',
) -> dict[str, Any]:
    """Find the PaymentRequest by PI and flip to 'refunded' if we have a
    matching 'processing' row. Idempotent — running twice is a no-op.
    """
    row = (
        PaymentRequest.objects
        .filter(stripe_payment_intent_id=payment_intent_id)
        .order_by('-created_at')
        .first()
    )
    if not row:
        return {'ok': False, 'reason': 'no_payment_request_for_pi'}

    if row.refund_status == 'refunded':
        return {'ok': True, 'noop': True}
    if row.refund_status not in {'processing', 'approved'}:
        # Refund happened outside our flow (e.g. admin refunded directly
        # from Stripe Dashboard). Record it anyway so finance reconciles.
        log.info(
            'refund_service: charge.refunded for PR#%s without a request '
            '(status=%s) — recording as out-of-band refund',
            row.id, row.refund_status,
        )

    row.refund_status = 'refunded'
    row.refund_processed_at = timezone.now()
    if stripe_refund_id and not row.stripe_refund_id:
        row.stripe_refund_id = stripe_refund_id
    if not row.refund_amount_usd:
        row.refund_amount_usd = row.revenue_usd or row.amount_usd
    row.save(update_fields=[
        'refund_status', 'refund_processed_at', 'stripe_refund_id',
        'refund_amount_usd', 'updated_at',
    ])

    return {'ok': True, 'payment_request_id': row.id}


def mark_refund_failed_from_webhook(
    *, stripe_refund_id: str, failure_reason: str = '',
) -> dict[str, Any]:
    """Find the PaymentRequest by stripe_refund_id and mark refund failed."""
    row = (
        PaymentRequest.objects
        .filter(stripe_refund_id=stripe_refund_id)
        .order_by('-created_at')
        .first()
    )
    if not row:
        return {'ok': False, 'reason': 'no_payment_request_for_refund_id'}

    row.refund_status = 'failed'
    if failure_reason:
        row.refund_admin_notes = (
            (row.refund_admin_notes + '\n\n' if row.refund_admin_notes else '')
            + f'Stripe failure reason: {failure_reason}'
        )
    row.save(update_fields=[
        'refund_status', 'refund_admin_notes', 'updated_at',
    ])
    return {'ok': True, 'payment_request_id': row.id}


# ---------------------------------------------------------------------------
# Email helpers (best-effort — never block the flow)
# ---------------------------------------------------------------------------

def _notify_admin_refund_requested(pr: PaymentRequest) -> None:
    try:
        from django.conf import settings
        from django.core.mail import send_mail
        admin_email = getattr(settings, 'ADMIN_NOTIFICATION_EMAIL', '')
        if not admin_email:
            return
        send_mail(
            subject=f'[Sellanto] Refund requested · PR#{pr.id} · ${pr.refund_amount_usd}',
            message=(
                f'User: {pr.user.username} ({pr.user.email})\n'
                f'Payment: ${pr.amount_usd} on {pr.created_at:%Y-%m-%d}\n'
                f'Purpose: {pr.purpose}\n'
                f'Reason: {pr.refund_reason}\n\n'
                f'Review in admin panel: {settings.FRONTEND_URL}/admin-panel/refunds'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception:  # noqa: BLE001
        log.exception('refund_service: admin notification failed for PR#%s', pr.id)


def _notify_user_refund_rejected(pr: PaymentRequest) -> None:
    try:
        from django.conf import settings
        from django.core.mail import send_mail
        if not pr.user.email:
            return
        send_mail(
            subject=f'[Sellanto] Your refund request was reviewed',
            message=(
                f'Hi {pr.user.get_full_name() or pr.user.username},\n\n'
                f'We have reviewed your refund request for the payment of '
                f'${pr.amount_usd} on {pr.created_at:%Y-%m-%d}.\n\n'
                f'Unfortunately, we were unable to approve it for the following reason:\n\n'
                f'{pr.refund_admin_notes}\n\n'
                f'If you have questions, reply to this email.\n\n'
                f'— Sellanto Billing'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[pr.user.email],
            fail_silently=True,
        )
    except Exception:  # noqa: BLE001
        log.exception('refund_service: user rejection email failed for PR#%s', pr.id)
