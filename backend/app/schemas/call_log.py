import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadStatus


class CallLogCreate(BaseModel):
    duration_minutes: float = Field(ge=0, default=0)
    outcome: LeadStatus
    notes: str | None = None
    order_value: float | None = Field(default=None, ge=0)
    product_id: uuid.UUID | None = None
    next_follow_up_at: datetime | None = None


class CallLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    logged_by: uuid.UUID | None
    logged_by_name: str | None = None
    duration_minutes: float
    outcome: LeadStatus
    notes: str | None
    created_at: datetime
    order_value: float | None
    product_id: uuid.UUID | None
    product_name: str | None = None
    next_follow_up_at: datetime | None = None


class FollowUpOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    lead_name: str
    lead_phone: str
    logged_by: uuid.UUID | None
    logged_by_name: str | None = None
    outcome: LeadStatus
    notes: str | None
    duration_minutes: float
    created_at: datetime
    next_follow_up_at: datetime | None = None


class PaginatedFollowUps(BaseModel):
    items: list[FollowUpOut]
    total: int
    page: int
    page_size: int
