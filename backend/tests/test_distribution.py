import asyncio

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.lead import Lead
from app.models.user import User, UserRole
from app.services.distribution import assign_next_telecaller
from tests.conftest import create_org_with_admin


async def _add_telecaller(db, org_id, phone):
    tc = User(
        organization_id=org_id, name=f"TC-{phone}", phone=phone,
        password_hash=hash_password("Password@123"), role=UserRole.telecaller, is_active=True,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


@pytest.mark.asyncio
async def test_round_robin_order(db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9100000001")
    tc1 = await _add_telecaller(db_session, org.id, "9100000010")
    tc2 = await _add_telecaller(db_session, org.id, "9100000011")

    assigned = []
    for _ in range(4):
        async with AsyncSessionLocal() as session:
            async with session.begin():
                chosen = await assign_next_telecaller(session, org.id)
                assigned.append(chosen.id)

    assert assigned == [tc1.id, tc2.id, tc1.id, tc2.id]


@pytest.mark.asyncio
async def test_concurrent_assignment_is_race_free(db_session):
    """Fires many concurrent lead-assignment transactions and asserts every
    telecaller ends up with an equal (or near-equal) share — proving the row lock
    serializes access instead of letting concurrent writers read a stale rotation
    pointer and double-assign to the same telecaller."""
    org, admin = await create_org_with_admin(db_session, admin_phone="9100000002")
    telecallers = []
    for i in range(4):
        tc = await _add_telecaller(db_session, org.id, f"91000000{20 + i}")
        telecallers.append(tc)

    concurrency = 20

    async def assign_one():
        async with AsyncSessionLocal() as session:
            async with session.begin():
                chosen = await assign_next_telecaller(session, org.id)
                lead = Lead(
                    organization_id=org.id, name="Lead", phone="9000000000",
                    assigned_to=chosen.id,
                )
                session.add(lead)
            return chosen.id

    results = await asyncio.gather(*(assign_one() for _ in range(concurrency)))

    counts = {tc.id: 0 for tc in telecallers}
    for r in results:
        counts[r] += 1

    assert sum(counts.values()) == concurrency
    expected_share = concurrency // len(telecallers)
    for tc_id, count in counts.items():
        assert count == expected_share, f"Uneven distribution detected: {counts}"

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Lead).where(Lead.organization_id == org.id))
        leads = result.scalars().all()
        assert len(leads) == concurrency
