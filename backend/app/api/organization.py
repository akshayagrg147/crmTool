from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_org_user
from app.models.organization import Organization
from app.schemas.organization import MyOrganizationOut, MyOrganizationUpdate

router = APIRouter(prefix="/organization", tags=["organization"])


@router.get("", response_model=MyOrganizationOut)
async def get_my_organization(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.id == current.organization_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return org


@router.patch("", response_model=MyOrganizationOut)
async def update_my_organization(
    payload: MyOrganizationUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current.organization_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    org.name = payload.name
    await db.commit()
    await db.refresh(org)
    return org
