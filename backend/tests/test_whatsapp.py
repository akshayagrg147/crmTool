from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole
from app.models.whatsapp import WhatsAppMessage
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
    await db.commit()
    await db.refresh(member)
    return member


def _headers(user):
    token = create_access_token(str(user.id), user.role.value, str(user.organization_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_can_create_track_and_review_instance_messages(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000001")
    telecaller = await _member(db_session, org.id, "WhatsApp Telecaller", "9300000002", UserRole.telecaller)
    admin_headers = _headers(admin)

    created = await client.post(
        "/api/whatsapp/instances",
        headers=admin_headers,
        json={"assigned_user_id": str(telecaller.id), "label": "Sales number 1", "phone_number": "+919300000002"},
    )
    assert created.status_code == 201, created.text
    instance = created.json()
    assert instance["assigned_user_name"] == "WhatsApp Telecaller"
    assert instance["webhook_token"]

    listed = await client.get("/api/whatsapp/instances", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["webhook_token"] is None

    forbidden = await client.get("/api/whatsapp/instances", headers=_headers(telecaller))
    assert forbidden.status_code == 403

    webhook_url = f"/api/whatsapp/webhook/{instance['id']}"
    webhook_headers = {"X-WhatsApp-Token": instance["webhook_token"]}
    status_event = await client.post(
        webhook_url,
        headers=webhook_headers,
        json={"event": "status", "status": "connected", "phone_number": "+919300000002"},
    )
    assert status_event.status_code == 202

    message_payload = {
        "event": "message",
        "message": {
            "external_message_id": "wamid-1",
            "contact_phone": "+919311112222",
            "contact_name": "Ravi",
            "direction": "inbound",
            "body": "Hello",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    first_message = await client.post(webhook_url, headers=webhook_headers, json=message_payload)
    assert first_message.status_code == 202
    assert first_message.json()["accepted"] == 1
    duplicate = await client.post(webhook_url, headers=webhook_headers, json=message_payload)
    assert duplicate.json()["accepted"] == 0

    messages = await client.get(f"/api/whatsapp/instances/{instance['id']}/messages", headers=admin_headers)
    assert messages.status_code == 200
    assert messages.json()["total"] == 1
    message_id = messages.json()["items"][0]["id"]

    marked = await client.post(
        f"/api/whatsapp/instances/{instance['id']}/messages/{message_id}/read",
        headers=admin_headers,
    )
    assert marked.status_code == 200
    assert marked.json()["is_read"] is True

    overview = await client.get("/api/whatsapp/overview", headers=admin_headers)
    assert overview.status_code == 200
    assert overview.json()["total_instances"] == 1
    assert overview.json()["connected_instances"] == 1
    assert overview.json()["total_messages"] == 1
    assert overview.json()["unread_messages"] == 0

    stored = await db_session.execute(select(WhatsAppMessage).where(WhatsAppMessage.instance_id == instance["id"]))
    assert len(stored.scalars().all()) == 1


@pytest.mark.asyncio
async def test_webhook_requires_per_instance_token(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000011")
    telecaller = await _member(db_session, org.id, "Token Telecaller", "9300000012", UserRole.telecaller)
    created = await client.post(
        "/api/whatsapp/instances",
        headers=_headers(admin),
        json={"assigned_user_id": str(telecaller.id), "label": "Token test"},
    )
    instance = created.json()

    bad = await client.post(
        f"/api/whatsapp/webhook/{instance['id']}",
        headers={"X-WhatsApp-Token": "wrong-token"},
        json={"event": "status", "status": "connected"},
    )
    assert bad.status_code == 401
