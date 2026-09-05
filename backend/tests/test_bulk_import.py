import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignmentHistory
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


def _upload(name: str, content: str, content_type: str = "text/csv"):
    return {"file": (name, content.encode("utf-8"), content_type)}


@pytest.mark.asyncio
async def test_bulk_import_reports_row_level_issues_and_imports_valid_rows(client, db_session):
    _, admin = await create_org_with_admin(db_session, "Import QA", "9300000010")
    token = create_access_token(str(admin.id), admin.role.value, str(admin.organization_id))

    response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload(
            "leads.csv",
            "name,phone,city\nGood Lead,9111111111,Pune\n,9222222222,Mumbai\nDuplicate,9111111111,Delhi\n",
        ),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 1
    assert body["skipped"] == 2
    assert body["issue_count"] == 2
    assert body["assignments"] == {}
    assert {issue["code"] for issue in body["issues"]} == {"missing_name", "duplicate_in_file"}
    assert any(issue["row"] == 3 and issue["field"] == "name" for issue in body["issues"])
    assert any(issue["row"] == 4 and issue["field"] == "phone" for issue in body["issues"])
    imported = (await db_session.execute(select(Lead).where(Lead.phone == "9111111111"))).scalar_one()
    assert imported.assigned_to is None


@pytest.mark.asyncio
async def test_bulk_import_explains_missing_columns(client, db_session):
    _, admin = await create_org_with_admin(db_session, "Import Header QA", "9300000011")
    token = create_access_token(str(admin.id), admin.role.value, str(admin.organization_id))

    response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload("leads.csv", "name,city\nMissing Phone,Delhi\n"),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
    body = response.json()["detail"]
    assert body["code"] == "missing_columns"
    assert body["message"] == "The file is missing required column(s): phone."
    assert body["issues"][0]["field"] == "phone"


@pytest.mark.asyncio
async def test_bulk_import_rejects_unsupported_file_type(client, db_session):
    _, admin = await create_org_with_admin(db_session, "Import Type QA", "9300000012")
    token = create_access_token(str(admin.id), admin.role.value, str(admin.organization_id))

    response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload("leads.json", '{"name":"Not supported"}', "application/json"),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 415
    body = response.json()["detail"]
    assert body["code"] == "unsupported_file_type"
    assert body["message"] == "Unsupported file type. Upload a CSV or XLSX file."


@pytest.mark.asyncio
async def test_bulk_import_matches_common_headers_without_case_sensitivity(client, db_session):
    _, admin = await create_org_with_admin(db_session, "Import Header Alias QA", "9300000013")
    token = create_access_token(str(admin.id), admin.role.value, str(admin.organization_id))

    response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload("leads.csv", "FULL NAME,MOBILE NUMBER,City\nCase Free Lead,9333333333,Pune\n"),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 1
    assert body["issue_count"] == 0


@pytest.mark.asyncio
async def test_telecaller_bulk_import_assigns_every_new_lead_to_uploader(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Telecaller Import QA", "9300000014")
    telecaller = User(
        organization_id=org.id,
        name="Import Caller",
        phone="9300000015",
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    db_session.add(telecaller)
    await db_session.commit()
    await db_session.refresh(telecaller)
    token = create_access_token(str(telecaller.id), telecaller.role.value, str(org.id))

    response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload(
            "my-leads.csv",
            "name,phone,city\nFirst Caller Lead,9444444444,Pune\nSecond Caller Lead,9555555555,Mumbai\n",
        ),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 2
    assert body["assignments"] == {"You": 2}

    imported = (
        await db_session.execute(
            select(Lead).where(
                Lead.organization_id == org.id,
                Lead.phone.in_(["9444444444", "9555555555"]),
            )
        )
    ).scalars().all()
    assert {lead.assigned_to for lead in imported} == {telecaller.id}

    history = (
        await db_session.execute(
            select(LeadAssignmentHistory).where(
                LeadAssignmentHistory.organization_id == org.id,
                LeadAssignmentHistory.lead_id.in_([lead.id for lead in imported]),
            )
        )
    ).scalars().all()
    assert len(history) == 2
    assert {event.new_assignee_id for event in history} == {telecaller.id}
    assert {event.source for event in history} == {"telecaller_import"}


@pytest.mark.asyncio
async def test_telecaller_bulk_import_is_visible_to_manager_and_not_other_telecaller(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Telecaller Visibility QA", "9300000016")
    manager = User(
        organization_id=org.id,
        name="Workspace Manager",
        phone="9300000019",
        password_hash=hash_password("Password@123"),
        role=UserRole.manager,
        is_active=True,
    )
    first = User(
        organization_id=org.id,
        name="First Caller",
        phone="9300000017",
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    second = User(
        organization_id=org.id,
        name="Second Caller",
        phone="9300000018",
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    db_session.add_all([manager, first, second])
    await db_session.commit()
    await db_session.refresh(first)
    await db_session.refresh(second)

    first_token = create_access_token(str(first.id), first.role.value, str(org.id))
    upload_response = await client.post(
        "/api/leads/bulk-import",
        params={"source": "manual"},
        files=_upload("my-leads.csv", "name,phone\nAssigned Lead,9666666666\n"),
        headers={"Authorization": f"Bearer {first_token}"},
    )
    assert upload_response.status_code == 200, upload_response.text

    second_token = create_access_token(str(second.id), second.role.value, str(org.id))
    second_list = await client.get("/api/leads", headers={"Authorization": f"Bearer {second_token}"})
    assert second_list.status_code == 200, second_list.text
    assert second_list.json()["total"] == 0

    manager_token = create_access_token(str(manager.id), manager.role.value, str(org.id))
    manager_list = await client.get("/api/leads", headers={"Authorization": f"Bearer {manager_token}"})
    assert manager_list.status_code == 200, manager_list.text
    assert manager_list.json()["total"] == 1
    assert manager_list.json()["items"][0]["assigned_to"] == str(first.id)
