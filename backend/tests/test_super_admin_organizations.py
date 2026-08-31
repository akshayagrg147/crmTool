import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token, hash_password, verify_password
from app.models.distribution_settings import DistributionSettings
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.organization import Organization
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


def _token(user: User) -> str:
    return create_access_token(str(user.id), user.role.value, str(user.organization_id) if user.organization_id else None)


@pytest.mark.asyncio
async def test_super_admin_can_view_organization_contacts(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Details Org", "9300000101")
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000102",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)

    response = await client.get(
        f"/api/super-admin/organizations/{org.id}",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Details Org"
    assert body["user_count"] == 1
    assert body["members"][0]["phone"] == admin.phone
    assert body["members"][0]["role"] == "admin"


@pytest.mark.asyncio
async def test_super_admin_can_create_organization_without_optional_email(client, db_session):
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000100",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)

    response = await client.post(
        "/api/super-admin/organizations",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
        json={
            "name": "Created Organization",
            "admin_name": "Created Administrator",
            "admin_phone": "9300000101",
            "admin_email": "",
            "admin_password": "Password@123",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Created Organization"
    assert body["user_count"] == 1
    assert body["lead_count"] == 0

    created_admin = (await db_session.execute(select(User).where(User.phone == "9300000101"))).scalar_one()
    assert created_admin.email is None
    settings = (await db_session.execute(
        select(DistributionSettings).where(DistributionSettings.organization_id == body["id"])
    )).scalar_one()
    assert settings.rotation_index == 0


@pytest.mark.asyncio
async def test_organization_details_require_super_admin(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Private Details Org", "9300000103")

    response = await client.get(
        f"/api/super-admin/organizations/{org.id}",
        headers={"Authorization": f"Bearer {_token(admin)}"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_can_edit_organization_and_primary_admin(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Old Organization", "9300000104")
    admin_id = admin.id
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000105",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)

    response = await client.patch(
        f"/api/super-admin/organizations/{org.id}",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
        json={
            "name": "Updated Organization",
            "plan": "professional",
            "admin_name": "Updated Administrator",
            "admin_phone": "9300000106",
            "admin_email": "admin@updated.example",
            "admin_password": "FreshPassword@123",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Updated Organization"
    assert body["plan"] == "professional"
    primary_admin = next(member for member in body["members"] if member["role"] == "admin")
    assert primary_admin["name"] == "Updated Administrator"
    assert primary_admin["phone"] == "9300000106"
    assert primary_admin["email"] == "admin@updated.example"

    db_session.expire_all()
    updated_admin = (await db_session.execute(select(User).where(User.id == admin_id))).scalar_one()
    assert verify_password("FreshPassword@123", updated_admin.password_hash)


@pytest.mark.asyncio
async def test_edit_organization_rejects_duplicate_admin_phone(client, db_session):
    org, _ = await create_org_with_admin(db_session, "First Organization", "9300000107")
    _, second_admin = await create_org_with_admin(db_session, "Second Organization", "9300000108")
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000109",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)

    response = await client.patch(
        f"/api/super-admin/organizations/{org.id}",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
        json={
            "name": "First Organization",
            "plan": "trial",
            "admin_name": "Admin",
            "admin_phone": second_admin.phone,
            "admin_email": None,
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "A user with this phone number already exists"


@pytest.mark.asyncio
async def test_delete_organization_requires_exact_name_and_cascades_tenant_data(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Delete This Organization", "9300000110")
    org_id = org.id
    lead = Lead(
        organization_id=org.id,
        name="Tenant Lead",
        phone="9300000111",
        source=LeadSource.manual,
        status=LeadStatus.new,
        category=LeadCategory.other,
        interested_categories=[],
    )
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000112",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add_all([lead, super_admin])
    await db_session.commit()
    await db_session.refresh(super_admin)

    mismatch = await client.delete(
        f"/api/super-admin/organizations/{org.id}",
        params={"confirm_name": "delete this organization"},
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
    )
    assert mismatch.status_code == 400

    response = await client.delete(
        f"/api/super-admin/organizations/{org.id}",
        params={"confirm_name": org.name},
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
    )

    assert response.status_code == 204, response.text
    db_session.expire_all()
    org_count = (await db_session.execute(
        select(func.count()).select_from(Organization).where(Organization.id == org_id)
    )).scalar_one()
    user_count = (await db_session.execute(
        select(func.count()).select_from(User).where(User.organization_id == org_id)
    )).scalar_one()
    lead_count = (await db_session.execute(
        select(func.count()).select_from(Lead).where(Lead.organization_id == org_id)
    )).scalar_one()
    settings_count = (await db_session.execute(
        select(func.count()).select_from(DistributionSettings).where(DistributionSettings.organization_id == org_id)
    )).scalar_one()
    assert (org_count, user_count, lead_count, settings_count) == (0, 0, 0, 0)


@pytest.mark.asyncio
async def test_admin_cannot_edit_or_delete_organization(client, db_session):
    org, admin = await create_org_with_admin(db_session, "Protected Organization", "9300000113")
    headers = {"Authorization": f"Bearer {_token(admin)}"}

    edit_response = await client.patch(
        f"/api/super-admin/organizations/{org.id}",
        headers=headers,
        json={
            "name": "Not Allowed",
            "plan": "enterprise",
            "admin_name": "Admin",
            "admin_phone": admin.phone,
            "admin_email": None,
        },
    )
    delete_response = await client.delete(
        f"/api/super-admin/organizations/{org.id}",
        params={"confirm_name": org.name},
        headers=headers,
    )

    assert edit_response.status_code == 403
    assert delete_response.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_can_upload_and_replace_organization_logo(client, db_session, monkeypatch):
    org, _ = await create_org_with_admin(db_session, "Branded Organization", "9300000114")
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000115",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)
    uploads: list[tuple[str, bytes, str]] = []

    def fake_upload(key: str, content: bytes, content_type: str) -> None:
        uploads.append((key, content, content_type))

    monkeypatch.setattr("app.api.super_admin.upload_logo_to_s3", fake_upload)
    response = await client.post(
        f"/api/super-admin/organizations/{org.id}/logo",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
        files={"file": ("brand.png", b"fake-png", "image/png")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["logo_url"].endswith(f"/api/branding/organizations/{org.id}/logo")
    assert len(uploads) == 1
    assert uploads[0][1:] == (b"fake-png", "image/png")

    db_session.expire_all()
    saved = (await db_session.execute(select(Organization).where(Organization.id == org.id))).scalar_one()
    assert saved.logo_storage_key == uploads[0][0]
    assert saved.logo_url == body["logo_url"]


@pytest.mark.asyncio
async def test_logo_upload_rejects_unsupported_files(client, db_session):
    org, _ = await create_org_with_admin(db_session, "Logo Validation Org", "9300000116")
    super_admin = User(
        organization_id=None,
        name="Platform Owner",
        phone="9300000117",
        password_hash=hash_password("Password@123"),
        role=UserRole.super_admin,
        is_active=True,
    )
    db_session.add(super_admin)
    await db_session.commit()
    await db_session.refresh(super_admin)
    response = await client.post(
        f"/api/super-admin/organizations/{org.id}/logo",
        headers={"Authorization": f"Bearer {_token(super_admin)}"},
        files={"file": ("brand.gif", b"gif", "image/gif")},
    )

    assert response.status_code == 415
