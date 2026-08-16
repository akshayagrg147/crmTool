import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


@pytest.mark.asyncio
async def test_managers_cannot_export_or_clear_leads(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Admin Actions QA", "9300000070")
    manager = User(
        organization_id=org.id,
        name="Manager",
        phone="9300000071",
        password_hash=hash_password("Password@123"),
        role=UserRole.manager,
        is_active=True,
    )
    db_session.add(
        Lead(
            organization_id=org.id,
            name="Protected Lead",
            phone="9300000072",
            source=LeadSource.manual,
            status=LeadStatus.new,
            category=LeadCategory.other,
        )
    )
    db_session.add(manager)
    await db_session.commit()
    await db_session.refresh(manager)

    manager_headers = {"Authorization": f"Bearer {_token(manager)}"}
    export_response = await client.get("/api/leads/export", headers=manager_headers)
    clear_response = await client.delete("/api/leads", headers=manager_headers)

    assert export_response.status_code == 403
    assert clear_response.status_code == 403

    admin_headers = {"Authorization": f"Bearer {_token(admin)}"}
    admin_export = await client.get("/api/leads/export", headers=admin_headers)
    assert admin_export.status_code == 200
    assert "Protected Lead" in admin_export.text
