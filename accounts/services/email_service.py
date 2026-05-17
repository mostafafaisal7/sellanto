# accounts/services/email_service.py
"""Transactional email helpers for Sellanto.

Three flows live here:
    - send_welcome_email(user)            after OTP-verified first signup
    - send_otp_email(user, code, ttl)     6-digit OTP for first-time login
    - send_payment_pending_email(user, p) after a payment claim is submitted

All sends are best-effort: SMTP errors are logged and swallowed so they
never break the HTTP request that triggered them.
"""

from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection


log = logging.getLogger(__name__)


def get_email_connection():
    """Return an SMTP connection built from DB config (SiteConfiguration).
    Falls back to Django settings / .env values if DB has nothing set.
    Returns None when no credentials are configured at all."""
    from accounts.models import SiteConfiguration

    host = SiteConfiguration.get('email_host') or getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    port = SiteConfiguration.get('email_port') or str(getattr(settings, 'EMAIL_PORT', 587))
    user = SiteConfiguration.get('email_host_user') or getattr(settings, 'EMAIL_HOST_USER', '')
    password = SiteConfiguration.get('email_host_password') or getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    use_tls_raw = SiteConfiguration.get('email_use_tls') or str(getattr(settings, 'EMAIL_USE_TLS', True))
    use_tls = str(use_tls_raw).lower() not in ('false', '0', 'no')

    if not user or not password:
        return None  # let Django use its default connection

    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=host,
        port=int(port) if port and str(port).isdigit() else 587,
        username=user,
        password=password,
        use_tls=use_tls,
    )


def get_from_email() -> str:
    """Return the configured from-address, preferring DB over settings."""
    from accounts.models import SiteConfiguration

    return (
        SiteConfiguration.get('email_default_from')
        or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        or getattr(settings, 'EMAIL_HOST_USER', None)
        or 'noreply@sellanto.app'
    )


def _send(subject: str, text_body: str, recipient: str,
          html_body: Optional[str] = None) -> bool:
    if not recipient:
        log.warning('email_service: skipped send, recipient is empty')
        return False
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=get_from_email(),
            to=[recipient],
            connection=get_email_connection(),
        )
        if html_body:
            msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        return True
    except Exception:  # noqa: BLE001
        log.exception('email_service: send failed (recipient=%s)', recipient)
        return False


# ─────────────────────────────────────────────────────────────────────
# Shared HTML chrome — keeps the brand consistent across templates
# ─────────────────────────────────────────────────────────────────────

