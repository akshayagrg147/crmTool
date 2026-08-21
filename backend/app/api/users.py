import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_admin_or_manager, require_org_user
from app.core.security import hash_password
from app.models.lead import Lead
from app.models.user import User, UserRole
from app.schemas.user import TeamMemberCreate, TeamMemberOut, TeamMemberUpdate
from app.services.assignment_history import record_assignment

router = APIRouter(prefix="/users", tags=["team"])


async def _active_leads_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(Lead).where(
            Lead.assigned_to == user_id,
            Lead.status.notin_(["converted", "lost"]),
        )
    )
    return result.scalar_one()


def _to_out(member: User) -> TeamMemberOut:
    return TeamMemberOut.model_validate(member)


@router.get("", response_model=list[TeamMemberOut])
async def list_team(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.organization_id == current.organization_id)
        .order_by(User.created_at)
    )
    members = list(result.scalars().all())
    out = []
    for m in members:
        count = await _active_leads_count(db, m.id)
        item = _to_out(m)
        item.active_leads_count = count
        out.append(item)
    return out


@router.get("/managers", response_model=list[TeamMemberOut])
async def list_active_managers(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    """Return active managers available as telecaller reassignment targets."""
    result = await db.execute(
        select(User)
        .where(
            User.organization_id == current.organization_id,
            User.role == UserRole.manager,
            User.is_active.is_(True),
        )
        .order_by(User.created_at)
    )
    managers = list(result.scalars().all())
    out = []
    for manager in managers:
        item = _to_out(manager)
        item.active_leads_count = await _active_leads_count(db, manager.id)
        out.append(item)
    return out


@router.post("", response_model=TeamMemberOut, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    payload: TeamMemberCreate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.phone == payload.phone))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this phone number already exists")
    if payload.role == UserRole.super_admin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot create a super admin here")

    member = User(
        organization_id=current.organization_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        state=payload.state,
        city=payload.city,
    )
    db.add(member)
    await db.commit()
    result = await db.execute(select(User).where(User.id == member.id))
    member = result.scalar_one()
    out = _to_out(member)
    out.active_leads_count = 0
    return out


@router.patch("/{user_id}", response_model=TeamMemberOut)
async def update_team_member(
    user_id: uuid.UUID,
    payload: TeamMemberUpdate,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == current.organization_id)
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team member not found")

    data = payload.model_dump(exclude_unset=True)

    # Manager can only toggle is_active; block other field changes and role escalation.
    if current.role == UserRole.manager:
        disallowed = set(data.keys()) - {"is_active"}
        if disallowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers can only toggle active status")

    if "role" in data and member.role == UserRole.admin and data["role"] != UserRole.admin:
        admin_count = await db.execute(
            select(func.count()).select_from(User).where(
                User.organization_id == current.organization_id, User.role == UserRole.admin
            )
        )
        if admin_count.scalar_one() <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot demote the last admin of the organization")

    if "is_active" in data and data["is_active"] is False and member.role == UserRole.admin:
        active_admins = await db.execute(
            select(func.count()).select_from(User).where(
                User.organization_id == current.organization_id,
                User.role == UserRole.admin,
                User.is_active.is_(True),
            )
        )
        if active_admins.scalar_one() <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot deactivate the last active admin")

    for field, value in data.items():
        setattr(member, field, value)

    await db.commit()
    result = await db.execute(select(User).where(User.id == member.id))
    member = result.scalar_one()
    out = _to_out(member)
    out.active_leads_count = await _active_leads_count(db, member.id)
    return out


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    user_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == current.organization_id)
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team member not found")

    total_count = await db.execute(
        select(func.count()).select_from(User).where(User.organization_id == current.organization_id)
    )
    if total_count.scalar_one() <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the last member of the organization")

    if member.role == UserRole.admin:
        admin_count = await db.execute(
            select(func.count()).select_from(User).where(
                User.organization_id == current.organization_id, User.role == UserRole.admin
            )
        )
        if admin_count.scalar_one() <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot remove the last admin of the organization")

    assigned_leads_result = await db.execute(
        select(Lead.id).where(
            Lead.assigned_to == member.id,
            Lead.organization_id == current.organization_id,
        )
    )
    for (lead_id,) in assigned_leads_result.all():
        record_assignment(
            db,
            organization_id=current.organization_id,
            lead_id=lead_id,
            previous_assignee_id=member.id,
            new_assignee_id=None,
            assigned_by_id=current.id,
            action="unassigned",
            source="team_member_removed",
        )

    await db.execute(
        update(Lead)
        .where(Lead.assigned_to == member.id, Lead.organization_id == current.organization_id)
        .values(assigned_to=None)
    )
    await db.delete(member)
    await db.commit()
