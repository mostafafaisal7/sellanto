"""
Stripe payment processor integration.

Handles:
  - Lazy creation of Stripe Customer objects mapped to Django users
  - Checkout Session creation for recurring plan subscriptions
  - Checkout Session creation for one-time diamond top-ups
  - Subscription cancellation (default: at period end)
  - Webhook event handling with idempotency (StripeWebhookEvent guard)

Stripe is canonical for *payment state* (subscription status, period end,
payment method); UserProfile remains canonical for *entitlement state*
(plan id, limits, end date). The webhook handlers reconcile UserProfile
from Stripe via the existing helpers in `accounts.services.diamond_service`
and `UserProfile.set_plan`.

Reused helpers (do NOT reimplement these here):
  - UserProfile.set_plan()                  → applies plan + sets dates/limits
  - grant_plan_diamonds_on_upgrade()        → idempotent per cycle, rank-up only
  - recharge_diamonds()                      → ledger-safe wallet credit
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone as py_tz
from decimal import Decimal
from typing import Any, Optional

import stripe
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    PaymentRequest,
    StripeCustomer,
    StripePaymentMethod,
    StripeSubscription,
    StripeWebhookEvent,
    UserProfile,
)
from accounts.services.diamond_service import (
    grant_plan_diamonds_on_upgrade,
    recharge_diamonds,
)
from accounts.services import stripe_config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Top-up catalog. SKU → (env price-id setting, diamond amount).
# Kept here (not in DB) because top-up SKUs change as rarely as plan tiers
# and an env-driven catalog makes test/live separation trivial.
# ---------------------------------------------------------------------------

TOPUP_CATALOG: dict[str, dict[str, Any]] = {
    'topup_1000':  {'sku_short': '1k',  'diamonds':  1_000, 'usd':  10},
    'topup_5000':  {'sku_short': '5k',  'diamonds':  5_000, 'usd':  45},
    'topup_10000': {'sku_short': '10k', 'diamonds': 10_000, 'usd':  85},
    'topup_25000': {'sku_short': '25k', 'diamonds': 25_000, 'usd': 200},
}


class StripeConfigError(RuntimeError):
    """Raised when Stripe is invoked without the required settings."""


def _client() -> Any:
    """Return the configured `stripe` module.

    Resolves the secret key via `stripe_config` (DB first, env fallback),
    so admins can rotate keys from the Admin Panel without restarting.
    """
    secret = stripe_config.secret_key()
    if not secret:
        raise StripeConfigError(
            'Stripe secret key is not configured. '
            'Set it in the Admin Panel → Stripe Settings, or as STRIPE_SECRET_KEY in env.'
        )
    stripe.api_key = secret
    stripe.api_version = stripe_config.api_version()
    return stripe


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

def get_or_create_customer(user: User) -> StripeCustomer:
    """Return the StripeCustomer for `user`, creating both sides if missing.

    Idempotent: calling twice returns the same row and never creates
    duplicate Stripe customers.
    """
    try:
        return StripeCustomer.objects.get(user=user)
    except StripeCustomer.DoesNotExist:
        pass

    stripe_mod = _client()
    customer = stripe_mod.Customer.create(
        email=user.email or None,
        name=(user.get_full_name() or user.username) or None,
        metadata={'user_id': str(user.id), 'username': user.username},
    )
    return StripeCustomer.objects.create(
        user=user,
        stripe_customer_id=customer.id,
    )


# ---------------------------------------------------------------------------
# Price resolution
# ---------------------------------------------------------------------------

_SUPPORTED_PLAN_PAIRS = {
    ('pro', 'monthly'), ('pro', 'yearly'),
    ('business', 'monthly'), ('business', 'yearly'),
}


def _resolve_plan_price_id(plan: str, billing_cycle: str) -> str:
    if (plan, billing_cycle) not in _SUPPORTED_PLAN_PAIRS:
        raise ValueError(
            f'No Stripe price configured for plan={plan!r}, cycle={billing_cycle!r}. '
            f'Supported pairs: {sorted(_SUPPORTED_PLAN_PAIRS)}'
        )
    price_id = stripe_config.price_id(plan, billing_cycle)
    if not price_id:
        raise StripeConfigError(
            f'Stripe Price ID for {plan}/{billing_cycle} is empty. '
            f'Set it in Admin Panel → Stripe Settings.'
        )
    return price_id


def _resolve_topup(sku: str) -> tuple[str, int, int]:
    """Return (stripe_price_id, diamonds, usd_amount) for a top-up SKU."""
    entry = TOPUP_CATALOG.get(sku)
    if not entry:
        raise ValueError(
            f'Unknown top-up SKU: {sku!r}. Known: {list(TOPUP_CATALOG.keys())}'
        )
    price_id = stripe_config.topup_price_id(entry['sku_short'])
    if not price_id:
        raise StripeConfigError(
            f'Stripe Price ID for {sku} is empty. '
            f'Set it in Admin Panel → Stripe Settings.'
        )
    return price_id, entry['diamonds'], entry['usd']


# ---------------------------------------------------------------------------
# Checkout session creation
# ---------------------------------------------------------------------------

@dataclass
class CheckoutResult:
    url: str
    session_id: str


def create_plan_checkout_session(
    user: User, plan: str, billing_cycle: str,
) -> CheckoutResult:
    """Create a Stripe Checkout Session for a recurring plan purchase.

    The plan is NOT applied locally here — it's applied by the
    `checkout.session.completed` webhook handler after Stripe confirms
    payment succeeded. This is the standard Stripe pattern and keeps
    the entitlement honest if a user closes the tab mid-payment.
    """
    if billing_cycle not in {'monthly', 'yearly'}:
        raise ValueError(f"billing_cycle must be 'monthly' or 'yearly', got {billing_cycle!r}")

    price_id = _resolve_plan_price_id(plan, billing_cycle)
    customer = get_or_create_customer(user)
    stripe_mod = _client()

    metadata = {
        'user_id':       str(user.id),
        'plan':          plan,
        'billing_cycle': billing_cycle,
        'purpose':       'plan',
    }

    session = stripe_mod.checkout.Session.create(
        mode='subscription',
        customer=customer.stripe_customer_id,
        line_items=[{'price': price_id, 'quantity': 1}],
        success_url=stripe_config.success_url(),
        cancel_url=stripe_config.cancel_url(),
        metadata=metadata,
        subscription_data={'metadata': metadata},
        allow_promotion_codes=True,
        client_reference_id=str(user.id),
    )
    log.info('stripe_service: plan checkout created session=%s user=%s plan=%s/%s',
             session.id, user.id, plan, billing_cycle)
    return CheckoutResult(url=session.url, session_id=session.id)


def create_topup_checkout_session(user: User, sku: str) -> CheckoutResult:
    """Create a Stripe Checkout Session for a one-time diamond top-up."""
    price_id, diamonds, usd_amount = _resolve_topup(sku)
    customer = get_or_create_customer(user)
    stripe_mod = _client()

    metadata = {
        'user_id':  str(user.id),
        'sku':      sku,
        'diamonds': str(diamonds),
        'usd':      str(usd_amount),
        'purpose':  'topup',
    }

    session = stripe_mod.checkout.Session.create(
        mode='payment',
        customer=customer.stripe_customer_id,
        line_items=[{'price': price_id, 'quantity': 1}],
        success_url=stripe_config.success_url(),
        cancel_url=stripe_config.cancel_url(),
        metadata=metadata,
        payment_intent_data={'metadata': metadata},
        client_reference_id=str(user.id),
    )
    log.info('stripe_service: topup checkout created session=%s user=%s sku=%s',
             session.id, user.id, sku)
    return CheckoutResult(url=session.url, session_id=session.id)


# ---------------------------------------------------------------------------
# Card-on-file: charge intent creation and off-session charge
# ---------------------------------------------------------------------------
#
# Architecture summary:
#   - First purchase (no card on file): create PaymentIntent with
#     `setup_future_usage='off_session'` and return the client_secret to
#     the frontend, which renders Stripe PaymentElement to collect the
#     card and confirm in-browser. On success, Stripe attaches the
#     PaymentMethod to the Customer and we get a payment_method.attached
#     webhook to mirror locally.
#   - Repeat purchase (saved card): create PaymentIntent server-side with
#     `payment_method=pm_xxx, customer=cus_xxx, off_session=true, confirm=true`.
#     Stripe charges instantly. No UI required other than a confirm
#     dialog. If the bank requires 3DS, we return `needs_3ds=true` with a
#     Checkout Session URL fallback so Stripe's hosted page handles SCA.

@dataclass
class ChargeIntentResult:
    """Result of creating a PaymentIntent for the embedded flow."""
    client_secret: str
    payment_intent_id: str
    publishable_key: str
    # Only present when off-session charge succeeded immediately (no UI needed)
    status: Optional[str] = None
    requires_action: bool = False


@dataclass
class OffSessionResult:
    """Result of an off-session PaymentIntent confirm."""
    succeeded: bool
    payment_intent_id: str
    status: str
    needs_3ds: bool = False
    fallback_checkout_url: Optional[str] = None
    error_message: Optional[str] = None


def _user_default_payment_method(user: User) -> Optional[StripePaymentMethod]:
    return (
        StripePaymentMethod.objects
        .filter(user=user, is_default=True)
        .order_by('-updated_at')
        .first()
    )


def has_card_on_file(user: User) -> bool:
    return StripePaymentMethod.objects.filter(user=user).exists()


def create_charge_intent(
    user: User,
    amount_cents: int,
    purpose: str,
    metadata: Optional[dict[str, str]] = None,
) -> ChargeIntentResult:
    """Create a PaymentIntent for an embedded card-entry flow.

    Used for the user's FIRST purchase (no saved card yet). The frontend
    receives the client_secret, renders <PaymentElement />, and confirms
    in-browser. The card is then saved on the Customer for future
    off-session charges.

    `purpose` ∈ {'topup', 'boost', 'plan_initial', 'misc'} — drives the
    webhook handler dispatch. Top-up & boost handlers consume `metadata`
    to know how many diamonds to grant or what to boost.
    """
    if amount_cents < 50:
        raise ValueError(
            f'Stripe minimum charge is $0.50 (50 cents); got {amount_cents}.'
        )

    customer = get_or_create_customer(user)
    stripe_mod = _client()

    md = {'user_id': str(user.id), 'purpose': purpose, **(metadata or {})}

    intent = stripe_mod.PaymentIntent.create(
        amount=amount_cents,
        currency='usd',
        customer=customer.stripe_customer_id,
        setup_future_usage='off_session',
        automatic_payment_methods={'enabled': True},
        metadata=md,
    )
    log.info('stripe_service: charge intent created pi=%s user=%s purpose=%s amount=%s',
             intent.id, user.id, purpose, amount_cents)
    return ChargeIntentResult(
        client_secret=intent.client_secret,
        payment_intent_id=intent.id,
        publishable_key=stripe_config.publishable_key(),
        status=intent.status,
    )


def charge_off_session(
    user: User,
    amount_cents: int,
    purpose: str,
    metadata: Optional[dict[str, str]] = None,
) -> OffSessionResult:
    """Charge the user's default saved card without any UI interaction.

    Returns `succeeded=True` if Stripe charged the card. If the bank
    demands 3DS, returns `needs_3ds=True` with a Stripe Checkout
    fallback URL so the frontend can redirect the user once to satisfy
    the challenge.
    """
    if amount_cents < 50:
        raise ValueError(
            f'Stripe minimum charge is $0.50 (50 cents); got {amount_cents}.'
        )

    pm = _user_default_payment_method(user)
    if not pm:
        raise ValueError('User has no saved card. Use create_charge_intent() instead.')

    customer = get_or_create_customer(user)
    stripe_mod = _client()
    md = {'user_id': str(user.id), 'purpose': purpose, **(metadata or {})}

    try:
        intent = stripe_mod.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            customer=customer.stripe_customer_id,
            payment_method=pm.stripe_payment_method_id,
            off_session=True,
            confirm=True,
            metadata=md,
        )
    except stripe.error.CardError as exc:
        # 3DS / authentication_required lands here. Build a Checkout fallback.
        err_payload = getattr(exc, 'error', None) or getattr(exc, 'json_body', {}).get('error', {})
        code = getattr(err_payload, 'code', None) or (err_payload.get('code') if isinstance(err_payload, dict) else None)
        intent_obj = getattr(err_payload, 'payment_intent', None) or (
            err_payload.get('payment_intent') if isinstance(err_payload, dict) else None
        )
        pi_id = (intent_obj.get('id') if isinstance(intent_obj, dict) else getattr(intent_obj, 'id', '')) or ''

        if code == 'authentication_required':
            fallback_url = _build_3ds_fallback_checkout(
                user=user, amount_cents=amount_cents, purpose=purpose, metadata=md,
            )
            log.info('stripe_service: off-session charge needs 3DS user=%s pi=%s', user.id, pi_id)
            return OffSessionResult(
                succeeded=False, payment_intent_id=pi_id, status='requires_action',
                needs_3ds=True, fallback_checkout_url=fallback_url,
                error_message=str(exc),
            )
        log.warning('stripe_service: off-session charge declined user=%s code=%s', user.id, code)
        return OffSessionResult(
            succeeded=False, payment_intent_id=pi_id,
            status='requires_payment_method',
            error_message=str(exc),
        )

    succeeded = intent.status == 'succeeded'
    log.info('stripe_service: off-session charge result pi=%s status=%s user=%s purpose=%s',
             intent.id, intent.status, user.id, purpose)
    return OffSessionResult(
        succeeded=succeeded,
        payment_intent_id=intent.id,
        status=intent.status,
    )


def _build_3ds_fallback_checkout(
    *, user: User, amount_cents: int, purpose: str, metadata: dict[str, str],
) -> str:
    """When off-session 3DS is required, fall back to a one-time Stripe
    Checkout Session. Stripe's hosted page handles SCA better than
    in-browser Elements for some banks.
    """
    customer = get_or_create_customer(user)
    stripe_mod = _client()
    session = stripe_mod.checkout.Session.create(
        mode='payment',
        customer=customer.stripe_customer_id,
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'product_data': {'name': _human_purpose_label(purpose, metadata)},
                'unit_amount': amount_cents,
            },
            'quantity': 1,
        }],
        success_url=stripe_config.success_url(),
        cancel_url=stripe_config.cancel_url(),
        metadata=metadata,
        payment_intent_data={
            'metadata': metadata,
            'setup_future_usage': 'off_session',
        },
        client_reference_id=str(user.id),
    )
    return session.url


def _human_purpose_label(purpose: str, metadata: dict[str, str]) -> str:
    if purpose == 'topup':
        diamonds = metadata.get('diamonds', '')
        return f'{diamonds} Diamonds' if diamonds else 'Diamond top-up'
    if purpose == 'boost':
        return f"Boost · {metadata.get('boost_label', '')}".strip(' ·')
    if purpose == 'plan_initial':
        return f"{metadata.get('plan', '').title()} plan"
    return 'Sellanto charge'


# ---------------------------------------------------------------------------
# Subscription with embedded card collection (PaymentElement-based signup)
# ---------------------------------------------------------------------------

@dataclass
class SubscribeResult:
    """Result of creating a subscription with `default_incomplete` behaviour.

    The frontend uses `client_secret` to confirm via PaymentElement. On
    success, the subscription activates and Stripe attaches the
    PaymentMethod as the customer's default (we set
    save_default_payment_method='on_subscription').
    """
    subscription_id: str
    client_secret: str
    publishable_key: str


def create_subscription_with_setup(
    user: User, plan: str, billing_cycle: str,
) -> SubscribeResult:
    """Create a Stripe Subscription in `default_incomplete` state.

    Returns a client_secret for the initial invoice's PaymentIntent so
    the frontend can collect the card via PaymentElement. The
    subscription is NOT active until the PaymentIntent confirms.
    """
    if billing_cycle not in {'monthly', 'yearly'}:
        raise ValueError(f"billing_cycle must be 'monthly' or 'yearly', got {billing_cycle!r}")

    price_id = _resolve_plan_price_id(plan, billing_cycle)
    customer = get_or_create_customer(user)
    stripe_mod = _client()

    metadata = {
        'user_id':       str(user.id),
        'plan':          plan,
        'billing_cycle': billing_cycle,
        'purpose':       'plan',
    }

    subscription = stripe_mod.Subscription.create(
        customer=customer.stripe_customer_id,
        items=[{'price': price_id}],
        payment_behavior='default_incomplete',
        payment_settings={
            'save_default_payment_method': 'on_subscription',
            'payment_method_types': ['card'],
        },
        expand=['latest_invoice.payment_intent'],
        metadata=metadata,
    )

    invoice = subscription.latest_invoice
    pi = invoice.payment_intent if invoice else None
    if not pi or not pi.client_secret:
        raise RuntimeError(
            'Stripe did not return a client_secret on the subscription. '
            'Check Price config and account state.'
        )

    log.info(
        'stripe_service: subscription draft created sub=%s user=%s plan=%s/%s',
        subscription.id, user.id, plan, billing_cycle,
    )
    return SubscribeResult(
        subscription_id=subscription.id,
        client_secret=pi.client_secret,
        publishable_key=stripe_config.publishable_key(),
    )


# ---------------------------------------------------------------------------
# Payment method management
# ---------------------------------------------------------------------------

def list_payment_methods(user: User) -> list[StripePaymentMethod]:
    """Return the user's saved cards. Refreshes from Stripe if our local
    mirror is empty (e.g., webhook missed an event)."""
    rows = list(
        StripePaymentMethod.objects.filter(user=user).order_by('-is_default', '-created_at')
    )
    if rows:
        return rows
    # Fallback: pull from Stripe.
    customer_row = StripeCustomer.objects.filter(user=user).first()
    if not customer_row:
        return []
    stripe_mod = _client()
    pms = stripe_mod.PaymentMethod.list(
        customer=customer_row.stripe_customer_id, type='card', limit=20,
    )
    for pm in pms.auto_paging_iter():
        _sync_payment_method(pm, user=user, set_default=False)
    return list(
        StripePaymentMethod.objects.filter(user=user).order_by('-is_default', '-created_at')
    )


def set_default_payment_method(user: User, pm_id: str) -> StripePaymentMethod:
    """Mark a PaymentMethod as the user's default. Also mirrors the
    `invoice_settings.default_payment_method` on the Stripe Customer so
    subscription renewals charge the right card."""
    pm = StripePaymentMethod.objects.get(user=user, stripe_payment_method_id=pm_id)
    customer = get_or_create_customer(user)
    stripe_mod = _client()
    stripe_mod.Customer.modify(
        customer.stripe_customer_id,
        invoice_settings={'default_payment_method': pm_id},
    )
    with transaction.atomic():
        StripePaymentMethod.objects.filter(user=user, is_default=True).update(is_default=False)
        pm.is_default = True
        pm.save(update_fields=['is_default', 'updated_at'])
    customer.default_payment_method_id = pm_id
    customer.save(update_fields=['default_payment_method_id', 'updated_at'])
    return pm


def remove_payment_method(user: User, pm_id: str) -> dict[str, Any]:
    """Detach a PaymentMethod from the Customer and remove our local row."""
    pm = StripePaymentMethod.objects.filter(user=user, stripe_payment_method_id=pm_id).first()
    if not pm:
        return {'ok': False, 'error': 'Payment method not found'}
    stripe_mod = _client()
    try:
        stripe_mod.PaymentMethod.detach(pm_id)
    except stripe.error.InvalidRequestError as exc:
        # Already detached on Stripe side — proceed with local cleanup.
        log.info('stripe_service: pm %s already detached: %s', pm_id, exc)
    was_default = pm.is_default
    pm.delete()
    if was_default:
        # Promote any other card to default (most recent wins).
        next_pm = StripePaymentMethod.objects.filter(user=user).order_by('-created_at').first()
        if next_pm:
            set_default_payment_method(user, next_pm.stripe_payment_method_id)
    return {'ok': True}


def _sync_payment_method(
    pm: Any, *, user: User, set_default: bool = False,
) -> StripePaymentMethod:
    """Upsert a local StripePaymentMethod row from a Stripe PaymentMethod object."""
    pm_id = pm.get('id') if isinstance(pm, dict) else pm.id
    customer_id = pm.get('customer') if isinstance(pm, dict) else pm.customer
    card = (pm.get('card') if isinstance(pm, dict) else pm.card) or {}
    if not isinstance(card, dict):
        card = card.to_dict() if hasattr(card, 'to_dict') else dict(card)

    defaults = {
        'user': user,
        'stripe_customer_id': customer_id or '',
        'card_brand': card.get('brand', '') or '',
        'card_last4': card.get('last4', '') or '',
        'card_exp_month': card.get('exp_month'),
        'card_exp_year': card.get('exp_year'),
        'card_funding': card.get('funding', '') or '',
    }

    with transaction.atomic():
        row, _ = StripePaymentMethod.objects.update_or_create(
            stripe_payment_method_id=pm_id,
            defaults=defaults,
        )
        if set_default:
            StripePaymentMethod.objects.filter(user=user, is_default=True).exclude(
                pk=row.pk,
            ).update(is_default=False)
            row.is_default = True
            row.save(update_fields=['is_default', 'updated_at'])
    return row


# ---------------------------------------------------------------------------
# Subscription cancellation
# ---------------------------------------------------------------------------

def cancel_subscription(user: User, immediate: bool = False) -> dict[str, Any]:
    """Cancel the user's most recent active Stripe subscription.

    Default: `cancel_at_period_end=True` — user keeps access until the end
    of the current paid period. Pass `immediate=True` to terminate now
    (refunds are NOT issued automatically — handle separately).
    """
    sub = (
        StripeSubscription.objects
        .filter(user=user)
        .exclude(status__in=['canceled', 'incomplete_expired'])
        .order_by('-created_at')
        .first()
    )
    if sub is None:
        return {'ok': False, 'error': 'No active Stripe subscription found.'}

    stripe_mod = _client()

    if immediate:
        stripe_obj = stripe_mod.Subscription.delete(sub.stripe_subscription_id)
    else:
        stripe_obj = stripe_mod.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=True,
        )

    # Sync local row from the Stripe response. The full reconciliation
    # also happens via the customer.subscription.updated/deleted webhook.
    _sync_subscription_from_stripe(stripe_obj, user=user, plan=sub.plan,
                                   billing_cycle=sub.billing_cycle)

    return {
        'ok': True,
        'status': stripe_obj.status,
        'cancel_at_period_end': stripe_obj.cancel_at_period_end,
        'current_period_end': _ts(stripe_obj.current_period_end),
    }


# ---------------------------------------------------------------------------
# Webhook dispatch
# ---------------------------------------------------------------------------

def handle_event(payload: bytes, sig_header: str) -> dict[str, Any]:
    """Verify the signature, dedupe, and dispatch a Stripe webhook event.

    Returns a small dict describing the outcome. Never raises on dedup
    or unknown event types — callers should always respond 200 unless
    signature verification fails (which is a 400/401).
    """
    webhook_secret_value = stripe_config.webhook_secret()
    if not webhook_secret_value:
        raise StripeConfigError(
            'Stripe webhook secret is not configured. '
            'Set it in Admin Panel → Stripe Settings, or as STRIPE_WEBHOOK_SECRET in env.'
        )

    stripe_mod = _client()
    event = stripe_mod.Webhook.construct_event(
        payload=payload,
        sig_header=sig_header,
        secret=webhook_secret_value,
    )

    # Idempotency guard: log every event by id. If get_or_create says
    # `created=False`, this is a replay — short-circuit.
    log_row, created = StripeWebhookEvent.objects.get_or_create(
        stripe_event_id=event['id'],
        defaults={
            'event_type': event['type'],
            'payload': _safe_payload(event),
            'processing_status': 'ok',
        },
    )
    if not created:
        log.info('stripe_service: webhook %s (%s) already processed — skipping',
                 event['id'], event['type'])
        return {'ok': True, 'deduped': True, 'event_type': event['type']}

    try:
        result = _dispatch(event)
    except Exception as exc:  # noqa: BLE001
        log_row.processing_status = 'error'
        log_row.error = f'{type(exc).__name__}: {exc}'
        log_row.save(update_fields=['processing_status', 'error'])
        log.exception('stripe_service: webhook handler failed for %s', event['id'])
        raise

    if result.get('ignored'):
        log_row.processing_status = 'ignored'
        log_row.save(update_fields=['processing_status'])

    return {'ok': True, 'event_type': event['type'], **result}


_HANDLED_EVENTS = {
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_method.attached',
    'payment_method.detached',
    'charge.refunded',
    'refund.updated',
}


def _dispatch(event: dict[str, Any]) -> dict[str, Any]:
    event_type = event['type']
    if event_type not in _HANDLED_EVENTS:
        return {'ignored': True, 'reason': 'event_type_not_subscribed'}

    obj = event['data']['object']
    if event_type == 'checkout.session.completed':
        return _on_checkout_completed(obj)
    if event_type in ('customer.subscription.created',
                      'customer.subscription.updated',
                      'customer.subscription.deleted'):
        return _on_subscription_lifecycle(obj, deleted=event_type.endswith('deleted'))
    if event_type == 'invoice.paid':
        return _on_invoice_paid(obj)
    if event_type == 'invoice.payment_failed':
        return _on_invoice_failed(obj)
    if event_type == 'payment_intent.succeeded':
        return _on_payment_intent_succeeded(obj)
    if event_type == 'payment_intent.payment_failed':
        return _on_payment_intent_failed(obj)
    if event_type == 'payment_method.attached':
        return _on_payment_method_attached(obj)
    if event_type == 'payment_method.detached':
        return _on_payment_method_detached(obj)
    if event_type == 'charge.refunded':
        return _on_charge_refunded(obj)
    if event_type == 'refund.updated':
        return _on_refund_updated(obj)
    return {'ignored': True, 'reason': 'no_handler'}


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def _on_checkout_completed(session: dict[str, Any]) -> dict[str, Any]:
    """Primary purchase confirmation. Routes by metadata.purpose."""
    metadata = session.get('metadata') or {}
    purpose = metadata.get('purpose')

    user = _resolve_user_from_metadata(metadata, session)
    if user is None:
        return {'ignored': True, 'reason': 'no_user_in_metadata'}

    if purpose == 'plan':
        return _apply_plan_purchase(user, session, metadata)
    if purpose == 'topup':
        return _apply_topup_purchase(user, session, metadata)

    return {'ignored': True, 'reason': f'unknown_purpose:{purpose}'}


def _apply_plan_purchase(
    user: User, session: dict[str, Any], metadata: dict[str, str],
) -> dict[str, Any]:
    plan = metadata.get('plan')
    billing_cycle = metadata.get('billing_cycle', 'monthly')
    if plan not in {p[0] for p in UserProfile.PLAN_CHOICES} or plan == 'free':
        return {'ignored': True, 'reason': f'invalid_plan:{plan}'}

    duration_months = 12 if billing_cycle == 'yearly' else 1
    profile = UserProfile.objects.select_related('user').get(user=user)
    previous_plan = profile.subscription_plan

    amount_total_cents = session.get('amount_total') or 0
    revenue_usd = Decimal(amount_total_cents) / Decimal(100)
    stripe_session_id = session.get('id', '')
    stripe_subscription_id = session.get('subscription') or ''
    stripe_invoice_id = session.get('invoice') or ''

    with transaction.atomic():
        # 1. Apply plan (sets dates/limits)
        profile.set_plan(plan, duration_months=duration_months)
        profile.refresh_from_db()

        # 2. Grant diamonds on rank-up (idempotent per cycle)
        grant = grant_plan_diamonds_on_upgrade(
            user=user,
            previous_plan=previous_plan,
            new_plan=plan,
            cycle_start_date=profile.plan_start_date,
        )

        # 3. Record revenue row (replaces admin-approval audit trail)
        PaymentRequest.objects.create(
            user=user,
            plan=plan,
            billing_cycle=billing_cycle,
            amount_usd=revenue_usd,
            amount_local=revenue_usd,
            local_currency='USD',
            payment_method='stripe',
            payment_provider='stripe',
            purpose='plan',
            status='approved',
            stripe_checkout_session_id=stripe_session_id,
            stripe_invoice_id=stripe_invoice_id,
            payer_email=user.email or '',
            payer_name=user.get_full_name() or user.username,
            diamonds_granted=grant['amount'] if grant['granted'] else 0,
            plan_applied_at=timezone.now(),
            revenue_usd=revenue_usd,
            fx_rate_used=Decimal(1),
            reviewed_at=timezone.now(),
            admin_notes=f'Auto-approved via Stripe Checkout session {stripe_session_id}',
        )

        # 4. Supersede any pending manual claims for the same user.
        # Avoids confusion when a user submitted a manual bKash claim and then
        # switched to Stripe before admin reviewed it.
        PaymentRequest.objects.filter(
            user=user, status='pending', payment_provider='manual',
        ).update(
            status='cancelled',
            admin_notes=f'Superseded by Stripe payment {stripe_session_id}',
            reviewed_at=timezone.now(),
        )

    log.info(
        'stripe_service: plan applied user=%s plan=%s prev=%s diamonds_granted=%s',
        user.id, plan, previous_plan, grant.get('amount', 0),
    )
    return {
        'handled': 'plan_purchase',
        'previous_plan': previous_plan,
        'new_plan': plan,
        'diamond_grant': grant,
    }


def _apply_topup_purchase(
    user: User, session: dict[str, Any], metadata: dict[str, str],
) -> dict[str, Any]:
    sku = metadata.get('sku', '')
    try:
        diamonds = int(metadata.get('diamonds', '0'))
    except (TypeError, ValueError):
        diamonds = 0
    if diamonds <= 0:
        return {'ignored': True, 'reason': 'no_diamond_amount'}

    payment_intent_id = session.get('payment_intent') or ''
    stripe_session_id = session.get('id', '')
    amount_total_cents = session.get('amount_total') or 0
    revenue_usd = Decimal(amount_total_cents) / Decimal(100)

    # Idempotency: if a PaymentRequest with this PI already exists, skip.
    # (StripeWebhookEvent dedupes events; this dedupes across event types
    # since `payment_intent.succeeded` also fires.)
    if payment_intent_id and PaymentRequest.objects.filter(
        stripe_payment_intent_id=payment_intent_id, purpose='topup',
    ).exists():
        log.info('stripe_service: topup PI %s already processed', payment_intent_id)
        return {'handled': 'topup', 'skipped': True}

    with transaction.atomic():
        balance = recharge_diamonds(
            user=user,
            amount=diamonds,
            recharged_by=None,
            note=f'Stripe top-up sku={sku} session={stripe_session_id}',
        )
        PaymentRequest.objects.create(
            user=user,
            plan=UserProfile.objects.get(user=user).subscription_plan,
            billing_cycle='monthly',  # not meaningful for top-up; choose default
            amount_usd=revenue_usd,
            amount_local=revenue_usd,
            local_currency='USD',
            payment_method='stripe',
            payment_provider='stripe',
            purpose='topup',
            status='approved',
            stripe_checkout_session_id=stripe_session_id,
            stripe_payment_intent_id=payment_intent_id,
            payer_email=user.email or '',
            payer_name=user.get_full_name() or user.username,
            diamonds_topped_up=diamonds,
            revenue_usd=revenue_usd,
            fx_rate_used=Decimal(1),
            reviewed_at=timezone.now(),
            admin_notes=f'Stripe top-up sku={sku}',
        )

    log.info('stripe_service: topup applied user=%s sku=%s diamonds=%s balance=%s',
             user.id, sku, diamonds, balance)
    return {'handled': 'topup', 'diamonds': diamonds, 'balance': balance}


def _on_subscription_lifecycle(
    sub: dict[str, Any], *, deleted: bool,
) -> dict[str, Any]:
    """Sync the local StripeSubscription mirror from a webhook payload."""
    customer_id = sub.get('customer')
    user = _resolve_user_from_customer(customer_id)
    if user is None:
        return {'ignored': True, 'reason': 'no_user_for_customer'}

    # Plan / billing_cycle aren't on the bare subscription object — use
    # metadata if present, else fall back to existing local row.
    metadata = sub.get('metadata') or {}
    plan = metadata.get('plan')
    billing_cycle = metadata.get('billing_cycle')
    if not plan or not billing_cycle:
        existing = (
            StripeSubscription.objects
            .filter(stripe_subscription_id=sub.get('id'))
            .first()
        )
        if existing:
            plan = plan or existing.plan
            billing_cycle = billing_cycle or existing.billing_cycle
    if not plan or not billing_cycle:
        # Best-effort: skip if we genuinely don't know what tier this is.
        return {'ignored': True, 'reason': 'plan_metadata_missing'}

    _sync_subscription_from_stripe(
        sub, user=user, plan=plan, billing_cycle=billing_cycle,
    )
    return {'handled': 'subscription_deleted' if deleted else 'subscription_sync'}


def _on_invoice_paid(invoice: dict[str, Any]) -> dict[str, Any]:
    """Auto-renewal. Extend plan_end_date, do NOT re-grant diamonds.

    Diamonds are granted only on tier change (handled by checkout.session.completed
    / grant_plan_diamonds_on_upgrade idempotency). Re-granting on every
    renewal would double-mint.
    """
    billing_reason = invoice.get('billing_reason') or ''
    # Only act on subscription renewals; the initial creation is already
    # handled by checkout.session.completed.
    if billing_reason not in {'subscription_cycle', 'subscription_create',
                              'subscription_update'}:
        return {'ignored': True, 'reason': f'billing_reason:{billing_reason}'}

    customer_id = invoice.get('customer')
    user = _resolve_user_from_customer(customer_id)
    if user is None:
        return {'ignored': True, 'reason': 'no_user_for_customer'}

    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return {'ignored': True, 'reason': 'no_subscription_on_invoice'}

    local_sub = StripeSubscription.objects.filter(
        stripe_subscription_id=subscription_id,
    ).first()
    if not local_sub:
        # We haven't synced this subscription yet — let the
        # customer.subscription.* webhooks catch it.
        return {'ignored': True, 'reason': 'no_local_subscription_row'}

    # Pull the new period end from the invoice line item.
    lines = invoice.get('lines', {}).get('data', [])
    period_end_ts = None
    for line in lines:
        period = line.get('period') or {}
        if period.get('end'):
            period_end_ts = period['end']
            break
    new_period_end = _ts(period_end_ts) if period_end_ts else None

    profile = UserProfile.objects.get(user=user)
    if new_period_end:
        profile.plan_end_date = new_period_end.date()
        profile.save(update_fields=['plan_end_date'])
        local_sub.current_period_end = new_period_end
        local_sub.save(update_fields=['current_period_end'])

    # Record renewal revenue row.
    amount_total_cents = invoice.get('amount_paid') or 0
    revenue_usd = Decimal(amount_total_cents) / Decimal(100)
    if revenue_usd > 0 and not PaymentRequest.objects.filter(
        stripe_invoice_id=invoice.get('id'), purpose='plan',
    ).exists():
        PaymentRequest.objects.create(
            user=user,
            plan=local_sub.plan,
            billing_cycle=local_sub.billing_cycle,
            amount_usd=revenue_usd,
            amount_local=revenue_usd,
            local_currency='USD',
            payment_method='stripe',
            payment_provider='stripe',
            purpose='plan',
            status='approved',
            stripe_invoice_id=invoice.get('id') or '',
            stripe_payment_intent_id=invoice.get('payment_intent') or '',
            payer_email=user.email or '',
            payer_name=user.get_full_name() or user.username,
            revenue_usd=revenue_usd,
            fx_rate_used=Decimal(1),
            reviewed_at=timezone.now(),
            admin_notes='Auto-renewal payment',
        )

    return {'handled': 'invoice_paid', 'new_period_end': str(new_period_end) if new_period_end else None}


def _on_invoice_failed(invoice: dict[str, Any]) -> dict[str, Any]:
    """Mark the subscription past_due. Stripe handles retries automatically."""
    subscription_id = invoice.get('subscription')
    if subscription_id:
        StripeSubscription.objects.filter(
            stripe_subscription_id=subscription_id,
        ).update(status='past_due')

    # Email could go here (best-effort) — left as a TODO until the dunning
    # template exists in accounts/services/email_service.py.
    log.warning('stripe_service: invoice payment failed sub=%s invoice=%s',
                subscription_id, invoice.get('id'))
    return {'handled': 'invoice_failed'}


def _on_payment_intent_succeeded(pi: dict[str, Any]) -> dict[str, Any]:
    """Primary confirmation for card-on-file charges.

    Dispatches by metadata.purpose:
      - topup        → grant diamonds
      - boost        → activate boost (TODO: integrate with ads/)
      - plan_initial → already handled by subscription webhooks
      - misc         → record revenue row only
    """
    metadata = pi.get('metadata') or {}
    purpose = metadata.get('purpose', '')
    user = _resolve_user_from_metadata(metadata, pi)
    if user is None:
        return {'ignored': True, 'reason': 'no_user_in_metadata'}

    payment_intent_id = pi.get('id', '')
    # Idempotency: if a row with this PI already exists, skip.
    if PaymentRequest.objects.filter(stripe_payment_intent_id=payment_intent_id).exists():
        return {'handled': f'{purpose}_already_recorded'}

    revenue_usd = Decimal(pi.get('amount_received') or pi.get('amount') or 0) / Decimal(100)

    if purpose == 'topup':
        return _record_topup_from_pi(user, pi, metadata, revenue_usd)
    if purpose == 'boost':
        return _record_boost_from_pi(user, pi, metadata, revenue_usd)
    if purpose == 'plan_initial':
        # Subscription flow handles plan activation via invoice.paid /
        # customer.subscription.* — nothing to do here.
        return {'handled': 'plan_initial_noop'}
    if purpose == 'misc':
        _record_misc_revenue(user, pi, metadata, revenue_usd)
        return {'handled': 'misc_revenue_recorded'}
    return {'ignored': True, 'reason': f'unknown_purpose:{purpose}'}


def _record_topup_from_pi(
    user: User, pi: dict[str, Any], metadata: dict[str, str], revenue_usd: Decimal,
) -> dict[str, Any]:
    try:
        diamonds = int(metadata.get('diamonds', '0'))
    except (TypeError, ValueError):
        diamonds = 0
    if diamonds <= 0:
        return {'ignored': True, 'reason': 'no_diamond_amount'}

    payment_intent_id = pi.get('id', '')
    sku = metadata.get('sku', '')
    with transaction.atomic():
        balance = recharge_diamonds(
            user=user, amount=diamonds, recharged_by=None,
            note=f'Stripe top-up sku={sku} pi={payment_intent_id}',
        )
        PaymentRequest.objects.create(
            user=user,
            plan=UserProfile.objects.get(user=user).subscription_plan,
            billing_cycle='monthly',
            amount_usd=revenue_usd,
            amount_local=revenue_usd,
            local_currency='USD',
            payment_method='stripe',
            payment_provider='stripe',
            purpose='topup',
            status='approved',
            stripe_payment_intent_id=payment_intent_id,
            payer_email=user.email or '',
            payer_name=user.get_full_name() or user.username,
            diamonds_topped_up=diamonds,
            revenue_usd=revenue_usd,
            fx_rate_used=Decimal(1),
            reviewed_at=timezone.now(),
            admin_notes=f'Stripe top-up sku={sku}',
        )
    return {'handled': 'topup', 'diamonds': diamonds, 'balance': balance}


def _record_boost_from_pi(
    user: User, pi: dict[str, Any], metadata: dict[str, str], revenue_usd: Decimal,
) -> dict[str, Any]:
    """Record an ad-boost payment.

    The actual ads/ integration (calling Meta/Google APIs to launch the
    boost) is the responsibility of the ads service which should listen
    for this PaymentRequest row. We keep that decoupled so the payment
    layer doesn't depend on ads platform availability.
    """
    payment_intent_id = pi.get('id', '')
    boost_label = metadata.get('boost_label', '')
    post_id = metadata.get('post_id', '')

    PaymentRequest.objects.create(
        user=user,
        plan=UserProfile.objects.get(user=user).subscription_plan,
        billing_cycle='monthly',
        amount_usd=revenue_usd,
        amount_local=revenue_usd,
        local_currency='USD',
        payment_method='stripe',
        payment_provider='stripe',
        purpose='topup',  # PaymentRequest.PURPOSE_CHOICES only has plan/topup;
                          # boost is recorded as a topup-style row with metadata.
        status='approved',
        stripe_payment_intent_id=payment_intent_id,
        payer_email=user.email or '',
        payer_name=user.get_full_name() or user.username,
        revenue_usd=revenue_usd,
        fx_rate_used=Decimal(1),
        reviewed_at=timezone.now(),
        admin_notes=f'Stripe boost {boost_label} post={post_id} pi={payment_intent_id}',
    )
    return {'handled': 'boost', 'amount_usd': str(revenue_usd), 'post_id': post_id}


def _record_misc_revenue(
    user: User, pi: dict[str, Any], metadata: dict[str, str], revenue_usd: Decimal,
) -> None:
    PaymentRequest.objects.create(
        user=user,
        plan=UserProfile.objects.get(user=user).subscription_plan,
        billing_cycle='monthly',
        amount_usd=revenue_usd,
        amount_local=revenue_usd,
        local_currency='USD',
        payment_method='stripe',
        payment_provider='stripe',
        purpose='topup',
        status='approved',
        stripe_payment_intent_id=pi.get('id', ''),
        payer_email=user.email or '',
        payer_name=user.get_full_name() or user.username,
        revenue_usd=revenue_usd,
        fx_rate_used=Decimal(1),
        reviewed_at=timezone.now(),
        admin_notes=f'Stripe misc charge: {metadata}',
    )


def _on_payment_intent_failed(pi: dict[str, Any]) -> dict[str, Any]:
    """Log a failed off-session charge attempt."""
    metadata = pi.get('metadata') or {}
    user = _resolve_user_from_metadata(metadata, pi)
    log.warning(
        'stripe_service: payment_intent failed user_id=%s purpose=%s pi=%s err=%s',
        getattr(user, 'id', None), metadata.get('purpose'),
        pi.get('id'),
        (pi.get('last_payment_error') or {}).get('message'),
    )
    return {'handled': 'pi_failed_logged'}


def _on_payment_method_attached(pm: dict[str, Any]) -> dict[str, Any]:
    """A card was attached to a Customer — mirror it locally and mark
    as default if it's the user's first card."""
    customer_id = pm.get('customer')
    user = _resolve_user_from_customer(customer_id)
    if user is None:
        return {'ignored': True, 'reason': 'no_user_for_customer'}

    is_first = not StripePaymentMethod.objects.filter(user=user).exists()
    row = _sync_payment_method(pm, user=user, set_default=is_first)

    # Also set as default on the Stripe Customer so subscription
    # renewals use this card.
    if is_first:
        try:
            stripe_mod = _client()
            stripe_mod.Customer.modify(
                customer_id,
                invoice_settings={'default_payment_method': row.stripe_payment_method_id},
            )
            customer_row = StripeCustomer.objects.filter(user=user).first()
            if customer_row:
                customer_row.default_payment_method_id = row.stripe_payment_method_id
                customer_row.save(update_fields=['default_payment_method_id', 'updated_at'])
        except stripe.error.StripeError as exc:
            log.warning('stripe_service: failed to set default pm on customer: %s', exc)

    return {'handled': 'pm_attached', 'pm_id': row.stripe_payment_method_id,
            'is_default': row.is_default}


def _on_payment_method_detached(pm: dict[str, Any]) -> dict[str, Any]:
    """A card was removed from a Customer — drop the local row."""
    pm_id = pm.get('id')
    if not pm_id:
        return {'ignored': True, 'reason': 'no_pm_id'}
    deleted, _ = StripePaymentMethod.objects.filter(
        stripe_payment_method_id=pm_id,
    ).delete()
    return {'handled': 'pm_detached', 'deleted': deleted}


def _on_charge_refunded(charge: dict[str, Any]) -> dict[str, Any]:
    """A charge was refunded (full or partial). Flip the matching
    PaymentRequest to refund_status='refunded'.

    Stripe fires this for refunds we initiate AND for refunds issued
    directly from the Stripe Dashboard — `refund_service` handles both
    cases idempotently.
    """
    from accounts.services import refund_service

    payment_intent_id = charge.get('payment_intent') or ''
    if not payment_intent_id:
        return {'ignored': True, 'reason': 'no_payment_intent'}

    # The newest refund on the charge is in refunds.data[-1].
    refunds = (charge.get('refunds') or {}).get('data') or []
    stripe_refund_id = refunds[-1].get('id') if refunds else ''

    result = refund_service.mark_refunded_from_webhook(
        payment_intent_id=payment_intent_id,
        stripe_refund_id=stripe_refund_id,
    )
    if not result.get('ok'):
        return {'ignored': True, 'reason': result.get('reason', 'unknown')}
    return {'handled': 'charge_refunded', 'payment_request_id': result['payment_request_id']}


def _on_refund_updated(refund: dict[str, Any]) -> dict[str, Any]:
    """Refund transitioned states. We only care about `failed` here
    (success arrives via `charge.refunded`).
    """
    from accounts.services import refund_service

    refund_id = refund.get('id') or ''
    status = refund.get('status') or ''
    if status != 'failed':
        return {'ignored': True, 'reason': f'status:{status}'}

    failure_reason = refund.get('failure_reason') or ''
    result = refund_service.mark_refund_failed_from_webhook(
        stripe_refund_id=refund_id,
        failure_reason=failure_reason,
    )
    if not result.get('ok'):
        return {'ignored': True, 'reason': result.get('reason', 'unknown')}
    return {'handled': 'refund_failed', 'payment_request_id': result['payment_request_id']}


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

def get_session_status(session_id: str, user: User) -> dict[str, Any]:
    """Used by the success page to poll until the webhook has landed.

    Returns `{status: 'completed', ...}` if we have a PaymentRequest row
    keyed on the session id; `{status: 'pending'}` otherwise.
    """
    row = PaymentRequest.objects.filter(
        user=user, stripe_checkout_session_id=session_id,
    ).order_by('-created_at').first()

    if not row:
        return {'status': 'pending'}

    return {
        'status': 'completed',
        'purpose': row.purpose,
        'plan': row.plan,
        'diamonds': row.diamonds_granted + row.diamonds_topped_up,
        'amount_usd': str(row.revenue_usd),
    }


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _resolve_user_from_metadata(
    metadata: dict[str, str], obj: dict[str, Any],
) -> Optional[User]:
    user_id = metadata.get('user_id') or obj.get('client_reference_id')
    if not user_id:
        return None
    try:
        return User.objects.get(pk=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return None


def _resolve_user_from_customer(stripe_customer_id: Optional[str]) -> Optional[User]:
    if not stripe_customer_id:
        return None
    row = StripeCustomer.objects.filter(
        stripe_customer_id=stripe_customer_id,
    ).select_related('user').first()
    return row.user if row else None


def _sync_subscription_from_stripe(
    sub: Any, *, user: User, plan: str, billing_cycle: str,
) -> StripeSubscription:
    """Upsert local row from a Stripe Subscription object (dict or stripe.Subscription)."""
    items = (sub.get('items') or {}).get('data') if isinstance(sub, dict) else (
        sub['items']['data'] if hasattr(sub, '__getitem__') else []
    )
    price_id = ''
    if items:
        price = items[0].get('price') if isinstance(items[0], dict) else items[0].price
        price_id = price.get('id') if isinstance(price, dict) else getattr(price, 'id', '')

    defaults = {
        'user': user,
        'stripe_customer_id': sub.get('customer') if isinstance(sub, dict) else sub.customer,
        'stripe_price_id': price_id,
        'plan': plan,
        'billing_cycle': billing_cycle,
        'status': sub.get('status') if isinstance(sub, dict) else sub.status,
        'current_period_start': _ts(_get(sub, 'current_period_start')),
        'current_period_end':   _ts(_get(sub, 'current_period_end')),
        'cancel_at_period_end': bool(_get(sub, 'cancel_at_period_end') or False),
        'canceled_at':          _ts(_get(sub, 'canceled_at')),
    }
    sub_id = sub.get('id') if isinstance(sub, dict) else sub.id
    obj, _ = StripeSubscription.objects.update_or_create(
        stripe_subscription_id=sub_id,
        defaults=defaults,
    )
    return obj


def _get(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _ts(epoch_seconds: Optional[int]) -> Optional[datetime]:
    if not epoch_seconds:
        return None
    return datetime.fromtimestamp(int(epoch_seconds), tz=py_tz.utc)


def _safe_payload(event: Any) -> dict[str, Any]:
    """Convert a stripe.Event to a JSON-safe dict for storage."""
    try:
        # stripe-python v10+ exposes .to_dict_recursive
        return event.to_dict_recursive() if hasattr(event, 'to_dict_recursive') else dict(event)
    except Exception:  # noqa: BLE001
        return {'event_id': getattr(event, 'id', None), 'type': getattr(event, 'type', None)}