def _wrap_html(*, preheader: str, content_html: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sellanto</title>
</head>
<body style="margin:0;padding:0;background:#0D0D14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#0D0D14;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#16162A;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#E8364F 0%,#FF6B47 100%);padding:32px 32px 28px;text-align:center;">
              <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-0.5px;margin:0;">Sellanto</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;letter-spacing:0.4px;text-transform:uppercase;">AI content, on autopilot</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#F1F1F6;">
              {content_html}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#6B7280;font-size:11px;line-height:1.6;">
              You are receiving this because you have a Sellanto account.<br>
              &copy; Sellanto · automated message — please don't reply directly to this address.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────
# Welcome email — first signup, after OTP verification
# ─────────────────────────────────────────────────────────────────────

def send_welcome_email(user) -> bool:
    if not user.email:
        return False

    name = (user.first_name or user.username or 'there').strip()
    site_url = (getattr(settings, 'SITE_URL', '') or '').rstrip('/') or 'https://sellanto.app'
    dashboard_url = f'{site_url}/dashboard'

    subject = f'Welcome to Sellanto, {name} 👋'

    text_body = '\n'.join([
        f'Hi {name},',
        '',
        'Welcome to Sellanto — we\'re excited to have you on board!',
        '',
        'Your account is ready. You can now:',
        '  • Generate brand-aware captions, images, and videos in seconds',
        '  • Schedule posts across Facebook, Instagram, LinkedIn and more',
        '  • Use Magic Mode to ship a full content batch in one click',
        '',
        f'Open your dashboard: {dashboard_url}',
        '',
        'You started with 200 free Diamond Tokens — enough to try every feature.',
        'Need help? Just reply to this email; a human reads every message.',
        '',
        '— The Sellanto team',
    ])

    content_html = f"""
      <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;letter-spacing:-0.4px;">Welcome aboard, {name}! 🎉</h1>
      <p style="margin:0 0 18px;color:#C7C7D1;font-size:15px;line-height:1.65;">
        We're thrilled you joined Sellanto. Your account is ready and waiting — you've got
        <strong style="color:#FF6B47;">200 free Diamond Tokens</strong> to spend on captions, images, and videos.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr>
          <td style="background:linear-gradient(135deg,rgba(232,54,79,0.15),rgba(255,107,71,0.08));border:1px solid rgba(232,54,79,0.25);border-radius:16px;padding:18px 20px;">
            <div style="font-size:13px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">What's inside</div>
            <ul style="margin:0;padding-left:18px;color:#E8E8F0;font-size:14px;line-height:1.85;">
              <li>One-click <strong>Magic Mode</strong> — full posts in a single tap</li>
              <li>Brand-aware AI captions, images &amp; videos</li>
              <li>Multi-platform scheduling (Facebook, Instagram, LinkedIn…)</li>
              <li>Messenger automation with your knowledge base</li>
            </ul>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 24px;">
        <tr>
          <td style="border-radius:14px;background:linear-gradient(135deg,#E8364F,#FF6B47);">
            <a href="{dashboard_url}"
               style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;">
              Open my dashboard →
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:24px 0 0;color:#9CA3AF;font-size:13px;line-height:1.6;text-align:center;">
        Stuck somewhere? Just hit reply — a human reads every message.
      </p>
    """

    html_body = _wrap_html(
        preheader='Your Sellanto account is ready — open your dashboard.',
        content_html=content_html,
    )
    return _send(subject, text_body, user.email, html_body)


# ─────────────────────────────────────────────────────────────────────
# OTP email — 6-digit code for first-time login verification
# ─────────────────────────────────────────────────────────────────────

def send_otp_email(user, code: str, ttl_seconds: int = 60) -> bool:
    if not user.email:
        return False

    name = (user.first_name or user.username or 'there').strip()
    subject = f'Your Sellanto verification code: {code}'

    text_body = '\n'.join([
        f'Hi {name},',
        '',
        f'Your Sellanto verification code is: {code}',
        '',
        f'This code expires in {ttl_seconds} seconds. If it expires before you',
        'enter it, just request a new one from the verification screen.',
        '',
        'If you didn\'t try to sign up, you can safely ignore this email.',
        '',
        '— The Sellanto team',
    ])

    # Big, eye-catching code block with letterspacing for legibility
    spaced = ' '.join(code)
    content_html = f"""
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:-0.3px;">Verify your email</h1>
      <p style="margin:0 0 24px;color:#C7C7D1;font-size:14px;line-height:1.6;">
        Hi {name}, enter this code on the Sellanto signup screen to finish creating your account.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td align="center" style="background:#0D0D14;border:1px solid rgba(232,54,79,0.35);border-radius:18px;padding:28px 16px;">
            <div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;">Verification code</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
                        font-size:38px;font-weight:800;color:#FF6B47;letter-spacing:14px;
                        padding-left:14px;text-shadow:0 0 24px rgba(255,107,71,0.45);">
              {spaced}
            </div>
            <div style="font-size:11px;color:#6B7280;margin-top:14px;letter-spacing:0.4px;">
              Expires in {ttl_seconds} seconds
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:18px 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">
        If you didn't try to sign up to Sellanto, you can safely ignore this email — nobody can access your account without this code.
      </p>
    """

    html_body = _wrap_html(
        preheader=f'Your Sellanto verification code is {code}.',
        content_html=content_html,
    )
    return _send(subject, text_body, user.email, html_body)


# ─────────────────────────────────────────────────────────────────────
# Password-reset OTP — same 6-digit code mechanism, different copy
# ─────────────────────────────────────────────────────────────────────

def send_password_reset_otp_email(user, code: str, ttl_seconds: int = 60) -> bool:
    if not user.email:
        return False

    name = (user.first_name or user.username or 'there').strip()
    subject = f'Reset your Sellanto password — code: {code}'

    text_body = '\n'.join([
        f'Hi {name},',
        '',
        f'Your Sellanto password reset code is: {code}',
        '',
        f'This code expires in {ttl_seconds} seconds. Enter it on the',
        'reset-password screen along with your new password to regain access.',
        '',
        'If you didn\'t request this, you can safely ignore this email —',
        'your password will stay unchanged.',
        '',
        '— The Sellanto team',
    ])

    spaced = ' '.join(code)
    content_html = f"""
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:-0.3px;">Reset your password</h1>
      <p style="margin:0 0 24px;color:#C7C7D1;font-size:14px;line-height:1.6;">
        Hi {name}, enter this code on the reset-password screen together with your new password.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td align="center" style="background:#0D0D14;border:1px solid rgba(232,54,79,0.35);border-radius:18px;padding:28px 16px;">
            <div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;">Password reset code</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
                        font-size:38px;font-weight:800;color:#FF6B47;letter-spacing:14px;
                        padding-left:14px;text-shadow:0 0 24px rgba(255,107,71,0.45);">
              {spaced}
            </div>
            <div style="font-size:11px;color:#6B7280;margin-top:14px;letter-spacing:0.4px;">
              Expires in {ttl_seconds} seconds
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:18px 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">
        If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
      </p>
    """

    html_body = _wrap_html(
        preheader=f'Your Sellanto password reset code is {code}.',
        content_html=content_html,
    )
    return _send(subject, text_body, user.email, html_body)


# ─────────────────────────────────────────────────────────────────────
# Payment pending email — sent immediately after a payment claim is filed
# ─────────────────────────────────────────────────────────────────────

def send_payment_pending_email(user, payment_request) -> bool:
    """Sent right after a user submits a payment claim.

    Tone: thank them for upgrading, set the expectation that a human is
    reviewing the proof, and promise activation ASAP. The approval email
    itself is sent later from `payment_service.approve_payment_request`.
    """
    if not user.email:
        return False

    name = (user.first_name or user.username or 'there').strip()
    plan = payment_request.plan.upper()
    amount = f'{payment_request.amount_local} {payment_request.local_currency}'
    method = payment_request.get_payment_method_display()
    ref = payment_request.transaction_reference or '—'

    subject = f'🎉 Payment received — {plan} activation underway'

    text_body = '\n'.join([
        f'Hi {name},',
        '',
        f'🎉 Congratulations — you just upgraded to the {plan} plan!',
        '',
        f'We\'ve received your {amount} payment via {method}',
        f'(reference: {ref}). Our technician will verify it shortly and',
        'activate your account ASAP — usually within a few minutes during',
        'business hours.',
        '',
        'You\'ll get another email the moment your plan goes live, and your',
        'Diamond Tokens will land in your wallet automatically.',
        '',
        'No action needed from you right now — sit tight and we\'ll handle it.',
        '',
        '— The Sellanto team',
    ])

    content_html = f"""
      <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-0.4px;">
        🎉 Congratulations, {name}!
      </h1>
      <p style="margin:0 0 22px;color:#C7C7D1;font-size:15px;line-height:1.65;">
        You've just upgraded to the <strong style="color:#FF6B47;">{plan}</strong> plan.
        We've received your payment and our technician is verifying it now —
        your account will be activated <strong>ASAP</strong>.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
        <tr>
          <td style="background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04));border:1px solid rgba(245,158,11,0.3);border-radius:14px;padding:16px 18px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="font-size:22px;line-height:1;">⏳</div>
              <div>
                <div style="font-weight:700;color:#F59E0B;font-size:14px;margin-bottom:2px;">Verification in progress</div>
                <div style="color:#C7C7D1;font-size:13px;line-height:1.55;">
                  Our technician will check your payment and activate your plan as soon as possible. You don't need to do anything — we'll email you the moment it's live.
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <div style="background:#0D0D14;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px 20px;margin:0 0 24px;">
        <div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:12px;">Payment summary</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#E8E8F0;">
          <tr><td style="padding:6px 0;color:#9CA3AF;">Plan</td><td style="text-align:right;font-weight:600;">{plan}</td></tr>
          <tr><td style="padding:6px 0;color:#9CA3AF;">Amount paid</td><td style="text-align:right;font-weight:600;">{amount}</td></tr>
          <tr><td style="padding:6px 0;color:#9CA3AF;">Method</td><td style="text-align:right;">{method}</td></tr>
          <tr><td style="padding:6px 0;color:#9CA3AF;">Reference</td><td style="text-align:right;font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;">{ref}</td></tr>
          <tr><td style="padding:6px 0;color:#9CA3AF;">Status</td><td style="text-align:right;color:#F59E0B;font-weight:700;">Awaiting verification</td></tr>
        </table>
      </div>

      <p style="margin:0;color:#9CA3AF;font-size:13px;line-height:1.6;text-align:center;">
        Questions about your payment? Reply to this email and we'll sort it out.
      </p>
    """

    html_body = _wrap_html(
        preheader=f'Your {plan} payment is being verified — we\'ll activate it ASAP.',
        content_html=content_html,
    )
    return _send(subject, text_body, user.email, html_body)
