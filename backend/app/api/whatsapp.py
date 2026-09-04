import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import Integer, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import encrypt_json, decrypt_json
from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin
from app.core.security import hash_password, verify_password
from app.models.lead import Lead
from app.models.user import User, UserRole
from app.models.whatsapp import WhatsAppChatType, WhatsAppInstance, WhatsAppInstanceStatus, WhatsAppMessage, WhatsAppMessageDirection
from app.schemas.whatsapp import (
    WhatsAppEmployeeSummary,
    WhatsAppInstanceCreate,
    WhatsAppInstanceOut,
    WhatsAppInstanceUpdate,
    WhatsAppMessageIn,
    WhatsAppMessageOut,
    WhatsAppMessagePage,
    WhatsAppOverview,
    WhatsAppWebhookEvent,
)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
webhook_router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _phone_from_value(value: str | None) -> str | None:
    """Return a phone-number JID as digits, never a group/LID identifier."""
    if not value:
        return None
    text = str(value).strip()
    if "@" in text:
        user, server = text.split("@", 1)
        if server not in {"s.whatsapp.net", "c.us"}:
            return None
        text = user
    text = text.split(":", 1)[0].lstrip("+")
    return text if text.isdigit() and 5 <= len(text) <= 20 else None


def _is_unresolved_contact(value: str | None, chat_id: str | None = None) -> bool:
    """Identify placeholders and anonymous LIDs that must not be shown as phone numbers."""
    if not value:
        return True
    normalized = value.strip().lower()
    if normalized in {"unknown contact", "unknown", "phone unavailable", "group chat"}:
        return True
    if chat_id and chat_id.endswith("@lid"):
        chat_user = chat_id.split("@", 1)[0].split(":", 1)[0]
        if value == chat_user:
            return True
    return False


async def _known_contact_phone(
    db: AsyncSession,
    instance_id: uuid.UUID,
    chat_id: str,
) -> str | None:
    """Find a real phone number learned from an inbound message in this chat."""
    result = await db.execute(
        select(WhatsAppMessage.contact_phone)
        .where(
            WhatsAppMessage.instance_id == instance_id,
            WhatsAppMessage.chat_id == chat_id,
            WhatsAppMessage.chat_type == WhatsAppChatType.direct.value,
            WhatsAppMessage.direction == WhatsAppMessageDirection.inbound.value,
        )
        .order_by(WhatsAppMessage.sent_at.desc())
        .limit(20)
    )
    for value in result.scalars():
        if _is_unresolved_contact(value, chat_id):
            continue
        phone = _phone_from_value(value)
        if phone:
            return phone
    return None


def _webhook_url(instance_id: uuid.UUID) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/whatsapp/webhook/{instance_id}"


async def _get_instance(db: AsyncSession, org_id: uuid.UUID, instance_id: uuid.UUID) -> WhatsAppInstance:
    result = await db.execute(
        select(WhatsAppInstance).where(
            WhatsAppInstance.id == instance_id,
            WhatsAppInstance.organization_id == org_id,
        )
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "WhatsApp instance not found")
    return instance


