import pytest

from app.models.lead import Lead
from tests.conftest import create_org_with_admin


async def _login(client, phone, password):
    resp = await client.post("/api/auth/login", json={"phone": phone, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["tokens"]["access_token"]


@pytest.mark.asyncio
async def test_leads_are_isolated_between_organizations(client, db_session):
    org_a, admin_a = await create_org_with_admin(db_session, "Org A", "9300000001")
    org_b, admin_b = await create_org_with_admin(db_session, "Org B", "9300000002")

    token_a = await _login(client, "9300000001", "Password@123")
    token_b = await _login(client, "9300000002", "Password@123")

    create_resp = await client.post(
        "/api/leads",
        json={"name": "Org A Lead", "phone": "9111111111", "source": "manual"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_resp.status_code == 201
    lead_a_id = create_resp.json()["id"]

    # Org B cannot see Org A's lead in listing.
    list_b = await client.get("/api/leads", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.status_code == 200
    assert all(item["id"] != lead_a_id for item in list_b.json()["items"])

    # Org B cannot fetch Org A's lead directly.
    get_b = await client.get(f"/api/leads/{lead_a_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert get_b.status_code == 404

    # Org B cannot update Org A's lead.
    patch_b = await client.patch(
        f"/api/leads/{lead_a_id}", json={"notes": "hijacked"}, headers={"Authorization": f"Bearer {token_b}"}
    )
    assert patch_b.status_code == 404


@pytest.mark.asyncio
async def test_team_members_are_isolated_between_organizations(client, db_session):
    org_a, admin_a = await create_org_with_admin(db_session, "Org A", "9300000003")
    org_b, admin_b = await create_org_with_admin(db_session, "Org B", "9300000004")

    token_a = await _login(client, "9300000003", "Password@123")

    team_a = await client.get("/api/users", headers={"Authorization": f"Bearer {token_a}"})
    assert team_a.status_code == 200
    phones = [m["phone"] for m in team_a.json()]
    assert "9300000004" not in phones


@pytest.mark.asyncio
async def test_clear_leads_only_affects_own_org(client, db_session):
    org_a, admin_a = await create_org_with_admin(db_session, "Org A", "9300000005")
    org_b, admin_b = await create_org_with_admin(db_session, "Org B", "9300000006")

    token_a = await _login(client, "9300000005", "Password@123")
    token_b = await _login(client, "9300000006", "Password@123")

    await client.post(
        "/api/leads", json={"name": "B Lead", "phone": "9222222222"},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    clear_a = await client.delete("/api/leads", headers={"Authorization": f"Bearer {token_a}"})
    assert clear_a.status_code == 204

    list_b = await client.get("/api/leads", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.json()["total"] == 1
