# accounts/services/diamond_service.py
# Diamond Token — Unified AI Credit System

import math
from decimal import Decimal

from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════
# DIAMOND COST TABLE — SEED / FALLBACK
# 1 Diamond = $0.001 USD | 3x SaaS markup target on raw API costs
#
# Live pricing now reads from the `FeatureCostConfig` table — see
# `get_diamond_cost()` below for resolution order. This dict is kept as:
#   • seed data for migration 0024
#   • fallback when the DB row is missing or `is_active=False`
#   • emergency rollback target ("Reseed from code" button in admin UI)
# ══════════════════════════════════════════════════════════════════════════

# Diamond cost basis: 1 diamond corresponds to this many USD of raw API spend.
DIAMOND_USD_RATE = Decimal('0.001')

# Default markup percentage when no FeatureCostConfig row exists.
# 200 = 3× cost basis (matches the "3x SaaS markup" intent documented above).
DEFAULT_MARKUP_PCT = Decimal('200')

DIAMOND_COSTS = {
    # Text generation (Claude/OpenAI/Gemini)
    'caption': 5,
    'caption_adapt': 5,
    'caption_regenerate': 5,
    'brand_dna': 35,  # bumped from 15 — covers web_search + extended thinking
    'strategy_ideas': 10,
    'idea_regenerate': 10,
    'ai_reply_comment': 3,
    'hashtag_generation': 3,
    'competitor_analysis': 12,
    'competitor_suggest': 8,
    'trending_generation': 8,
    'weekly_report': 15,
    'pillar_generation': 10,
    'pillar_compliance': 5,
    'support_chat': 2,
    'refine_prompt': 3,
    'alt_text': 3,
    'copy_overlay_text': 5,
    'compute_times': 5,
    'repurpose_post': 10,

    # Image generation
    'image_standard': 15,
    'image_hd': 40,

    # Video generation (Gemini Veo)
    'video_5s': 500,
    'video_8s': 800,
    'video_10s': 1000,
    'video_15s': 1500,
    'video_30s': 3000,

    # Voice TTS (OpenAI)
    'voice_short': 5,       # ≤500 chars
    'voice_medium': 10,     # ≤1000 chars
    'voice_long': 15,       # ≤2000 chars
    'voice_extra_long': 25, # >2000 chars
    'voice_preview': 2,

    # Messenger bot
    'messenger_reply': 3,

    # Prompt engineering
    'prompt_engineer_generate': 5,
    'prompt_engineer_diagnose': 5,
    'prompt_engineer_reprompt': 5,
    'ai_styles': 5,

    # Paid Ads (Meta + Google) — automation setup cost, ad spend paid direct by user to platform
    'ads_boost_post': 50,             # boost an organic post via Meta Ads
    'ads_campaign_create': 100,       # full campaign creation (multi-step)
    'ads_audience_create': 30,        # upload custom audience / build lookalike
    'ads_ai_targeting_suggest': 20,   # AI suggests targeting from Brand DNA
    'ads_insights_pull': 2,           # pull fresh insights (cheap, runs often)
    'ads_google_campaign': 100,       # create a Google Ads campaign (Search/Display/PMax)
    'ads_ai_campaign_suggest': 15,    # AI proposes a full Google Ads campaign (LLM)
    'ads_meta_ai_suggest': 15,        # AI proposes a full Meta campaign (LLM)
    'ads_meta_recommendations': 3,    # pull Meta's native optimization recommendations

    # Google Business Profile
    'gbp_post': 2,                    # publish a Google Post (non-AI, cheap)
    'gbp_ai_caption': 5,              # AI-write a Google Post caption (LLM)
    'gbp_review_reply': 3,            # AI-generate a reply to a review (LLM)
}

# Plan-based diamond grants
PLAN_DIAMONDS = {
    'free': 50,
    'starter': 500,
    'pro': 2500,
    'business': 10000,
    'enterprise': 50000,
}

# Plan ranking — used to detect upgrades vs downgrades.
# Higher rank = higher tier.
PLAN_RANK = {
    'free': 0,
    'starter': 1,
    'pro': 2,
    'business': 3,
    'enterprise': 4,
}


class InsufficientDiamondsError(Exception):
    """Raised when user doesn't have enough diamonds for an operation."""
    def __init__(self, balance, required):
        self.balance = balance
        self.required = required
        super().__init__(
            f'Insufficient Diamond Tokens: have {balance}, need {required}'
        )


