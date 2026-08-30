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
from app.models.lead_assignment import LeadAssignmentHistory
from app.models.lead_note import LeadNote
from app.models.payroll import TimeEntry
from app.models.task import Task
from app.models.user import UserRole
from app.schemas.activity import LeadActivityOut
from app.schemas.call_log import CallLogCreate, CallLogOut, FollowUpOut, PaginatedFollowUps
from app.services.audit import record_audit
from app.services.automation import run_automations

router = APIRouter(prefix="/leads", tags=["calls"])
followups_router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])

CALL_LOAD_OPTIONS = (selectinload(CallLog.logger),)


def _to_out(call: CallLog) -> CallLogOut:
    out = CallLogOut.model_validate(call)
    out.logged_by_name = call.logger.name if call.logger else None
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
    now = datetime.now(timezone.utc)

    call = CallLog(
        lead_id=lead.id,
        logged_by=current.id,
        duration_minutes=payload.duration_minutes,
        outcome=payload.outcome,
        notes=payload.notes,
        order_value=payload.order_value,
        next_follow_up_at=next_follow_up_at,
    )
    db.add(call)
    # A logged call is already an authenticated, completed piece of work. Keep
    # it in the attendance ledger as approved calling time so payroll reflects
    # real talk time without requiring the telecaller to enter it twice.
    if payload.duration_minutes > 0:
        db.add(
            TimeEntry(
                organization_id=current.organization_id,
                user_id=current.id,
                entry_date=now.date(),
                hours=round(float(payload.duration_minutes) / 60, 2),
                category="calling",
                description=f"Call with {lead.name}",
                status="approved",
                submitted_by=current.id,
                reviewed_by=current.id,
                reviewed_at=now,
            )
        )
    lead.status = payload.outcome
    lead.last_contacted_at = now
    lead.next_follow_up_at = next_follow_up_at
    record_audit(
        db,
        organization_id=current.organization_id,
        actor_id=current.id,
        entity_type="call",
        entity_id=call.id,
        action="logged",
        summary=f"Call logged for {lead.name}: {payload.outcome.value}",
        payload={"lead_id": str(lead.id), "outcome": payload.outcome.value, "duration_minutes": payload.duration_minutes},
    )
    await run_automations(
        db,
        organization_id=current.organization_id,
        actor_id=current.id,
        trigger="status_changed",
        lead=lead,
        context={"previous_status": "unknown"},
    )
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


@router.get("/{lead_id}/activity", response_model=list[LeadActivityOut])
async def get_lead_activity(
    lead_id: uuid.UUID,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    """Return calls, ownership changes, and creation as one chronological feed."""
    lead_result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id)
    )
    lead = lead_result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")

    calls_result = await db.execute(
        select(CallLog)
        .options(*CALL_LOAD_OPTIONS)
        .where(CallLog.lead_id == lead_id)
        .order_by(CallLog.created_at.desc())
    )
    assignments_result = await db.execute(
        select(LeadAssignmentHistory)
        .options(
            selectinload(LeadAssignmentHistory.previous_assignee),
            selectinload(LeadAssignmentHistory.new_assignee),
            selectinload(LeadAssignmentHistory.assigned_by),
        )
        .where(
            LeadAssignmentHistory.lead_id == lead_id,
            LeadAssignmentHistory.organization_id == current.organization_id,
        )
        .order_by(LeadAssignmentHistory.created_at.desc())
    )
    notes_result = await db.execute(
        select(LeadNote)
        .options(selectinload(LeadNote.author))
        .where(LeadNote.lead_id == lead_id, LeadNote.organization_id == current.organization_id)
        .order_by(LeadNote.created_at.desc())
    )
    tasks_result = await db.execute(
        select(Task)
        .options(selectinload(Task.creator))
        .where(Task.lead_id == lead_id, Task.organization_id == current.organization_id)
        .order_by(Task.created_at.desc())
    )

    call_titles = {
        LeadStatus.new: "Call logged",
        LeadStatus.follow_up: "Follow-up logged",
        LeadStatus.not_picked: "No answer logged",
        LeadStatus.converted: "Lead converted",
        LeadStatus.lost: "Lead marked as lost",
    }
    assignment_titles = {
        "created": "Lead assigned",
        "auto_assigned": "Lead auto-assigned",
        "lost_handoff": "Lost deal routed",
        "unassigned": "Lead unassigned",
    }

    events: list[LeadActivityOut] = [
        LeadActivityOut(
            id=lead.id,
            lead_id=lead.id,
            event_type="created",
            occurred_at=lead.created_at,
            title="Lead added",
            body=f"Added from {lead.source.value.replace('_', ' ').title()}.",
            source=lead.source.value,
        )
    ]
    events.extend(
        LeadActivityOut(
            id=call.id,
            lead_id=lead.id,
            event_type="call",
            occurred_at=call.created_at,
            actor_id=call.logged_by,
            actor_name=call.logger.name if call.logger else None,
            title=call_titles.get(call.outcome, "Call logged"),
            body=call.notes,
            call_outcome=call.outcome,
            duration_minutes=float(call.duration_minutes),
            order_value=float(call.order_value) if call.order_value is not None else None,
            next_follow_up_at=call.next_follow_up_at,
        )
        for call in calls_result.scalars().all()
    )
    events.extend(
        LeadActivityOut(
            id=event.id,
            lead_id=lead.id,
            event_type="assignment",
            occurred_at=event.created_at,
            actor_id=event.assigned_by_id,
            actor_name=event.assigned_by.name if event.assigned_by else None,
            title=assignment_titles.get(event.action, "Lead reassigned"),
            body=f"{event.previous_assignee.name if event.previous_assignee else 'Unassigned'} → "
            f"{event.new_assignee.name if event.new_assignee else 'Unassigned'}",
            source=event.source,
            assignment_action=event.action,
            previous_assignee_name=event.previous_assignee.name if event.previous_assignee else None,
            new_assignee_name=event.new_assignee.name if event.new_assignee else None,
        )
        for event in assignments_result.scalars().all()
    )
    events.extend(
        LeadActivityOut(
            id=note.id,
            lead_id=lead.id,
            event_type="note",
            occurred_at=note.created_at,
            actor_id=note.author_id,
            actor_name=note.author.name if note.author else None,
            title="Note added",
            body=note.body,
            source="note",
        )
        for note in notes_result.scalars().all()
    )
    events.extend(
        LeadActivityOut(
            id=task.id,
            lead_id=lead.id,
            event_type="task",
            occurred_at=task.created_at,
            actor_id=task.created_by,
            actor_name=task.creator.name if task.creator else None,
            title=f"Task created: {task.title}",
            body=task.description,
            source="task",
        )
        for task in tasks_result.scalars().all()
    )
    return sorted(events, key=lambda event: event.occurred_at, reverse=True)


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