async def _get_assigned_user(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> User:
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == org_id,
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if user is None or user.role == UserRole.super_admin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose an active employee from this organization")
    return user


async def _instance_out(
    db: AsyncSession,
    instance: WhatsAppInstance,
    token: str | None = None,
) -> WhatsAppInstanceOut:
    user_result = await db.execute(select(User).where(User.id == instance.assigned_user_id))
    user = user_result.scalar_one()
    message_count_result = await db.execute(
        select(func.count()).select_from(WhatsAppMessage).where(WhatsAppMessage.instance_id == instance.id)
    )
    unread_count_result = await db.execute(
        select(func.count()).select_from(WhatsAppMessage).where(
            WhatsAppMessage.instance_id == instance.id,
            WhatsAppMessage.is_read.is_(False),
            WhatsAppMessage.direction == WhatsAppMessageDirection.inbound.value,
        )
    )
    return WhatsAppInstanceOut(
        id=instance.id,
        assigned_user_id=instance.assigned_user_id,
        assigned_user_name=user.name,
        assigned_user_role=user.role.value,
        label=instance.label,
        phone_number=instance.phone_number,
        session_key=instance.session_key,
        status=WhatsAppInstanceStatus(instance.status),
        is_enabled=instance.is_enabled,
        last_connected_at=instance.last_connected_at,
        last_seen_at=instance.last_seen_at,
        last_message_at=instance.last_message_at,
        last_error=instance.last_error,
        message_count=message_count_result.scalar_one(),
        unread_count=unread_count_result.scalar_one(),
        created_at=instance.created_at,
        webhook_url=_webhook_url(instance.id),
        webhook_token=token,
        qr_code=instance.qr_code,
    )


async def _bridge_request(method: str, path: str, payload: dict | None = None) -> None:
    """Start/stop a session in the private bridge, when configured."""
    if not settings.whatsapp_bridge_url:
        raise RuntimeError("WhatsApp Web bridge is not configured")
    import httpx

    headers = {"Authorization": f"Bearer {settings.whatsapp_bridge_token}"}
    url = f"{settings.whatsapp_bridge_url.rstrip('/')}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=settings.whatsapp_bridge_timeout_seconds) as client:
        response = await client.request(method, url, headers=headers, json=payload)
    if response.is_error:
        detail = response.text[:500] or response.reason_phrase
        raise RuntimeError(f"WhatsApp bridge returned {response.status_code}: {detail}")


def _needs_fresh_bridge_auth(instance: WhatsAppInstance) -> bool:
    """Return true when WhatsApp rejected the saved linked-device session."""
    if not instance.last_error:
        return False
    error = instance.last_error.lower()
    return (
        error.startswith("whatsapp web session expired")
        or error.startswith("whatsapp web logged out this session")
    )


async def _start_bridge_session(instance: WhatsAppInstance, *, reset_auth: bool = False) -> None:
    secret = decrypt_json(instance.webhook_secret_encrypted).get("token")
    if not secret:
        raise RuntimeError("Rotate the bridge token for this instance before connecting")
    payload = {
        "session_key": instance.session_key,
        "webhook_url": _webhook_url(instance.id),
        "webhook_token": secret,
    }
    if reset_auth:
        # Reset only the bridge's invalid WhatsApp credentials. Tracked CRM
        # messages remain in Postgres and are never removed by reconnecting.
        payload["reset_auth"] = True
    await _bridge_request("POST", "/sessions", payload)


async def _stop_bridge_session(instance: WhatsAppInstance) -> None:
    if not settings.whatsapp_bridge_url:
        return
    await _bridge_request("DELETE", f"/sessions/{instance.session_key}")


def _message_out(message: WhatsAppMessage) -> WhatsAppMessageOut:
    return WhatsAppMessageOut(
        id=message.id,
        instance_id=message.instance_id,
        lead_id=message.lead_id,
        external_message_id=message.external_message_id,
        contact_phone=message.contact_phone,
        contact_name=message.contact_name,
        chat_id=message.chat_id,
        chat_type=WhatsAppChatType(message.chat_type),
        chat_name=message.chat_name,
        sender_phone=message.sender_phone,
        sender_name=message.sender_name,
        recipient_phone=message.recipient_phone,
        recipient_name=message.recipient_name,
        direction=WhatsAppMessageDirection(message.direction),
        message_type=message.message_type,
        body=message.body,
        is_read=message.is_read,
        sent_at=message.sent_at,
        created_at=message.created_at,
    )


@router.get("/instances", response_model=list[WhatsAppInstanceOut])
async def list_instances(current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WhatsAppInstance)
        .where(WhatsAppInstance.organization_id == current.organization_id)
        .order_by(WhatsAppInstance.created_at.desc())
    )
    return [await _instance_out(db, instance) for instance in result.scalars().all()]


