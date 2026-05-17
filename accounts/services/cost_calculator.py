"""
Dynamic API Cost Calculator
============================

Computes actual USD cost for every AI API call from DiamondTransaction ledger
data. Rates are sourced from docs/apiModelCost.md (verified from official
Anthropic, Google, and OpenAI pricing pages — May 2026).

Usage:
    from accounts.services.cost_calculator import calculate_transaction_cost

    cost_usd = calculate_transaction_cost(transaction)

The calculator handles three cost types:
    1. Token-based (text/LLM): cost = input_tokens × input_rate + output_tokens × output_rate
    2. Per-image (image gen): fixed cost per generation
    3. Per-second (video gen): cost = duration_seconds × per_second_rate

For old DiamondTransaction rows without populated metadata, sensible
defaults are applied (Claude Sonnet 4 for text, gemini-3.1-flash-image for
image, veo-3.1 for video) so historical costs can be back-calculated.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional


# ─────────────────────────────────────────────────────────────────────
# Rate Tables (verified from official sources — May 2026)
# ─────────────────────────────────────────────────────────────────────

# LLM per-million-token rates (input, output) in USD
# Source: platform.claude.com/docs/about-claude/pricing
#         openai.com/api/pricing
#         ai.google.dev/gemini-api/docs/pricing
LLM_RATES: dict[str, tuple[Decimal, Decimal]] = {
    # Anthropic Claude
    'claude-sonnet-4-20250514':   (Decimal('3.00'),  Decimal('15.00')),  # ⚠️ deprecated June 15, 2026
    'claude-sonnet-4-6':          (Decimal('3.00'),  Decimal('15.00')),
    'claude-sonnet-4-5':          (Decimal('3.00'),  Decimal('15.00')),
    'claude-sonnet-4-5-20250929': (Decimal('3.00'),  Decimal('15.00')),
    'claude-haiku-4-5':           (Decimal('1.00'),  Decimal('5.00')),
    'claude-haiku-4-5-20251001':  (Decimal('1.00'),  Decimal('5.00')),
    'claude-opus-4-7':            (Decimal('5.00'),  Decimal('25.00')),
    'claude-opus-4-6':            (Decimal('5.00'),  Decimal('25.00')),
    'claude-opus-4':              (Decimal('15.00'), Decimal('75.00')),
    'claude-opus-4-20250514':     (Decimal('15.00'), Decimal('75.00')),

    # OpenAI
    'gpt-4o':                     (Decimal('2.50'),  Decimal('10.00')),
    'gpt-4o-mini':                (Decimal('0.15'),  Decimal('0.60')),
    'gpt-4-turbo':                (Decimal('10.00'), Decimal('30.00')),
    'gpt-4':                      (Decimal('30.00'), Decimal('60.00')),
    'gpt-3.5-turbo':              (Decimal('0.50'),  Decimal('1.50')),

    # Google Gemini (text)
    'gemini-2.5-pro':             (Decimal('1.25'),  Decimal('10.00')),
    'gemini-2.5-flash':           (Decimal('0.30'),  Decimal('2.50')),
    'gemini-2.5-flash-lite':      (Decimal('0.10'),  Decimal('0.40')),
    'gemini-2.0-flash':           (Decimal('0.10'),  Decimal('0.40')),  # ⚠️ deprecating
    'gemini-2.0-flash-lite':      (Decimal('0.075'), Decimal('0.30')),
}

# Default LLM model when transaction.model_used is empty
DEFAULT_LLM_MODEL = 'claude-sonnet-4-20250514'

# OpenAI embeddings per-million-token rates (input only)
EMBEDDING_RATES: dict[str, Decimal] = {
    'text-embedding-3-small': Decimal('0.020'),
    'text-embedding-3-large': Decimal('0.130'),
}

# Image generation per-image cost in USD
# Source: ai.google.dev/gemini-api/docs/pricing  +  apiModelCost.md
IMAGE_RATES: dict[str, Decimal] = {
    # Google Gemini (Magic Link primary)
    'gemini-3.1-flash-image-preview': Decimal('0.067'),  # 1K res
    'gemini-2.5-flash-image':         Decimal('0.039'),
    'gemini-3-pro-image-preview':     Decimal('0.134'),  # 1K/2K res
    'imagen-3.0-generate-001':        Decimal('0.040'),  # estimated (Imagen 4 std rate)
    'imagen-3.0-fast-generate-001':   Decimal('0.020'),  # estimated (Imagen 4 fast rate)

    # OpenAI (used in non-Magic-Link flows: creative_views.py)
    'gpt-image-1.5':                  Decimal('0.042'),  # medium quality
    'dall-e-3':                       Decimal('0.040'),  # standard 1024x1024
    'dall-e-2':                       Decimal('0.020'),
}

# Default image model per provider when transaction.model_used is empty
DEFAULT_IMAGE_MODEL_BY_PROVIDER: dict[str, str] = {
    'gemini': 'gemini-3.1-flash-image-preview',
    'google': 'gemini-3.1-flash-image-preview',
    'openai': 'gpt-image-1.5',
}

# Image quality multiplier (for HD vs standard features)
IMAGE_QUALITY_MULTIPLIER: dict[str, Decimal] = {
    'image':          Decimal('1.0'),  # generic 'image' feature (legacy / Magic Link default)
    'image_standard': Decimal('1.0'),
    'image_hd':       Decimal('2.0'),  # HD ~ gemini-3-pro-image-preview rate / standard rate
}

# Video generation per-second cost in USD
VIDEO_RATES_PER_SECOND: dict[str, Decimal] = {
    'veo-3.1-generate-preview':        Decimal('0.40'),  # 720p–1080p
    'veo-3.1-lite-generate-preview':   Decimal('0.08'),  # 1080p
    'veo-3.1-fast-generate-preview':   Decimal('0.12'),  # 1080p
    'veo-2.0-generate-001':            Decimal('0.35'),
    'veo-2.0-generate-preview':        Decimal('0.35'),
}

# Default video model
DEFAULT_VIDEO_MODEL = 'veo-3.1-generate-preview'

# OpenAI TTS rate (per character) — for voice features
# Source: openai.com/api/pricing — TTS-1: $15 / 1M chars; TTS-1-HD: $30 / 1M chars
TTS_RATE_PER_MILLION_CHARS = Decimal('15.00')

# Voice feature → estimated character count (worst case, used for cost ceiling)
VOICE_FEATURE_CHARS: dict[str, int] = {
    'voice_short':      500,
    'voice_medium':     1000,
    'voice_long':       2000,
    'voice_extra_long': 4000,
    'voice_preview':    100,
}


# ─────────────────────────────────────────────────────────────────────
# Token split estimate (input vs output)
# ─────────────────────────────────────────────────────────────────────

# Most LLM workloads in this app are input-heavy (long brand DNA + system
# prompts vs short JSON output). 65/35 split fits caption/idea/trending
# token estimates in apiModelCost.md.
DEFAULT_INPUT_RATIO = Decimal('0.65')
DEFAULT_OUTPUT_RATIO = Decimal('0.35')

# Some features have skewed ratios — override per feature
FEATURE_INPUT_RATIO: dict[str, Decimal] = {
    'brand_dna':           Decimal('0.60'),  # ~3K in / 2K out
    'trending_generation': Decimal('0.75'),  # ~1.5K in / 0.5K out
    'strategy_ideas':      Decimal('0.67'),  # ~3K in / 1.5K out
    'idea_regenerate':     Decimal('0.67'),
    'caption':             Decimal('0.71'),  # ~2K in / 0.8K out
    'caption_adapt':       Decimal('0.71'),
    'caption_regenerate':  Decimal('0.76'),  # ~2.5K in / 0.8K out
    'alt_text':            Decimal('0.85'),  # mostly image vision tokens in
    'hashtag_generation':  Decimal('0.70'),
    'pillar_generation':   Decimal('0.65'),
    'competitor_analysis': Decimal('0.70'),
    'competitor_suggest':  Decimal('0.70'),
    'compute_times':       Decimal('0.65'),
    'support_chat':        Decimal('0.80'),
    'refine_prompt':       Decimal('0.75'),
    'repurpose_post':      Decimal('0.65'),
    'messenger_reply':     Decimal('0.80'),
}


# ─────────────────────────────────────────────────────────────────────
# Typical token volumes per text feature
# Used by `diamond_service.get_diamond_cost()` when computing diamond cost
# from a markup percentage. Numbers reflect upper-bound prompt sizes used
# in the live views and were the basis for `docs/AI_COST_AUDIT.md`.
# ─────────────────────────────────────────────────────────────────────

FEATURE_TYPICAL_TOKENS: dict[str, tuple[int, int]] = {
    # text feature -> (input_tokens, output_tokens)
    'caption':                  (2000, 800),
    'caption_adapt':            (1500, 600),
    'caption_regenerate':       (2500, 800),
    'brand_dna':                (3000, 2000),
    'strategy_ideas':           (3000, 1500),
    'idea_regenerate':          (3000, 1500),
    'ai_reply_comment':         (500, 200),
    'hashtag_generation':       (500, 200),
    'competitor_analysis':      (5000, 2000),
    'competitor_suggest':       (1500, 600),
    'trending_generation':      (1500, 500),
    'weekly_report':            (3000, 1500),
    'pillar_generation':        (2500, 1500),
    'pillar_compliance':        (1000, 400),
    'support_chat':             (1500, 400),
    'refine_prompt':            (800, 300),
    'alt_text':                 (1000, 200),
    'copy_overlay_text':        (1000, 400),
    'compute_times':            (1500, 500),
    'repurpose_post':           (2500, 1500),
    'messenger_reply':          (1000, 300),
    'prompt_engineer_generate': (800, 400),
    'prompt_engineer_diagnose': (800, 400),
    'prompt_engineer_reprompt': (800, 400),
    'ai_styles':                (600, 400),
    # Ads features run via Claude too
    'ads_boost_post':           (1500, 600),
    'ads_campaign_create':      (3000, 1500),
    'ads_audience_create':      (1000, 500),
    'ads_ai_targeting_suggest': (1000, 500),
    'ads_insights_pull':        (500, 200),
}


def estimate_feature_raw_cost_usd(
    feature: str,
    model: str = '',
    duration_seconds: int = 0,
    characters: int = 0,
    media_count: int = 1,
) -> Decimal:
    """Estimate the raw provider USD cost for a single call to `feature`.

    Used by `diamond_service.get_diamond_cost()` when computing the
    diamond cost from a markup percentage instead of a flat override.

    Routing:
        - feature in IMAGE_FEATURES → calculate_image_cost × media_count
        - feature starts with 'video_' → calculate_video_cost
        - feature in VOICE_FEATURES → calculate_voice_cost
        - otherwise → calculate_text_cost using FEATURE_TYPICAL_TOKENS
          (falls back to (1500, 600) when feature is unknown)
    """
    f = (feature or '').strip().lower()

    if f in IMAGE_FEATURES:
        per_image = calculate_image_cost(f, model=model)
        return (per_image * max(1, media_count)).quantize(Decimal('0.000001'))

    if _is_video_feature(f):
        return calculate_video_cost(f, model=model, duration_override=duration_seconds or None)

    if f in VOICE_FEATURES:
        if characters > 0:
            return (Decimal(characters) * TTS_RATE_PER_MILLION_CHARS / Decimal('1000000')).quantize(Decimal('0.000001'))
        return calculate_voice_cost(f)

    # Text / LLM path
    in_tokens, out_tokens = FEATURE_TYPICAL_TOKENS.get(f, (1500, 600))
    chosen_model = model or DEFAULT_LLM_MODEL
    return calculate_text_cost(
        raw_tokens=in_tokens + out_tokens,
        model=chosen_model,
        feature=f,
        input_tokens=in_tokens,
        output_tokens=out_tokens,
    )


# ─────────────────────────────────────────────────────────────────────
# Cost type classification
# ─────────────────────────────────────────────────────────────────────

IMAGE_FEATURES = {'image_standard', 'image_hd', 'image'}
VOICE_FEATURES = set(VOICE_FEATURE_CHARS.keys())


def _is_video_feature(feature: str) -> bool:
    return feature.startswith('video_')


def _video_duration_seconds(feature: str) -> int:
    """Extract duration from feature name like 'video_5s' → 5."""
    if not feature.startswith('video_'):
        return 0
    digits = ''.join(ch for ch in feature[6:] if ch.isdigit())
    try:
        return int(digits) if digits else 0
    except ValueError:
        return 0


# ─────────────────────────────────────────────────────────────────────
# Per-transaction cost calculator
# ─────────────────────────────────────────────────────────────────────

def calculate_text_cost(
    raw_tokens: int,
    model: str = DEFAULT_LLM_MODEL,
    feature: str = '',
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> Decimal:
    """Cost for a token-billed LLM call.

    100% ACCURATE PATH: when `input_tokens` and `output_tokens` are provided
    (from the actual API response), uses exact rates per token type. Cache
    reads/writes are billed at their discounted/premium rates if given.

    ESTIMATE PATH: when only `raw_tokens` is given (legacy/old data), splits
    tokens using a per-feature ratio (defaults to 65/35) and applies blended
    input/output rates.
    """
    rates = LLM_RATES.get(model) or LLM_RATES.get(DEFAULT_LLM_MODEL)
    input_rate, output_rate = rates

    # 100% accurate path — exact split from provider API response
    if input_tokens > 0 or output_tokens > 0:
        # Cache read tokens are billed at 0.1× input rate (Anthropic / OpenAI)
        # Cache write tokens (Anthropic) at 1.25× input rate for 5-min cache
        cache_read_rate = input_rate * Decimal('0.10')
        cache_write_rate = input_rate * Decimal('1.25')

        # Subtract cached tokens from regular input (avoid double-billing)
        regular_input = max(0, input_tokens - cache_read_tokens - cache_write_tokens)

        cost = (
            Decimal(regular_input) * input_rate
            + Decimal(cache_read_tokens) * cache_read_rate
            + Decimal(cache_write_tokens) * cache_write_rate
            + Decimal(output_tokens) * output_rate
        ) / Decimal('1000000')
        return cost.quantize(Decimal('0.000001'))

    # Estimate path — only total tokens available (legacy data)
    if raw_tokens <= 0:
        return Decimal('0')

    input_ratio = FEATURE_INPUT_RATIO.get(feature, DEFAULT_INPUT_RATIO)
    output_ratio = Decimal('1') - input_ratio

    tokens = Decimal(raw_tokens)
    est_input = tokens * input_ratio
    est_output = tokens * output_ratio

    cost = (est_input * input_rate + est_output * output_rate) / Decimal('1000000')
    return cost.quantize(Decimal('0.000001'))


def calculate_image_cost(
    feature: str,
    provider: str = '',
    model: str = '',
) -> Decimal:
    """Cost for an image generation. feature is 'image_standard' or 'image_hd'."""
    # Try exact model match first
    if model and model in IMAGE_RATES:
        base = IMAGE_RATES[model]
    else:
        # Fall back to provider default
        default_model = DEFAULT_IMAGE_MODEL_BY_PROVIDER.get(
            (provider or '').lower(),
            'gemini-3.1-flash-image-preview',
        )
        base = IMAGE_RATES.get(default_model, Decimal('0.067'))

    multiplier = IMAGE_QUALITY_MULTIPLIER.get(feature, Decimal('1.0'))
    return (base * multiplier).quantize(Decimal('0.000001'))


def calculate_video_cost(
    feature: str,
    model: str = '',
    duration_override: Optional[int] = None,
) -> Decimal:
    """Cost for a video generation. feature is 'video_5s' / 'video_8s' / etc."""
    duration = duration_override if duration_override is not None else _video_duration_seconds(feature)
    if duration <= 0:
        return Decimal('0')

    rate = VIDEO_RATES_PER_SECOND.get(model)
    if rate is None:
        rate = VIDEO_RATES_PER_SECOND[DEFAULT_VIDEO_MODEL]

    return (rate * Decimal(duration)).quantize(Decimal('0.000001'))


def calculate_voice_cost(feature: str) -> Decimal:
    """Cost for a TTS/voice generation, estimated from feature name."""
    chars = VOICE_FEATURE_CHARS.get(feature, 0)
    if chars <= 0:
        return Decimal('0')
    return (Decimal(chars) * TTS_RATE_PER_MILLION_CHARS / Decimal('1000000')).quantize(Decimal('0.000001'))


def calculate_transaction_cost(transaction) -> Decimal:
    """
    Calculate the actual USD cost for a single DiamondTransaction.

    Routing logic:
        - feature in IMAGE_FEATURES → per-image rate × media_count (default 1)
        - feature starts with 'video_' → per-second rate × duration_seconds
        - feature in VOICE_FEATURES → per-character TTS rate
        - otherwise (text/LLM) → exact input/output rates if available, else
          ratio-based estimate from total tokens
    """
    # Only deductions represent API spend; recharges/grants/refunds are not costs.
    if transaction.transaction_type != 'deduction':
        return Decimal('0')

    feature = (transaction.feature or '').strip().lower()
    provider = (transaction.provider or '').strip().lower()
    model = (transaction.model_used or '').strip()

    # Use raw_cost_usd if explicitly recorded by the caller (most accurate)
    raw_cost = getattr(transaction, 'raw_cost_usd', None)
    if raw_cost and raw_cost > 0:
        return Decimal(raw_cost).quantize(Decimal('0.000001'))

    if feature in IMAGE_FEATURES:
        per_image = calculate_image_cost(feature, provider, model)
        count = max(1, getattr(transaction, 'media_count', 0) or 1)
        return (per_image * count).quantize(Decimal('0.000001'))

    if _is_video_feature(feature):
        # Prefer explicit duration_seconds field; fall back to feature suffix
        duration = getattr(transaction, 'duration_seconds', 0) or 0
        return calculate_video_cost(feature, model, duration_override=duration or None)

    if feature in VOICE_FEATURES:
        return calculate_voice_cost(feature)

    # Text/LLM — prefer exact input/output split when available (100% accurate)
    input_tokens = getattr(transaction, 'input_tokens', 0) or 0
    output_tokens = getattr(transaction, 'output_tokens', 0) or 0
    cache_read = getattr(transaction, 'cache_read_tokens', 0) or 0
    cache_write = getattr(transaction, 'cache_write_tokens', 0) or 0
    raw_tokens = transaction.raw_tokens or 0

    if input_tokens > 0 or output_tokens > 0 or raw_tokens > 0:
        return calculate_text_cost(
            raw_tokens=raw_tokens,
            model=model or DEFAULT_LLM_MODEL,
            feature=feature,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
        )

    # Fallback: no tokens recorded — treat as zero
    return Decimal('0')


# ─────────────────────────────────────────────────────────────────────
# Aggregation helpers
# ─────────────────────────────────────────────────────────────────────

def map_feature_to_provider_category(feature: str, provider: str) -> str:
    """
    Map a (feature, provider) pair to one of the ExpenseEntry categories
    so dynamic costs can be displayed alongside manual entries.

    Categories: openai, gemini, claude, other_api
    """
    p = (provider or '').lower()
    if p in ('openai',):
        return 'openai'
    if p in ('gemini', 'google', 'veo'):
        return 'gemini'
    if p in ('claude', 'anthropic'):
        return 'claude'

    # Image/video features default to gemini (Magic Link primary)
    if feature in IMAGE_FEATURES or _is_video_feature(feature):
        return 'gemini'

    # Embeddings default to openai
    if 'embedding' in feature:
        return 'openai'

    # Text features default to claude (primary LLM)
    return 'claude'


def cost_type_for_feature(feature: str) -> str:
    """Returns 'image' | 'video' | 'voice' | 'text' for grouping."""
    if feature in IMAGE_FEATURES:
        return 'image'
    if _is_video_feature(feature):
        return 'video'
    if feature in VOICE_FEATURES:
        return 'voice'
    return 'text'
