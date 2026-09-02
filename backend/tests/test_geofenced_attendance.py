from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.payroll import AttendanceRecord, TimeEntry
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


async def _member(db, organization_id, name, phone, role):
    member = User(
        organization_id=organization_id,
        name=name,
        phone=phone,
        password_hash=hash_password("Password@123"),
        role=role,
        is_active=True,
    )
    db.add(member)
    await db.flush()
    return member


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


@pytest.mark.asyncio
async def test_attendance_requires_location_and_enforces_geofence(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Geofence QA", "9700000001")
    manager = await _member(db_session, org.id, "Geofence Manager", "9700000002", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Geofence Telecaller", "9700000003", UserRole.telecaller)
    await db_session.commit()
    admin_headers = {"Authorization": f"Bearer {_token(admin)}"}
    manager_headers = {"Authorization": f"Bearer {_token(manager)}"}
    telecaller_headers = {"Authorization": f"Bearer {_token(telecaller)}"}

    not_configured = await client.post(
        "/api/attendance/check-in",
        json={"latitude": 28.6139, "longitude": 77.2090},
        headers=telecaller_headers,
    )
    assert not_configured.status_code == 409

    configured = await client.put(
        "/api/attendance/location",
        json={"name": "Head office", "latitude": 28.6139, "longitude": 77.2090, "radius_meters": 200},
        headers=admin_headers,
    )
    assert configured.status_code == 200, configured.text
    assert configured.json()["configured"] is True
    assert configured.json()["latitude"] == 28.6139

    check_in = await client.post(
        "/api/attendance/check-in",
        json={"latitude": 28.6139, "longitude": 77.2090, "accuracy_meters": 12},
        headers=telecaller_headers,
    )
    assert check_in.status_code == 201, check_in.text
    assert check_in.json()["status"] == "checked_in"

    duplicate = await client.post(
        "/api/attendance/check-in",
        json={"latitude": 28.6139, "longitude": 77.2090},
        headers=telecaller_headers,
    )
    assert duplicate.status_code == 409

    outside = await client.post(
        "/api/attendance/check-in",
        json={"latitude": 28.7000, "longitude": 77.2090},
        headers=manager_headers,
    )
    assert outside.status_code == 403

    status_response = await client.get("/api/attendance/status", headers=telecaller_headers)
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "checked_in"
    assert "latitude" not in status_response.json()
    assert "latitude" not in status_response.json()["record"]

    record_id = check_in.json()["id"]
    result = await db_session.execute(select(AttendanceRecord).where(AttendanceRecord.id == record_id))
    record = result.scalar_one()
    record.checked_in_at = datetime.now(timezone.utc) - timedelta(hours=2)
    await db_session.commit()

    check_out = await client.post(
        "/api/attendance/check-out",
        json={"latitude": 28.6139, "longitude": 77.2090, "accuracy_meters": 10},
        headers=telecaller_headers,
    )
    assert check_out.status_code == 200, check_out.text
    assert check_out.json()["status"] == "checked_out"
    assert check_out.json()["worked_minutes"] >= 119

    entry_result = await db_session.execute(select(TimeEntry).where(TimeEntry.attendance_record_id == record.id))
    entry = entry_result.scalar_one()
    assert entry.category == "calling"
    assert entry.status == "pending"

    team = await client.get("/api/attendance/team?month=2099-01", headers=admin_headers)
    assert team.status_code == 200
    assert team.json()["records"] == []
    telecaller_team = await client.get("/api/attendance/team", headers=telecaller_headers)
    assert telecaller_team.status_code == 403


@pytest.mark.asyncio
async def test_only_admin_can_change_attendance_location(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Geofence Role QA", "9700000011")
    manager = await _member(db_session, org.id, "Role Manager", "9700000012", UserRole.manager)
    await db_session.commit()

    payload = {"name": "Office", "latitude": 28.6139, "longitude": 77.2090, "radius_meters": 200}
    forbidden = await client.put(
        "/api/attendance/location",
        json=payload,
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )
    assert forbidden.status_code == 403

    allowed = await client.put(
        "/api/attendance/location",
        json=payload,
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert allowed.status_code == 200