@router.post("/instances", response_model=WhatsAppInstanceOut, status_code=status.HTTP_201_CREATED)
async def create_instance(
    payload: WhatsAppInstanceCreate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_assigned_user(db, current.organization_id, payload.assigned_user_id)
    token = secrets.token_urlsafe(32)
    instance = WhatsAppInstance(
        organization_id=current.organization_id,
        assigned_user_id=payload.assigned_user_id,
        label=payload.label,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        session_key=uuid.uuid4().hex,
        webhook_secret_hash=hash_password(token),
        webhook_secret_encrypted=encrypt_json({"token": token}),
        status=WhatsAppInstanceStatus.disconnected.value,
        is_enabled=True,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return await _instance_out(db, instance, token)


@router.patch("/instances/{instance_id}", response_model=WhatsAppInstanceOut)
async def update_instance(
    instance_id: uuid.UUID,
    payload: WhatsAppInstanceUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    instance = await _get_instance(db, current.organization_id, instance_id)
    data = payload.model_dump(exclude_unset=True)
    if "assigned_user_id" in data:
        await _get_assigned_user(db, current.organization_id, data["assigned_user_id"])
    if "phone_number" in data and data["phone_number"]:
        data["phone_number"] = data["phone_number"].strip()
    for field, value in data.items():
        setattr(instance, field, value)
    await db.commit()
    await db.refresh(instance)
    return await _instance_out(db, instance)


@router.post("/instances/{instance_id}/connect", response_model=WhatsAppInstanceOut)
async def request_connect(
    instance_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    instance = await _get_instance(db, current.organization_id, instance_id)
    reset_auth = _needs_fresh_bridge_auth(instance)
    instance.is_enabled = True
    instance.status = WhatsAppInstanceStatus.connecting.value
    instance.last_error = None
    instance.qr_code = None
    # Instances created before the first-party bridge was introduced only have
    # the hashed webhook token. Generate and persist an encrypted copy on the
    # first connect so they can start a QR session without a manual rotation.
    if not decrypt_json(instance.webhook_secret_encrypted).get("token"):
        token = secrets.token_urlsafe(32)
        instance.webhook_secret_hash = hash_password(token)
        instance.webhook_secret_encrypted = encrypt_json({"token": token})
    await db.commit()
    try:
        await _start_bridge_session(instance, reset_auth=reset_auth)
    except RuntimeError as exc:
        instance.status = WhatsAppInstanceStatus.error.value
        instance.last_error = str(exc)
        await db.commit()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    await db.refresh(instance)
    return await _instance_out(db, instance)


@router.post("/instances/{instance_id}/disconnect", response_model=WhatsAppInstanceOut)
async def disconnect_instance(
    instance_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    instance = await _get_instance(db, current.organization_id, instance_id)
    instance.is_enabled = False
    instance.status = WhatsAppInstanceStatus.disconnected.value
    instance.last_error = None
    instance.qr_code = None
    await db.commit()
    try:
        await _stop_bridge_session(instance)
    except RuntimeError as exc:
        instance.last_error = str(exc)
        await db.commit()
    await db.refresh(instance)
    return await _instance_out(db, instance)


@router.post("/instances/{instance_id}/rotate-token", response_model=WhatsAppInstanceOut)
async def rotate_instance_token(
    instance_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    instance = await _get_instance(db, current.organization_id, instance_id)
    token = secrets.token_urlsafe(32)
    instance.webhook_secret_hash = hash_password(token)
    instance.webhook_secret_encrypted = encrypt_json({"token": token})
    await db.commit()
    if instance.status in {WhatsAppInstanceStatus.connected.value, WhatsAppInstanceStatus.connecting.value}:
        try:
            await _stop_bridge_session(instance)
            instance.status = WhatsAppInstanceStatus.connecting.value
            instance.qr_code = None
            await db.commit()
            await _start_bridge_session(instance)
        except RuntimeError as exc:
            instance.status = WhatsAppInstanceStatus.error.value
            instance.last_error = str(exc)
            await db.commit()
    await db.refresh(instance)
    return await _instance_out(db, instance, token)


@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instance(
    instance_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    instance = await _get_instance(db, current.organization_id, instance_id)
    try:
        await _stop_bridge_session(instance)
    except RuntimeError:
        pass
    await db.delete(instance)
    await db.commit()


@router.get("/instances/{instance_id}/messages", response_model=WhatsAppMessagePage)
async def list_messages(
    instance_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_instance(db, current.organization_id, instance_id)
    where = WhatsAppMessage.instance_id == instance_id
    total_result = await db.execute(select(func.count()).select_from(WhatsAppMessage).where(where))
    result = await db.execute(
        select(WhatsAppMessage)
        .where(where)
        .order_by(WhatsAppMessage.sent_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return WhatsAppMessagePage(
        items=[_message_out(message) for message in result.scalars().all()],
        page=page,
        page_size=page_size,
        total=total_result.scalar_one(),
    )


@router.post("/instances/{instance_id}/messages/{message_id}/read", response_model=WhatsAppMessageOut)
async def mark_message_read(
    instance_id: uuid.UUID,
    message_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_instance(db, current.organization_id, instance_id)
    result = await db.execute(
        select(WhatsAppMessage).where(
            WhatsAppMessage.id == message_id,
            WhatsAppMessage.instance_id == instance_id,
            WhatsAppMessage.organization_id == current.organization_id,
        )
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "WhatsApp message not found")
    message.is_read = True
    await db.commit()
    await db.refresh(message)
    return _message_out(message)


@router.get("/overview", response_model=WhatsAppOverview)
async def overview(current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    org_id = current.organization_id
    totals = await db.execute(
        select(
            func.count(WhatsAppInstance.id),
            func.sum(func.cast(WhatsAppInstance.status == WhatsAppInstanceStatus.connected.value, Integer)),
        ).where(WhatsAppInstance.organization_id == org_id)
    )
    total_instances, connected_instances = totals.one()
    message_totals = await db.execute(
        select(
            func.count(WhatsAppMessage.id),
            func.sum(func.cast(
                (WhatsAppMessage.is_read.is_(False))
                & (WhatsAppMessage.direction == WhatsAppMessageDirection.inbound.value),
                Integer,
            )),
        ).where(WhatsAppMessage.organization_id == org_id)
    )
    total_messages, unread_messages = message_totals.one()
    employees_result = await db.execute(
        select(User).where(User.organization_id == org_id).order_by(User.name)
    )
    employees: list[WhatsAppEmployeeSummary] = []
    for user in employees_result.scalars().all():
        instance_count = await db.execute(
            select(func.count()).select_from(WhatsAppInstance).where(WhatsAppInstance.assigned_user_id == user.id)
        )
        connected_count = await db.execute(
            select(func.count()).select_from(WhatsAppInstance).where(
                WhatsAppInstance.assigned_user_id == user.id,
                WhatsAppInstance.status == WhatsAppInstanceStatus.connected.value,
            )
        )
        message_count = await db.execute(
            select(func.count()).select_from(WhatsAppMessage).join(
                WhatsAppInstance, WhatsAppMessage.instance_id == WhatsAppInstance.id
            ).where(WhatsAppInstance.assigned_user_id == user.id)
        )
        unread_count = await db.execute(
            select(func.count()).select_from(WhatsAppMessage).join(
                WhatsAppInstance, WhatsAppMessage.instance_id == WhatsAppInstance.id
            ).where(
                WhatsAppInstance.assigned_user_id == user.id,
                WhatsAppMessage.is_read.is_(False),
                WhatsAppMessage.direction == WhatsAppMessageDirection.inbound.value,
            )
        )
        employees.append(WhatsAppEmployeeSummary(
            user_id=user.id,
            user_name=user.name,
            user_role=user.role.value,
            instances=instance_count.scalar_one(),
            connected_instances=connected_count.scalar_one(),
            messages=message_count.scalar_one(),
            unread_messages=unread_count.scalar_one(),
        ))
    return WhatsAppOverview(
        total_instances=total_instances or 0,
        connected_instances=connected_instances or 0,
        total_messages=total_messages or 0,
        unread_messages=unread_messages or 0,
        employees=employees,
    )


@webhook_router.post("/webhook/{instance_id}", status_code=status.HTTP_202_ACCEPTED)
async def receive_webhook(
    instance_id: uuid.UUID,
    event: WhatsAppWebhookEvent,
    x_whatsapp_token: str | None = Header(default=None, alias="X-WhatsApp-Token"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(WhatsAppInstance).where(WhatsAppInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown WhatsApp instance")
    if not x_whatsapp_token or not verify_password(x_whatsapp_token, instance.webhook_secret_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid WhatsApp webhook token")
    if not instance.is_enabled:
        return {"accepted": 0, "message": "Instance is paused"}

    now = datetime.now(timezone.utc)
    instance.last_seen_at = now
    if event.phone_number:
        instance.phone_number = event.phone_number.strip()
    if event.event == "status":
        if event.status is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status event requires status")
        instance.status = event.status.value
        instance.last_error = event.error
        instance.qr_code = event.qr_code if event.status == WhatsAppInstanceStatus.connecting else None
        if event.status == WhatsAppInstanceStatus.connected:
            instance.last_connected_at = now
        await db.commit()
        return {"accepted": 1, "message": "Status recorded"}

    if event.message is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message event requires message")
    payload: WhatsAppMessageIn = event.message
    if payload.lead_id:
        lead_result = await db.execute(
            select(Lead.id).where(Lead.id == payload.lead_id, Lead.organization_id == instance.organization_id)
        )
        if lead_result.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lead does not belong to this organization")
    if payload.external_message_id:
        duplicate = await db.execute(
            select(WhatsAppMessage).where(
                WhatsAppMessage.instance_id == instance.id,
                WhatsAppMessage.external_message_id == payload.external_message_id,
            )
        )
        if duplicate.scalar_one_or_none() is not None:
            await db.commit()
            return {"accepted": 0, "message": "Message already recorded"}
    sent_at = payload.sent_at if payload.sent_at.tzinfo else payload.sent_at.replace(tzinfo=timezone.utc)
    metadata = payload.metadata or {}
    raw_chat_id = payload.chat_id or metadata.get("remote_jid") or payload.contact_phone or payload.sender_phone or payload.recipient_phone or "unknown"
    chat_id = str(raw_chat_id).strip()
    chat_type = payload.chat_type
    if chat_type == WhatsAppChatType.direct and (chat_id.endswith("@g.us") or metadata.get("chat_type") == WhatsAppChatType.group.value):
        chat_type = WhatsAppChatType.group
    if chat_type == WhatsAppChatType.group:
        contact_phone = "Group chat"
    else:
        contact_phone = _phone_from_value(payload.contact_phone)
        if not contact_phone:
            contact_phone = _phone_from_value(payload.sender_phone if payload.direction == WhatsAppMessageDirection.inbound else payload.recipient_phone)
        if not contact_phone:
            # WhatsApp Web can identify a direct chat only by an anonymous LID
            # on outbound events. Reuse the number learned from an inbound
            # message in the same conversation when it becomes available.
            contact_phone = await _known_contact_phone(db, instance.id, chat_id)
        contact_phone = contact_phone or "Unknown contact"
    chat_name = payload.chat_name.strip() if payload.chat_name else None
    recipient_phone = _phone_from_value(payload.recipient_phone)
    if chat_type == WhatsAppChatType.direct and payload.direction == WhatsAppMessageDirection.outbound and not recipient_phone:
        recipient_phone = _known_contact_phone(db, instance.id, chat_id)
    message = WhatsAppMessage(
        organization_id=instance.organization_id,
        instance_id=instance.id,
        lead_id=payload.lead_id,
        external_message_id=payload.external_message_id,
        contact_phone=contact_phone,
        contact_name=payload.contact_name.strip() if payload.contact_name else None,
        chat_id=chat_id,
        chat_type=chat_type.value,
        chat_name=chat_name,
        sender_phone=_phone_from_value(payload.sender_phone),
        sender_name=payload.sender_name.strip() if payload.sender_name else None,
        recipient_phone=recipient_phone,
        recipient_name=payload.recipient_name.strip() if payload.recipient_name else None,
        direction=payload.direction.value,
        message_type=payload.message_type,
        body=payload.body,
        is_read=payload.direction == WhatsAppMessageDirection.outbound,
        sent_at=sent_at,
        metadata_json=metadata,
    )
    instance.status = WhatsAppInstanceStatus.connected.value
    instance.last_connected_at = instance.last_connected_at or now
    instance.last_message_at = max(instance.last_message_at, sent_at) if instance.last_message_at else sent_at
    instance.last_error = None
    db.add(message)
    if chat_type == WhatsAppChatType.direct and not _is_unresolved_contact(contact_phone, chat_id):
        # Backfill earlier outbound messages from the same LID conversation.
        # This handles the common case where the first outbound event arrives
        # before WhatsApp exposes the contact's phone number on an inbound
        # event.
        unresolved_values = ["Unknown contact", "unknown", "Phone unavailable"]
        if chat_id.endswith("@lid"):
            chat_user = chat_id.split("@", 1)[0].split(":", 1)[0]
            if chat_user.isdigit():
                unresolved_values.append(chat_user)
        await db.execute(
            update(WhatsAppMessage)
            .where(
                WhatsAppMessage.instance_id == instance.id,
                WhatsAppMessage.chat_id == chat_id,
                WhatsAppMessage.chat_type == WhatsAppChatType.direct.value,
                WhatsAppMessage.direction == WhatsAppMessageDirection.outbound.value,
                or_(
                    WhatsAppMessage.contact_phone.in_(unresolved_values),
                    WhatsAppMessage.recipient_phone.is_(None),
                ),
            )
            .values(contact_phone=contact_phone, recipient_phone=contact_phone)
        )
    await db.commit()
    return {"accepted": 1, "message": "Message recorded"}
