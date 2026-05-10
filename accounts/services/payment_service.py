# accounts/services/payment_service.py
"""
Payment request service for the MVP billing flow.

There's no real payment gateway yet. Users submit a request claiming they
sent money via bKash / Nagad / bank / card; the request is queued for admin
review. On approval, the admin's action triggers `set_plan()` and a
diamond grant. Both submission and approval send notification emails.
"""

from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from accounts.models import (
    AdminPayoutAccount,
    PaymentRequest,
    UserProfile,
)
from accounts.services.diamond_service import (
    PLAN_DIAMONDS,
    grant_plan_diamonds_on_upgrade,
)
from accounts.services.fx_service import convert_to_usd


log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────
# One-click email approval — signed-token URLs
# ─────────────────────────────────────────────────────────────────────
# Tokens carry "{payment_id}:{action}" signed with TimestampSigner.
# Only Django (with SECRET_KEY) can produce valid tokens, so anyone
# clicking the email link can only execute actions Django minted for them.
# The receiving view also enforces a max_age so old links expire.

_TOKEN_SALT = 'sellanto.payment-action'
_TOKEN_MAX_AGE = 7 * 24 * 3600  # 7 days


def make_action_token(payment_id: int, action: str) -> str:
    """Sign a (payment_id, action) tuple. Action must be 'approve' or 'reject'."""
    if action not in ('approve', 'reject'):
        raise ValueError(f'Invalid action: {action!r}')
    signer = TimestampSigner(salt=_TOKEN_SALT)
    return signer.sign(f'{payment_id}:{action}')


def verify_action_token(token: str) -> Optional[tuple[int, str]]:
    """Returns (payment_id, action) or None if the token is invalid/expired."""
    signer = TimestampSigner(salt=_TOKEN_SALT)
    try:
        unsigned = signer.unsign(token, max_age=_TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    try:
        pid_str, action = unsigned.split(':', 1)
        pid = int(pid_str)
    except (ValueError, TypeError):
        return None
    if action not in ('approve', 'reject'):
        return None
    return pid, action


def _build_action_url(payment_id: int, action: str, base_url: Optional[str] = None) -> str:
    """Build a one-click action URL.

    `base_url` should be the scheme+host the user submitted the payment from
    (e.g. http://127.0.0.1:8000 in dev, https://abedintechllc.com in prod).
    Falls back to SITE_URL setting, then to localhost.
    """
    base = (base_url or getattr(settings, 'SITE_URL', '') or 'http://127.0.0.1:8000').rstrip('/')
    token = make_action_token(payment_id, action)
    return f'{base}/api/v1/payments/action/{token}/'


# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

def _safe_send(subject: str, text_body: str, recipient: str,
               html_body: Optional[str] = None) -> bool:
    """Send an email, swallowing errors so a failed SMTP doesn't break the
    HTTP request that triggered it. Returns True if the message was queued."""
    if not recipient:
        log.warning('payment_service: skipped send, recipient is empty')
        return False
    try:
        from_addr = (
            getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            or getattr(settings, 'EMAIL_HOST_USER', None)
            or 'noreply@sellanto.app'
        )
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_addr,
            to=[recipient],
        )
        if html_body:
            msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        return True
    except Exception:  # noqa: BLE001 — logging only, must not propagate
        log.exception('payment_service: email send failed (recipient=%s)', recipient)
        return False


def _admin_notification_recipient() -> str:
    return getattr(settings, 'ADMIN_NOTIFICATION_EMAIL', '') or ''


