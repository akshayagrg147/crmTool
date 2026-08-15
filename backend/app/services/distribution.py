import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.distribution_settings import DistributionSettings
from app.models.user import User, UserRole


async def get_active_telecallers(db: AsyncSession, organization_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .where(
            User.organization_id == organization_id,
            User.role == UserRole.telecaller,
            User.is_active.is_(True),
        )
        .order_by(User.created_at)
    )
    return list(result.scalars().all())


async def get_locked_distribution_settings(db: AsyncSession, organization_id: uuid.UUID) -> DistributionSettings:
    """Row-locks the org's distribution settings row for the duration of the transaction.

    Callers must be inside a transaction (async with db.begin()) so the lock is held
    until commit, serializing concurrent assignment for the same org.
    """
    result = await db.execute(
        select(DistributionSettings)
        .where(DistributionSettings.organization_id == organization_id)
        .with_for_update()
    )
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        settings_row = DistributionSettings(organization_id=organization_id, rotation_index=0)
        db.add(settings_row)
        await db.flush()
    return settings_row


async def assign_next_telecaller(db: AsyncSession, organization_id: uuid.UUID) -> User | None:
    """Picks the next telecaller in round-robin order and advances the rotation pointer.

    Must be called within a transaction holding the distribution_settings row lock
    (see get_locked_distribution_settings) to be race-condition safe under concurrent
    lead creation.
    """
    telecallers = await get_active_telecallers(db, organization_id)
    if not telecallers:
        return None

    settings_row = await get_locked_distribution_settings(db, organization_id)
    index = settings_row.rotation_index % len(telecallers)
    chosen = telecallers[index]
    settings_row.rotation_index = (index + 1) % len(telecallers)
    return chosen


async def assign_batch(db: AsyncSession, organization_id: uuid.UUID, count: int) -> list[User | None]:
    """Assigns `count` sequential leads in one locked transaction, returning the assignee for each."""
    telecallers = await get_active_telecallers(db, organization_id)
    if not telecallers:
        return [None] * count

    settings_row = await get_locked_distribution_settings(db, organization_id)
    assignments: list[User | None] = []
    index = settings_row.rotation_index
    for _ in range(count):
        idx = index % len(telecallers)
        assignments.append(telecallers[idx])
        index += 1
    settings_row.rotation_index = index % len(telecallers)
    return assignments
