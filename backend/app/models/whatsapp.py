import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WhatsAppInstanceStatus(str, enum.Enum):
    disconnected = "disconnected"
    connecting = "connecting"
    connected = "connected"
    paused = "paused"
    error = "error"


class WhatsAppMessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class WhatsAppInstance(Base):
    """A WhatsApp Web session owned by one organization employee."""

    __tablename__ = "whatsapp_instances"
    __table_args__ = ()

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Stable, non-secret identifier used by an external WhatsApp bridge.
    session_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    # Hashed token for the bridge webhook. The clear token is returned once on create/rotate.
    webhook_secret_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Encrypted copy used only by the first-party bridge when an admin starts a session.
    webhook_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=WhatsAppInstanceStatus.disconnected.value, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Latest QR data URL. It is short-lived and cleared as soon as the session connects.
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    organization = relationship("Organization")
    assigned_user = relationship("User")
    messages = relationship("WhatsAppMessage", back_populates="instance", cascade="all, delete-orphan")


class WhatsAppMessage(Base):
    """A message received from or sent through a WhatsApp instance."""

    __tablename__ = "whatsapp_messages"
    __table_args__ = (
        UniqueConstraint("instance_id", "external_message_id", name="uq_whatsapp_message_instance_external"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    instance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True
    )
    external_message_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    contact_phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    direction: Mapped[str] = mapped_column(String(12), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(String(30), nullable=False, default="text")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")
    instance = relationship("WhatsAppInstance", back_populates="messages")
    lead = relationship("Lead")
