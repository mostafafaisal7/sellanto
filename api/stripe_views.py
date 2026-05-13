"""
Stripe HTTP endpoints.

Mounted under /api/v1/billing/stripe/:
  - POST checkout/                 → create Checkout Session for plan upgrade
  - POST topup/                    → create Checkout Session for diamond top-up
  - POST webhook/                  → Stripe webhook receiver (no auth, signature-verified)
  - POST cancel/                   → cancel the current subscription (at period end)
  - GET  session/<session_id>/     → success-page polling endpoint
"""

from __future__ import annotations

import logging

import stripe
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services import stripe_service
from accounts.services.stripe_service import (
    StripeConfigError,
    TOPUP_CATALOG,
)
from accounts.models import StripePaymentMethod

log = logging.getLogger(__name__)


class CreatePlanCheckoutView(APIView):
    """POST /api/v1/billing/stripe/checkout/

    Body: { "plan": "pro"|"business", "billing_cycle": "monthly"|"yearly" }
    Returns: { "url": str, "session_id": str }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get('plan')
        billing_cycle = request.data.get('billing_cycle', 'monthly')

        if not plan:
            return Response({'error': 'plan is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if plan == 'free':
            return Response({'error': 'Free plan does not require checkout'},
                            status=status.HTTP_400_BAD_REQUEST)
        if billing_cycle not in {'monthly', 'yearly'}:
            return Response({'error': "billing_cycle must be 'monthly' or 'yearly'"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            result = stripe_service.create_plan_checkout_session(
                request.user, plan, billing_cycle,
            )
        except StripeConfigError as exc:
            log.exception('stripe checkout config error')
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as exc:
            log.exception('stripe checkout error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({'url': result.url, 'session_id': result.session_id})


class CreateTopupCheckoutView(APIView):
    """POST /api/v1/billing/stripe/topup/

    Body: { "sku": "topup_1000" | "topup_5000" | "topup_10000" | "topup_25000" }
    Returns: { "url": str, "session_id": str }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sku = request.data.get('sku')
        if not sku:
            return Response({'error': 'sku is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            result = stripe_service.create_topup_checkout_session(request.user, sku)
        except StripeConfigError as exc:
            log.exception('stripe topup config error')
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as exc:
            log.exception('stripe topup error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({'url': result.url, 'session_id': result.session_id})


class CancelSubscriptionView(APIView):
    """POST /api/v1/billing/stripe/cancel/

    Body: { "immediate"?: bool }  (default false → cancel at period end)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        immediate = bool(request.data.get('immediate', False))
        try:
            result = stripe_service.cancel_subscription(request.user, immediate=immediate)
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.StripeError as exc:
            log.exception('stripe cancel error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


class CheckoutSessionStatusView(APIView):
    """GET /api/v1/billing/stripe/session/<session_id>/

    Polled by the success page to confirm the webhook landed and the
    plan / diamonds were applied. Returns `{status: 'pending'}` while
    waiting for the webhook to arrive.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id: str):
        result = stripe_service.get_session_status(session_id, request.user)
        return Response(result)


class TopupCatalogView(APIView):
    """GET /api/v1/billing/stripe/topup-catalog/

    Returns the static list of top-up SKUs for the BuyDiamonds page.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        catalog = [
            {'sku': sku, 'diamonds': entry['diamonds'], 'usd': entry['usd']}
            for sku, entry in TOPUP_CATALOG.items()
        ]
        return Response({'items': catalog})


# ---------------------------------------------------------------------------
# Card-on-file endpoints
# ---------------------------------------------------------------------------

class CreateChargeIntentView(APIView):
    """POST /api/v1/billing/stripe/charge/

    Universal embedded-flow charge. Used when the user has no saved card
    OR explicitly wants to enter a new card. Returns a client_secret so
    the frontend can render <PaymentElement /> and confirm in-browser.

    Body (one of):
      { "sku": "topup_1000" }                                          # diamond top-up
      { "purpose": "boost", "amount_usd": 50, "metadata": {...} }      # ad boost
      { "purpose": "misc", "amount_usd": 5, "metadata": {...} }        # generic charge
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sku = request.data.get('sku')
        purpose = request.data.get('purpose')
        amount_usd = request.data.get('amount_usd')
        extra_metadata = request.data.get('metadata') or {}

        try:
            amount_cents, purpose_resolved, metadata = _resolve_charge_request(
                sku=sku, purpose=purpose, amount_usd=amount_usd,
                extra_metadata=extra_metadata,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = stripe_service.create_charge_intent(
                user=request.user,
                amount_cents=amount_cents,
                purpose=purpose_resolved,
                metadata=metadata,
            )
        except StripeConfigError as exc:
            log.exception('stripe charge config error')
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as exc:
            log.exception('stripe charge error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'client_secret':      result.client_secret,
            'payment_intent_id':  result.payment_intent_id,
            'publishable_key':    result.publishable_key,
            'status':             result.status,
            'amount_cents':       amount_cents,
        })


class ChargeOffSessionView(APIView):
    """POST /api/v1/billing/stripe/charge-saved/

    Charge the user's default saved card without any UI. Used for repeat
    purchases when `has_card_on_file` is true. Returns 3DS fallback URL
    if the bank demands SCA.

    Body: same shape as /charge/.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not stripe_service.has_card_on_file(request.user):
            return Response(
                {'error': 'No saved card. Use /charge/ for the embedded flow.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sku = request.data.get('sku')
        purpose = request.data.get('purpose')
        amount_usd = request.data.get('amount_usd')
        extra_metadata = request.data.get('metadata') or {}

        try:
            amount_cents, purpose_resolved, metadata = _resolve_charge_request(
                sku=sku, purpose=purpose, amount_usd=amount_usd,
                extra_metadata=extra_metadata,
            )
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = stripe_service.charge_off_session(
                user=request.user,
                amount_cents=amount_cents,
                purpose=purpose_resolved,
                metadata=metadata,
            )
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as exc:
            log.exception('stripe off-session error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'succeeded':            result.succeeded,
            'payment_intent_id':    result.payment_intent_id,
            'status':               result.status,
            'needs_3ds':            result.needs_3ds,
            'fallback_checkout_url': result.fallback_checkout_url,
            'error':                result.error_message,
            'amount_cents':         amount_cents,
        })


def _resolve_charge_request(*, sku, purpose, amount_usd, extra_metadata):
    """Resolve the request body into (amount_cents, purpose, metadata).

    Four shapes supported:
      - sku provided                    → locked-catalog topup
      - purpose='topup' + amount_usd    → flexible-amount topup (NEW)
      - purpose='boost' + amount_usd    → custom-amount boost
      - purpose='misc'  + amount_usd    → generic
    """
    from accounts.services import stripe_config

    if sku:
        entry = TOPUP_CATALOG.get(sku)
        if not entry:
            raise ValueError(f'Unknown SKU: {sku!r}')
        amount_cents = int(entry['usd']) * 100
        return amount_cents, 'topup', {
            'sku': sku,
            'diamonds': str(entry['diamonds']),
            'usd': str(entry['usd']),
            'source': 'sku',
            **{k: str(v) for k, v in extra_metadata.items()},
        }

    if purpose not in {'topup', 'boost', 'misc'}:
        raise ValueError(
            "Must supply `sku` OR `purpose` in {'topup','boost','misc'} with `amount_usd`."
        )
    try:
        amount_dollars = float(amount_usd)
    except (TypeError, ValueError):
        raise ValueError('`amount_usd` must be a number')

    # Flexible topup: validate bounds against admin-configured limits and
    # compute diamond grant amount so the webhook can read it directly.
    if purpose == 'topup':
        if amount_dollars < stripe_config.TOPUP_MIN_USD:
            raise ValueError(
                f'Minimum top-up is ${stripe_config.TOPUP_MIN_USD}.'
            )
        if amount_dollars > stripe_config.TOPUP_MAX_USD:
            raise ValueError(
                f'Maximum top-up is ${stripe_config.TOPUP_MAX_USD}.'
            )
        diamonds = int(amount_dollars * stripe_config.diamonds_per_dollar())
        amount_cents = int(round(amount_dollars * 100))
        metadata = {
            'diamonds':   str(diamonds),
            'usd':        f'{amount_dollars:.2f}',
            'amount_usd': f'{amount_dollars:.2f}',
            'source':     'flex',
            **{k: str(v) for k, v in extra_metadata.items()},
        }
        return amount_cents, 'topup', metadata

    # boost / misc — caller-supplied amount, free-form metadata
    amount_cents = int(round(amount_dollars * 100))
    metadata = {
        'amount_usd': f'{amount_dollars:.2f}',
        **{k: str(v) for k, v in extra_metadata.items()},
    }
    return amount_cents, purpose, metadata


class CreateSubscriptionView(APIView):
    """POST /api/v1/billing/stripe/subscribe/

    Embedded subscription flow. Creates a draft subscription with
    `default_incomplete` and returns the client_secret for the initial
    invoice PaymentIntent, so the frontend can render <PaymentElement />
    to collect the card and confirm.

    Body: { "plan": "pro"|"business", "billing_cycle": "monthly"|"yearly" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get('plan')
        billing_cycle = request.data.get('billing_cycle', 'monthly')

        if not plan or plan == 'free':
            return Response({'error': 'Valid paid plan required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if billing_cycle not in {'monthly', 'yearly'}:
            return Response({'error': "billing_cycle must be 'monthly' or 'yearly'"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            result = stripe_service.create_subscription_with_setup(
                user=request.user, plan=plan, billing_cycle=billing_cycle,
            )
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.StripeError as exc:
            log.exception('stripe subscribe error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'subscription_id': result.subscription_id,
            'client_secret':   result.client_secret,
            'publishable_key': result.publishable_key,
        })


class PaymentMethodsView(APIView):
    """GET  /api/v1/billing/stripe/payment-methods/    → list saved cards
    POST /api/v1/billing/stripe/payment-methods/<pm>/default/ → set default
    DELETE /api/v1/billing/stripe/payment-methods/<pm>/ → detach
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            rows = stripe_service.list_payment_methods(request.user)
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'items': [_serialize_pm(pm) for pm in rows]})


class PaymentMethodDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pm_id: str):
        """Set as default."""
        try:
            pm = stripe_service.set_default_payment_method(request.user, pm_id)
        except StripePaymentMethod.DoesNotExist:
            return Response({'error': 'Payment method not found'},
                            status=status.HTTP_404_NOT_FOUND)
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.StripeError as exc:
            log.exception('stripe set-default error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response({'item': _serialize_pm(pm)})

    def delete(self, request, pm_id: str):
        try:
            result = stripe_service.remove_payment_method(request.user, pm_id)
        except StripeConfigError as exc:
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.StripeError as exc:
            log.exception('stripe remove-pm error')
            return Response({'error': str(exc)},
                            status=status.HTTP_502_BAD_GATEWAY)
        if not result.get('ok'):
            return Response(result, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


def _serialize_pm(pm: StripePaymentMethod) -> dict:
    return {
        'id':         pm.stripe_payment_method_id,
        'brand':      pm.card_brand,
        'last4':      pm.card_last4,
        'exp_month':  pm.card_exp_month,
        'exp_year':   pm.card_exp_year,
        'funding':    pm.card_funding,
        'is_default': pm.is_default,
        'created_at': pm.created_at.isoformat(),
    }


class HasCardOnFileView(APIView):
    """GET /api/v1/billing/stripe/has-card/

    Lightweight check so the frontend can choose between embedded card
    entry (no card) and the one-click confirm modal (card on file).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has = stripe_service.has_card_on_file(request.user)
        default = None
        if has:
            from accounts.models import StripePaymentMethod as _PM
            row = _PM.objects.filter(user=request.user, is_default=True).first()
            if row:
                default = _serialize_pm(row)
        return Response({'has_card': has, 'default': default})


# ---------------------------------------------------------------------------
# Flexible top-up rate + payment history + refunds + boost reservation
# ---------------------------------------------------------------------------

class DiamondRateView(APIView):
    """GET /api/v1/billing/stripe/diamond-rate/

    Returns the admin-configured rate + bounds so the BuyDiamondsPage can
    render a live preview of "$X = N diamonds".
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from accounts.services import stripe_config
        return Response({
            'diamonds_per_dollar': stripe_config.diamonds_per_dollar(),
            'min_usd': stripe_config.TOPUP_MIN_USD,
            'max_usd': stripe_config.TOPUP_MAX_USD,
        })


class PaymentHistoryView(APIView):
    """GET /api/v1/billing/payments/?page=1

    User's own payment history. Each row carries enough state for the
    UI to show a "Request refund" button + the refund status if any.
    """
    permission_classes = [IsAuthenticated]

    PAGE_SIZE = 20

    def get(self, request):
        from accounts.models import PaymentRequest
        from accounts.services import refund_service

        try:
            page = max(1, int(request.query_params.get('page', '1')))
        except (TypeError, ValueError):
            page = 1
        start = (page - 1) * self.PAGE_SIZE
        end = start + self.PAGE_SIZE

        qs = (
            PaymentRequest.objects
            .filter(user=request.user)
            .order_by('-created_at')
        )
        total = qs.count()
        rows = list(qs[start:end])

        items = [_serialize_payment_for_user(p) for p in rows]
        return Response({
            'items': items,
            'total': total,
            'page': page,
            'page_size': self.PAGE_SIZE,
            'total_pages': max(1, (total + self.PAGE_SIZE - 1) // self.PAGE_SIZE),
            'refund_window_days': refund_service.REFUND_WINDOW_DAYS,
        })


def _serialize_payment_for_user(pr) -> dict:
    """Shape a PaymentRequest row for the user-facing history page."""
    from datetime import timedelta
    from django.utils import timezone as tz
    from accounts.services import refund_service

    age = tz.now() - pr.created_at
    within_window = age <= timedelta(days=refund_service.REFUND_WINDOW_DAYS)
    can_request_refund = (
        pr.payment_provider == 'stripe'
        and pr.status == 'approved'
        and pr.refund_status in ('', 'rejected', 'failed')
        and within_window
    )

    # Build a human-readable description.
    if pr.purpose == 'plan':
        description = f'{pr.plan.title()} plan · {pr.billing_cycle}'
    elif pr.purpose == 'topup':
        if pr.payment_provider == 'internal_wallet':
            description = 'Ad boost (wallet)'
        elif pr.diamonds_topped_up:
            description = f'{pr.diamonds_topped_up:,} 💎 top-up'
        else:
            description = 'Diamond top-up'
    else:
        description = pr.purpose

    return {
        'id': pr.id,
        'created_at': pr.created_at.isoformat(),
        'description': description,
        'purpose': pr.purpose,
        'plan': pr.plan,
        'billing_cycle': pr.billing_cycle,
        'amount_usd': str(pr.amount_usd),
        'revenue_usd': str(pr.revenue_usd),
        'status': pr.status,
        'payment_provider': pr.payment_provider,
        'payment_method': pr.payment_method,
        'diamonds_granted': pr.diamonds_granted,
        'diamonds_topped_up': pr.diamonds_topped_up,
        # Refund fields
        'refund_status': pr.refund_status,
        'refund_amount_usd': str(pr.refund_amount_usd),
        'refund_reason': pr.refund_reason,
        'refund_admin_notes': pr.refund_admin_notes,
        'refund_requested_at': pr.refund_requested_at.isoformat() if pr.refund_requested_at else None,
        'refund_processed_at': pr.refund_processed_at.isoformat() if pr.refund_processed_at else None,
        'can_request_refund': can_request_refund,
    }


class RequestRefundView(APIView):
    """POST /api/v1/billing/refunds/request/

    Body: { payment_request_id, reason }
    User-initiated. Queues for admin review.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from accounts.models import PaymentRequest
        from accounts.services import refund_service

        pr_id = request.data.get('payment_request_id')
        reason = request.data.get('reason', '')

        try:
            pr_id = int(pr_id)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid payment_request_id'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            pr = PaymentRequest.objects.get(pk=pr_id, user=request.user)
        except PaymentRequest.DoesNotExist:
            return Response({'error': 'Payment not found'},
                            status=status.HTTP_404_NOT_FOUND)

        result = refund_service.request_refund(
            payment_request=pr, user=request.user, reason=reason,
        )
        if not result.get('ok'):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class BoostReserveView(APIView):
    """POST /api/v1/billing/boost/reserve/

    Body: { amount_usd, reservation_id, metadata: {post_id?, boost_label?, duration_days?} }
    Deducts diamonds from wallet for ad-boost spending. Returns
    `insufficient_funds` so frontend can prompt a top-up.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from accounts.services import boost_service

        amount_usd = request.data.get('amount_usd')
        reservation_id = request.data.get('reservation_id', '')
        metadata = request.data.get('metadata') or {}

        try:
            amount_usd = float(amount_usd)
        except (TypeError, ValueError):
            return Response({'error': 'amount_usd must be a number'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not reservation_id:
            return Response({'error': 'reservation_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        result = boost_service.reserve_boost_budget(
            user=request.user,
            amount_usd=amount_usd,
            reservation_id=str(reservation_id),
            metadata=metadata,
        )
        return Response(result)


class BoostReleaseView(APIView):
    """POST /api/v1/billing/boost/release/

    Body: { reservation_id, reason? }
    Credits back a previously deducted boost reservation. Used when the
    Meta/Google ads API rejects the campaign after the wallet was charged.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from accounts.services import boost_service

        reservation_id = request.data.get('reservation_id', '')
        reason = request.data.get('reason', '')

        if not reservation_id:
            return Response({'error': 'reservation_id is required'},
                            status=status.HTTP_400_BAD_REQUEST)

        result = boost_service.release_reservation(
            user=request.user,
            reservation_id=str(reservation_id),
            reason=str(reason),
        )
        return Response(result)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """POST /api/v1/billing/stripe/webhook/

    No authentication — Stripe doesn't carry our session cookies. Instead
    we verify the request body against STRIPE_WEBHOOK_SECRET using
    `stripe.Webhook.construct_event`. A bad signature is the only thing
    that returns 4xx; everything else returns 200 so Stripe stops retrying.
    """
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        try:
            result = stripe_service.handle_event(payload, sig_header)
        except StripeConfigError as exc:
            log.exception('stripe webhook config error')
            return Response({'error': str(exc)},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.SignatureVerificationError:
            log.warning('stripe webhook: signature verification failed')
            return Response({'error': 'invalid signature'},
                            status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            # Malformed JSON
            log.warning('stripe webhook: malformed payload')
            return Response({'error': 'malformed payload'},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            # Don't expose internals; logged in stripe_service.handle_event.
            log.exception('stripe webhook: handler raised')
            # Return 200 anyway? No — for genuine handler failures we want
            # Stripe to retry. Return 500 so Stripe's automatic retries kick in.
            return Response({'error': 'handler_failed', 'detail': str(exc)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result)
