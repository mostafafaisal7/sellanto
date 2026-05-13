"""
Ad-boost budget reservation against the diamond wallet.

The user's diamond wallet is the unified credit ledger across all paid
features. Boosts work like this:

  1. Frontend collects daily_budget + duration_days → total USD.
  2. Frontend calls `reserve_boost_budget(user, amount_usd, reservation_id)`.
  3. This module converts USD → diamonds at the admin-configured rate
     (`stripe_config.diamonds_per_dollar()`), checks the wallet, and
     deducts atomically. If the wallet is short, returns
     `insufficient_funds` so the frontend can prompt a top-up.
  4. On wallet success, the frontend then calls the ads service to
     actually launch the campaign. If THAT fails, the frontend calls
     `release_reservation(reservation_id)` to credit the diamonds back.

Idempotency is keyed on the client-supplied `reservation_id` (uuid4).
Re-submitting the same ID is a no-op — protects against double-clicks
and webhook-style retries.
"""

from __future__ import annotations

import logging
import math
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    DiamondTransaction,
    DiamondWallet,
    PaymentRequest,
    UserProfile,
)
from accounts.services import stripe_config

log = logging.getLogger(__name__)


def _reservation_marker(reservation_id: str) -> str:
    """Build the canonical `note` substring we search on for idempotency."""
    return f'reservation_id={reservation_id}'


def _existing_reservation(user: User, reservation_id: str) -> DiamondTransaction | None:
    return (
        DiamondTransaction.objects
        .filter(
            user=user,
            transaction_type='deduction',
            feature='boost',
            note__contains=_reservation_marker(reservation_id),
        )
        .order_by('-created_at')
        .first()
    )


def _existing_release(user: User, reservation_id: str) -> DiamondTransaction | None:
    return (
        DiamondTransaction.objects
        .filter(
            user=user,
            transaction_type='refund',
            feature='boost',
            note__contains=_reservation_marker(reservation_id),
        )
        .order_by('-created_at')
        .first()
    )


