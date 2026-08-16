"""Symmetric encryption for third-party credentials stored in the database.

Integration API keys are tenant-owned secrets. They are encrypted at rest so a
database dump alone does not hand over every customer's IndiaMART / JustDial
account.
"""
import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    # Fernet needs a 32-byte urlsafe-base64 key; hashing lets any passphrase work.
    secret = settings.integration_encryption_key or settings.jwt_secret
    digest = hashlib.sha256(secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_json(data: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_json(token: str | None) -> dict[str, Any]:
    """Returns {} rather than raising if the blob is missing or undecryptable.

    An unreadable blob means the encryption key changed; callers surface that as
    "reconnect this integration" instead of a 500.
    """
    if not token:
        return {}
    try:
        return json.loads(_fernet().decrypt(token.encode()).decode())
    except (InvalidToken, ValueError):
        return {}


def mask(value: str | None, keep: int = 4) -> str:
    """Renders a credential for display: '••••••••3f2a'. Never returns the full value."""
    if not value:
        return ""
    tail = value[-keep:] if len(value) > keep else ""
    return "•" * 8 + tail
