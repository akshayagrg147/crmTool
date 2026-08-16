import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.call_log import CallLog
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
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
async def test_telecaller_marks_lost_and_manager_sees_reason_and_attribution(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Lost Deals QA", "9300000050")
    manager = await _member(db_session, org.id, "Lost Deals Manager", "9300000051", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Reporting Telecaller", "9300000052", UserRole.telecaller)
    lead = Lead(
        organization_id=org.id,
        name="Invalid Number Lead",
        phone="123456789",
        source=LeadSource.manual,
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=telecaller.id,
    )
    db_session.add(lead)
    await db_session.commit()
    await db_session.refresh(lead)

    mark_lost = await client.post(
        f"/api/leads/{lead.id}/mark-lost",
        json={"manager_id": str(manager.id), "reason": "Phone number has only nine digits and could not be contacted."},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )
    assert mark_lost.status_code == 200, mark_lost.text
    assert mark_lost.json()["status"] == "lost"
    assert mark_lost.json()["assignee_name"] == manager.name

    lost_deals = await client.get("/api/lost-deals", headers={"Authorization": f"Bearer {_token(manager)}"})
    assert lost_deals.status_code == 200, lost_deals.text
    body = lost_deals.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["id"] == str(lead.id)
    assert item["lost_by_name"] == telecaller.name
    assert item["lost_reason"] == "Phone number has only nine digits and could not be contacted."
    assert item["assignee_name"] == manager.name

    filtered = await client.get(
        f"/api/lost-deals?telecaller_id={telecaller.id}",
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1

    admin_view = await client.get("/api/lost-deals", headers={"Authorization": f"Bearer {_token(admin)}"})
    assert admin_view.status_code == 200
    assert admin_view.json()["total"] == 1


@pytest.mark.asyncio
async def test_only_admin_can_delete_lost_deals_individually_and_in_bulk(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Lost Delete QA", "9300000070")
    manager = await _member(db_session, org.id, "Delete Manager", "9300000071", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Delete Telecaller", "9300000072", UserRole.telecaller)
    lost_one = Lead(
        organization_id=org.id,
        name="Lost One",
        phone="9300000073",
        source=LeadSource.manual,
        status=LeadStatus.lost,
        category=LeadCategory.other,
        assigned_to=manager.id,
    )
    lost_two = Lead(
        organization_id=org.id,
        name="Lost Two",
        phone="9300000074",
        source=LeadSource.manual,
        status=LeadStatus.lost,
        category=LeadCategory.other,
        assigned_to=manager.id,
    )
    active_lead = Lead(
        organization_id=org.id,
        name="Still Active",
        phone="9300000075",
        source=LeadSource.manual,
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=telecaller.id,
    )
    db_session.add_all([lost_one, lost_two, active_lead])
    await db_session.flush()
    db_session.add_all(
        [
            CallLog(
                lead_id=lost_one.id,
                logged_by=telecaller.id,
                duration_minutes=0,
                outcome=LeadStatus.lost,
                notes="No longer interested",
            ),
            CallLog(
                lead_id=lost_two.id,
                logged_by=telecaller.id,
                duration_minutes=0,
                outcome=LeadStatus.lost,
                notes="Invalid contact",
            ),
        ]
    )
    await db_session.commit()
    await db_session.refresh(lost_one)
    await db_session.refresh(lost_two)

    manager_headers = {"Authorization": f"Bearer {_token(manager)}"}
    assert (await client.delete(f"/api/lost-deals/{lost_one.id}", headers=manager_headers)).status_code == 403
    assert (
        await client.post(
            "/api/lost-deals/bulk-delete",
            json={"ids": [str(lost_one.id), str(lost_two.id)]},
            headers=manager_headers,
        )
    ).status_code == 403

    admin_headers = {"Authorization": f"Bearer {_token(admin)}"}
    individual = await client.delete(f"/api/lost-deals/{lost_one.id}", headers=admin_headers)
    assert individual.status_code == 200, individual.text
    assert individual.json() == {"deleted": 1}

    bulk = await client.post(
        "/api/lost-deals/bulk-delete",
        json={"ids": [str(lost_two.id)]},
        headers=admin_headers,
    )
    assert bulk.status_code == 200, bulk.text
    assert bulk.json() == {"deleted": 1}

    remaining = await db_session.execute(select(Lead).where(Lead.organization_id == org.id))
    assert {lead.name for lead in remaining.scalars().all()} == {"Still Active"}
    call_logs = await db_session.execute(select(CallLog).where(CallLog.lead_id.in_([lost_one.id, lost_two.id])))
    assert call_logs.scalars().all() == []


@pytest.mark.asyncio
async def test_lost_deal_workflow_requires_reason_and_manager_access(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Lost Validation QA", "9300000060")
    manager = await _member(db_session, org.id, "Manager", "9300000061", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Telecaller", "9300000062", UserRole.telecaller)
    lead = Lead(
        organization_id=org.id,
        name="Validation Lead",
        phone="9300000063",
        source=LeadSource.manual,
        status=LeadStatus.new,
        category=LeadCategory.other,
        assigned_to=telecaller.id,
    )
    db_session.add(lead)
    await db_session.commit()
    await db_session.refresh(lead)

    blank_reason = await client.post(
        f"/api/leads/{lead.id}/mark-lost",
        json={"manager_id": str(manager.id), "reason": "   "},
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
    )
    assert blank_reason.status_code == 422
    assert blank_reason.json()["detail"] == "A reason is required when marking a deal as lost"

    telecaller_view = await client.get("/api/lost-deals", headers={"Authorization": f"Bearer {_token(telecaller)}"})
    assert telecaller_view.status_code == 403
