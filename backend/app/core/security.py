import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(subject: str, role: str, organization_id: str | None, expires_delta: timedelta, token_type: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "org_id": organization_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, role: str, organization_id: str | None, extra: dict | None = None) -> str:
    return _create_token(
        user_id, role, organization_id,
        timedelta(minutes=settings.access_token_expire_minutes), "access", extra,
    )


def create_refresh_token(user_id: str, role: str, organization_id: str | None) -> str:
    return _create_token(
        user_id, role, organization_id,
        timedelta(days=settings.refresh_token_expire_days), "refresh",
    )


def create_impersonation_token(user_id: str, role: str, organization_id: str | None, impersonated_by: str) -> str:
    return _create_token(
        user_id, role, organization_id,
        timedelta(minutes=settings.impersonation_token_expire_minutes), "access",
        extra={"impersonated_by": impersonated_by},
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("invalid token") from exc


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret: str, timestamp: int | None = None) -> str:
    timestamp = int(time.time()) if timestamp is None else timestamp
    counter = timestamp // 30
    padded = secret + "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 1_000_000:06d}"


def verify_totp(secret: str | None, code: str) -> bool:
    if not secret or len(code.strip()) != 6 or not code.strip().isdigit():
        return False
    now = int(time.time())
    return any(hmac.compare_digest(totp_code(secret, now + offset), code.strip()) for offset in (-30, 0, 30))
