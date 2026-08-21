import pytest

from app.core.security import create_access_token
from tests.conftest import create_org_with_admin


def _headers(admin) -> dict[str, str]:
    token = create_access_token(str(admin.id), admin.role.value, str(admin.organization_id))
    return {"Authorization": f"Bearer {token}"}


def _valid_payload() -> dict[str, str]:
    return {
        "name": "Required Fields User",
        "phone": "9300000110",
        "email": "required@example.com",
        "role": "telecaller",
        "password": "Secure@123",
        "state": "Haryana",
        "city": "Kaithal",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("missing_field", ["name", "phone", "email", "role", "password", "state", "city"])
async def test_team_member_creation_rejects_missing_fields(client, db_session, missing_field):
    _, admin = await create_org_with_admin(db_session, admin_phone="9300000109")
    payload = _valid_payload()
    payload.pop(missing_field)

    response = await client.post("/api/users", json=payload, headers=_headers(admin))

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_team_member_creation_accepts_all_required_fields(client, db_session):
    _, admin = await create_org_with_admin(db_session, admin_phone="9300000111")

    response = await client.post("/api/users", json=_valid_payload(), headers=_headers(admin))

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "required@example.com"
    assert body["state"] == "Haryana"
    assert body["city"] == "Kaithal"
