# accounts/services/diamond_service.py
# Diamond Token — Unified AI Credit System

from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════
# DIAMOND COST TABLE
# 1 Diamond = $0.001 USD | 3x SaaS markup on raw API costs
# ══════════════════════════════════════════════════════════════════════════

DIAMOND_COSTS = {
    # Text generation (Claude/OpenAI/Gemini)
    'caption': 5,
    'caption_adapt': 5,
    'caption_regenerate': 5,
    'brand_dna': 15,
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
}

# Plan-based diamond grants
PLAN_DIAMONDS = {
    'free': 50,
    'starter': 500,
    'pro': 2500,
    'business': 10000,
    'enterprise': 50000,
}


class InsufficientDiamondsError(Exception):
    """Raised when user doesn't have enough diamonds for an operation."""
    def __init__(self, balance, required):
        self.balance = balance
        self.required = required
        super().__init__(
            f'Insufficient Diamond Tokens: have {balance}, need {required}'
        )


def get_diamond_cost(feature, **kwargs):
    """Calculate diamond cost for a given feature with modifiers.

    Args:
        feature: Feature key from DIAMOND_COSTS
        **kwargs: Modifiers like duration, characters, quality

    Returns:
        int: Diamond token cost
    """
    # Video — cost depends on duration
    if feature == 'video':
        duration = kwargs.get('duration', 5)
        key = f'video_{duration}s'
        return DIAMOND_COSTS.get(key, DIAMOND_COSTS.get('video_5s', 500))

    # Voice — cost depends on text length
    if feature == 'voice':
        chars = kwargs.get('characters', 500)
        if chars <= 500:
            return DIAMOND_COSTS['voice_short']
        if chars <= 1000:
            return DIAMOND_COSTS['voice_medium']
        if chars <= 2000:
            return DIAMOND_COSTS['voice_long']
        return DIAMOND_COSTS['voice_extra_long']

    # Image — cost depends on quality
    if feature == 'image':
        quality = kwargs.get('quality', 'standard')
        if quality in ('hd', 'ultra', 'HD'):
            return DIAMOND_COSTS['image_hd']
        return DIAMOND_COSTS['image_standard']

    return DIAMOND_COSTS.get(feature, 5)


def pre_check(user, feature, **kwargs):
    """Check if user can afford an AI operation.

    Returns:
        tuple: (can_afford: bool, cost: int, balance: int)
    """
    from accounts.models import DiamondWallet
    cost = get_diamond_cost(feature, **kwargs)
    wallet, _ = DiamondWallet.objects.get_or_create(user=user)
    return (wallet.balance >= cost, cost, wallet.balance)


def deduct_diamonds(user, feature, provider='', raw_tokens=0,
                    model_used='', raw_cost_usd=0, **kwargs):
    """Deduct diamonds after a successful AI call.

    Creates an immutable DiamondTransaction ledger entry.

    Returns:
        int: Diamonds deducted
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    cost = get_diamond_cost(feature, **kwargs)
    wallet, _ = DiamondWallet.objects.get_or_create(user=user)

    if wallet.balance < cost:
        raise InsufficientDiamondsError(wallet.balance, cost)

    wallet.balance -= cost
    wallet.total_spent += cost
    wallet.save()

    DiamondTransaction.objects.create(
        user=user,
        amount=-cost,
        transaction_type='deduction',
        balance_after=wallet.balance,
        feature=feature,
        provider=provider,
        raw_tokens=raw_tokens,
        model_used=model_used,
        raw_cost_usd=raw_cost_usd,
    )
    return cost


def recharge_diamonds(user, amount, recharged_by=None, note=''):
    """Admin recharges diamonds for a user.

    Returns:
        int: New wallet balance
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    wallet, _ = DiamondWallet.objects.get_or_create(user=user)
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

    Returns:
        int: New wallet balance
    """
    from accounts.models import DiamondWallet, DiamondTransaction
    amount = PLAN_DIAMONDS.get(plan, PLAN_DIAMONDS['free'])
    wallet, _ = DiamondWallet.objects.get_or_create(user=user)
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
