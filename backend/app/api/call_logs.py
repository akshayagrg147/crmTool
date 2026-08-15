import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser, require_org_user
from app.models.call_log import CallLog
from app.models.lead import Lead, LeadStatus
from app.models.user import UserRole
from app.schemas.call_log import CallLogCreate, CallLogOut, FollowUpOut, PaginatedFollowUps

router = APIRouter(prefix="/leads", tags=["calls"])
followups_router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])

CALL_LOAD_OPTIONS = (selectinload(CallLog.logger), selectinload(CallLog.product))


def _to_out(call: CallLog) -> CallLogOut:
    out = CallLogOut.model_validate(call)
    out.logged_by_name = call.logger.name if call.logger else None
    out.product_name = call.product.name if call.product else None
    return out


@router.post("/{lead_id}/calls", response_model=CallLogOut, status_code=status.HTTP_201_CREATED)
async def log_call(
    lead_id: uuid.UUID,
    payload: CallLogCreate,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")

    next_follow_up_at = payload.next_follow_up_at if payload.outcome == LeadStatus.follow_up else None

    call = CallLog(
        lead_id=lead.id,
        logged_by=current.id,
        duration_minutes=payload.duration_minutes,
        outcome=payload.outcome,
        notes=payload.notes,
        order_value=payload.order_value,
        product_id=payload.product_id,
        next_follow_up_at=next_follow_up_at,
    )
    db.add(call)
    lead.status = payload.outcome
    lead.last_contacted_at = datetime.now(timezone.utc)
    lead.next_follow_up_at = next_follow_up_at
    await db.commit()
    result = await db.execute(select(CallLog).options(*CALL_LOAD_OPTIONS).where(CallLog.id == call.id))
    call = result.scalar_one()
    return _to_out(call)


@router.get("/{lead_id}/calls", response_model=list[CallLogOut])
async def get_call_history(
    lead_id: uuid.UUID,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    lead_result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = lead_result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")

    result = await db.execute(
        select(CallLog)
        .options(*CALL_LOAD_OPTIONS)
        .where(CallLog.lead_id == lead_id)
        .order_by(CallLog.created_at.desc())
    )
    calls = result.scalars().all()
    return [_to_out(c) for c in calls]


@followups_router.get("", response_model=PaginatedFollowUps)
async def list_follow_ups(
    telecaller_id: uuid.UUID | None = Query(default=None),
    outcome: LeadStatus | None = Query(default=None),
    q: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CallLog).join(Lead, CallLog.lead_id == Lead.id).where(Lead.organization_id == current.organization_id)

    if current.role == UserRole.telecaller:
        stmt = stmt.where(CallLog.logged_by == current.id)
    elif telecaller_id is not None:
        stmt = stmt.where(CallLog.logged_by == telecaller_id)

    if outcome is not None:
        stmt = stmt.where(CallLog.outcome == outcome)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.phone.ilike(like)))
    if date_from is not None:
        stmt = stmt.where(CallLog.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(CallLog.created_at <= date_to)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        stmt.options(selectinload(CallLog.logger), selectinload(CallLog.lead))
        .order_by(CallLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    calls = result.scalars().all()
    items = [
        FollowUpOut(
            id=c.id,
            lead_id=c.lead_id,
            lead_name=c.lead.name,
            lead_phone=c.lead.phone,
            logged_by=c.logged_by,
            logged_by_name=c.logger.name if c.logger else None,
            outcome=c.outcome,
            notes=c.notes,
            duration_minutes=float(c.duration_minutes),
            created_at=c.created_at,
            next_follow_up_at=c.next_follow_up_at,
        )
        for c in calls
    ]
    return PaginatedFollowUps(items=items, total=total, page=page, page_size=page_size)
