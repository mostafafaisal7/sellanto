# accounts/encryption.py
"""Fernet symmetric encryption for sensitive fields (API keys, etc.).

WARNING: If Django SECRET_KEY changes, all encrypted values become unreadable.
Admin must re-enter API keys after SECRET_KEY rotation.
"""

import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _derive_fernet_key() -> bytes:
    """Derive a Fernet-compatible 32-byte key from Django SECRET_KEY."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string, return base64-encoded ciphertext."""
    if not plaintext:
        return ''
    f = Fernet(_derive_fernet_key())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted value back to plaintext."""
    if not ciphertext:
        return ''
    f = Fernet(_derive_fernet_key())
    return f.decrypt(ciphertext.encode()).decode()
