import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadCategory, LeadSource, LeadStatus


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=6, max_length=20)
    city: str | None = None
    state: str | None = None
    source: LeadSource = LeadSource.manual
    notes: str | None = None
    category: LeadCategory = LeadCategory.other
    drug_license_number: str | None = None
    specialty: str | None = None
    product_id: uuid.UUID | None = None
    credit_limit: float | None = None
    outstanding_amount: float | None = None
    dnd: bool = False


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    source: LeadSource | None = None
    status: LeadStatus | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None
    category: LeadCategory | None = None
    drug_license_number: str | None = None
    specialty: str | None = None
    product_id: uuid.UUID | None = None
    credit_limit: float | None = None
    outstanding_amount: float | None = None
    dnd: bool | None = None


class AssigneeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class LastCallOut(BaseModel):
    outcome: LeadStatus
    duration_minutes: float
    notes: str | None
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    city: str | None
    state: str | None
    source: LeadSource
    status: LeadStatus
    assigned_to: uuid.UUID | None
    assignee_name: str | None = None
    notes: str | None
    created_at: datetime
    last_contacted_at: datetime | None
    next_follow_up_at: datetime | None = None
    last_call: LastCallOut | None = None
    category: LeadCategory
    drug_license_number: str | None
    specialty: str | None
    product_id: uuid.UUID | None
    product_name: str | None = None
    credit_limit: float | None
    outstanding_amount: float | None
    dnd: bool


class PaginatedLeads(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int


class BulkImportPreviewRow(BaseModel):
    name: str
    phone: str
    city: str | None = None


class BulkImportResult(BaseModel):
    imported: int
    skipped: int
    duplicates_skipped: int = 0
    assignments: dict[str, int]


class DuplicateLeadMatch(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    status: LeadStatus
    assignee_name: str | None = None


class ReassignRequest(BaseModel):
    assigned_to: uuid.UUID | None
