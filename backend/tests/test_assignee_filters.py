import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadStatus
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
async def test_admin_can_filter_leads_assigned_directly_to_a_manager(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Assignee Filter QA", "9300000090")
    manager = await _member(db_session, org.id, "Filter Manager", "9300000091", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Filter Telecaller", "9300000092", UserRole.telecaller)
    db_session.add_all(
        [
            Lead(
                organization_id=org.id,
                name="Manager Lead",
                phone="9300000093",
                status=LeadStatus.new,
                category=LeadCategory.other,
                assigned_to=manager.id,
            ),
            Lead(
                organization_id=org.id,
                name="Telecaller Lead",
                phone="9300000094",
                status=LeadStatus.new,
                category=LeadCategory.other,
                assigned_to=telecaller.id,
            ),
        ]
    )
    await db_session.commit()

    response = await client.get(
        "/api/leads",
        params={"assigned_to": str(manager.id)},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["name"] == "Manager Lead"
