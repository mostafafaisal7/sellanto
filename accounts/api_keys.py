# accounts/api_keys.py
# Centralized API key management — Global admin keys for all users

from django.conf import settings as django_settings


def get_openai_key(user=None):
    """Get OpenAI API key from global admin config or Django settings.
    Keys are now admin-managed globally — no per-user keys."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='openai', is_active=True)
        if gk.api_key:
            return gk.api_key
    except Exception:
        pass
    fallback = getattr(django_settings, 'OPENAI_API_KEY', '')
    return fallback if fallback else None


def get_gemini_key(user=None):
    """Get Gemini API key from global admin config or Django settings.
    Keys are now admin-managed globally — no per-user keys."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='gemini', is_active=True)
        if gk.api_key:
            return gk.api_key
    except Exception:
        pass
    fallback = getattr(django_settings, 'GEMINI_API_KEY', '')
    return fallback if fallback else None


def get_claude_key(user=None):
    """Get Claude API key from global admin config or Django settings."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='claude', is_active=True)
        if gk.api_key:
            return gk.api_key
    except Exception:
        pass
    key = getattr(django_settings, 'ANTHROPIC_API_KEY', '')
    return key if key else None


def mask_key(key):
    """Return masked version of API key for display."""
    if not key:
        return ''
    if len(key) > 8:
        return key[:4] + '*' * (len(key) - 8) + key[-4:]
    return '****'
