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
