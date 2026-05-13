"""
Stripe configuration accessor — DB-first with env fallback.

Why this exists:
  - Admins should be able to rotate Stripe keys + price IDs from the
    Admin Panel without touching env files or restarting the server.
  - We still want env vars to work in dev / CI / first-boot before the
    admin has logged in to configure anything.

Resolution order for every config value:
  1. SiteConfiguration row with the matching `key` (admin-editable)
  2. Django settings.STRIPE_* (env-backed)
  3. Empty string

All Stripe code (stripe_service.py) MUST go through this module so that
DB-stored values take effect immediately on save without a restart.
"""

from __future__ import annotations

from django.conf import settings

from accounts.models import SiteConfiguration


# Map config key → (SiteConfiguration key, fallback settings attribute, description)
# `description` lands in the SiteConfiguration row to give admins context.
_CONFIG_SCHEMA: dict[str, tuple[str, str, str]] = {
    'publishable_key':         ('stripe_publishable_key',        'STRIPE_PUBLISHABLE_KEY',
                                'Stripe Publishable Key (pk_test_… or pk_live_…). Safe to expose to the browser.'),
    'secret_key':              ('stripe_secret_key',             'STRIPE_SECRET_KEY',
                                'Stripe Secret Key (sk_test_… or sk_live_…). Server-side only — keep private.'),
    'webhook_secret':          ('stripe_webhook_secret',         'STRIPE_WEBHOOK_SECRET',
                                'Webhook signing secret (whsec_…). One per registered endpoint.'),
    'price_pro_monthly':       ('stripe_price_pro_monthly',      'STRIPE_PRICE_PRO_MONTHLY',
                                'Stripe Price ID for the Pro plan billed monthly (price_…).'),
    'price_pro_yearly':        ('stripe_price_pro_yearly',       'STRIPE_PRICE_PRO_YEARLY',
                                'Stripe Price ID for the Pro plan billed yearly (price_…).'),
    'price_business_monthly':  ('stripe_price_business_monthly', 'STRIPE_PRICE_BUSINESS_MONTHLY',
                                'Stripe Price ID for the Business plan billed monthly (price_…).'),
    'price_business_yearly':   ('stripe_price_business_yearly',  'STRIPE_PRICE_BUSINESS_YEARLY',
                                'Stripe Price ID for the Business plan billed yearly (price_…).'),
    'price_topup_1k':          ('stripe_price_topup_1k',         'STRIPE_PRICE_TOPUP_1K',
                                'Stripe Price ID for the 1,000-diamond top-up ($10, one-time).'),
    'price_topup_5k':          ('stripe_price_topup_5k',         'STRIPE_PRICE_TOPUP_5K',
                                'Stripe Price ID for the 5,000-diamond top-up ($45, one-time).'),
    'price_topup_10k':         ('stripe_price_topup_10k',        'STRIPE_PRICE_TOPUP_10K',
                                'Stripe Price ID for the 10,000-diamond top-up ($85, one-time).'),
    'price_topup_25k':         ('stripe_price_topup_25k',        'STRIPE_PRICE_TOPUP_25K',
                                'Stripe Price ID for the 25,000-diamond top-up ($200, one-time).'),

    # Pricing — flexible top-up rate. Not a Stripe ID; lives here so the
    # admin can adjust it from the same Stripe Settings page.
    'diamonds_per_dollar':     ('diamonds_per_dollar',           'DIAMONDS_PER_DOLLAR',
                                'Diamonds granted per USD on flexible top-up (default 100 = $0.01 / diamond).'),
}


# Keys whose values are secrets — masked in admin GET responses.
SECRET_KEYS = {'secret_key', 'webhook_secret'}

# Public list of admin-facing keys with metadata. Used by the admin UI
# to render the form without hardcoding field names there too.
ADMIN_FIELDS: list[dict[str, str]] = [
    {
        'key': name,
        'site_config_key': site_key,
        'env_var': env_attr,
        'description': desc,
        'is_secret': name in SECRET_KEYS,
    }
    for name, (site_key, env_attr, desc) in _CONFIG_SCHEMA.items()
]


def _resolve(name: str) -> str:
    """Resolve a single config key: DB first, then settings, then empty."""
    site_key, env_attr, _desc = _CONFIG_SCHEMA[name]
    db_value = SiteConfiguration.get(site_key, '')
    if db_value:
        return db_value
    return getattr(settings, env_attr, '') or ''


