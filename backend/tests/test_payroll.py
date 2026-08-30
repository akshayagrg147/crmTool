from datetime import date

import pytest

from app.api.payroll import DEFAULT_WORKING_DAYS, _overlap_working_days, _scheduled_days
from app.core.security import create_access_token, hash_password
from app.models.payroll import EmployeePayrollProfile, LeaveRequest, TimeEntry
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


def test_schedule_counts_configured_days_and_date_overrides():
    month_start = date(2026, 8, 1)
    month_end = date(2026, 9, 1)
    saturday = date(2026, 8, 8)
    holiday = date(2026, 8, 10)

    assert _scheduled_days(month_start, month_end) == 21
    assert _scheduled_days(month_start, month_end) * 8 == 168
    assert _scheduled_days(month_start, month_end, {0, 1, 2, 3, 4, 5}) == 26
    assert _scheduled_days(month_start, month_end, DEFAULT_WORKING_DAYS, {holiday: False, saturday: True}) == 21
    assert _overlap_working_days(saturday, saturday, month_start, month_end, DEFAULT_WORKING_DAYS, {saturday: True}) == 1


@pytest.mark.asyncio
async def test_admin_payroll_uses_approved_hours_and_counts_approved_leave(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Payroll QA", "9600000001")
    manager = await _member(db_session, org.id, "Payroll Manager", "9600000002", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Payroll Telecaller", "9600000003", UserRole.telecaller)
    db_session.add(EmployeePayrollProfile(organization_id=org.id, user_id=telecaller.id, hourly_rate=100, standard_hours_per_day=8))
    db_session.add_all(
        [
            TimeEntry(organization_id=org.id, user_id=telecaller.id, entry_date=date(2026, 8, 3), hours=5, category="calling", status="approved", submitted_by=telecaller.id, reviewed_by=manager.id),
            TimeEntry(organization_id=org.id, user_id=telecaller.id, entry_date=date(2026, 8, 4), hours=3, category="event", status="approved", submitted_by=telecaller.id, reviewed_by=manager.id),
            TimeEntry(organization_id=org.id, user_id=telecaller.id, entry_date=date(2026, 8, 5), hours=2, category="training", status="pending", submitted_by=telecaller.id),
            LeaveRequest(organization_id=org.id, user_id=telecaller.id, start_date=date(2026, 8, 6), end_date=date(2026, 8, 7), leave_type="planned", reason="Personal work", status="approved", reviewed_by=manager.id),
        ]
    )
    await db_session.commit()

    response = await client.get("/api/payroll?month=2026-08", headers={"Authorization": f"Bearer {_token(admin)}"})
    assert response.status_code == 200, response.text
    employee = next(row for row in response.json()["employees"] if row["user_id"] == str(telecaller.id))
    assert employee["approved_hours"] == 8
    assert employee["pending_hours"] == 2
    assert employee["leave_days"] == 2
    assert employee["estimated_pay"] == 800


@pytest.mark.asyncio
async def test_manager_can_review_telecaller_but_cannot_view_payroll(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Attendance QA", "9600000011")
    manager = await _member(db_session, org.id, "Attendance Manager", "9600000012", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Attendance Telecaller", "9600000013", UserRole.telecaller)
    entry = TimeEntry(
        organization_id=org.id,
        user_id=telecaller.id,
        entry_date=date(2026, 8, 10),
        hours=3,
        category="event",
        description="Team celebration",
        status="pending",
        submitted_by=telecaller.id,
    )
    leave = LeaveRequest(
        organization_id=org.id,
        user_id=telecaller.id,
        start_date=date(2026, 8, 11),
        end_date=date(2026, 8, 11),
        leave_type="casual",
        reason="Personal appointment",
        status="pending",
    )
    db_session.add_all([entry, leave])
    await db_session.commit()
    await db_session.refresh(entry)
    await db_session.refresh(leave)

    manager_headers = {"Authorization": f"Bearer {_token(manager)}"}
    queue = await client.get("/api/attendance/approvals?month=2026-08", headers=manager_headers)
    assert queue.status_code == 200, queue.text
    assert [item["id"] for item in queue.json()["time_entries"]] == [str(entry.id)]
    assert [item["id"] for item in queue.json()["leaves"]] == [str(leave.id)]

    reviewed_entry = await client.patch(f"/api/attendance/time-entries/{entry.id}", json={"status": "approved"}, headers=manager_headers)
    reviewed_leave = await client.patch(f"/api/attendance/leave-requests/{leave.id}", json={"status": "approved"}, headers=manager_headers)
    assert reviewed_entry.status_code == 200, reviewed_entry.text
    assert reviewed_leave.status_code == 200, reviewed_leave.text

    payroll = await client.get("/api/payroll?month=2026-08", headers=manager_headers)
    assert payroll.status_code == 403

    telecaller_headers = {"Authorization": f"Bearer {_token(telecaller)}"}
    forbidden_review = await client.patch(f"/api/attendance/time-entries/{entry.id}", json={"status": "rejected"}, headers=telecaller_headers)
    assert forbidden_review.status_code == 403

    admin_queue = await client.get("/api/attendance/approvals?month=2026-08", headers={"Authorization": f"Bearer {_token(admin)}"})
    assert admin_queue.status_code == 200
    assert admin_queue.json()["time_entries"] == []


@pytest.mark.asyncio
async def test_admin_can_submit_and_approve_own_time_and_leave(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Admin Attendance QA", "9600000021")
    headers = {"Authorization": f"Bearer {_token(admin)}"}

    time_response = await client.post(
        "/api/attendance/time-entries",
        json={"entry_date": "2026-08-18", "hours": 7.5, "category": "admin", "description": "Operations review"},
        headers=headers,
    )
    assert time_response.status_code == 201, time_response.text
    assert time_response.json()["status"] == "pending"

    leave_response = await client.post(
        "/api/attendance/leave-requests",
        json={"start_date": "2026-08-21", "end_date": "2026-08-21", "leave_type": "planned", "reason": "Personal appointment"},
        headers=headers,
    )
    assert leave_response.status_code == 201, leave_response.text
    leave_id = leave_response.json()["id"]
    assert leave_response.json()["status"] == "pending"

    approvals = await client.get("/api/attendance/approvals?month=2026-08", headers=headers)
    assert approvals.status_code == 200, approvals.text
    assert leave_id in [item["id"] for item in approvals.json()["leaves"]]

    approved = await client.patch(
        f"/api/attendance/leave-requests/{leave_id}",
        json={"status": "approved", "review_note": "Approved by admin"},
        headers=headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["reviewed_by"] == str(admin.id)
