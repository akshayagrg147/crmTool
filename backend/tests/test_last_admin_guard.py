import pytest

from app.core.security import hash_password
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


async def _login(client, phone, password):
    resp = await client.post("/api/auth/login", json={"phone": phone, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["tokens"]["access_token"]


async def _add_member(db, org_id, phone, role):
    member = User(
        organization_id=org_id, name=f"Member-{phone}", phone=phone,
        password_hash=hash_password("Password@123"), role=role, is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@pytest.mark.asyncio
async def test_cannot_remove_last_admin(client, db_session):
    """With a lone telecaller also in the org, the last-admin guard (not the
    last-member guard) must be the one blocking removal."""
    org, admin = await create_org_with_admin(db_session, admin_phone="9200000001")
    await _add_member(db_session, org.id, "9200000007", UserRole.telecaller)
    token = await _login(client, "9200000001", "Password@123")

    resp = await client.delete(
        f"/api/users/{admin.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400
    assert "last admin" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_can_remove_admin_when_second_admin_exists(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9200000002")
    second_admin = await _add_member(db_session, org.id, "9200000003", UserRole.admin)
    token = await _login(client, "9200000002", "Password@123")

    resp = await client.delete(
        f"/api/users/{admin.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_cannot_demote_last_admin(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9200000004")
    token = await _login(client, "9200000004", "Password@123")

    resp = await client.patch(
        f"/api/users/{admin.id}",
        json={"role": "manager"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "last admin" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_deactivate_last_admin(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9200000005")
    token = await _login(client, "9200000005", "Password@123")

    resp = await client.patch(
        f"/api/users/{admin.id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "last active admin" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_remove_last_member_overall(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9200000006")
    token = await _login(client, "9200000006", "Password@123")

    # Only member in the org is the admin themself.
    resp = await client.delete(
        f"/api/users/{admin.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400
