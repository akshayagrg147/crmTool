from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.payroll import AttendanceRecord, TimeEntry
from app.models.user import User, UserRole
from app.services.attendance_clock import attendance_date_for, local_midnight_utc
from app.services.attendance_closer import (
    AUTO_CHECKOUT_DESCRIPTION,
    close_stale_attendance_records,
)
from tests.conftest import create_org_with_admin


IST = ZoneInfo("Asia/Kolkata")


async def _telecaller(db, organization_id, phone: str) -> User:
    user = User(
        organization_id=organization_id,
        name="Attendance Telecaller",
        phone=phone,
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _attendance_record(
    organization_id,
    user_id,
    attendance_date: date,
    checked_in_at: datetime,
    *,
    checked_out_at: datetime | None = None,
) -> AttendanceRecord:
    return AttendanceRecord(
        organization_id=organization_id,
        user_id=user_id,
        attendance_date=attendance_date,
        checked_in_at=checked_in_at,
        checked_out_at=checked_out_at,
        check_in_latitude=28.6139,
        check_in_longitude=77.2090,
    )


def test_attendance_clock_uses_india_midnight() -> None:
    just_after_midnight_ist = datetime(2026, 9, 5, 18, 31, tzinfo=timezone.utc)

    assert attendance_date_for(just_after_midnight_ist, attendance_tz=IST) == date(2026, 9, 6)
    assert local_midnight_utc(date(2026, 9, 6), attendance_tz=IST) == datetime(
        2026, 9, 5, 18, 30, tzinfo=timezone.utc
    )


@pytest.mark.asyncio
async def test_auto_checkout_closes_at_midnight_and_is_idempotent(db_session):
    org, _admin = await create_org_with_admin(db_session, "Midnight Attendance QA", "9700000031")
    telecaller = await _telecaller(db_session, org.id, "9700000032")
    # 20:30 IST on Sep 5. The actual recorded checkout must be 00:00 IST,
    # not the later time when the worker happens to run.
    stale_record = _attendance_record(
        org.id,
        telecaller.id,
        date(2026, 9, 5),
        datetime(2026, 9, 5, 15, 0, tzinfo=timezone.utc),
    )
    # This is 00:30 IST on Sep 6 and must remain open.
    current_record = _attendance_record(
        org.id,
        telecaller.id,
        date(2026, 9, 6),
        datetime(2026, 9, 5, 19, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([stale_record, current_record])
    await db_session.commit()

    worker_now = datetime(2026, 9, 5, 18, 31, tzinfo=timezone.utc)
    assert await close_stale_attendance_records(db_session, now=worker_now, attendance_tz=IST) == 1
    await db_session.commit()
    await db_session.refresh(stale_record)
    await db_session.refresh(current_record)

    assert stale_record.checked_out_at == datetime(2026, 9, 5, 18, 30, tzinfo=timezone.utc)
    assert stale_record.check_out_latitude is None
    assert stale_record.check_out_longitude is None
    assert current_record.checked_out_at is None

    entries = list(
        (
            await db_session.execute(
                select(TimeEntry).where(TimeEntry.attendance_record_id == stale_record.id)
            )
        ).scalars()
    )
    assert len(entries) == 1
    assert float(entries[0].hours) == 3.5
    assert entries[0].status == "pending"
    assert entries[0].description == AUTO_CHECKOUT_DESCRIPTION
    assert entries[0].entry_date == date(2026, 9, 5)

    # A second cycle cannot change the cutoff or create a duplicate payroll entry.
    assert await close_stale_attendance_records(db_session, now=worker_now, attendance_tz=IST) == 0
    await db_session.commit()
    entry_count = (
        await db_session.execute(select(TimeEntry).where(TimeEntry.attendance_record_id == stale_record.id))
    ).scalars().all()
    assert len(entry_count) == 1


@pytest.mark.asyncio
async def test_auto_checkout_skips_completed_sessions_and_short_sessions(db_session):
    org, _admin = await create_org_with_admin(db_session, "Auto Checkout Safety QA", "9700000041")
    telecaller = await _telecaller(db_session, org.id, "9700000042")
    manual_checkout = datetime(2026, 9, 5, 16, 0, tzinfo=timezone.utc)
    completed_record = _attendance_record(
        org.id,
        telecaller.id,
        date(2026, 9, 4),
        datetime(2026, 9, 4, 14, 0, tzinfo=timezone.utc),
        checked_out_at=manual_checkout,
    )
    # 23:59:30 IST. It still closes, but follows the existing one-minute
    # payroll threshold and therefore must not create a TimeEntry.
    short_record = _attendance_record(
        org.id,
        telecaller.id,
        date(2026, 9, 5),
        datetime(2026, 9, 5, 18, 29, 30, tzinfo=timezone.utc),
    )
    db_session.add_all([completed_record, short_record])
    await db_session.commit()

    assert await close_stale_attendance_records(
        db_session,
        now=datetime(2026, 9, 5, 18, 31, tzinfo=timezone.utc),
        attendance_tz=IST,
    ) == 1
    await db_session.commit()
    await db_session.refresh(completed_record)
    await db_session.refresh(short_record)

    assert completed_record.checked_out_at == manual_checkout
    assert short_record.checked_out_at == datetime(2026, 9, 5, 18, 30, tzinfo=timezone.utc)
    short_entry = await db_session.execute(
        select(TimeEntry).where(TimeEntry.attendance_record_id == short_record.id)
    )
    assert short_entry.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_auto_checkout_reconciles_a_legacy_utc_dated_session(db_session):
    """Old records saved their UTC date, so their payroll date must be repaired logically."""
    org, _admin = await create_org_with_admin(db_session, "Legacy Attendance QA", "9700000051")
    telecaller = await _telecaller(db_session, org.id, "9700000052")
    # This was 00:30 IST on Sep 6, but the pre-timezone implementation saved
    # the UTC calendar date (Sep 5) in attendance_date.
    legacy_record = _attendance_record(
        org.id,
        telecaller.id,
        date(2026, 9, 5),
        datetime(2026, 9, 5, 19, 0, tzinfo=timezone.utc),
    )
    db_session.add(legacy_record)
    await db_session.commit()

    # The worker comes up just after midnight IST on Sep 7 and must close this
    # at Sep 7 midnight, while assigning hours to the real Sep 6 workday.
    assert await close_stale_attendance_records(
        db_session,
        now=datetime(2026, 9, 6, 18, 31, tzinfo=timezone.utc),
        attendance_tz=IST,
    ) == 1
    await db_session.commit()
    await db_session.refresh(legacy_record)

    assert legacy_record.checked_out_at == datetime(2026, 9, 6, 18, 30, tzinfo=timezone.utc)
    entry_result = await db_session.execute(
        select(TimeEntry).where(TimeEntry.attendance_record_id == legacy_record.id)
    )
    entry = entry_result.scalar_one()
    assert entry.entry_date == date(2026, 9, 6)
    assert float(entry.hours) == 23.5