def _format_admin_email(req: PaymentRequest, base_url: Optional[str] = None) -> tuple[str, str, str]:
    """Returns (subject, text_body, html_body) for the admin notification.

    `base_url` is the scheme+host where Django is reachable — used to build
    one-click approve/reject links. When None, falls back to SITE_URL setting.
    """
    user = req.user
    plan = req.plan.upper()
    subject = (
        f'[Sellanto Billing] {plan} payment from {user.username} — '
        f'${req.amount_usd} via {req.get_payment_method_display()}'
    )

    payout_line = ''
    if req.payout_account:
        payout_line = (
            f'Paid to: {req.payout_account.display_name} '
            f'({req.payout_account.account_number})'
        )

    approve_url = _build_action_url(req.id, 'approve', base_url=base_url)
    reject_url = _build_action_url(req.id, 'reject', base_url=base_url)

    text_body = '\n'.join([
        'A new plan upgrade payment is awaiting your review.',
        '',
        '── ONE-CLICK ACTIONS ────────────────',
        f'APPROVE & switch plan:  {approve_url}',
        f'REJECT this payment:    {reject_url}',
        '(links expire in 7 days)',
        '',
        '── Request ────────────────────────────',
        f'Request ID:  #{req.id}',
        f'Submitted:   {req.created_at.strftime("%Y-%m-%d %H:%M %Z")}',
        '',
        '── User ───────────────────────────────',
        f'Username:    {user.username}',
        f'Email:       {user.email or "(not set)"}',
        f'User ID:     {user.id}',
        f'Joined:      {user.date_joined.strftime("%Y-%m-%d") if user.date_joined else "(unknown)"}',
        '',
        '── Plan ───────────────────────────────',
        f'Target plan: {req.plan} ({req.billing_cycle})',
        f'Amount USD:  ${req.amount_usd}',
        f'Amount paid: {req.amount_local} {req.local_currency}',
        '',
        '── Payment ────────────────────────────',
        f'Method:      {req.get_payment_method_display()}',
        payout_line,
        f'Reference:   {req.transaction_reference or "(none)"}',
        f'Payer name:  {req.payer_name or "(none)"}',
        f'Payer phone: {req.payer_phone or "(none)"}',
        f'Payer email: {req.payer_email or user.email or "(none)"}',
        '',
        '── Notes from user ────────────────────',
        req.payer_notes or '(none)',
    ])

    # Lightweight HTML — table-based for Gmail/Outlook compatibility.
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #0D0D14; color: #F1F1F6; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 24px; color: #E8364F;">Sellanto Billing</h1>
        <p style="margin: 4px 0 0; color: #9CA3AF; font-size: 13px;">New payment awaiting your review</p>
      </div>

      <div style="background: #16162A; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">{user.username} → {req.plan.upper()}</h2>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Request</td><td>#{req.id}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">User email</td><td>{user.email or '—'}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">User ID</td><td>{user.id}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Plan</td><td>{req.plan} · {req.billing_cycle}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Amount (USD)</td><td><strong>${req.amount_usd}</strong></td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Amount paid</td><td>{req.amount_local} {req.local_currency}</td></tr>
        </table>
      </div>

      <!-- One-click approve / reject buttons -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 16px; border-collapse: collapse;">
        <tr>
          <td style="padding-right: 8px; width: 50%;">
            <a href="{approve_url}"
               style="display: block; text-align: center; background: #10B981; color: #ffffff;
                      text-decoration: none; padding: 14px 20px; border-radius: 12px;
                      font-weight: 700; font-size: 15px; letter-spacing: 0.3px;
                      box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
              ✓ Approve &amp; Switch Plan
            </a>
          </td>
          <td style="padding-left: 8px; width: 50%;">
            <a href="{reject_url}"
               style="display: block; text-align: center; background: #E8364F; color: #ffffff;
                      text-decoration: none; padding: 14px 20px; border-radius: 12px;
                      font-weight: 700; font-size: 15px; letter-spacing: 0.3px;
                      box-shadow: 0 4px 14px rgba(232,54,79,0.35);">
              ✕ Reject Payment
            </a>
          </td>
        </tr>
      </table>
      <p style="text-align: center; color: #6B7280; font-size: 11px; margin: 0 0 20px;">
        One-click action — no login needed. Links expire in 7 days.
      </p>

      <div style="background: #16162A; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; font-size: 15px; color: #F59E0B;">Payment details</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Method</td><td>{req.get_payment_method_display()}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Reference / TrxID</td><td><code>{req.transaction_reference or '—'}</code></td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Payer name</td><td>{req.payer_name or '—'}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Payer phone</td><td>{req.payer_phone or '—'}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0;">Payer email</td><td>{req.payer_email or '—'}</td></tr>
          <tr><td style="color: #9CA3AF; padding: 6px 0; vertical-align: top;">Notes</td><td>{req.payer_notes or '—'}</td></tr>
        </table>
      </div>

      <p style="text-align: center; color: #6B7280; font-size: 12px; margin-top: 24px;">
        Verify the funds in your bKash/Nagad/bank first, then click Approve.
      </p>
    </div>
    """.strip()

    return subject, text_body, html_body


def _format_user_confirmation(req: PaymentRequest) -> tuple[str, str]:
    subject = f'Your {req.plan.upper()} plan is now active 🎉'
    text_body = '\n'.join([
        f'Hi {req.user.username},',
        '',
        f'We verified your payment of {req.amount_local} {req.local_currency} '
        f'(${req.amount_usd}) and just activated your {req.plan.upper()} plan.',
        '',
        f'Diamonds granted: {req.diamonds_granted:,}',
        '',
        'You can start using all the new features straight away from your',
        'dashboard. If anything looks off, reply to this email and we\'ll',
        'sort it out.',
        '',
        '— The Sellanto team',
    ])
    return subject, text_body


# ─────────────────────────────────────────────────────────────────────
# Public service functions
# ─────────────────────────────────────────────────────────────────────

def submit_payment_request(
    *,
    user,
    plan: str,
    billing_cycle: str,
    amount_usd,
    amount_local,
    local_currency: str,
    payment_method: str,
    payout_account: Optional[AdminPayoutAccount],
    transaction_reference: str = '',
    payer_name: str = '',
    payer_phone: str = '',
    payer_email: str = '',
    payer_notes: str = '',
    request_base_url: Optional[str] = None,
) -> PaymentRequest:
    """Create a PaymentRequest and notify the admin by email.

    Email failures are non-fatal — the request is persisted even if SMTP is
    misconfigured, so the admin can still see it in the dashboard.
    """
    with transaction.atomic():
        req = PaymentRequest.objects.create(
            user=user,
            plan=plan,
            billing_cycle=billing_cycle,
            amount_usd=amount_usd,
            amount_local=amount_local,
            local_currency=local_currency,
            payment_method=payment_method,
            payout_account=payout_account,
            transaction_reference=transaction_reference.strip(),
            payer_name=payer_name.strip() or user.get_full_name() or user.username,
            payer_phone=payer_phone.strip(),
            payer_email=payer_email.strip() or user.email,
            payer_notes=payer_notes.strip(),
            status='pending',
        )

    # Email outside the txn so a failed send doesn't roll back the record.
    subject, text_body, html_body = _format_admin_email(req, base_url=request_base_url)
    sent = _safe_send(
        subject=subject,
        text_body=text_body,
        recipient=_admin_notification_recipient(),
        html_body=html_body,
    )
    if not sent:
        log.warning('payment_service: admin notification not delivered for #%s', req.id)

    # Send the user a "🎉 payment received, technician verifying ASAP" email.
    # Best-effort: failures never block the request.
    try:
        from accounts.services.email_service import send_payment_pending_email
        send_payment_pending_email(user, req)
    except Exception:  # noqa: BLE001
        log.exception('payment_service: pending-confirmation email failed for #%s', req.id)

    return req


def approve_payment_request(*, request_obj: PaymentRequest, admin_user, admin_notes: str = '') -> dict:
    """Approve a pending request: switch the plan, grant diamonds, mail user.

    Idempotent: re-running on an already-approved request is a no-op.
    Returns a dict describing what happened.
    """
    if request_obj.status == 'approved':
        return {
            'ok': True,
            'already_approved': True,
            'diamonds_granted': request_obj.diamonds_granted,
        }
    if request_obj.status not in ('pending',):
        return {
            'ok': False,
            'error': f'Cannot approve a request that is {request_obj.status!r}.',
        }

    profile = UserProfile.objects.select_related('user').get(user=request_obj.user)
    previous_plan = profile.subscription_plan
    duration_months = 12 if request_obj.billing_cycle == 'yearly' else 1

    # FX-convert what the user actually paid into USD for accounting.
    # Done outside the txn — failures here must not block the approval.
    revenue_usd, fx_rate, fx_source = convert_to_usd(
        request_obj.amount_local,
        request_obj.local_currency,
    )

    with transaction.atomic():
        # Apply the plan first (so diamond grant has the correct cycle marker).
        profile.set_plan(request_obj.plan, duration_months=duration_months)
        profile.refresh_from_db()

        grant = grant_plan_diamonds_on_upgrade(
            user=request_obj.user,
            previous_plan=previous_plan,
            new_plan=request_obj.plan,
            cycle_start_date=profile.plan_start_date,
        )

        request_obj.status = 'approved'
        request_obj.reviewed_by = admin_user
        request_obj.reviewed_at = timezone.now()
        request_obj.admin_notes = admin_notes
        request_obj.diamonds_granted = grant['amount'] if grant['granted'] else 0
        request_obj.plan_applied_at = timezone.now()
        request_obj.revenue_usd = revenue_usd
        request_obj.fx_rate_used = fx_rate
        request_obj.save()

        log.info(
            'payment_service: approved #%s revenue_usd=%s rate=%s source=%s',
            request_obj.id, revenue_usd, fx_rate, fx_source,
        )

    # Confirmation email to user (best-effort).
    if request_obj.user.email:
        subject, text_body = _format_user_confirmation(request_obj)
        _safe_send(subject=subject, text_body=text_body, recipient=request_obj.user.email)

    return {
        'ok': True,
        'previous_plan': previous_plan,
        'new_plan': request_obj.plan,
        'diamonds_granted': request_obj.diamonds_granted,
        'grant_reason': grant.get('reason'),
        'balance': grant.get('balance'),
    }


def reject_payment_request(*, request_obj: PaymentRequest, admin_user, admin_notes: str = '') -> dict:
    if request_obj.status != 'pending':
        return {
            'ok': False,
            'error': f'Cannot reject a request that is {request_obj.status!r}.',
        }
    request_obj.status = 'rejected'
    request_obj.reviewed_by = admin_user
    request_obj.reviewed_at = timezone.now()
    request_obj.admin_notes = admin_notes
    request_obj.save()

    if request_obj.user.email:
        subject = f'Your {request_obj.plan.upper()} payment couldn\'t be verified'
        text_body = '\n'.join([
            f'Hi {request_obj.user.username},',
            '',
            'We weren\'t able to confirm your recent payment for the '
            f'{request_obj.plan.upper()} plan.',
            '',
            'Notes from our team:',
            admin_notes or '(none provided)',
            '',
            'If you believe this is a mistake, reply to this email with your',
            'transaction screenshot and reference number.',
            '',
            '— The Sellanto team',
        ])
        _safe_send(subject=subject, text_body=text_body, recipient=request_obj.user.email)

    return {'ok': True, 'status': 'rejected'}


# Convenience: default plan price in USD (mirrors api/subscription_views PLAN_CATALOG).
PLAN_PRICE_USD = {
    'monthly': {'free': 0, 'starter': 9, 'pro': 29, 'business': 149, 'enterprise': 499},
    'yearly':  {'free': 0, 'starter': 7, 'pro': 23, 'business': 119, 'enterprise': 399},
}


def lookup_plan_price_usd(plan: str, billing_cycle: str = 'monthly') -> int:
    """Server-side source of truth for plan prices (so the client can't lie)."""
    table = PLAN_PRICE_USD.get(billing_cycle, PLAN_PRICE_USD['monthly'])
    return table.get(plan, 0)


def expected_diamonds_for_plan(plan: str) -> int:
    return PLAN_DIAMONDS.get(plan, 0)
