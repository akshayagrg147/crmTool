import pytest

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


async def _add_member(db, organization_id, name, phone, role):
    member = User(
        organization_id=organization_id,
        name=name,
        phone=phone,
        password_hash=hash_password("OldPassword@123"),
        role=role,
        is_active=True,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


@pytest.mark.asyncio
async def test_admin_can_reset_telecaller_password(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Password Reset QA", "9500000001")
    telecaller = await _add_member(db_session, org.id, "Reset Telecaller", "9500000002", UserRole.telecaller)
    admin_headers = {"Authorization": f"Bearer {_token(admin)}"}

    response = await client.post(
        f"/api/users/{telecaller.id}/reset-password",
        json={"new_password": "NewPassword@123"},
        headers=admin_headers,
    )

    assert response.status_code == 204, response.text
    await db_session.refresh(telecaller)
    assert verify_password("NewPassword@123", telecaller.password_hash)

    old_login = await client.post(
        "/api/auth/login", json={"phone": telecaller.phone, "password": "OldPassword@123"}
    )
    new_login = await client.post(
        "/api/auth/login", json={"phone": telecaller.phone, "password": "NewPassword@123"}
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_only_admin_can_reset_telecaller_password(client, db_session):
    org, _admin = await create_org_with_admin(db_session, "Password Role QA", "9500000011")
    manager = await _add_member(db_session, org.id, "Manager", "9500000012", UserRole.manager)
    telecaller = await _add_member(db_session, org.id, "Telecaller", "9500000013", UserRole.telecaller)

    response = await client.post(
        f"/api/users/{telecaller.id}/reset-password",
        json={"new_password": "NewPassword@123"},
        headers={"Authorization": f"Bearer {_token(manager)}"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_reset_manager_password(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Password Target QA", "9500000021")
    manager = await _add_member(db_session, org.id, "Manager", "9500000022", UserRole.manager)

    response = await client.post(
        f"/api/users/{manager.id}/reset-password",
        json={"new_password": "NewPassword@123"},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 400
    assert "only for telecallers" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reset_password_requires_six_characters(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Password Validation QA", "9500000031")
    telecaller = await _add_member(db_session, org.id, "Telecaller", "9500000032", UserRole.telecaller)

    response = await client.post(
        f"/api/users/{telecaller.id}/reset-password",
        json={"new_password": "short"},
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 422
