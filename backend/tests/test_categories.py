import pytest
from sqlalchemy import select

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
async def test_admin_creates_category_and_telecaller_can_update_lead_with_it(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Category QA", "9300000080")
    manager = await _member(db_session, org.id, "Category Manager", "9300000081", UserRole.manager)
    telecaller = await _member(db_session, org.id, "Category Telecaller", "9300000082", UserRole.telecaller)
    lead = Lead(
        organization_id=org.id,
        name="Category Lead",
        phone="9300000083",
        status=LeadStatus.new,
        assigned_to=telecaller.id,
        category=LeadCategory.other,
    )
    db_session.add(lead)
    await db_session.commit()
    await db_session.refresh(lead)

    admin_headers = {"Authorization": f"Bearer {_token(admin)}"}
    manager_headers = {"Authorization": f"Bearer {_token(manager)}"}
    telecaller_headers = {"Authorization": f"Bearer {_token(telecaller)}"}

    default_categories = await client.get("/api/leads/categories", headers=telecaller_headers)
    assert default_categories.status_code == 200
    assert {option["value"] for option in default_categories.json()} >= {"pharmaceutical", "other"}

    manager_create = await client.post(
        "/api/leads/categories", json={"name": "Wholesale"}, headers=manager_headers
    )
    assert manager_create.status_code == 403

    created = await client.post(
        "/api/leads/categories", json={"name": "Wholesale"}, headers=admin_headers
    )
    assert created.status_code == 201, created.text
    assert created.json() == {"value": "Wholesale", "label": "Wholesale", "is_custom": True}

    duplicate = await client.post(
        "/api/leads/categories", json={"name": " wholesale "}, headers=admin_headers
    )
    assert duplicate.status_code == 409

    updated = await client.patch(
        f"/api/leads/{lead.id}",
        json={"category": "Wholesale"},
        headers=telecaller_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["category"] == "Wholesale"

    invalid = await client.patch(
        f"/api/leads/{lead.id}",
        json={"category": "Not Created"},
        headers=telecaller_headers,
    )
    assert invalid.status_code == 422

    filtered = await client.get(
        "/api/leads", params={"category": "Wholesale"}, headers=manager_headers
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1

    stored = await db_session.execute(select(Lead).where(Lead.id == lead.id))
    persisted = stored.scalar_one()
    await db_session.refresh(persisted)
    assert persisted.category == LeadCategory.other
    assert persisted.custom_category == "Wholesale"

    multi = await client.post(
        "/api/leads/categories", json={"name": "Retail"}, headers=admin_headers
    )
    assert multi.status_code == 201
    selected = await client.patch(
        f"/api/leads/{lead.id}",
        json={"interested_categories": ["Wholesale", "pharmaceutical", "Retail"]},
        headers=telecaller_headers,
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["category"] == "Wholesale"
    assert selected.json()["interested_categories"] == ["Wholesale", "pharmaceutical", "Retail"]

    for category in ("Wholesale", "pharmaceutical", "Retail"):
        filtered_multi = await client.get(
            "/api/leads", params={"category": category}, headers=manager_headers
        )
        assert filtered_multi.status_code == 200
        assert filtered_multi.json()["total"] == 1
