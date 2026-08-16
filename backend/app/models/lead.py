import enum
import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LeadSource(str, enum.Enum):
    manual = "manual"
    indiamart = "indiamart"
    justdial = "justdial"
    tradeindia = "tradeindia"
    website = "website"
    referral = "referral"


class LeadStatus(str, enum.Enum):
    new = "new"
    follow_up = "follow_up"
    not_picked = "not_picked"
    converted = "converted"
    lost = "lost"


class LeadCategory(str, enum.Enum):
    pharmaceutical = "pharmaceutical"
    ayurvedic = "ayurvedic"
    homeopathic = "homeopathic"
    nutraceutical = "nutraceutical"
    generic = "generic"
    other = "other"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[LeadSource] = mapped_column(SAEnum(LeadSource, name="lead_source"), nullable=False, default=LeadSource.manual)
    status: Mapped[LeadStatus] = mapped_column(SAEnum(LeadStatus, name="lead_status"), nullable=False, default=LeadStatus.new, index=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    # Pharma-vertical fields
    category: Mapped[LeadCategory] = mapped_column(
        SAEnum(LeadCategory, name="lead_category"), nullable=False, default=LeadCategory.other
    )
    # Built-in categories stay in the PostgreSQL enum for backwards compatibility.
    # Admin-created categories are stored here and exposed as the effective category.
    custom_category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # A lead can be interested in several categories. ``category`` remains the
    # primary category for backwards-compatible reporting and filtering.
    interested_categories: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), nullable=False, default=list, server_default="{}"
    )
    drug_license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credit_limit: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    outstanding_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    dnd: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    organization = relationship("Organization", back_populates="leads")
    assignee = relationship("User", back_populates="assigned_leads", foreign_keys=[assigned_to])
    call_logs = relationship("CallLog", back_populates="lead", cascade="all, delete-orphan", order_by="CallLog.created_at.desc()")
    assignment_history = relationship(
        "LeadAssignmentHistory",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadAssignmentHistory.created_at.desc()",
    )