def _normalise_feature_key(feature, **kwargs):
    """Resolve generic 'video' / 'voice' / 'image' aliases to concrete keys."""
    if feature == 'video':
        duration = kwargs.get('duration', 5)
        return f'video_{duration}s'

    if feature == 'voice':
        chars = kwargs.get('characters', 500)
        if chars <= 500:
            return 'voice_short'
        if chars <= 1000:
            return 'voice_medium'
        if chars <= 2000:
            return 'voice_long'
        return 'voice_extra_long'

    if feature == 'image':
        quality = kwargs.get('quality', 'standard')
        if quality in ('hd', 'ultra', 'HD'):
            return 'image_hd'
        return 'image_standard'

    return feature


def _formula_diamond_cost(feature, markup_pct, model='', **kwargs):
    """Compute diamond cost from raw API cost × (1 + markup_pct / 100)."""
    from accounts.services.cost_calculator import estimate_feature_raw_cost_usd

    duration_seconds = kwargs.get('duration_seconds') or kwargs.get('duration') or 0
    characters = kwargs.get('characters', 0)
    media_count = kwargs.get('media_count', 1)

    raw_usd = estimate_feature_raw_cost_usd(
        feature,
        model=model,
        duration_seconds=duration_seconds,
        characters=characters,
        media_count=media_count,
    )
    if raw_usd <= 0:
        return None

    multiplier = Decimal('1') + (Decimal(markup_pct) / Decimal('100'))
    diamonds = (raw_usd / DIAMOND_USD_RATE) * multiplier
    return int(math.ceil(diamonds))


def get_diamond_cost(feature, **kwargs):
    """Calculate diamond cost for a given feature.

    Resolution order:
        1. Normalise generic aliases ('video' → 'video_8s' etc.).
        2. Look up `FeatureCostConfig(feature=key, is_active=True)`.
           - If `flat_override_diamonds` is set, return it.
           - Otherwise compute from `cost_calculator` × markup_pct.
        3. If no config row, use `DIAMOND_COSTS` seed dict.
        4. Final fallback: 5 diamonds.

    Args:
        feature: feature key (e.g. 'caption', 'video_5s') or alias
                 ('video', 'voice', 'image').
        **kwargs:
            duration / duration_seconds: video duration in seconds.
            characters: voice character count.
            quality: 'standard' | 'hd' for generic 'image' alias.
            model: override model id for the cost estimate.
            media_count: number of images for batch image generation.

    Returns:
        int: diamond token cost.
    """
    key = _normalise_feature_key(feature, **kwargs)

    # Try DB-backed config first
    cfg = _load_feature_config(key)
    if cfg is not None:
        if cfg.flat_override_diamonds is not None:
            return int(cfg.flat_override_diamonds)
        model = kwargs.get('model') or cfg.model_used
        formula_cost = _formula_diamond_cost(key, cfg.markup_pct, model=model, **kwargs)
        if formula_cost is not None:
            return formula_cost

    # No DB row (or formula returned 0) — fall back to seed dict.
    if key in DIAMOND_COSTS:
        return DIAMOND_COSTS[key]

    # Final fallback for unknown features
    return 5


def _load_feature_config(feature_key):
    """Load FeatureCostConfig row; returns None if the table/row is missing.

    Wrapped in try/except so this works during migrations and in tests
    that don't run the seed migration.
    """
    try:
        from accounts.models import FeatureCostConfig
        return FeatureCostConfig.objects.filter(
            feature=feature_key,
            is_active=True,
        ).only(
            'feature', 'flat_override_diamonds', 'markup_pct',
            'model_used', 'provider', 'category',
        ).first()
    except Exception:
        return None


def pre_check(user, feature, **kwargs):
    """Check if user can afford an AI operation.

    Uses SELECT FOR UPDATE to prevent race conditions during balance checks.

    Returns:
        tuple: (can_afford: bool, cost: int, balance: int)
    """
    from accounts.models import DiamondWallet
    from django.db import transaction

    cost = get_diamond_cost(feature, **kwargs)

    # Use select_for_update() to lock the wallet row and prevent race conditions
    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            # Create wallet if it doesn't exist (should only happen for old users migrated before v1.9)
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

    return (wallet.balance >= cost, cost, wallet.balance)


