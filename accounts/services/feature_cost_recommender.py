"""Historical-data driven feature cost recommendations.

Reads every `DiamondTransaction` deduction in a window, computes the real
USD API cost using `cost_calculator.calculate_transaction_cost`, and
recommends per-feature `flat_override_diamonds` grounded in actual usage
rather than the theoretical `FEATURE_TYPICAL_TOKENS` estimates.

Used by the admin Feature-Costs page (Historical Audit tab) to surface
under-priced features and bulk-apply recommended prices.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone


# Same conversion constants as `accounts/services/diamond_service.py` — kept
# duplicated rather than imported to keep the recommender self-contained.
DIAMOND_USD_RATE = Decimal('0.001')
DEFAULT_TARGET_MARKUP_PCT = Decimal('200')  # 200% = 3× cost basis

# Features with fewer than this many real calls in the window fall back to
# the typical-tokens estimate; their row is flagged "low confidence".
MIN_CALLS_FOR_RECOMMENDATION = 5


def _resolve_window(lookback_days: Optional[int] = None,
                    from_date=None, to_date=None) -> tuple[datetime, datetime]:
    """Return (window_start, window_end) as aware datetimes."""
    now = timezone.now()

    if from_date and to_date:
        start = datetime.combine(from_date, datetime.min.time())
        end = datetime.combine(to_date, datetime.max.time()) + timedelta(seconds=1)
    else:
        days = max(1, int(lookback_days or 30))
        end = now
        start = end - timedelta(days=days)

    if timezone.is_naive(start):
        start = timezone.make_aware(start)
    if timezone.is_naive(end):
        end = timezone.make_aware(end)
    return start, end


def _recommended_diamonds_from_cost(
    avg_real_cost_usd: Decimal,
    markup_pct: Decimal = DEFAULT_TARGET_MARKUP_PCT,
) -> int:
    """ceil(avg_cost × (1 + markup_pct/100) / $0.001) — guarantees ≥ 1 💎."""
    if avg_real_cost_usd <= 0:
        return 0
    multiplier = Decimal('1') + (Decimal(markup_pct) / Decimal('100'))
    return max(1, int(math.ceil((avg_real_cost_usd / DIAMOND_USD_RATE) * multiplier)))


def _current_diamonds_for_feature(feature: str) -> int:
    """What `get_diamond_cost` would return right now for one call."""
    from accounts.services import diamond_service
    try:
        return int(diamond_service.get_diamond_cost(feature))
    except Exception:
        return 0


def aggregate_historical_costs(
    lookback_days: Optional[int] = None,
    from_date=None,
    to_date=None,
    category: str = '',
) -> dict:
    """Aggregate every DiamondTransaction deduction in the window by feature.

    Returns:
      {
        'window': {'from': ISO, 'to': ISO, 'lookback_days': int|None},
        'summary': {
            'feature_count', 'total_calls', 'total_real_cost_usd',
            'total_diamonds_charged', 'total_cost_basis_charged_usd',
            'total_margin_usd', 'under_priced_count',
        },
        'rows': [
            {
                'feature', 'cost_type', 'category', 'provider_mix',
                'call_count', 'tokens_total', 'avg_input_tokens',
                'avg_output_tokens', 'diamonds_charged_total',
                'cost_basis_charged_usd', 'real_cost_usd',
                'avg_real_cost_per_call_usd', 'margin_usd',
                'current_diamonds_per_call', 'recommended_flat_override',
                'gap_per_call_diamonds', 'projected_extra_revenue_usd',
                'is_under_priced', 'low_confidence',
            },
            ...
        ],
      }
    """
    from accounts.models import DiamondTransaction
    from accounts.services.cost_calculator import (
        calculate_transaction_cost,
        cost_type_for_feature,
        map_feature_to_provider_category,
    )

    start, end = _resolve_window(lookback_days, from_date, to_date)

    qs = (
        DiamondTransaction.objects
        .filter(
            transaction_type='deduction',
            created_at__gte=start,
            created_at__lt=end,
        )
        .only(
            'feature', 'provider', 'model_used', 'amount',
            'raw_tokens', 'input_tokens', 'output_tokens',
            'cache_read_tokens', 'cache_write_tokens',
            'media_count', 'duration_seconds', 'raw_cost_usd',
            'created_at', 'transaction_type',
        )
    )

    buckets: dict[str, dict] = {}

    for tx in qs.iterator():
        feature = (tx.feature or '').strip().lower()
        if not feature:
            continue

        cost = calculate_transaction_cost(tx)
        diamonds_charged = abs(int(tx.amount or 0))
        provider = (tx.provider or '').strip().lower()

        b = buckets.setdefault(feature, {
            'feature': feature,
            'call_count': 0,
            'real_cost_usd': Decimal('0'),
            'diamonds_charged_total': 0,
            'tokens_total': 0,
            'input_tokens_total': 0,
            'output_tokens_total': 0,
            'provider_counts': {},
        })
        b['call_count'] += 1
        b['real_cost_usd'] += cost
        b['diamonds_charged_total'] += diamonds_charged
        b['tokens_total'] += int(tx.raw_tokens or 0)
        b['input_tokens_total'] += int(tx.input_tokens or 0)
        b['output_tokens_total'] += int(tx.output_tokens or 0)

        if provider:
            b['provider_counts'][provider] = b['provider_counts'].get(provider, 0) + 1

    # Build per-feature rows
    rows = []
    summary_total_real = Decimal('0')
    summary_total_diamonds = 0
    summary_total_calls = 0
    summary_under_priced = 0

    for feature, b in buckets.items():
        cost_type = cost_type_for_feature(feature)
        # Determine category from feature/provider — gemini wins for image/video,
        # otherwise pick the most common provider seen in history.
        dominant_provider = ''
        if b['provider_counts']:
            dominant_provider = max(b['provider_counts'].items(), key=lambda kv: kv[1])[0]
        category_label = map_feature_to_provider_category(feature, dominant_provider)

        # Filter by category if requested — match the FeatureCostConfig
        # category, not the provider category. To do that we need to look at
        # the config row.
        # (We post-filter rather than narrow the DB query because we always
        # need to count totals across all features.)

        calls = b['call_count']
        real_cost = b['real_cost_usd']
        diamonds_charged = b['diamonds_charged_total']
        cost_basis_charged = Decimal(diamonds_charged) * DIAMOND_USD_RATE
        margin = cost_basis_charged - real_cost

        avg_cost = (real_cost / Decimal(calls)) if calls else Decimal('0')
        current_diamonds = _current_diamonds_for_feature(feature)

        low_confidence = calls < MIN_CALLS_FOR_RECOMMENDATION
        if low_confidence or avg_cost <= 0:
            recommended = current_diamonds  # leave as-is
        else:
            recommended = _recommended_diamonds_from_cost(avg_cost)

        gap = recommended - current_diamonds
        projected_extra = (
            Decimal(gap) * Decimal(calls) * DIAMOND_USD_RATE
            if gap > 0 else Decimal('0')
        )

        is_under_priced = gap > 0 and not low_confidence

        # Provider mix as percentages
        provider_mix = {}
        for prov, count in b['provider_counts'].items():
            provider_mix[prov] = round(count / calls * 100, 1) if calls else 0

        # Look up the FeatureCostConfig category if it exists (for filtering)
        feature_config_category = _config_category(feature) or 'misc'

        if category and feature_config_category != category:
            continue

        rows.append({
            'feature':                       feature,
            'cost_type':                     cost_type,
            'category':                      feature_config_category,
            'provider_mix':                  provider_mix,
            'dominant_provider':             dominant_provider,
            'call_count':                    calls,
            'tokens_total':                  b['tokens_total'],
            'avg_input_tokens':              round(b['input_tokens_total'] / calls, 0) if calls else 0,
            'avg_output_tokens':             round(b['output_tokens_total'] / calls, 0) if calls else 0,
            'diamonds_charged_total':        diamonds_charged,
            'cost_basis_charged_usd':        f'{cost_basis_charged:.6f}',
            'real_cost_usd':                 f'{real_cost:.6f}',
            'avg_real_cost_per_call_usd':    f'{avg_cost:.6f}',
            'margin_usd':                    f'{margin:.6f}',
            'current_diamonds_per_call':     current_diamonds,
            'recommended_flat_override':     recommended,
            'gap_per_call_diamonds':         gap,
            'projected_extra_revenue_usd':   f'{projected_extra:.6f}',
            'is_under_priced':               is_under_priced,
            'low_confidence':                low_confidence,
        })

        summary_total_real += real_cost
        summary_total_diamonds += diamonds_charged
        summary_total_calls += calls
        if is_under_priced:
            summary_under_priced += 1

    # Sort by gap (biggest under-priced features first)
    rows.sort(key=lambda r: r['gap_per_call_diamonds'] * r['call_count'], reverse=True)

    summary_cost_basis = Decimal(summary_total_diamonds) * DIAMOND_USD_RATE

    return {
        'window': {
            'from':           start.isoformat(),
            'to':             (end - timedelta(seconds=1)).isoformat(),
            'lookback_days':  lookback_days,
        },
        'summary': {
            'feature_count':                len(rows),
            'total_calls':                  summary_total_calls,
            'total_real_cost_usd':          f'{summary_total_real:.6f}',
            'total_diamonds_charged':       summary_total_diamonds,
            'total_cost_basis_charged_usd': f'{summary_cost_basis:.6f}',
            'total_margin_usd':             f'{(summary_cost_basis - summary_total_real):.6f}',
            'under_priced_count':           summary_under_priced,
        },
        'rows':                rows,
        'min_calls_for_recommendation': MIN_CALLS_FOR_RECOMMENDATION,
    }


def _config_category(feature: str) -> Optional[str]:
    """Return the FeatureCostConfig.category for a feature, or None."""
    try:
        from accounts.models import FeatureCostConfig
        row = FeatureCostConfig.objects.filter(feature=feature).only('category').first()
        return row.category if row else None
    except Exception:
        return None


def recommend_price(
    feature: str,
    lookback_days: int = 30,
    markup_pct: Decimal = DEFAULT_TARGET_MARKUP_PCT,
) -> dict:
    """Compute a recommended flat_override_diamonds for one feature.

    Returns:
      {
        'feature', 'call_count', 'avg_real_cost_per_call_usd',
        'recommended_flat_override', 'current_diamonds_per_call',
        'gap_per_call_diamonds', 'low_confidence', 'fallback_used',
      }
    """
    from accounts.models import DiamondTransaction
    from accounts.services.cost_calculator import (
        calculate_transaction_cost,
        estimate_feature_raw_cost_usd,
    )

    start, end = _resolve_window(lookback_days)
    qs = (
        DiamondTransaction.objects
        .filter(
            transaction_type='deduction',
            feature=feature,
            created_at__gte=start,
            created_at__lt=end,
        )
        .only(
            'feature', 'provider', 'model_used', 'amount',
            'raw_tokens', 'input_tokens', 'output_tokens',
            'cache_read_tokens', 'cache_write_tokens',
            'media_count', 'duration_seconds', 'raw_cost_usd',
            'transaction_type',
        )
    )

    total_cost = Decimal('0')
    calls = 0
    for tx in qs.iterator():
        total_cost += calculate_transaction_cost(tx)
        calls += 1

    fallback_used = False
    if calls < MIN_CALLS_FOR_RECOMMENDATION or total_cost <= 0:
        # Fall back to typical-token estimate from Phase 1
        avg_cost = estimate_feature_raw_cost_usd(feature)
        fallback_used = True
    else:
        avg_cost = total_cost / Decimal(calls)

    recommended = _recommended_diamonds_from_cost(avg_cost, markup_pct)
    current = _current_diamonds_for_feature(feature)

    return {
        'feature':                    feature,
        'call_count':                 calls,
        'avg_real_cost_per_call_usd': f'{avg_cost:.6f}',
        'recommended_flat_override':  recommended,
        'current_diamonds_per_call':  current,
        'gap_per_call_diamonds':      recommended - current,
        'markup_pct':                 str(markup_pct),
        'low_confidence':             calls < MIN_CALLS_FOR_RECOMMENDATION,
        'fallback_used':              fallback_used,
        'window_days':                lookback_days,
    }


def apply_recommendations(
    features: list[str],
    lookback_days: int,
    actor=None,
    markup_pct: Decimal = DEFAULT_TARGET_MARKUP_PCT,
) -> dict:
    """Bulk-apply recommended flat_override_diamonds to selected features.

    Skips features with fewer than MIN_CALLS_FOR_RECOMMENDATION historical
    calls (their recommendation is theoretical, not history-grounded).

    Returns:
      {
        'applied':  [{feature, old, new, call_count}, ...],
        'skipped':  [{feature, reason}, ...],
      }
    """
    from accounts.models import FeatureCostConfig

    applied = []
    skipped = []

    for feature in features:
        try:
            cfg = FeatureCostConfig.objects.get(feature=feature)
        except FeatureCostConfig.DoesNotExist:
            skipped.append({'feature': feature, 'reason': 'no_config_row'})
            continue

        rec = recommend_price(feature, lookback_days=lookback_days, markup_pct=markup_pct)

        if rec['fallback_used']:
            skipped.append({
                'feature':    feature,
                'reason':     'insufficient_history',
                'call_count': rec['call_count'],
            })
            continue

        if rec['recommended_flat_override'] <= 0:
            skipped.append({'feature': feature, 'reason': 'zero_cost'})
            continue

        old_value = cfg.flat_override_diamonds
        cfg.flat_override_diamonds = rec['recommended_flat_override']
        cfg.is_active = True
        if actor is not None:
            cfg.updated_by = actor
        # Add a note so the admin can see why this changed
        from django.utils import timezone as tz
        cfg.notes = (
            f"Auto-applied from {lookback_days}d history at "
            f"{tz.now().date().isoformat()}: avg cost "
            f"${rec['avg_real_cost_per_call_usd']} × 3 → "
            f"{rec['recommended_flat_override']} 💎 "
            f"(was {old_value if old_value is not None else 'formula'})."
        )[:1000]
        cfg.save()

        applied.append({
            'feature':    feature,
            'old':        int(old_value) if old_value is not None else None,
            'new':        rec['recommended_flat_override'],
            'call_count': rec['call_count'],
        })

    return {'applied': applied, 'skipped': skipped}
