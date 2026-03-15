# accounts/api_keys.py
# Centralized API key management — Global admin keys only (database)
# No .env or settings.py fallback — keys must be set via admin panel


def get_openai_key(user=None):
    """Get OpenAI API key from global admin config. Database only."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='openai', is_active=True)
        return gk.get_key() or None
    except Exception:
        return None


def get_gemini_key(user=None):
    """Get Gemini API key from global admin config. Database only."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='gemini', is_active=True)
        return gk.get_key() or None
    except Exception:
        return None


def get_claude_key(user=None):
    """Get Claude API key from global admin config. Database only."""
    try:
        from accounts.models import GlobalAPIKey
        gk = GlobalAPIKey.objects.get(provider='claude', is_active=True)
        return gk.get_key() or None
    except Exception:
        return None


def mask_key(key):
    """Return masked version of API key for display."""
    if not key:
        return ''
    if len(key) > 8:
        return key[:4] + '*' * (len(key) - 8) + key[-4:]
    return '****'