def deduct_diamonds(user, feature, provider='', raw_tokens=0,
                    model_used='', raw_cost_usd=0, result=None,
                    input_tokens=0, output_tokens=0,
                    cache_read_tokens=0, cache_write_tokens=0,
                    media_count=0, duration_seconds=0, **kwargs):
    """Deduct diamonds after a successful AI call.

    Uses SELECT FOR UPDATE to prevent race conditions and ensure ACID compliance.
    Creates an immutable DiamondTransaction ledger entry.

    Args:
        user, feature: required.
        provider, raw_tokens, model_used, raw_cost_usd: explicit metadata.
        input_tokens, output_tokens: exact prompt/completion token split — used
            for 100% accurate cost calculation (Claude $3 in / $15 out etc).
        cache_read_tokens, cache_write_tokens: prompt cache metrics for
            providers that bill them at different rates.
        media_count: number of images/videos generated (for media features).
        duration_seconds: video duration (for accurate per-second video cost).
        result: optional LLMResponse / dict / object. When provided, its
            `.provider`, `.model`, `.input_tokens`, `.output_tokens`, etc.
            auto-fill any explicit values left blank — so the actual API path
            that served the request is recorded accurately for cost reporting.

    Returns:
        int: Diamonds deducted

    Raises:
        InsufficientDiamondsError: If user doesn't have enough diamonds
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    from django.db import transaction

    # Auto-fill from LLMResponse / dict if provided
    if result is not None:
        def _attr(obj, name, default=''):
            if isinstance(obj, dict):
                return obj.get(name, default)
            return getattr(obj, name, default)

        if not provider:
            provider = _attr(result, 'provider', '') or provider
        if not model_used:
            # LLMResponse uses .model; some callers may use .model_used
            model_used = _attr(result, 'model', '') or _attr(result, 'model_used', '') or model_used
        if not input_tokens:
            input_tokens = _attr(result, 'input_tokens', 0) or input_tokens
        if not output_tokens:
            output_tokens = _attr(result, 'output_tokens', 0) or output_tokens
        if not cache_read_tokens:
            cache_read_tokens = _attr(result, 'cache_read_tokens', 0) or cache_read_tokens
        if not cache_write_tokens:
            cache_write_tokens = _attr(result, 'cache_write_tokens', 0) or cache_write_tokens
        if not raw_tokens:
            raw_tokens = _attr(result, 'tokens_used', 0) or raw_tokens
        if not raw_cost_usd:
            raw_cost_usd = _attr(result, 'cost_usd', 0) or _attr(result, 'raw_cost_usd', 0) or raw_cost_usd
        if not media_count:
            media_count = _attr(result, 'media_count', 0) or media_count
        if not duration_seconds:
            duration_seconds = _attr(result, 'duration', 0) or _attr(result, 'duration_seconds', 0) or duration_seconds

    # Derive total tokens from split if not given explicitly
    if not raw_tokens and (input_tokens or output_tokens):
        raw_tokens = input_tokens + output_tokens

    cost = get_diamond_cost(feature, **kwargs)

    # CRITICAL: Use atomic transaction with row-level locking to prevent double-spending
    with transaction.atomic():
        try:
            # Lock the wallet row for this transaction
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            raise InsufficientDiamondsError(0, cost)

        # Check balance after acquiring lock
        if wallet.balance < cost:
            raise InsufficientDiamondsError(wallet.balance, cost)

        # Deduct diamonds
        wallet.balance -= cost
        wallet.total_spent += cost
        wallet.save()

        # Create immutable transaction record with full cost metadata
        DiamondTransaction.objects.create(
            user=user,
            amount=-cost,
            transaction_type='deduction',
            balance_after=wallet.balance,
            feature=feature,
            provider=provider,
            raw_tokens=raw_tokens,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_write_tokens=cache_write_tokens,
            media_count=media_count,
            duration_seconds=duration_seconds,
            model_used=model_used,
            raw_cost_usd=raw_cost_usd,
        )

    return cost


def recharge_diamonds(user, amount, recharged_by=None, note=''):
    """Admin recharges diamonds for a user.

    Uses SELECT FOR UPDATE to prevent race conditions during recharge.

    Returns:
        int: New wallet balance
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    from django.db import transaction

    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            # Create wallet if it doesn't exist
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

        wallet.balance += amount
        wallet.total_recharged += amount
        wallet.last_recharge_at = timezone.now()
        wallet.save()

        DiamondTransaction.objects.create(
            user=user,
            amount=amount,
            transaction_type='recharge',
            balance_after=wallet.balance,
            recharged_by=recharged_by,
            note=note,
        )

    return wallet.balance


