import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_super_admin
from app.core.security import create_impersonation_token, hash_password
from app.core.config import settings
from app.models.distribution_settings import DistributionSettings
from app.models.lead import Lead
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.auth import TokenPair
from app.schemas.organization import (
    ImpersonateRequest,
    OrganizationCreate,
    OrganizationDetailsOut,
    OrganizationMemberOut,
    OrganizationOut,
    OrganizationUpdate,
    PlatformStats,
)
from app.services.object_storage import ObjectStorageError, delete_object, upload_logo as upload_logo_to_s3
from app.api.branding import logo_proxy_url

router = APIRouter(prefix="/super-admin", tags=["super-admin"])

LOGO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
LOGO_EXTENSIONS = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def _logo_content_type(file: UploadFile) -> tuple[str, str] | None:
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if content_type in LOGO_TYPES:
        return content_type, LOGO_TYPES[content_type]
    suffix = Path(file.filename or "").suffix.lower()
    inferred_type = LOGO_EXTENSIONS.get(suffix)
    if inferred_type:
        return inferred_type, LOGO_TYPES[inferred_type]
    return None


async def _organization_details(org: Organization, db: AsyncSession) -> OrganizationDetailsOut:
    members_result = await db.execute(
        select(User)
        .where(User.organization_id == org.id)
        .order_by(User.role, User.created_at)
    )
    members = [OrganizationMemberOut.model_validate(member) for member in members_result.scalars().all()]
    lead_count = (await db.execute(
        select(func.count()).select_from(Lead).where(Lead.organization_id == org.id)
    )).scalar_one()

    return OrganizationDetailsOut(
        id=org.id,
        name=org.name,
        logo_url=org.logo_url,
        is_active=org.is_active,
        plan=org.plan,
        created_at=org.created_at,
        user_count=len(members),
        lead_count=lead_count,
        members=members,
    )


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


@router.get("/organizations/{org_id}", response_model=OrganizationDetailsOut)
async def get_organization(
    org_id: uuid.UUID,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    return await _organization_details(org, db)


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


@router.post("/organizations/{org_id}/logo", response_model=OrganizationOut)
async def upload_organization_logo(
    org_id: uuid.UUID,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    content_info = _logo_content_type(file)
    if content_info is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Logo must be a PNG, JPG, or WebP image")
    content_type, extension = content_info
    # Read only one byte past the configured limit so an oversized multipart
    # upload cannot consume unbounded memory before we reject it.
    content = await file.read(settings.max_logo_size_bytes + 1)
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The selected logo is empty")
    if len(content) > settings.max_logo_size_bytes:
        limit_mb = settings.max_logo_size_bytes // (1024 * 1024)
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Logo must be smaller than {limit_mb} MB")

    storage_key = f"organizations/{org.id}/logo/{uuid.uuid4()}{extension}"
    try:
        await asyncio.to_thread(upload_logo_to_s3, storage_key, content, content_type)
    except ObjectStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    previous_key = org.logo_storage_key
    org.logo_storage_key = storage_key
    org.logo_url = logo_proxy_url(org.id)
    try:
        await db.commit()
        await db.refresh(org)
    except Exception:
        await db.rollback()
        try:
            await asyncio.to_thread(delete_object, storage_key)
        except ObjectStorageError:
            pass
        raise

    if previous_key:
        try:
            await asyncio.to_thread(delete_object, previous_key)
        except ObjectStorageError:
            # The new logo is already active. A failed cleanup should not make
            # an otherwise successful branding update look like a failure.
            pass

    return org


@router.delete("/organizations/{org_id}/logo", response_model=OrganizationOut)
async def delete_organization_logo(
    org_id: uuid.UUID,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    previous_key = org.logo_storage_key
    if previous_key:
        try:
            await asyncio.to_thread(delete_object, previous_key)
        except ObjectStorageError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    org.logo_storage_key = None
    org.logo_url = None
    await db.commit()
    await db.refresh(org)
    return org


@router.patch("/organizations/{org_id}", response_model=OrganizationDetailsOut)
async def update_organization(
    org_id: uuid.UUID,
    payload: OrganizationUpdate,
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    admin_result = await db.execute(
        select(User)
        .where(User.organization_id == org.id, User.role == UserRole.admin)
        .order_by(User.created_at)
    )
    admin = admin_result.scalars().first()
    if admin is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This organization has no administrator to update")

    duplicate_phone = await db.execute(
        select(User.id).where(User.phone == payload.admin_phone.strip(), User.id != admin.id)
    )
    if duplicate_phone.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this phone number already exists")

    org.name = payload.name.strip()
    org.plan = payload.plan
    admin.name = payload.admin_name.strip()
    admin.phone = payload.admin_phone.strip()
    admin.email = str(payload.admin_email) if payload.admin_email else None
    if payload.admin_password:
        admin.password_hash = hash_password(payload.admin_password)
    await db.commit()
    await db.refresh(org)
    return await _organization_details(org, db)


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: uuid.UUID,
    confirm_name: str = Query(min_length=1),
    current: CurrentUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    if confirm_name != org.name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Organization name confirmation does not match")

    if org.logo_storage_key:
        try:
            await asyncio.to_thread(delete_object, org.logo_storage_key)
        except ObjectStorageError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    # Use a database delete so every organization-owned record follows its
    # foreign-key ON DELETE CASCADE policy in one transaction.
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


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
