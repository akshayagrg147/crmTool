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
    tracked = messages.json()["items"][0]
    assert tracked["chat_type"] == "direct"
    assert tracked["chat_id"] == "+919311112222"
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
async def test_group_message_keeps_chat_and_participant_identity(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000031")
    telecaller = await _member(db_session, org.id, "Group Telecaller", "9300000032", UserRole.telecaller)
    admin_headers = _headers(admin)
    created = await client.post(
        "/api/whatsapp/instances",
        headers=admin_headers,
        json={"assigned_user_id": str(telecaller.id), "label": "Group test"},
    )
    instance = created.json()
    webhook_url = f"/api/whatsapp/webhook/{instance['id']}"
    response = await client.post(
        webhook_url,
        headers={"X-WhatsApp-Token": instance["webhook_token"]},
        json={
            "event": "message",
            "message": {
                "external_message_id": "wamid-group-1",
                "chat_id": "120363123456789@g.us",
                "chat_type": "group",
                "chat_name": "Sales team",
                "contact_phone": "120363123456789",
                "sender_phone": "+919311112222",
                "sender_name": "Ravi",
                "recipient_phone": "120363123456789",
                "recipient_name": "Sales team",
                "direction": "inbound",
                "body": "Good morning team",
                "sent_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    assert response.status_code == 202
    messages = await client.get(f"/api/whatsapp/instances/{instance['id']}/messages", headers=admin_headers)
    assert messages.status_code == 200
    tracked = messages.json()["items"][0]
    assert tracked["chat_type"] == "group"
    assert tracked["chat_id"] == "120363123456789@g.us"
    assert tracked["chat_name"] == "Sales team"
    assert tracked["sender_phone"] == "+919311112222"
    assert tracked["sender_name"] == "Ravi"
    assert tracked["recipient_name"] == "Sales team"


@pytest.mark.asyncio
async def test_outbound_lid_message_is_resolved_from_same_chat(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000061")
    telecaller = await _member(db_session, org.id, "LID Telecaller", "9300000062", UserRole.telecaller)
    headers = _headers(admin)
    created = await client.post(
        "/api/whatsapp/instances",
        headers=headers,
        json={"assigned_user_id": str(telecaller.id), "label": "LID test"},
    )
    instance = created.json()
    webhook_url = f"/api/whatsapp/webhook/{instance['id']}"
    webhook_headers = {"X-WhatsApp-Token": instance["webhook_token"]}
    chat_id = "63329594810436@lid"
    now = datetime.now(timezone.utc).isoformat()

    outbound = await client.post(
        webhook_url,
        headers=webhook_headers,
        json={
            "event": "message",
            "message": {
                "external_message_id": "wamid-lid-outbound",
                "chat_id": chat_id,
                "chat_type": "direct",
                "contact_phone": "Unknown contact",
                "sender_phone": "+919300000062",
                "sender_name": "You",
                "direction": "outbound",
                "body": "Hello",
                "sent_at": now,
            },
        },
    )
    assert outbound.status_code == 202

    inbound = await client.post(
        webhook_url,
        headers=webhook_headers,
        json={
            "event": "message",
            "message": {
                "external_message_id": "wamid-lid-inbound",
                "chat_id": chat_id,
                "chat_type": "direct",
                "contact_phone": "+919311116666",
                "sender_phone": "+919311116666",
                "sender_name": "Ravi",
                "recipient_phone": "+919300000062",
                "direction": "inbound",
                "body": "Hi back",
                "sent_at": now,
            },
        },
    )
    assert inbound.status_code == 202

    messages = await client.get(f"/api/whatsapp/instances/{instance['id']}/messages", headers=headers)
    assert messages.status_code == 200
    by_body = {item["body"]: item for item in messages.json()["items"]}
    assert by_body["Hello"]["contact_phone"] == "919311116666"
    assert by_body["Hello"]["recipient_phone"] == "919311116666"
    assert by_body["Hi back"]["contact_phone"] == "919311116666"


@pytest.mark.asyncio
async def test_each_employee_number_has_an_isolated_instance_and_message_stream(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000041")
    first_employee = await _member(db_session, org.id, "First Telecaller", "9300000042", UserRole.telecaller)
    second_employee = await _member(db_session, org.id, "Second Telecaller", "9300000043", UserRole.telecaller)
    headers = _headers(admin)

    first_response = await client.post(
        "/api/whatsapp/instances",
        headers=headers,
        json={"assigned_user_id": str(first_employee.id), "label": "First number"},
    )
    second_response = await client.post(
        "/api/whatsapp/instances",
        headers=headers,
        json={"assigned_user_id": str(second_employee.id), "label": "Second number"},
    )
    assert first_response.status_code == 201
    assert second_response.status_code == 201
    first = first_response.json()
    second = second_response.json()
    assert first["session_key"] != second["session_key"]

    now = datetime.now(timezone.utc).isoformat()
    for instance, phone, external_id in (
        (first, "+919311110001", "first-message"),
        (second, "+919311110002", "second-message"),
    ):
        response = await client.post(
            f"/api/whatsapp/webhook/{instance['id']}",
            headers={"X-WhatsApp-Token": instance["webhook_token"]},
            json={
                "event": "message",
                "message": {
                    "external_message_id": external_id,
                    "contact_phone": phone,
                    "direction": "inbound",
                    "body": external_id,
                    "sent_at": now,
                },
            },
        )
        assert response.status_code == 202
        assert response.json()["accepted"] == 1

    first_messages = await client.get(f"/api/whatsapp/instances/{first['id']}/messages", headers=headers)
    second_messages = await client.get(f"/api/whatsapp/instances/{second['id']}/messages", headers=headers)
    assert [item["body"] for item in first_messages.json()["items"]] == ["first-message"]
    assert [item["body"] for item in second_messages.json()["items"]] == ["second-message"]


@pytest.mark.asyncio
async def test_admin_can_receive_and_view_instance_qr(client, db_session):
    org, admin = await create_org_with_admin(db_session, admin_phone="9300000021")
    telecaller = await _member(db_session, org.id, "QR Telecaller", "9300000022", UserRole.telecaller)
    admin_headers = _headers(admin)
    created = await client.post(
        "/api/whatsapp/instances",
        headers=admin_headers,
        json={"assigned_user_id": str(telecaller.id), "label": "QR test"},
    )
    instance = created.json()
    response = await client.post(
        f"/api/whatsapp/webhook/{instance['id']}",
        headers={"X-WhatsApp-Token": instance["webhook_token"]},
        json={"event": "status", "status": "connecting", "qr_code": "data:image/png;base64,qr"},
    )
    assert response.status_code == 202
    listed = await client.get("/api/whatsapp/instances", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["qr_code"] == "data:image/png;base64,qr"


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
