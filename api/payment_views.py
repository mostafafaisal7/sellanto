# api/payment_views.py
"""
User & admin payment endpoints for the MVP billing flow.

User flow:
    GET  /api/v1/payments/methods/         → public payout accounts
    POST /api/v1/payments/submit/          → submit a payment claim
    GET  /api/v1/payments/my-requests/     → user's own request history

Admin flow:
    GET    /api/v1/admin/payments/                   → list (filter by status)
    POST   /api/v1/admin/payments/<id>/approve/      → approve (switches plan)
    POST   /api/v1/admin/payments/<id>/reject/       → reject
    GET    /api/v1/admin/payout-accounts/            → list
    POST   /api/v1/admin/payout-accounts/            → create
    PUT    /api/v1/admin/payout-accounts/<id>/       → update
    DELETE /api/v1/admin/payout-accounts/<id>/       → delete
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth.models import User
from django.http import HttpResponse
from django.utils.html import escape
from django.views.decorators.http import require_GET

from accounts.models import AdminPayoutAccount, PaymentRequest
from accounts.services.payment_service import (
    approve_payment_request,
    expected_diamonds_for_plan,
    lookup_plan_price_usd,
    reject_payment_request,
    submit_payment_request,
    verify_action_token,
)


# ─────────────────────────────────────────────────────────────────────
# Serialization helpers (small enough to keep inline)
# ─────────────────────────────────────────────────────────────────────

def _serialize_payout_account(acct: AdminPayoutAccount, *, public: bool) -> dict:
    """Public version excludes admin-only sort_order and timestamps."""
    base = {
        'id': acct.id,
        'method': acct.method,
        'method_label': acct.get_method_display(),
        'display_name': acct.display_name,
        'account_number': acct.account_number,
        'account_holder_name': acct.account_holder_name,
        'instructions': acct.instructions,
        'currency': acct.currency,
        'is_active': acct.is_active,
    }
    if public:
        return base
    return {
        **base,
        'sort_order': acct.sort_order,
        'created_at': acct.created_at,
        'updated_at': acct.updated_at,
    }


def _serialize_payment_request(req: PaymentRequest, *, include_user: bool = False) -> dict:
    payout = (
        _serialize_payout_account(req.payout_account, public=True)
        if req.payout_account else None
    )
    out = {
        'id': req.id,
        'plan': req.plan,
        'billing_cycle': req.billing_cycle,
        'amount_usd': str(req.amount_usd),
        'amount_local': str(req.amount_local),
        'local_currency': req.local_currency,
        'payment_method': req.payment_method,
        'payment_method_label': req.get_payment_method_display(),
        'payout_account': payout,
        'transaction_reference': req.transaction_reference,
        'payer_name': req.payer_name,
        'payer_phone': req.payer_phone,
        'payer_email': req.payer_email,
        'payer_notes': req.payer_notes,
        'status': req.status,
        'admin_notes': req.admin_notes,
        'reviewed_at': req.reviewed_at,
        'reviewed_by': req.reviewed_by.username if req.reviewed_by else None,
        'diamonds_granted': req.diamonds_granted,
        'plan_applied_at': req.plan_applied_at,
        'created_at': req.created_at,
        'updated_at': req.updated_at,
    }
    if include_user:
        out['user'] = {
            'id': req.user.id,
            'username': req.user.username,
            'email': req.user.email,
        }
    return out


def _to_decimal(value, default=Decimal('0')) -> Decimal:
    try:
        return Decimal(str(value)) if value not in (None, '') else default
    except (InvalidOperation, TypeError):
        return default


# ─────────────────────────────────────────────────────────────────────
# User endpoints
# ─────────────────────────────────────────────────────────────────────

class PayoutMethodsView(APIView):
    """GET /api/v1/payments/methods/

    Lists active payout accounts the user can pay to. Public to authenticated
    users — this is what the PaymentModal uses to render bKash/Nagad/Bank tabs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = AdminPayoutAccount.objects.filter(is_active=True).order_by(
            'sort_order', 'method'
        )
        return Response({
            'methods': [_serialize_payout_account(a, public=True) for a in accounts],
        })


