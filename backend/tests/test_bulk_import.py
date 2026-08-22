import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.lead import Lead
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
