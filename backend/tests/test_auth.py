import pytest

from app.core.security import hash_password
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


@pytest.mark.asyncio
async def test_login_country_code_matches_existing_indian_phone(client, db_session):
    await create_org_with_admin(db_session, admin_phone="9999900000")

    response = await client.post(
        "/api/auth/login",
        json={"phone": "9999900000", "country_code": "+91", "password": "Password@123"},
    )

    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_login_country_code_matches_e164_user_phone(client, db_session):
    organization, _ = await create_org_with_admin(db_session, admin_phone="9999900001")
    db_session.add(
        User(
            organization_id=organization.id,
            name="International Admin",
            phone="+14155552671",
            password_hash=hash_password("Password@123"),
            role=UserRole.admin,
            is_active=True,
        )
    )
    await db_session.commit()

    response = await client.post(
        "/api/auth/login",
        json={"phone": "4155552671", "country_code": "+1", "password": "Password@123"},
    )

    assert response.status_code == 200, response.text
