import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # The object key stays private; logo_url points at the public proxy route
    # which signs a short-lived S3 download URL for the browser.
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    logo_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="trial")
    # Workplace geofence used when employees check in/out for attendance.
    # Coordinates remain private to the organization and are only returned to admins.
    attendance_location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attendance_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    attendance_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    attendance_radius_meters: Mapped[int] = mapped_column(Integer, nullable=False, default=200, server_default="200")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="organization", cascade="all, delete-orphan")
    distribution_settings = relationship(
        "DistributionSettings", back_populates="organization", uselist=False, cascade="all, delete-orphan"
    )
