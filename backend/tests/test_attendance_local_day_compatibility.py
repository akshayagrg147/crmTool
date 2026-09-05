"""Regression coverage for pre-timezone attendance rows.

Older deployments stored ``attendance_date`` using UTC.  A check-in after
18:30 UTC therefore belongs to the following India business day even when the
persisted date still contains the prior UTC date.  These tests exercise the
public API rather than only the date helper so a future query change cannot
silently reintroduce duplicate check-ins or misdated payroll entries.
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import func, select

import app.api.payroll as payroll_api
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.payroll import AttendanceRecord, TimeEntry
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


UTC = timezone.utc


async def _telecaller(db, organization_id, phone: str) -> User:
    user = User(
        organization_id=organization_id,
        name="Local Day Telecaller",
        phone=phone,
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), user.role.value, str(user.organization_id))
    return {"Authorization": f"Bearer {token}"}


def _freeze_payroll_clock(monkeypatch: pytest.MonkeyPatch, value: datetime) -> None:
    """Freeze only the payroll route's clock, leaving DB timestamps untouched."""

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[override]
            if tz is None:
                return value.replace(tzinfo=None)
            return value.astimezone(tz)

    monkeypatch.setattr(payroll_api, "datetime", FrozenDateTime)


async def _configure_geofence(db, organization) -> None:
    organization.attendance_location_name = "Head office"
    organization.attendance_latitude = 28.6139
    organization.attendance_longitude = 77.2090
    organization.attendance_radius_meters = 200
    await db.commit()


@pytest.mark.asyncio
async def test_legacy_utc_dated_open_session_is_found_and_checked_out_on_its_india_day(
    client, db_session, monkeypatch: pytest.MonkeyPatch
):
    """A 00:30 IST legacy session must not allow a second Sep 6 check-in."""
    monkeypatch.setattr(settings, "attendance_timezone", "Asia/Kolkata")
    # 02:00 IST on Sep 6.  The old deployment would have stored the check-in
    # under its UTC date (Sep 5), which is deliberately retained below.
    _freeze_payroll_clock(monkeypatch, datetime(2026, 9, 5, 20, 0, tzinfo=UTC))

    org, _admin = await create_org_with_admin(db_session, "Legacy Local-Day QA", "9700000051")
    telecaller = await _telecaller(db_session, org.id, "9700000052")
    await _configure_geofence(db_session, org)

    legacy_record = AttendanceRecord(
        organization_id=org.id,
        user_id=telecaller.id,
        # Simulates the legacy UTC-derived value.  The true India date is Sep 6.
        attendance_date=date(2026, 9, 5),
        checked_in_at=datetime(2026, 9, 5, 19, 0, tzinfo=UTC),  # 00:30 IST Sep 6
        check_in_latitude=28.6139,
        check_in_longitude=77.2090,
    )
    db_session.add(legacy_record)
    await db_session.commit()

    headers = _headers(telecaller)
    status = await client.get("/api/attendance/status", headers=headers)
    assert status.status_code == 200, status.text
    payload = status.json()
    assert payload["attendance_date"] == "2026-09-06"
    assert payload["status"] == "checked_in"
    assert payload["record"]["id"] == str(legacy_record.id)
    # API output must correct the old persisted UTC date without mutating
    # historical rows or risking unique-key collisions.
    assert payload["record"]["attendance_date"] == "2026-09-06"

    duplicate = await client.post(
        "/api/attendance/check-in",
        json={"latitude": 28.6139, "longitude": 77.2090},
        headers=headers,
    )
    assert duplicate.status_code == 409, duplicate.text
    record_count = await db_session.scalar(
        select(func.count()).select_from(AttendanceRecord).where(AttendanceRecord.user_id == telecaller.id)
    )
    assert record_count == 1

    check_out = await client.post(
        "/api/attendance/check-out",
        json={"latitude": 28.6139, "longitude": 77.2090},
        headers=headers,
    )
    assert check_out.status_code == 200, check_out.text
    assert check_out.json()["attendance_date"] == "2026-09-06"
    assert check_out.json()["worked_minutes"] == 60

    await db_session.refresh(legacy_record)
    assert legacy_record.checked_out_at == datetime(2026, 9, 5, 20, 0, tzinfo=UTC)
    entry = await db_session.scalar(
        select(TimeEntry).where(TimeEntry.attendance_record_id == legacy_record.id)
    )
    assert entry is not None
    assert entry.entry_date == date(2026, 9, 6)
    assert float(entry.hours) == 1.0


@pytest.mark.asyncio
async def test_team_month_uses_real_india_check_in_month_for_legacy_rows(client, db_session, monkeypatch: pytest.MonkeyPatch):
    """A UTC-August row from 00:30 IST Sep 1 belongs in September reports."""
    monkeypatch.setattr(settings, "attendance_timezone", "Asia/Kolkata")
    org, admin = await create_org_with_admin(db_session, "Legacy Report Month QA", "9700000061")
    telecaller = await _telecaller(db_session, org.id, "9700000062")
    legacy_record = AttendanceRecord(
        organization_id=org.id,
        user_id=telecaller.id,
        attendance_date=date(2026, 8, 31),
        checked_in_at=datetime(2026, 8, 31, 19, 0, tzinfo=UTC),  # 00:30 IST Sep 1
        checked_out_at=datetime(2026, 9, 1, 3, 0, tzinfo=UTC),
        check_in_latitude=28.6139,
        check_in_longitude=77.2090,
    )
    db_session.add(legacy_record)
    await db_session.commit()

    september = await client.get("/api/attendance/team?month=2026-09", headers=_headers(admin))
    assert september.status_code == 200, september.text
    assert [record["id"] for record in september.json()["records"]] == [str(legacy_record.id)]
    assert september.json()["records"][0]["attendance_date"] == "2026-09-01"

    august = await client.get("/api/attendance/team?month=2026-08", headers=_headers(admin))
    assert august.status_code == 200, august.text
    assert august.json()["records"] == []
