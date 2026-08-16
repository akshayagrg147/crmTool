import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_admin_or_manager
from app.models.call_log import CallLog
from app.models.lead import Lead, LeadStatus
from app.schemas.lost_deal import (
    BulkDeleteLostDealsOut,
    BulkDeleteLostDealsRequest,
    LostDealOut,
    PaginatedLostDeals,
)

router = APIRouter(prefix="/lost-deals", tags=["lost-deals"])


@router.get("", response_model=PaginatedLostDeals)
async def list_lost_deals(
    telecaller_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    latest_lost = (
        select(CallLog.lead_id, func.max(CallLog.created_at).label("lost_at"))
        .where(CallLog.outcome == LeadStatus.lost)
        .group_by(CallLog.lead_id)
        .subquery()
    )
    stmt = (
        select(Lead)
        .join(latest_lost, latest_lost.c.lead_id == Lead.id)
        .where(Lead.organization_id == current.organization_id, Lead.status == LeadStatus.lost)
    )
    if telecaller_id is not None:
        stmt = stmt.where(
            Lead.id.in_(
                select(CallLog.lead_id).where(
                    CallLog.logged_by == telecaller_id,
                    CallLog.outcome == LeadStatus.lost,
                )
            )
        )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.phone.ilike(like), Lead.city.ilike(like)))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    result = await db.execute(
        stmt.options(
            selectinload(Lead.assignee),
            selectinload(Lead.call_logs).selectinload(CallLog.logger),
        )
        .order_by(latest_lost.c.lost_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    leads = list(result.scalars().unique().all())

    items = []
    for lead in leads:
        lost_call = next((call for call in lead.call_logs if call.outcome == LeadStatus.lost), None)
        items.append(
            LostDealOut(
                id=lead.id,
                name=lead.name,
                phone=lead.phone,
                city=lead.city,
                state=lead.state,
                source=lead.source,
                status=lead.status,
                category=lead.custom_category or lead.category.value,
                interested_categories=lead.interested_categories or [lead.custom_category or lead.category.value],
                assigned_to=lead.assigned_to,
                assignee_name=lead.assignee.name if lead.assignee else None,
                lost_by=lost_call.logged_by if lost_call else None,
                lost_by_name=lost_call.logger.name if lost_call and lost_call.logger else None,
                lost_reason=lost_call.notes if lost_call else None,
                lost_at=lost_call.created_at if lost_call else None,
                created_at=lead.created_at,
            )
        )

    return PaginatedLostDeals(items=items, total=total, page=page, page_size=page_size)


async def _delete_lost_deals(
    ids: list[uuid.UUID],
    current: CurrentUser,
    db: AsyncSession,
) -> BulkDeleteLostDealsOut:
    unique_ids = list(dict.fromkeys(ids))
    result = await db.execute(
        select(Lead).where(
            Lead.id.in_(unique_ids),
            Lead.organization_id == current.organization_id,
            Lead.status == LeadStatus.lost,
        )
    )
    leads = list(result.scalars().all())
    if len(leads) != len(unique_ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "One or more selected lost deals were not found or are no longer marked as lost.",
        )

    for lead in leads:
        await db.delete(lead)
    await db.commit()
    return BulkDeleteLostDealsOut(deleted=len(leads))


@router.delete("/{lead_id}", response_model=BulkDeleteLostDealsOut)
async def delete_lost_deal(
    lead_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _delete_lost_deals([lead_id], current, db)


@router.delete("", response_model=BulkDeleteLostDealsOut)
async def bulk_delete_lost_deals(
    payload: BulkDeleteLostDealsRequest,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _delete_lost_deals(payload.ids, current, db)


@router.post("/bulk-delete", response_model=BulkDeleteLostDealsOut)
async def bulk_delete_lost_deals_post(
    payload: BulkDeleteLostDealsRequest,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Action-style alias for clients that do not send bodies with DELETE requests."""
    return await _delete_lost_deals(payload.ids, current, db)
