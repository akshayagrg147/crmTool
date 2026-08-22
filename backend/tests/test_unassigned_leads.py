import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadStatus
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


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


@pytest.mark.asyncio
async def test_admin_and_manager_can_filter_and_assign_unassigned_leads(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Unassigned Lead QA", "9500000001")
    manager = await _member(db_session, org.id, "Lead Manager", "9500000002", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Lead Telecaller", "9500000003", UserRole.telecaller)
    unassigned = Lead(
        organization_id=org.id,
        name="Needs Assignment",
        phone="9500000004",
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=None,
    )
    assigned = Lead(
        organization_id=org.id,
        name="Already Assigned",
        phone="9500000005",
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=telecaller.id,
    )
    db_session.add_all([unassigned, assigned])
    await db_session.commit()

    for user in (admin, manager):
        response = await client.get(
            "/api/leads",
            params={"unassigned_only": "true"},
            headers={"Authorization": f"Bearer {_token(user)}"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["total"] == 1
        assert response.json()["items"][0]["name"] == "Needs Assignment"

    assign_response = await client.post(
        f"/api/leads/{unassigned.id}/reassign",
        json={"assigned_to": str(telecaller.id)},
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )
    assert assign_response.status_code == 200, assign_response.text
    assert assign_response.json()["assignee_name"] == "Lead Telecaller"

    remaining = await client.get(
        "/api/leads",
        params={"unassigned_only": "true"},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert remaining.status_code == 200, remaining.text
    assert remaining.json()["total"] == 0
