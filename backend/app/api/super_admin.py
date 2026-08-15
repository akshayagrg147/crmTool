import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_super_admin
from app.core.security import create_impersonation_token, hash_password
from app.models.distribution_settings import DistributionSettings
from app.models.lead import Lead
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.auth import TokenPair
from app.schemas.organization import ImpersonateRequest, OrganizationCreate, OrganizationOut, PlatformStats

router = APIRouter(prefix="/super-admin", tags=["super-admin"])


@router.get("/organizations", response_model=list[OrganizationOut])
async def list_organizations(current: CurrentUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
    orgs = list(result.scalars().all())
    out = []
    for org in orgs:
        user_count = (await db.execute(
            select(func.count()).select_from(User).where(User.organization_id == org.id)
        )).scalar_one()
        lead_count = (await db.execute(
            select(func.count()).select_from(Lead).where(Lead.organization_id == org.id)
        )).scalar_one()
        item = OrganizationOut.model_validate(org)
        item.user_count = user_count
        item.lead_count = lead_count
        out.append(item)
    return out


@router.post("/organizations", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.phone == payload.admin_phone))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this phone number already exists")

    org = Organization(name=payload.name, is_active=True, plan="trial")
    db.add(org)
    await db.flush()

    admin = User(
        organization_id=org.id,
        name=payload.admin_name,
        phone=payload.admin_phone,
        email=payload.admin_email,
        password_hash=hash_password(payload.admin_password),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    db.add(DistributionSettings(organization_id=org.id, rotation_index=0))
    await db.commit()
    await db.refresh(org)

    out = OrganizationOut.model_validate(org)
    out.user_count = 1
    out.lead_count = 0
    return out


@router.post("/organizations/{org_id}/suspend", response_model=OrganizationOut)
async def suspend_organization(
    org_id: uuid.UUID,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    org.is_active = False
    await db.commit()
    await db.refresh(org)
    out = OrganizationOut.model_validate(org)
    return out


@router.post("/organizations/{org_id}/reactivate", response_model=OrganizationOut)
async def reactivate_organization(
    org_id: uuid.UUID,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    org.is_active = True
    await db.commit()
    await db.refresh(org)
    out = OrganizationOut.model_validate(org)
    return out


@router.get("/stats", response_model=PlatformStats)
async def platform_stats(current: CurrentUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar_one()
    active_orgs = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.is_active.is_(True))
    )).scalar_one()
    total_users = (await db.execute(
        select(func.count()).select_from(User).where(User.role != UserRole.super_admin)
    )).scalar_one()
    total_leads = (await db.execute(select(func.count()).select_from(Lead))).scalar_one()

    now = datetime.now(timezone.utc)
    growth = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        count = (await db.execute(
            select(func.count()).select_from(Organization).where(Organization.created_at < month_start + timedelta(days=31))
        )).scalar_one()
        growth.append({"month": month_start.strftime("%b %Y"), "organizations": count})

    return PlatformStats(
        total_organizations=total_orgs,
        total_users=total_users,
        total_leads=total_leads,
        active_organizations=active_orgs,
        growth=growth,
    )


@router.post("/impersonate", response_model=TokenPair)
async def impersonate(
    payload: ImpersonateRequest,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.organization_id == payload.organization_id, User.role == UserRole.admin)
        .order_by(User.created_at)
    )
    admin = result.scalars().first()
    if admin is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This organization has no admin to impersonate")

    org_result = await db.execute(select(Organization).where(Organization.id == payload.organization_id))
    org = org_result.scalar_one_or_none()
    if org is None or not org.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot impersonate a suspended organization")

    access = create_impersonation_token(str(admin.id), admin.role.value, str(admin.organization_id), str(current.id))
    return TokenPair(access_token=access, refresh_token="")
