import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


async def _add_member(db, organization_id, name, phone, role, is_active=True):
    member = User(
        organization_id=organization_id,
        name=name,
        phone=phone,
        password_hash=hash_password("Password@123"),
        role=role,
        is_active=is_active,
    )
    db.add(member)
    await db.flush()
    return member


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


async def _lead(db, organization_id, assigned_to, phone):
    lead = Lead(
        organization_id=organization_id,
        name="Reassignment test lead",
        phone=phone,
        source=LeadSource.manual,
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=assigned_to,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


@pytest.mark.asyncio
async def test_telecaller_can_reassign_own_lead_to_active_manager(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Telecaller Reassign QA", "9300000020")
    manager = await _add_member(db_session, org.id, "Active Manager", "9300000021", UserRole.manager)
    inactive_manager = await _add_member(
        db_session, org.id, "Inactive Manager", "9300000022", UserRole.manager, is_active=False
    )
    telecaller = await _add_member(db_session, org.id, "Telecaller", "9300000023", UserRole.telecaller)
    lead = await _lead(db_session, org.id, telecaller.id, "9300000024")

    response = await client.post(
        f"/api/leads/{lead.id}/reassign",
        json={"assigned_to": str(manager.id)},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["assignee_name"] == manager.name

    managers_response = await client.get(
        "/api/users/managers", headers={"Authorization": f"Bearer {_token(telecaller)}"}
    )
    assert managers_response.status_code == 200
    assert [member["id"] for member in managers_response.json()] == [str(manager.id)]
    assert str(inactive_manager.id) not in [member["id"] for member in managers_response.json()]


@pytest.mark.asyncio
async def test_telecaller_cannot_reassign_to_another_telecaller(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Telecaller Target QA", "9300000030")
    manager = await _add_member(db_session, org.id, "Manager", "9300000031", UserRole.manager)
    telecaller = await _add_member(db_session, org.id, "Telecaller", "9300000032", UserRole.telecaller)
    another_telecaller = await _add_member(db_session, org.id, "Another Telecaller", "9300000033", UserRole.telecaller)
    lead = await _lead(db_session, org.id, telecaller.id, "9300000034")

    response = await client.post(
        f"/api/leads/{lead.id}/reassign",
        json={"assigned_to": str(another_telecaller.id)},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Telecallers can only reassign leads to an active manager in their organization"
    assert manager.id != another_telecaller.id


@pytest.mark.asyncio
async def test_telecaller_can_only_reassign_a_lead_assigned_to_them(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Telecaller Ownership QA", "9300000040")
    manager = await _add_member(db_session, org.id, "Manager", "9300000041", UserRole.manager)
    telecaller = await _add_member(db_session, org.id, "Telecaller", "9300000042", UserRole.telecaller)
    another_telecaller = await _add_member(db_session, org.id, "Another Telecaller", "9300000043", UserRole.telecaller)
    lead = await _lead(db_session, org.id, another_telecaller.id, "9300000044")

    response = await client.post(
        f"/api/leads/{lead.id}/reassign",
        json={"assigned_to": str(manager.id)},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Telecallers can only reassign leads assigned to them"


@pytest.mark.asyncio
async def test_assignment_history_records_creator_and_reassigner(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Assignment History QA", "9300000050")
    manager = await _add_member(db_session, org.id, "History Manager", "9300000051", UserRole.manager)
    telecaller = await _add_member(db_session, org.id, "History Telecaller", "9300000052", UserRole.telecaller)
    await db_session.commit()

    created = await client.post(
        "/api/leads",
        json={"name": "History lead", "phone": "9300000053", "category": "other"},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert created.status_code == 201, created.text
    lead_id = created.json()["id"]
    assert created.json()["assignee_name"] is None

    distributed = await client.post(
        "/api/leads/auto-assign-unassigned",
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert distributed.status_code == 200, distributed.text
    assert distributed.json()["assigned_count"] == 1
    assert distributed.json()["assignments"] == {telecaller.name: 1}

    reassigned = await client.post(
        f"/api/leads/{lead_id}/reassign",
        json={"assigned_to": str(manager.id)},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )
    assert reassigned.status_code == 200, reassigned.text

    history = await client.get(
        f"/api/leads/{lead_id}/assignment-history",
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )
    assert history.status_code == 200, history.text
    events = history.json()
    assert [event["action"] for event in events] == ["reassigned", "auto_assigned", "created"]
    assert events[0]["previous_assignee_name"] == telecaller.name
    assert events[0]["new_assignee_name"] == manager.name
    assert events[0]["assigned_by_name"] == telecaller.name
    assert events[1]["assigned_by_name"] == admin.name
    assert events[1]["new_assignee_name"] == telecaller.name
    assert events[2]["assigned_by_name"] == admin.name