def grant_plan_diamonds(user, plan):
    """Auto-grant diamonds when admin assigns a plan.

    Uses SELECT FOR UPDATE to prevent race conditions during plan grants.

    Returns:
        int: New wallet balance
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    from django.db import transaction

    amount = PLAN_DIAMONDS.get(plan, PLAN_DIAMONDS['free'])

    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            # Create wallet if it doesn't exist
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

        wallet.balance += amount
        wallet.total_recharged += amount
        wallet.last_recharge_at = timezone.now()
        wallet.save()

        DiamondTransaction.objects.create(
            user=user,
            amount=amount,
            transaction_type='plan_grant',
            balance_after=wallet.balance,
            note=f'Plan grant: {plan} (+{amount} diamonds)',
        )

    return wallet.balance


def grant_plan_diamonds_on_upgrade(user, previous_plan, new_plan, cycle_start_date):
    """Grant plan diamonds when a user changes plan via self-service upgrade.

    Rules:
      - Grant only when the new plan ranks STRICTLY HIGHER than the previous plan
        (i.e. real upgrade — no grant on downgrade or same-plan re-selection).
      - Idempotent per billing cycle: keyed on (user, new_plan, cycle_start_date).
        Re-running for the same cycle is a no-op.
      - Free plan grants nothing (PLAN_DIAMONDS['free'] is intentional baseline).

    Returns dict:
      {
        'granted': bool,
        'amount': int,           # diamonds granted (0 if not granted)
        'balance': int,          # current wallet balance
        'reason': str,           # 'granted' | 'not_an_upgrade' | 'already_granted_this_cycle' | 'no_diamonds_for_plan'
      }
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    from django.db import transaction

    # Resolve current balance up front so we can return it in skip cases.
    def _current_balance():
        try:
            return DiamondWallet.objects.get(user=user).balance
        except DiamondWallet.DoesNotExist:
            return 0

    # Rule 1: only on rank-up
    prev_rank = PLAN_RANK.get(previous_plan, 0)
    new_rank = PLAN_RANK.get(new_plan, 0)
    if new_rank <= prev_rank:
        return {
            'granted': False,
            'amount': 0,
            'balance': _current_balance(),
            'reason': 'not_an_upgrade',
        }

    amount = PLAN_DIAMONDS.get(new_plan, 0)
    if amount <= 0:
        return {
            'granted': False,
            'amount': 0,
            'balance': _current_balance(),
            'reason': 'no_diamonds_for_plan',
        }

    cycle_marker = cycle_start_date.isoformat() if cycle_start_date else 'no-cycle'
    cycle_note = f'Plan upgrade grant: {new_plan} cycle={cycle_marker} (+{amount} diamonds)'

    with transaction.atomic():
        try:
            wallet = DiamondWallet.objects.select_for_update().get(user=user)
        except DiamondWallet.DoesNotExist:
            wallet = DiamondWallet.objects.create(user=user, balance=0, total_recharged=0)

        # Idempotency: same plan + same cycle start = already granted.
        already_granted = DiamondTransaction.objects.filter(
            user=user,
            transaction_type='plan_grant',
            note=cycle_note,
        ).exists()

        if already_granted:
            return {
                'granted': False,
                'amount': 0,
                'balance': wallet.balance,
                'reason': 'already_granted_this_cycle',
            }

        wallet.balance += amount
        wallet.total_recharged += amount
        wallet.last_recharge_at = timezone.now()
        wallet.save()

        DiamondTransaction.objects.create(
            user=user,
            amount=amount,
            transaction_type='plan_grant',
            balance_after=wallet.balance,
            note=cycle_note,
        )

        return {
            'granted': True,
            'amount': amount,
            'balance': wallet.balance,
            'reason': 'granted',
        }


def get_usage_summary(user, days=30):
    """Get diamond usage breakdown for a user.

    Returns:
        dict with by_feature, by_provider, totals
    """
    from accounts.models import DiamondTransaction
    from django.db.models import Sum, Count
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=days)
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    deductions = DiamondTransaction.objects.filter(
        user=user,
        transaction_type='deduction',
        created_at__gte=cutoff,
    )

    by_feature = list(
        deductions.values('feature').annotate(
            diamonds_spent=Sum('amount'),
            count=Count('id'),
        ).order_by('-diamonds_spent')
    )
    # amount is negative for deductions, so flip sign
    for item in by_feature:
        item['diamonds_spent'] = abs(item['diamonds_spent'] or 0)

    by_provider = list(
        deductions.values('provider').annotate(
            diamonds_spent=Sum('amount'),
            raw_tokens=Sum('raw_tokens'),
        ).order_by('-diamonds_spent')
    )
    for item in by_provider:
        item['diamonds_spent'] = abs(item['diamonds_spent'] or 0)

    total_spent_today = abs(
        DiamondTransaction.objects.filter(
            user=user,
            transaction_type='deduction',
            created_at__gte=today_start,
        ).aggregate(total=Sum('amount'))['total'] or 0
    )

    total_spent_this_month = abs(
        deductions.aggregate(total=Sum('amount'))['total'] or 0
    )

    return {
        'by_feature': by_feature,
        'by_provider': by_provider,
        'total_spent_today': total_spent_today,
        'total_spent_this_month': total_spent_this_month,
    }
