import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.whatsapp import WhatsAppChatType, WhatsAppInstanceStatus, WhatsAppMessageDirection


class WhatsAppInstanceCreate(BaseModel):
    assigned_user_id: uuid.UUID
    label: str = Field(min_length=1, max_length=120)
    phone_number: str | None = Field(default=None, max_length=30)

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Instance name is required")
        return value


class WhatsAppInstanceUpdate(BaseModel):
    assigned_user_id: uuid.UUID | None = None
    label: str | None = Field(default=None, min_length=1, max_length=120)
    phone_number: str | None = Field(default=None, max_length=30)
    is_enabled: bool | None = None

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Instance name is required")
        return value


class WhatsAppMessageIn(BaseModel):
    external_message_id: str | None = Field(default=None, max_length=180)
    contact_phone: str | None = Field(default=None, min_length=3, max_length=30)
    contact_name: str | None = Field(default=None, max_length=255)
    chat_id: str | None = Field(default=None, min_length=1, max_length=180)
    chat_type: WhatsAppChatType = WhatsAppChatType.direct
    chat_name: str | None = Field(default=None, max_length=255)
    sender_phone: str | None = Field(default=None, max_length=30)
    sender_name: str | None = Field(default=None, max_length=255)
    recipient_phone: str | None = Field(default=None, max_length=30)
    recipient_name: str | None = Field(default=None, max_length=255)
    direction: WhatsAppMessageDirection
    message_type: str = Field(default="text", min_length=1, max_length=30)
    body: str = Field(min_length=1, max_length=10000)
    sent_at: datetime
    lead_id: uuid.UUID | None = None
    metadata: dict | None = None


class WhatsAppWebhookEvent(BaseModel):
    event: Literal["status", "message"]
    status: WhatsAppInstanceStatus | None = None
    phone_number: str | None = Field(default=None, max_length=30)
    error: str | None = Field(default=None, max_length=1000)
    qr_code: str | None = Field(default=None, max_length=200_000)
    message: WhatsAppMessageIn | None = None


class WhatsAppInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assigned_user_id: uuid.UUID
    assigned_user_name: str
    assigned_user_role: str
    label: str
    phone_number: str | None
    session_key: str
    status: WhatsAppInstanceStatus
    is_enabled: bool
    last_connected_at: datetime | None
    last_seen_at: datetime | None
    last_message_at: datetime | None
    last_error: str | None
    message_count: int = 0
    unread_count: int = 0
    created_at: datetime
    webhook_url: str
    webhook_token: str | None = None
    qr_code: str | None = None


class WhatsAppMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    instance_id: uuid.UUID
    lead_id: uuid.UUID | None
    external_message_id: str | None
    contact_phone: str
    contact_name: str | None
    chat_id: str | None
    chat_type: WhatsAppChatType
    chat_name: str | None
    sender_phone: str | None
    sender_name: str | None
    recipient_phone: str | None
    recipient_name: str | None
    direction: WhatsAppMessageDirection
    message_type: str
    body: str
    is_read: bool
    sent_at: datetime
    created_at: datetime


class WhatsAppMessagePage(BaseModel):
    items: list[WhatsAppMessageOut]
    page: int
    page_size: int
    total: int


class WhatsAppEmployeeSummary(BaseModel):
    user_id: uuid.UUID
    user_name: str
    user_role: str
    instances: int
    connected_instances: int
    messages: int
    unread_messages: int


class WhatsAppOverview(BaseModel):
    total_instances: int
    connected_instances: int
    total_messages: int
    unread_messages: int
    employees: list[WhatsAppEmployeeSummary]
