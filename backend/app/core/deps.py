import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import UserRole

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: uuid.UUID
    role: UserRole
    organization_id: uuid.UUID | None
    impersonated_by: uuid.UUID | None = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
    org_id = payload.get("org_id")
    impersonated_by = payload.get("impersonated_by")
    return CurrentUser(
        id=uuid.UUID(payload["sub"]),
        role=UserRole(payload["role"]),
        organization_id=uuid.UUID(org_id) if org_id else None,
        impersonated_by=uuid.UUID(impersonated_by) if impersonated_by else None,
    )


async def require_org_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Any authenticated org-scoped user (admin/manager/telecaller). Bars super_admin from org routes."""
    if user.role == UserRole.super_admin or user.organization_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin cannot access org-scoped routes")
    return user


async def require_admin_or_manager(user: CurrentUser = Depends(require_org_user)) -> CurrentUser:
    if user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin or manager role required")
    return user


async def require_admin(user: CurrentUser = Depends(require_org_user)) -> CurrentUser:
    if user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


async def require_super_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != UserRole.super_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super admin role required")
    return user


DbSession = AsyncSession
