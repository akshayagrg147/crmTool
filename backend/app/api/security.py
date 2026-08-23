import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.security import generate_totp_secret, verify_totp
from app.models.user import User
from app.schemas.workspace import TwoFactorSetupOut, TwoFactorStatusOut
from app.services.audit import record_audit

router = APIRouter(prefix="/security", tags=["security"])


async def _user(current: CurrentUser, db: AsyncSession) -> User:
    user = await db.scalar(select(User).where(User.id == current.id))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("/2fa", response_model=TwoFactorStatusOut)
async def two_factor_status(current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await _user(current, db)
    return TwoFactorStatusOut(enabled=user.two_factor_enabled)


@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
async def two_factor_setup(current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await _user(current, db)
    secret = generate_totp_secret()
    user.two_factor_secret = secret
    user.two_factor_enabled = False
    await db.commit()
    label = urllib.parse.quote(f"TalkoCRM:{user.phone}")
    issuer = urllib.parse.quote("TalkoCRM")
    return TwoFactorSetupOut(secret=secret, otpauth_url=f"otpauth://totp/{label}?secret={secret}&issuer={issuer}")


@router.post("/2fa/enable", response_model=TwoFactorStatusOut)
async def two_factor_enable(code: str, current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await _user(current, db)
    if not verify_totp(user.two_factor_secret, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That authenticator code is invalid or expired")
    user.two_factor_enabled = True
    record_audit(db, organization_id=user.organization_id, actor_id=user.id, entity_type="security", entity_id=user.id, action="2fa_enabled", summary="Two-factor authentication enabled")
    await db.commit()
    return TwoFactorStatusOut(enabled=True)


@router.post("/2fa/disable", response_model=TwoFactorStatusOut)
async def two_factor_disable(code: str, current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await _user(current, db)
    if user.two_factor_enabled and not verify_totp(user.two_factor_secret, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That authenticator code is invalid or expired")
    user.two_factor_enabled = False
    user.two_factor_secret = None
    record_audit(db, organization_id=user.organization_id, actor_id=user.id, entity_type="security", entity_id=user.id, action="2fa_disabled", summary="Two-factor authentication disabled")
    await db.commit()
    return TwoFactorStatusOut(enabled=False)
