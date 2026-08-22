import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.lead_assignment import LeadAssignmentHistory
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


async def _add_lead(db, organization_id, assigned_to, phone, status=LeadStatus.new):
    lead = Lead(
        organization_id=organization_id,
        name=f"Removal lead {phone}",
        phone=phone,
        source=LeadSource.manual,
        status=status,
        category=LeadCategory.other,
        assigned_to=assigned_to,
    )
    db.add(lead)
    await db.flush()
    return lead


@pytest.mark.asyncio
async def test_removal_requires_manager_when_member_has_assigned_leads(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Removal Guard QA", "9400000001")
    telecaller = await _add_member(db_session, org.id, "Leaving Telecaller", "9400000002", UserRole.telecaller)
    lead = await _add_lead(db_session, org.id, telecaller.id, "9400000003")
    await db_session.commit()

    response = await client.delete(
        f"/api/users/{telecaller.id}",
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 400
    assert "active manager" in response.json()["detail"].lower()
    assert (await db_session.get(User, telecaller.id)) is not None
    assert (await db_session.get(Lead, lead.id)).assigned_to == telecaller.id


@pytest.mark.asyncio
async def test_removal_transfers_every_lead_and_manager_can_reassign(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Removal Transfer QA", "9400000011")
    receiving_manager = await _add_member(
        db_session, org.id, "Receiving Manager", "9400000012", UserRole.manager
    )
    selected_manager = await _add_member(
        db_session, org.id, "Selected Manager", "9400000013", UserRole.manager
    )
    telecaller = await _add_member(
        db_session, org.id, "Leaving Telecaller", "9400000014", UserRole.telecaller
    )
    other_telecaller = await _add_member(
        db_session, org.id, "Other Telecaller", "9400000015", UserRole.telecaller
    )
    leads = [
        await _add_lead(db_session, org.id, telecaller.id, "9400000021", LeadStatus.new),
        await _add_lead(db_session, org.id, telecaller.id, "9400000022", LeadStatus.converted),
        await _add_lead(db_session, org.id, telecaller.id, "9400000023", LeadStatus.lost),
    ]
    admin_id = admin.id
    organization_id = org.id
    selected_manager_id = selected_manager.id
    selected_manager_token = _token(selected_manager)
    other_telecaller_id = other_telecaller.id
    other_telecaller_name = other_telecaller.name
    telecaller_id = telecaller.id
    lead_ids = [lead.id for lead in leads]
    await db_session.commit()

    team_response = await client.get(
        "/api/users", headers={"Authorization": f"Bearer {_token(admin)}"}
    )
    assert team_response.status_code == 200
    leaving_member = next(member for member in team_response.json() if member["id"] == str(telecaller_id))
    assert leaving_member["assigned_leads_count"] == 3

    response = await client.delete(
        f"/api/users/{telecaller_id}",
        params={"manager_id": str(selected_manager_id)},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 204, response.text
    db_session.expire_all()
    assert (await db_session.get(User, telecaller_id)) is None

    transferred = (
        await db_session.execute(select(Lead).where(Lead.id.in_(lead_ids)))
    ).scalars().all()
    assert {lead.assigned_to for lead in transferred} == {selected_manager_id}

    history = (
        await db_session.execute(
            select(LeadAssignmentHistory).where(
                LeadAssignmentHistory.organization_id == organization_id,
                LeadAssignmentHistory.source == "team_member_removed",
            )
        )
    ).scalars().all()
    assert len(history) == 3
    assert {event.new_assignee_id for event in history} == {selected_manager_id}
    assert {event.assigned_by_id for event in history} == {admin_id}

    reassign_response = await client.post(
        f"/api/leads/{lead_ids[0]}/reassign",
        json={"assigned_to": str(other_telecaller_id)},
        headers={"Authorization": f"Bearer {selected_manager_token}"},
    )
    assert reassign_response.status_code == 200, reassign_response.text
    assert reassign_response.json()["assignee_name"] == other_telecaller_name


@pytest.mark.asyncio
async def test_removal_rejects_inactive_replacement_manager(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Removal Manager QA", "9400000031")
    inactive_manager = await _add_member(
        db_session, org.id, "Inactive Manager", "9400000032", UserRole.manager, is_active=False
    )
    telecaller = await _add_member(db_session, org.id, "Leaving Telecaller", "9400000033", UserRole.telecaller)
    await _add_lead(db_session, org.id, telecaller.id, "9400000034")
    await db_session.commit()

    response = await client.delete(
        f"/api/users/{telecaller.id}",
        params={"manager_id": str(inactive_manager.id)},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 400
    assert "another active manager" in response.json()["detail"].lower()
    assert (await db_session.get(User, telecaller.id)) is not None