# ---------------------------------------------------------------------------
# Public getters — these replace direct settings.STRIPE_* reads
# ---------------------------------------------------------------------------

def publishable_key() -> str:
    return _resolve('publishable_key')


def secret_key() -> str:
    return _resolve('secret_key')


def webhook_secret() -> str:
    return _resolve('webhook_secret')


def price_id(plan: str, billing_cycle: str) -> str:
    name = f'price_{plan}_{billing_cycle}'
    if name not in _CONFIG_SCHEMA:
        return ''
    return _resolve(name)


def topup_price_id(sku_short: str) -> str:
    """`sku_short` is one of {'1k','5k','10k','25k'}."""
    name = f'price_topup_{sku_short}'
    if name not in _CONFIG_SCHEMA:
        return ''
    return _resolve(name)


def api_version() -> str:
    # Pinned in code — admins don't edit API versions from the UI.
    return getattr(settings, 'STRIPE_API_VERSION', '2024-10-28.acacia')


# Min/max bounds on flexible top-up — protects against accidental zeroes
# and runaway charges. Stripe minimum charge is $0.50 in USD so $1 is a
# safe floor that leaves headroom.
TOPUP_MIN_USD = 1
TOPUP_MAX_USD = 10_000

# Bounds on the admin-editable rate. 1 = "$1 = 1 diamond" (terrible deal),
# 10000 = "$1 = 10,000 diamonds" (unreasonably generous). Default 100 keeps
# diamonds at $0.01 each.
RATE_DEFAULT = 100
RATE_MIN = 1
RATE_MAX = 10_000


def diamonds_per_dollar() -> int:
    """Resolve the flexible top-up rate. DB-first, env fallback, then default.

    Returns a positive int. Clamped to [RATE_MIN, RATE_MAX].
    """
    raw = _resolve('diamonds_per_dollar')
    try:
        value = int(raw) if raw else RATE_DEFAULT
    except (TypeError, ValueError):
        value = RATE_DEFAULT
    if value < RATE_MIN:
        return RATE_MIN
    if value > RATE_MAX:
        return RATE_MAX
    return value


def success_url() -> str:
    return getattr(settings, 'STRIPE_SUCCESS_URL', '')


def cancel_url() -> str:
    return getattr(settings, 'STRIPE_CANCEL_URL', '')


# ---------------------------------------------------------------------------
# Admin helpers
# ---------------------------------------------------------------------------

def describe_for_admin() -> list[dict[str, str | bool]]:
    """Return one row per editable Stripe config key for the admin UI.

    Includes:
      - current value (masked if secret)
      - source: 'db' if a SiteConfiguration row supplies it, 'env' if it's
        coming from the env file, '' if unset.
    """
    out = []
    for name, (site_key, env_attr, description) in _CONFIG_SCHEMA.items():
        db_value = SiteConfiguration.get(site_key, '')
        env_value = getattr(settings, env_attr, '') or ''
        effective = db_value or env_value
        source = 'db' if db_value else ('env' if env_value else '')
        is_secret = name in SECRET_KEYS
        out.append({
            'key':             name,
            'site_config_key': site_key,
            'env_var':         env_attr,
            'description':     description,
            'is_secret':       is_secret,
            'is_set':          bool(effective),
            'value':           _mask(effective) if is_secret else effective,
            'source':          source,
        })
    return out


def update_from_admin(payload: dict) -> dict:
    """Persist any provided Stripe config values into SiteConfiguration.

    Returns `{'updated': [...keys...], 'errors': [...]}`. Empty-string
    values clear the row (so admins can fall back to env).
    """
    updated: list[str] = []
    errors: list[str] = []
    for name, (site_key, _env_attr, description) in _CONFIG_SCHEMA.items():
        if name not in payload:
            continue
        value = '' if payload[name] is None else str(payload[name]).strip()
        try:
            SiteConfiguration.set(site_key, value, description)
            updated.append(name)
        except Exception as exc:  # noqa: BLE001
            errors.append(f'Could not save {name}: {exc}')
    return {'updated': updated, 'errors': errors}


def is_fully_configured() -> bool:
    """True if the minimum keys needed for any charge are present."""
    return all([publishable_key(), secret_key(), webhook_secret()])


def _mask(value: str) -> str:
    if not value:
        return ''
    if len(value) <= 8:
        return '•' * len(value)
    return '•' * (len(value) - 6) + value[-6:]