class SubmitPaymentView(APIView):
    """POST /api/v1/payments/submit/

    Body:
        {
          "plan": "pro",
          "billing_cycle": "monthly" | "yearly",
          "payment_method": "bkash" | "nagad" | ...,
          "payout_account_id": <int|null>,
          "amount_local": "3500",
          "local_currency": "BDT",
          "transaction_reference": "TRX12345",
          "payer_name": "...",
          "payer_phone": "...",
          "payer_email": "...",
          "payer_notes": "..."
        }
    """
    permission_classes = [IsAuthenticated]

    REQUIRED = ('plan', 'billing_cycle', 'payment_method')

    def post(self, request):
        data = request.data or {}
        for key in self.REQUIRED:
            if not data.get(key):
                return Response(
                    {'error': f'{key} is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        plan = data['plan']
        billing_cycle = data['billing_cycle']
        if billing_cycle not in ('monthly', 'yearly'):
            return Response(
                {'error': "billing_cycle must be 'monthly' or 'yearly'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if plan not in ('starter', 'pro', 'business', 'enterprise'):
            return Response(
                {'error': 'Free plan does not require payment'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve the payout account if provided. We don't *require* it because
        # admins might want to accept manual transfers off-list.
        payout_account = None
        payout_account_id = data.get('payout_account_id')
        if payout_account_id:
            try:
                payout_account = AdminPayoutAccount.objects.get(
                    id=int(payout_account_id), is_active=True
                )
            except (AdminPayoutAccount.DoesNotExist, ValueError, TypeError):
                return Response(
                    {'error': 'Invalid payout_account_id'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Server-side prices — never trust client.
        amount_usd = lookup_plan_price_usd(plan, billing_cycle)
        if amount_usd <= 0:
            return Response(
                {'error': f'No published price for {plan}/{billing_cycle}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount_local = _to_decimal(data.get('amount_local'), default=Decimal(str(amount_usd)))
        local_currency = (data.get('local_currency') or 'USD').upper()

        # Capture request scheme+host so the email's approve/reject links
        # resolve to wherever the user is hitting Django. Local: 127.0.0.1:8000;
        # production: https://abedintechllc.com — both work without config.
        request_base = f'{request.scheme}://{request.get_host()}'

        req = submit_payment_request(
            user=request.user,
            plan=plan,
            billing_cycle=billing_cycle,
            amount_usd=Decimal(str(amount_usd)),
            amount_local=amount_local,
            local_currency=local_currency,
            payment_method=data['payment_method'],
            payout_account=payout_account,
            transaction_reference=data.get('transaction_reference', ''),
            payer_name=data.get('payer_name', ''),
            payer_phone=data.get('payer_phone', ''),
            payer_email=data.get('payer_email', ''),
            payer_notes=data.get('payer_notes', ''),
            request_base_url=request_base,
        )

        return Response(
            {
                'ok': True,
                'payment_request': _serialize_payment_request(req),
                'expected_diamonds': expected_diamonds_for_plan(plan),
                'message': (
                    'Payment received and queued for verification. '
                    'You\'ll get an email the moment it\'s approved.'
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class MyPaymentRequestsView(APIView):
    """GET /api/v1/payments/my-requests/ — user's own request history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PaymentRequest.objects.filter(user=request.user).order_by('-created_at')[:50]
        return Response({
            'requests': [_serialize_payment_request(r) for r in qs],
        })


# ─────────────────────────────────────────────────────────────────────
# Admin endpoints
# ─────────────────────────────────────────────────────────────────────

def _require_admin(request):
    """Returns Response on failure, None on success."""
    if not (request.user and request.user.is_authenticated and
            (request.user.is_staff or request.user.is_superuser)):
        return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    return None


class AdminPaymentRequestListView(APIView):
    """GET /api/v1/admin/payments/?status=pending"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        qs = PaymentRequest.objects.select_related('user', 'payout_account', 'reviewed_by')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Lightweight pagination — last 100 by default.
        try:
            limit = max(1, min(int(request.query_params.get('limit', 100)), 500))
        except (TypeError, ValueError):
            limit = 100

        rows = list(qs.order_by('-created_at')[:limit])

        # Counts per status for the dashboard tabs.
        from django.db.models import Count
        counts_qs = PaymentRequest.objects.values('status').annotate(n=Count('id'))
        counts = {c['status']: c['n'] for c in counts_qs}

        return Response({
            'requests': [_serialize_payment_request(r, include_user=True) for r in rows],
            'counts': {
                'pending': counts.get('pending', 0),
                'approved': counts.get('approved', 0),
                'rejected': counts.get('rejected', 0),
                'cancelled': counts.get('cancelled', 0),
                'total': sum(counts.values()),
            },
        })


class AdminPaymentApproveView(APIView):
    """POST /api/v1/admin/payments/<id>/approve/   { admin_notes? }"""
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        denied = _require_admin(request)
        if denied:
            return denied

        try:
            req = PaymentRequest.objects.get(id=payment_id)
        except PaymentRequest.DoesNotExist:
            return Response({'error': 'Payment request not found'}, status=404)

        result = approve_payment_request(
            request_obj=req,
            admin_user=request.user,
            admin_notes=request.data.get('admin_notes', '') if request.data else '',
        )
        if not result.get('ok'):
            return Response({'error': result.get('error', 'Could not approve')}, status=400)

        req.refresh_from_db()
        return Response({
            'ok': True,
            'result': result,
            'payment_request': _serialize_payment_request(req, include_user=True),
        })


class AdminPaymentRejectView(APIView):
    """POST /api/v1/admin/payments/<id>/reject/   { admin_notes? }"""
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        denied = _require_admin(request)
        if denied:
            return denied

        try:
            req = PaymentRequest.objects.get(id=payment_id)
        except PaymentRequest.DoesNotExist:
            return Response({'error': 'Payment request not found'}, status=404)

        result = reject_payment_request(
            request_obj=req,
            admin_user=request.user,
            admin_notes=request.data.get('admin_notes', '') if request.data else '',
        )
        if not result.get('ok'):
            return Response({'error': result.get('error', 'Could not reject')}, status=400)

        req.refresh_from_db()
        return Response({
            'ok': True,
            'payment_request': _serialize_payment_request(req, include_user=True),
        })


class AdminPayoutAccountListView(APIView):
    """GET / POST /api/v1/admin/payout-accounts/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_admin(request)
        if denied:
            return denied
        accounts = AdminPayoutAccount.objects.all().order_by('sort_order', 'method')
        return Response({
            'accounts': [_serialize_payout_account(a, public=False) for a in accounts],
        })

    def post(self, request):
        denied = _require_admin(request)
        if denied:
            return denied

        data = request.data or {}
        if not data.get('method') or not data.get('display_name'):
            return Response({'error': 'method and display_name are required'}, status=400)

        valid_methods = {m for m, _ in AdminPayoutAccount.METHOD_CHOICES}
        if data['method'] not in valid_methods:
            return Response({'error': f'Invalid method: {data["method"]}'}, status=400)

        try:
            sort_order = int(data.get('sort_order', 0))
        except (TypeError, ValueError):
            sort_order = 0

        acct = AdminPayoutAccount.objects.create(
            method=data['method'],
            display_name=data['display_name'],
            account_number=data.get('account_number', ''),
            account_holder_name=data.get('account_holder_name', ''),
            instructions=data.get('instructions', ''),
            currency=(data.get('currency') or 'BDT').upper(),
            is_active=bool(data.get('is_active', True)),
            sort_order=sort_order,
        )
        return Response(
            {'account': _serialize_payout_account(acct, public=False)},
            status=status.HTTP_201_CREATED,
        )


class AdminPayoutAccountDetailView(APIView):
    """PUT / DELETE /api/v1/admin/payout-accounts/<id>/"""
    permission_classes = [IsAuthenticated]

    def put(self, request, account_id):
        denied = _require_admin(request)
        if denied:
            return denied
        try:
            acct = AdminPayoutAccount.objects.get(id=account_id)
        except AdminPayoutAccount.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        data = request.data or {}
        for field in ('display_name', 'account_number', 'account_holder_name',
                      'instructions', 'currency'):
            if field in data:
                value = data[field]
                if field == 'currency' and isinstance(value, str):
                    value = value.upper()
                setattr(acct, field, value)
        if 'method' in data:
            valid_methods = {m for m, _ in AdminPayoutAccount.METHOD_CHOICES}
            if data['method'] not in valid_methods:
                return Response({'error': f'Invalid method: {data["method"]}'}, status=400)
            acct.method = data['method']
        if 'is_active' in data:
            acct.is_active = bool(data['is_active'])
        if 'sort_order' in data:
            try:
                acct.sort_order = int(data['sort_order'])
            except (TypeError, ValueError):
                pass
        acct.save()
        return Response({'account': _serialize_payout_account(acct, public=False)})

    def delete(self, request, account_id):
        denied = _require_admin(request)
        if denied:
            return denied
        try:
            acct = AdminPayoutAccount.objects.get(id=account_id)
        except AdminPayoutAccount.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        acct.delete()
        return Response({'ok': True})


# ─────────────────────────────────────────────────────────────────────
# One-click email action (no login required — token proves authenticity)
# ─────────────────────────────────────────────────────────────────────

def _render_action_page(*, ok: bool, title: str, body_html: str) -> HttpResponse:
    """Render a small standalone HTML page after admin clicks email link.

    No template file; inline so this works regardless of TEMPLATES config.
    """
    color = '#10B981' if ok else '#E8364F'
    icon = '✓' if ok else '✕'
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)} · Sellanto</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0D0D14; color: #F1F1F6; min-height: 100vh; display: flex;
            align-items: center; justify-content: center; padding: 24px; }}
    .card {{ background: #16162A; border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
             max-width: 520px; width: 100%; padding: 36px; text-align: center; }}
    .icon {{ width: 72px; height: 72px; border-radius: 24px; background: {color}22;
             color: {color}; font-size: 36px; line-height: 72px; margin: 0 auto 20px;
             border: 1px solid {color}55; }}
    h1 {{ margin: 0 0 8px; font-size: 26px; letter-spacing: -0.4px; }}
    p {{ color: #9CA3AF; line-height: 1.6; font-size: 14px; }}
    .body {{ text-align: left; margin-top: 20px; }}
    .body table {{ width: 100%; font-size: 13px; border-collapse: collapse; }}
    .body td {{ padding: 6px 0; }}
    .body td:first-child {{ color: #6B7280; }}
    .body td:last-child {{ color: #F1F1F6; text-align: right; font-family: ui-monospace, SFMono-Regular, monospace; }}
    .btn {{ display: inline-block; margin-top: 24px; padding: 12px 22px; border-radius: 12px;
            background: linear-gradient(135deg, #E8364F, #FF4D66); color: white; text-decoration: none;
            font-weight: 700; font-size: 14px; }}
    .footer {{ color: #6B7280; font-size: 11px; margin-top: 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{icon}</div>
    <h1>{escape(title)}</h1>
    <div class="body">{body_html}</div>
    <a class="btn" href="/admin-panel/payments">Open admin dashboard</a>
    <div class="footer">Sellanto · automated payment action</div>
  </div>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html; charset=utf-8')


@require_GET
def payment_action_by_token(request, token: str):
    """GET /api/v1/payments/action/<token>/

    Verifies the signed token and executes the action (approve/reject)
    immediately. No login required — only Django (with SECRET_KEY) can
    have generated a valid token, and clicking the same token twice is
    idempotent for approval (re-running on an already-approved request
    is a no-op).
    """
    parsed = verify_action_token(token)
    if parsed is None:
        return _render_action_page(
            ok=False,
            title='Link invalid or expired',
            body_html=(
                '<p>This action link is no longer valid. It may have been '
                'tampered with, or expired (links work for 7 days). '
                'You can still review this request in the admin dashboard.</p>'
            ),
        )

    payment_id, action = parsed

    try:
        req = PaymentRequest.objects.select_related('user').get(id=payment_id)
    except PaymentRequest.DoesNotExist:
        return _render_action_page(
            ok=False,
            title='Payment not found',
            body_html=f'<p>Payment request #{payment_id} no longer exists.</p>',
        )

    # Resolve the admin user we attribute the action to. Prefer the first
    # superuser; fall back to any staff. None is OK too — service handles it.
    admin_user = (
        User.objects.filter(is_superuser=True).order_by('id').first()
        or User.objects.filter(is_staff=True).order_by('id').first()
    )

    if action == 'approve':
        result = approve_payment_request(
            request_obj=req,
            admin_user=admin_user,
            admin_notes='Approved via email one-click link',
        )
        if not result.get('ok'):
            return _render_action_page(
                ok=False,
                title='Could not approve',
                body_html=f'<p>{escape(result.get("error", "Action failed"))}</p>',
            )
        req.refresh_from_db()
        details = f"""
          <table>
            <tr><td>User</td><td>{escape(req.user.username)}</td></tr>
            <tr><td>Email</td><td>{escape(req.user.email or '—')}</td></tr>
            <tr><td>Plan</td><td>{escape(req.plan)} · {escape(req.billing_cycle)}</td></tr>
            <tr><td>Amount</td><td>${escape(str(req.amount_usd))}</td></tr>
            <tr><td>Diamonds granted</td><td>+{req.diamonds_granted:,}</td></tr>
            <tr><td>Reference</td><td>{escape(req.transaction_reference or '—')}</td></tr>
          </table>
        """
        if result.get('already_approved'):
            return _render_action_page(
                ok=True,
                title='Already approved',
                body_html=f'<p>This payment was already approved earlier.</p>{details}',
            )
        return _render_action_page(
            ok=True,
            title=f'{req.plan.upper()} plan activated',
            body_html=(
                f'<p>{escape(req.user.username)} has been switched to '
                f'<strong>{escape(req.plan)}</strong> and granted '
                f'<strong>{req.diamonds_granted:,} diamonds</strong>. '
                'A confirmation email is on its way to them.</p>'
                + details
            ),
        )

    # action == 'reject'
    result = reject_payment_request(
        request_obj=req,
        admin_user=admin_user,
        admin_notes='Rejected via email one-click link',
    )
    if not result.get('ok'):
        return _render_action_page(
            ok=False,
            title='Could not reject',
            body_html=f'<p>{escape(result.get("error", "Action failed"))}</p>',
        )
    req.refresh_from_db()
    details = f"""
      <table>
        <tr><td>User</td><td>{escape(req.user.username)}</td></tr>
        <tr><td>Plan attempted</td><td>{escape(req.plan)}</td></tr>
        <tr><td>Amount</td><td>${escape(str(req.amount_usd))}</td></tr>
        <tr><td>Reference</td><td>{escape(req.transaction_reference or '—')}</td></tr>
      </table>
    """
    return _render_action_page(
        ok=True,
        title='Payment rejected',
        body_html=(
            f'<p>The payment from <strong>{escape(req.user.username)}</strong> has been '
            f'marked as rejected. Their plan was not changed and they\'ve been emailed '
            'with the rejection notice.</p>'
            + details
        ),
    )
