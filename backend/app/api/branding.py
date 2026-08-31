"""Public, read-only organization branding assets."""

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.organization import Organization
from app.services.object_storage import ObjectStorageError, presigned_download_url

router = APIRouter(prefix="/branding", tags=["branding"])


def logo_proxy_url(organization_id: uuid.UUID) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/branding/organizations/{organization_id}/logo"


@router.get("/organizations/{organization_id}/logo", include_in_schema=False)
async def organization_logo(organization_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    organization = await db.scalar(select(Organization).where(Organization.id == organization_id))
    if organization is None or not organization.logo_storage_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization logo not found")
    try:
        download_url = await asyncio.to_thread(presigned_download_url, organization.logo_storage_key)
    except ObjectStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return RedirectResponse(
        download_url,
        status_code=status.HTTP_302_FOUND,
        headers={"Cache-Control": "public, max-age=3600"},
    )