def reserve_boost_budget(
    *, user: User, amount_usd: float, reservation_id: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Deduct diamonds for an ad boost. Returns one of:

      {'status': 'reserved', 'diamonds_deducted': N, 'wallet_balance': M,
       'reservation_id': ...}
      {'status': 'already_reserved', ...}    ← idempotent replay
      {'status': 'insufficient_funds', 'needed_usd': X, 'shortfall_usd': S,
       'wallet_balance_usd': Y, ...}
    """
    metadata = metadata or {}
    if amount_usd <= 0:
        return {'status': 'invalid', 'error': 'amount_usd must be positive'}
    if not reservation_id:
        return {'status': 'invalid', 'error': 'reservation_id is required'}

    rate = stripe_config.diamonds_per_dollar()
    # Round UP — better to slightly over-charge the wallet than under-cover
    # the ad budget and then get a Meta API rejection mid-flow.
    diamonds_needed = math.ceil(amount_usd * rate)

    # Idempotency: same reservation_id already deducted → no-op.
    existing = _existing_reservation(user, reservation_id)
    if existing is not None:
        wallet = DiamondWallet.objects.filter(user=user).first()
        return {
            'status': 'already_reserved',
            'diamonds_deducted': abs(existing.amount),
            'wallet_balance': wallet.balance if wallet else 0,
            'reservation_id': reservation_id,
        }

    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

        if wallet.balance < diamonds_needed:
            shortfall_diamonds = diamonds_needed - wallet.balance
            shortfall_usd = math.ceil(shortfall_diamonds / rate)
            wallet_balance_usd = Decimal(wallet.balance) / Decimal(rate)
            return {
                'status': 'insufficient_funds',
                'needed_usd': float(amount_usd),
                'needed_diamonds': diamonds_needed,
                'shortfall_usd': shortfall_usd,
                'shortfall_diamonds': shortfall_diamonds,
                'wallet_balance': wallet.balance,
                'wallet_balance_usd': float(wallet_balance_usd),
                'reservation_id': reservation_id,
            }

        # Deduct
        wallet.balance -= diamonds_needed
        wallet.total_spent = (wallet.total_spent or 0) + diamonds_needed
        wallet.save(update_fields=['balance', 'total_spent'])

        note_parts = [
            f'Boost reservation',
            _reservation_marker(reservation_id),
            f'usd={amount_usd:.2f}',
        ]
        # Bake metadata into the note so admins can grep for post_id later.
        for key in ('post_id', 'boost_label', 'duration_days'):
            value = metadata.get(key)
            if value:
                note_parts.append(f'{key}={value}')
        note = ' '.join(note_parts)

        DiamondTransaction.objects.create(
            user=user,
            amount=-diamonds_needed,
            transaction_type='deduction',
            balance_after=wallet.balance,
            feature='boost',
            note=note,
        )

        # Also record a revenue-ledger row so this shows up in admin finance
        # and the user's payment history alongside their Stripe charges.
        # provider='internal_wallet' makes it clear no card was charged.
        PaymentRequest.objects.create(
            user=user,
            plan=UserProfile.objects.get(user=user).subscription_plan,
            billing_cycle='monthly',
            amount_usd=Decimal(str(amount_usd)),
            amount_local=Decimal(str(amount_usd)),
            local_currency='USD',
            payment_method='other',
            payment_provider='internal_wallet',
            purpose='topup',  # model enum: closest match; admin_notes carries 'boost'
            status='approved',
            payer_email=user.email or '',
            payer_name=user.get_full_name() or user.username,
            revenue_usd=Decimal(str(amount_usd)),
            fx_rate_used=Decimal(1),
            reviewed_at=timezone.now(),
            admin_notes=note,
        )

    log.info(
        'boost_service: reserved user=%s diamonds=%s usd=%s reservation=%s',
        user.id, diamonds_needed, amount_usd, reservation_id,
    )
    return {
        'status': 'reserved',
        'diamonds_deducted': diamonds_needed,
        'wallet_balance': wallet.balance,
        'reservation_id': reservation_id,
    }


def release_reservation(
    *, user: User, reservation_id: str, reason: str = '',
) -> dict[str, Any]:
    """Credit the deducted diamonds back when an ad fails to launch.

    Idempotent — running twice doesn't double-refund. Returns
    `{'status': 'released' | 'already_released' | 'no_reservation', ...}`.
    """
    if not reservation_id:
        return {'status': 'invalid', 'error': 'reservation_id is required'}

    existing = _existing_reservation(user, reservation_id)
    if existing is None:
        return {'status': 'no_reservation'}

    already = _existing_release(user, reservation_id)
    if already is not None:
        wallet = DiamondWallet.objects.filter(user=user).first()
        return {
            'status': 'already_released',
            'wallet_balance': wallet.balance if wallet else 0,
        }

    diamonds_to_refund = abs(existing.amount)

    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

        wallet.balance += diamonds_to_refund
        if wallet.total_spent and wallet.total_spent >= diamonds_to_refund:
            wallet.total_spent -= diamonds_to_refund
        wallet.save(update_fields=['balance', 'total_spent'])

        DiamondTransaction.objects.create(
            user=user,
            amount=diamonds_to_refund,
            transaction_type='refund',
            balance_after=wallet.balance,
            feature='boost',
            note=f'Boost reservation released {_reservation_marker(reservation_id)} reason={reason or "ad_launch_failed"}',
        )

        # Mark the original revenue row as cancelled.
        PaymentRequest.objects.filter(
            user=user, payment_provider='internal_wallet',
            admin_notes__contains=_reservation_marker(reservation_id),
            status='approved',
        ).update(
            status='cancelled',
            admin_notes=(
                f'CANCELLED: {reason or "ad_launch_failed"}. '
                f'Original reservation: {reservation_id}'
            ),
        )

    log.info(
        'boost_service: released user=%s diamonds=%s reservation=%s',
        user.id, diamonds_to_refund, reservation_id,
    )
    return {
        'status': 'released',
        'diamonds_credited': diamonds_to_refund,
        'wallet_balance': wallet.balance,
    }
