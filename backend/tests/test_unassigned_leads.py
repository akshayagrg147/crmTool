import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadStatus
from app.models.lead_assignment import LeadAssignmentHistory
from app.models.user import User, UserRole
from sqlalchemy import select
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


@pytest.mark.asyncio
async def test_manual_lead_creation_stays_unassigned_until_explicit_distribution(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Manual Lead QA", "9500000006")
    telecaller = await _member(db_session, org.id, "Manual Telecaller", "9500000007", UserRole.telecaller)
    await db_session.commit()

    response = await client.post(
        "/api/leads",
        headers={"Authorization": f"Bearer {_token(admin)}"},
        json={
            "name": "Manual Lead",
            "phone": "9500000008",
            "source": "manual",
            "category": "other",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["assigned_to"] is None

    created = (await db_session.execute(select(Lead).where(Lead.phone == "9500000008"))).scalar_one()
    created_id = created.id
    telecaller_id = telecaller.id
    assert created.assigned_to is None

    distributed = await client.post(
        "/api/leads/auto-assign-unassigned",
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert distributed.status_code == 200, distributed.text
    assert distributed.json()["assigned_count"] == 1
    refreshed = (await db_session.execute(select(Lead.assigned_to).where(Lead.id == created_id))).scalar_one()
    assert refreshed == telecaller_id


@pytest.mark.asyncio
async def test_manager_can_bulk_assign_selected_leads_and_telecaller_cannot(client, db_session):
    org, _admin = await create_org_with_admin(db_session, "Bulk Assignment QA", "9500000010")
    manager = await _member(db_session, org.id, "Bulk Manager", "9500000011", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Bulk Telecaller", "9500000012", UserRole.telecaller)
    leads = [
        Lead(
            organization_id=org.id,
            name=f"Bulk Lead {index}",
            phone=f"950000001{index + 2}",
            status=LeadStatus.new,
            category=LeadCategory.other,
        )
        for index in range(2)
    ]
    db_session.add_all(leads)
    await db_session.commit()

    response = await client.post(
        "/api/leads/bulk-reassign",
        json={"lead_ids": [str(lead.id) for lead in leads], "assigned_to": str(telecaller.id)},
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"updated_count": 2}

    blocked = await client.post(
        "/api/leads/bulk-reassign",
        json={"lead_ids": [str(leads[0].id)], "assigned_to": str(telecaller.id)},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_auto_distribute_all_unassigned_leads(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Automatic Distribution QA", "9500000020")
    first = await _member(db_session, org.id, "Auto Telecaller A", "9500000021", UserRole.telecaller)
    second = await _member(db_session, org.id, "Auto Telecaller B", "9500000022", UserRole.telecaller)
    leads = [
        Lead(
            organization_id=org.id,
            name=f"Auto Lead {index}",
            phone=f"950000002{index + 3}",
            status=LeadStatus.new,
            category=LeadCategory.other,
        )
        for index in range(3)
    ]
    db_session.add_all(leads)
    await db_session.commit()

    response = await client.post(
        "/api/leads/auto-assign-unassigned",
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assigned_count"] == 3
    assert set(body["assignments"]) == {first.name, second.name}
    assert sorted(body["assignments"].values()) == [1, 2]

    refreshed = await db_session.execute(select(Lead).where(Lead.id.in_([lead.id for lead in leads])))
    assert all(lead.assigned_to in {first.id, second.id} for lead in refreshed.scalars().all())
    history = await db_session.execute(
        select(LeadAssignmentHistory).where(
            LeadAssignmentHistory.organization_id == org.id,
            LeadAssignmentHistory.source == "automatic",
        )
    )
    assert len(history.scalars().all()) == 3
