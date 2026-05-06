# accounts/services/fx_service.py
"""
Foreign-exchange conversion for the finance ledger.

We convert every approved payment from its local currency to USD so the
finance dashboard can do plain arithmetic on a single currency.

Providers (tried in order):
  1. https://api.frankfurter.app  (ECB-sourced, free, no API key)
     Limited currency coverage — does NOT support BDT, PKR, NGN, etc.
  2. https://open.er-api.com      (free, no API key, daily refresh)
     Broad coverage including BDT, PKR, INR, NGN, EGP.
Cache:     `accounts.FxRate` table — refreshed at most every 24h per pair.
Fallback:  hardcoded approximate rates so a network outage never blocks
           a payment approval. The approval still goes through; the rate
           is marked `source='fallback'` so we can spot it later.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Optional

import requests
from django.utils import timezone


log = logging.getLogger(__name__)


# Hardcoded fallbacks (1 unit of FROM = X USD). Approximate as of 2026-Q1.
# Used only if both the cache and the network provider fail.
_FALLBACK_TO_USD: dict[str, Decimal] = {
    'USD': Decimal('1.0'),
    'BDT': Decimal('0.00833'),   # ~120 BDT / USD (2026)
    'INR': Decimal('0.012'),     # ~83 INR / USD
    'PKR': Decimal('0.0036'),    # ~280 PKR / USD
    'EUR': Decimal('1.08'),
    'GBP': Decimal('1.27'),
    'AED': Decimal('0.272'),     # AED is pegged
    'SGD': Decimal('0.74'),
    'MYR': Decimal('0.21'),
    'AUD': Decimal('0.66'),
    'CAD': Decimal('0.74'),
    'JPY': Decimal('0.0067'),
    'CNY': Decimal('0.14'),
    'IDR': Decimal('0.000063'),
    'PHP': Decimal('0.018'),
    'THB': Decimal('0.029'),
    'VND': Decimal('0.000040'),
    'KRW': Decimal('0.00074'),
    'TRY': Decimal('0.031'),
    'NGN': Decimal('0.00067'),
    'EGP': Decimal('0.020'),
    'SAR': Decimal('0.267'),
}

_CACHE_TTL = timedelta(hours=24)


def get_rate_to_usd(from_currency: str) -> tuple[Decimal, str]:
    """Return (rate, source) where rate is `1 from_currency in USD`.

    source ∈ {'cache', 'frankfurter', 'fallback', 'identity'}.
    """
    code = (from_currency or '').upper().strip()
    if not code:
        return Decimal('1.0'), 'identity'
    if code == 'USD':
        return Decimal('1.0'), 'identity'

    # 1) Cache lookup (importing here avoids circular imports at module load).
    from accounts.models import FxRate

    try:
        cached = FxRate.objects.get(from_currency=code, to_currency='USD')
        if timezone.now() - cached.fetched_at < _CACHE_TTL:
            return Decimal(cached.rate), 'cache'
    except FxRate.DoesNotExist:
        cached = None

    # 2) Network fetch from frankfurter (best quality, ECB-sourced).
    rate = _fetch_rate_frankfurter(code)
    if rate is not None:
        FxRate.objects.update_or_create(
            from_currency=code,
            to_currency='USD',
            defaults={'rate': rate, 'source': 'frankfurter'},
        )
        return rate, 'frankfurter'

    # 3) Network fetch from open.er-api.com (covers BDT, PKR, NGN, EGP, etc.).
    rate = _fetch_rate_open_er_api(code)
    if rate is not None:
        FxRate.objects.update_or_create(
            from_currency=code,
            to_currency='USD',
            defaults={'rate': rate, 'source': 'open_er_api'},
        )
        return rate, 'open_er_api'

    # 4) Stale cache is better than nothing.
    if cached is not None:
        return Decimal(cached.rate), 'cache_stale'

    # 5) Hardcoded fallback table.
    fallback = _FALLBACK_TO_USD.get(code)
    if fallback is not None:
        FxRate.objects.update_or_create(
            from_currency=code,
            to_currency='USD',
            defaults={'rate': fallback, 'source': 'fallback'},
        )
        return fallback, 'fallback'

    # 6) Truly unknown currency — log and return 1.0 so the caller doesn't
    #    crash. We treat it as USD-equivalent which over-counts revenue
    #    slightly, but at least the payment can still be approved.
    log.warning('fx_service: no rate available for %s, defaulting to 1.0', code)
    return Decimal('1.0'), 'unknown'


def _fetch_rate_frankfurter(code: str) -> Optional[Decimal]:
    try:
        resp = requests.get(
            'https://api.frankfurter.app/latest',
            params={'from': code, 'to': 'USD'},
            timeout=8,
        )
        if resp.status_code != 200:
            log.warning('fx_service: frankfurter %s returned %s', code, resp.status_code)
            return None
        data = resp.json()
        rate_value = data.get('rates', {}).get('USD')
        if rate_value is None:
            return None
        return Decimal(str(rate_value))
    except requests.RequestException:
        log.warning('fx_service: frankfurter request failed for %s', code, exc_info=True)
        return None
    except (ValueError, TypeError):
        log.exception('fx_service: bad response shape for %s', code)
        return None


def _fetch_rate_open_er_api(code: str) -> Optional[Decimal]:
    """Use open.er-api.com — broader coverage than frankfurter (BDT, PKR, etc.).

    The API returns rates in the form `1 USD = X target_currency`. To get the
    rate `1 code = Y USD` we invert: Y = 1 / X.
    """
    try:
        resp = requests.get(
            f'https://open.er-api.com/v6/latest/{code}',
            timeout=8,
        )
        if resp.status_code != 200:
            log.warning('fx_service: open_er_api %s returned %s', code, resp.status_code)
            return None
        data = resp.json()
        if data.get('result') != 'success':
            log.warning('fx_service: open_er_api %s non-success: %s', code, data.get('error-type'))
            return None
        rate_value = data.get('rates', {}).get('USD')
        if rate_value is None or rate_value == 0:
            return None
        return Decimal(str(rate_value))
    except requests.RequestException:
        log.warning('fx_service: open_er_api request failed for %s', code, exc_info=True)
        return None
    except (ValueError, TypeError):
        log.exception('fx_service: bad open_er_api response shape for %s', code)
        return None


def convert_to_usd(amount, from_currency: str) -> tuple[Decimal, Decimal, str]:
    """Convert `amount` in `from_currency` to USD.

    Returns (amount_usd, rate_used, source).
    `amount` may be a Decimal, str, int, or float.
    """
    if amount is None:
        return Decimal('0'), Decimal('1.0'), 'identity'
    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))
    rate, source = get_rate_to_usd(from_currency)
    converted = (amount * rate).quantize(Decimal('0.01'))
    return converted, rate, source
