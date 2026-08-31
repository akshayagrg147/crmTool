import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, CurrentUser
from app.core.limiter import limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password, verify_totp
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ImpersonationInfo,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _phone_candidates(phone: str, country_code: str | None) -> list[str]:
    """Build compatible phone variants without changing existing user records.

    TalkoCRM historically stores Indian numbers as bare ten-digit strings,
    while newer users may enter an international/E.164 number. Keeping the
    variants here lets the login country selector work with both formats.
    """
    raw = phone.strip()
    candidates: list[str] = []

    def add(value: str) -> None:
        if value and value not in candidates:
            candidates.append(value)

    add(raw)
    digits = re.sub(r"\D", "", raw)
    add(digits)

    dial_digits = re.sub(r"\D", "", country_code or "")
    if dial_digits and digits:
        local_digits = digits
        if local_digits.startswith(dial_digits) and len(local_digits) > len(dial_digits):
            local_digits = local_digits[len(dial_digits) :]
        if local_digits.startswith("0") and len(local_digits) > 1:
            local_digits = local_digits[1:]
        add(f"+{dial_digits}{local_digits}")
        add(f"{dial_digits}{local_digits}")

    return candidates


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    candidates = _phone_candidates(payload.phone, payload.country_code)
    result = await db.execute(select(User).where(User.phone.in_(candidates)))
    users_by_phone = {user.phone: user for user in result.scalars().all()}
    user = next((users_by_phone[value] for value in candidates if value in users_by_phone), None)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone number or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your account has been deactivated")
    if user.two_factor_enabled and not verify_totp(user.two_factor_secret, payload.otp or ""):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, {"code": "two_factor_required", "message": "Enter the six-digit authenticator code"})

    org_name = None
    org_logo_url = None
    if user.organization_id:
        org_result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
        org = org_result.scalar_one_or_none()
        if org is None or not org.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This organization has been suspended")
        org_name = org.name
        org_logo_url = org.logo_url

    org_id_str = str(user.organization_id) if user.organization_id else None
    access = create_access_token(str(user.id), user.role.value, org_id_str)
    refresh = create_refresh_token(str(user.id), user.role.value, org_id_str)
    return LoginResponse(
        tokens=TokenPair(access_token=access, refresh_token=refresh),
        user=UserOut.model_validate(user),
        organization_name=org_name,
        organization_logo_url=org_logo_url,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    if data.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    result = await db.execute(select(User).where(User.id == data["sub"]))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    org_id_str = str(user.organization_id) if user.organization_id else None
    access = create_access_token(str(user.id), user.role.value, org_id_str)
    new_refresh = create_refresh_token(str(user.id), user.role.value, org_id_str)
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.get("/me", response_model=UserOut)
async def get_me(current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == current.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserOut.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()


@router.get("/impersonation-status", response_model=ImpersonationInfo)
async def impersonation_status(current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current.impersonated_by:
        return ImpersonationInfo(is_impersonating=False)
    result = await db.execute(select(User).where(User.id == current.impersonated_by))
    impersonator = result.scalar_one_or_none()
    return ImpersonationInfo(
        is_impersonating=True,
        impersonated_by_name=impersonator.name if impersonator else "Super Admin",
    )
