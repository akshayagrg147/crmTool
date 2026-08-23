import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser, require_org_user
from app.models.task import Task, TaskStatus
from app.models.lead import Lead
from app.models.user import User, UserRole
from app.schemas.task import PaginatedTasks, TaskCreate, TaskOut, TaskUpdate
from app.services.audit import record_audit
from app.services.automation import run_automations

router = APIRouter(prefix="/tasks", tags=["tasks"])


TASK_LOAD_OPTIONS = (
    selectinload(Task.assignee),
    selectinload(Task.creator),
    selectinload(Task.lead),
)


def _to_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        organization_id=task.organization_id,
        lead_id=task.lead_id,
        assigned_to=task.assigned_to,
        assigned_to_name=task.assignee.name if task.assignee else None,
        created_by=task.created_by,
        created_by_name=task.creator.name if task.creator else None,
        lead_name=task.lead.name if task.lead else None,
        lead_phone=task.lead.phone if task.lead else None,
        title=task.title,
        description=task.description,
        task_type=task.task_type,
        priority=task.priority,
        status=task.status,
        due_at=task.due_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
    )


async def _get_org_lead(db: AsyncSession, current: CurrentUser, lead_id: uuid.UUID | None) -> Lead | None:
    if lead_id is None:
        return None
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")
    return lead


async def _resolve_assignee(db: AsyncSession, current: CurrentUser, assignee_id: uuid.UUID | None) -> uuid.UUID | None:
    if current.role == UserRole.telecaller:
        if assignee_id is not None and assignee_id != current.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Telecallers can only assign tasks to themselves")
        return current.id
    if assignee_id is None:
        return current.id
    result = await db.execute(select(User).where(User.id == assignee_id, User.organization_id == current.organization_id, User.is_active.is_(True)))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assigned team member was not found")
    return assignee_id


@router.get("", response_model=PaginatedTasks)
async def list_tasks(
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    assigned_to: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.organization_id == current.organization_id)
    if current.role == UserRole.telecaller:
        stmt = stmt.where(Task.assigned_to == current.id)
    elif assigned_to is not None:
        stmt = stmt.where(Task.assigned_to == assigned_to)
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    if lead_id is not None:
        stmt = stmt.where(Task.lead_id == lead_id)
    if date_from is not None:
        stmt = stmt.where(Task.due_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Task.due_at <= date_to)

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    result = await db.execute(
        stmt.options(*TASK_LOAD_OPTIONS)
        .order_by(Task.status.asc(), Task.due_at.asc().nullslast(), Task.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return PaginatedTasks(items=[_to_out(task) for task in result.scalars().all()], total=total, page=page, page_size=page_size)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _get_org_lead(db, current, payload.lead_id)
    assignee_id = await _resolve_assignee(db, current, payload.assigned_to)
    task = Task(
        organization_id=current.organization_id,
        lead_id=payload.lead_id,
        assigned_to=assignee_id,
        created_by=current.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        task_type=payload.task_type,
        priority=payload.priority,
        due_at=payload.due_at,
    )
    db.add(task)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="task", entity_id=task.id, action="created", summary=f"Task created: {task.title}", payload={"lead_id": str(task.lead_id) if task.lead_id else None})
    await db.commit()
    result = await db.execute(select(Task).options(*TASK_LOAD_OPTIONS).where(Task.id == task.id))
    return _to_out(result.scalar_one())


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: uuid.UUID, payload: TaskUpdate, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.organization_id == current.organization_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if current.role == UserRole.telecaller and task.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your task")
    values = payload.model_dump(exclude_unset=True)
    if "lead_id" in values:
        await _get_org_lead(db, current, values["lead_id"])
    if "assigned_to" in values:
        values["assigned_to"] = await _resolve_assignee(db, current, values["assigned_to"])
    if values.get("status") == TaskStatus.completed and task.status != TaskStatus.completed:
        task.completed_at = datetime.now(timezone.utc)
    elif values.get("status") == TaskStatus.open:
        task.completed_at = None
    if "title" in values and values["title"] is not None:
        values["title"] = values["title"].strip()
    if "description" in values and values["description"]:
        values["description"] = values["description"].strip()
    for key, value in values.items():
        setattr(task, key, value)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="task", entity_id=task.id, action="updated", summary=f"Task updated: {task.title}", payload={"fields": sorted(values.keys())})
    if values.get("status") == TaskStatus.completed and task.lead_id:
        lead = await _get_org_lead(db, current, task.lead_id)
        await run_automations(db, organization_id=current.organization_id, actor_id=current.id, trigger="task_completed", lead=lead, context={"task_id": str(task.id)})
    await db.commit()
    result = await db.execute(select(Task).options(*TASK_LOAD_OPTIONS).where(Task.id == task.id))
    return _to_out(result.scalar_one())


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.organization_id == current.organization_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if current.role == UserRole.telecaller and task.created_by != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete tasks you created")
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="task", entity_id=task.id, action="deleted", summary=f"Task deleted: {task.title}")
    await db.delete(task)
    await db.commit()
