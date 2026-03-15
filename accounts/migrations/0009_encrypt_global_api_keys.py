"""Data migration: encrypt existing plaintext API keys with Fernet."""

from django.db import migrations


def encrypt_existing_keys(apps, schema_editor):
    """Encrypt any existing plaintext API keys using Fernet."""
    import base64
    import hashlib
    from cryptography.fernet import Fernet, InvalidToken
    from django.conf import settings

    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    f = Fernet(fernet_key)

    GlobalAPIKey = apps.get_model('accounts', 'GlobalAPIKey')
    for gk in GlobalAPIKey.objects.all():
        if not gk.api_key:
            continue
        # Skip if already encrypted (Fernet tokens start with 'gAAAAA')
        try:
            f.decrypt(gk.api_key.encode())
            continue  # Already encrypted
        except (InvalidToken, Exception):
            pass
        gk.api_key = f.encrypt(gk.api_key.encode()).decode()
        gk.save(update_fields=['api_key'])


def decrypt_existing_keys(apps, schema_editor):
    """Reverse: decrypt keys back to plaintext."""
    import base64
    import hashlib
    from cryptography.fernet import Fernet
    from django.conf import settings

    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    f = Fernet(fernet_key)

    GlobalAPIKey = apps.get_model('accounts', 'GlobalAPIKey')
    for gk in GlobalAPIKey.objects.all():
        if not gk.api_key:
            continue
        try:
            gk.api_key = f.decrypt(gk.api_key.encode()).decode()
            gk.save(update_fields=['api_key'])
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0008_alter_systemnotification_event_type_diamondwallet_and_more'),
    ]

    operations = [
        migrations.RunPython(encrypt_existing_keys, decrypt_existing_keys),
    ]
