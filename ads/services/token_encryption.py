"""
Token encryption helpers for ad-account credentials.

Meta System User tokens never expire — losing one means a user has to re-OAuth.
Google refresh tokens last until revoked. Both are bearer credentials that grant
full access to a user's ad account, so they MUST be encrypted at rest.

Key derivation: we derive a Fernet key from Django's SECRET_KEY so rotating
SECRET_KEY invalidates all stored tokens (forces re-auth, which is desirable
during a key-rotation security event).
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _get_fernet() -> Fernet:
    """Derive a deterministic Fernet key from SECRET_KEY.

    Fernet keys must be 32 url-safe base64-encoded bytes. We SHA-256 hash
    SECRET_KEY (which is arbitrary length) and base64-encode the digest.
    """
    digest = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a token string. Returns base64-encoded ciphertext (str)."""
    if not plaintext:
        return ''
    return _get_fernet().encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a token. Returns empty string on failure (logged elsewhere)."""
    if not ciphertext:
        return ''
    try:
        return _get_fernet().decrypt(ciphertext.encode('utf-8')).decode('utf-8')
    except InvalidToken:
        return ''
