import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadCategory, LeadSource, LeadStatus


class MarkLostRequest(BaseModel):
    manager_id: uuid.UUID
    reason: str = Field(min_length=1, max_length=2000)


class LostDealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    city: str | None
    state: str | None
    source: LeadSource
    status: LeadStatus
    category: str
    interested_categories: list[str]
    assigned_to: uuid.UUID | None
    assignee_name: str | None
    lost_by: uuid.UUID | None
    lost_by_name: str | None
    lost_reason: str | None
    lost_at: datetime | None
    created_at: datetime


class PaginatedLostDeals(BaseModel):
    items: list[LostDealOut]
    total: int
    page: int
    page_size: int


class BulkDeleteLostDealsRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class BulkDeleteLostDealsOut(BaseModel):
    deleted: int
