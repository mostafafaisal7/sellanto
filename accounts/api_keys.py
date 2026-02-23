# accounts/api_keys.py
# Centralized API key management - "Enter once, works everywhere"

from django.conf import settings as django_settings


def sync_openai_key(user, raw_key):
    """Save OpenAI API key to ALL features that use it"""
    if not raw_key:
        return

    # 1. AI Caption (base64 encoded)
    from ai_caption.models import UserAPISettings
    caption_settings, _ = UserAPISettings.objects.get_or_create(user=user)
    caption_settings.set_openai_api_key(raw_key)
    caption_settings.save()

    # 2. AI Voice (plain text)
    from ai_voice.models import UserVoiceSettings
    voice_settings, _ = UserVoiceSettings.objects.get_or_create(user=user)
    voice_settings.openai_api_key = raw_key
    voice_settings.save()

    # 3. AI Image (base64 encoded)
    from ai_image.models import UserImageSettings
    image_settings, _ = UserImageSettings.objects.get_or_create(user=user)
    image_settings.set_openai_api_key(raw_key)
    image_settings.save()


def sync_gemini_key(user, raw_key):
    """Save Gemini API key to ALL features that use it"""
    if not raw_key:
        return

    # 1. AI Image (base64 encoded)
    from ai_image.models import UserImageSettings
    image_settings, _ = UserImageSettings.objects.get_or_create(user=user)
    image_settings.set_gemini_api_key(raw_key)
    image_settings.save()

    # 2. AI Video (base64 encoded)
    from ai_video.models import UserVideoSettings
    video_settings, _ = UserVideoSettings.objects.get_or_create(user=user)
    video_settings.set_gemini_api_key(raw_key)
    video_settings.save()


def get_openai_key(user):
    """Get OpenAI API key from any available source.
    Checks all feature settings, returns first non-null key found."""

    # 1. AI Caption (base64)
    try:
        key = user.api_settings.get_openai_api_key()
        if key:
            return key
    except Exception:
        pass

    # 2. AI Voice (plain text)
    try:
        key = user.voice_settings.openai_api_key
        if key:
            return key
    except Exception:
        pass

    # 3. AI Image (base64)
    try:
        key = user.image_settings.get_openai_api_key()
        if key:
            return key
    except Exception:
        pass

    # 4. Messenger Bot AIConfiguration
    try:
        from messenger_bot.models import AIConfiguration
        ai_config = AIConfiguration.objects.filter(
            connection__user=user
        ).first()
        if ai_config and ai_config.openai_api_key:
            return ai_config.openai_api_key
    except Exception:
        pass

    # 5. Fallback to Django settings
    fallback = getattr(django_settings, 'OPENAI_API_KEY', '')
    return fallback if fallback else None


def get_gemini_key(user):
    """Get Gemini API key from any available source.
    Checks all feature settings, returns first non-null key found."""

    # 1. AI Image (base64)
    try:
        key = user.image_settings.get_gemini_api_key()
        if key:
            return key
    except Exception:
        pass

    # 2. AI Video (base64)
    try:
        key = user.video_settings.get_gemini_api_key()
        if key:
            return key
    except Exception:
        pass

    # 3. Fallback to Django settings
    fallback = getattr(django_settings, 'GEMINI_API_KEY', '')
    return fallback if fallback else None


def mask_key(key):
    """Return masked version of API key for display"""
    if not key:
        return ''
    if len(key) > 8:
        return key[:4] + '*' * (len(key) - 8) + key[-4:]
    return '****'
