import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class IntegrationProvider(str, enum.Enum):
    indiamart = "indiamart"
    justdial = "justdial"


class IntegrationStatus(str, enum.Enum):
    disconnected = "disconnected"
    active = "active"
    error = "error"


class LeadIntegration(Base):
    """One row per (organization, provider) — credentials are tenant-scoped.

    Two ingestion styles are supported:
      * pull  — we poll the provider's API on a timer (IndiaMART)
      * push  — the provider POSTs to our webhook (JustDial)
    """

    __tablename__ = "lead_integrations"
    __table_args__ = (UniqueConstraint("organization_id", "provider", name="uq_integration_org_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[IntegrationProvider] = mapped_column(
        SAEnum(IntegrationProvider, name="integration_provider"), nullable=False
    )

    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[IntegrationStatus] = mapped_column(
        SAEnum(IntegrationStatus, name="integration_status"),
        nullable=False,
        default=IntegrationStatus.disconnected,
    )

    # Fernet-encrypted JSON blob — never returned to the client in full.
    credentials: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Shared secret for verifying inbound webhooks (push providers).
    webhook_secret: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Pull cursor: only fetch leads created after this point.
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_imported: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_duplicates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    organization = relationship("Organization")
