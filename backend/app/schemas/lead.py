import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadCategory, LeadSource, LeadStatus


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=6, max_length=20)
    city: str | None = None
    state: str | None = None
    source: LeadSource = LeadSource.manual
    notes: str | None = None
    category: str = Field(default=LeadCategory.other.value, min_length=1, max_length=100)
    interested_categories: list[str] | None = Field(default=None, max_length=20)
    drug_license_number: str | None = None
    specialty: str | None = None
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
    category: str | None = Field(default=None, min_length=1, max_length=100)
    interested_categories: list[str] | None = Field(default=None, max_length=20)
    drug_license_number: str | None = None
    specialty: str | None = None
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
    category: str
    interested_categories: list[str]
    drug_license_number: str | None
    specialty: str | None
    credit_limit: float | None
    outstanding_amount: float | None
    dnd: bool


class AssignmentHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    previous_assignee_id: uuid.UUID | None
    previous_assignee_name: str | None = None
    new_assignee_id: uuid.UUID | None
    new_assignee_name: str | None = None
    assigned_by_id: uuid.UUID | None
    assigned_by_name: str | None = None
    action: str
    source: str
    created_at: datetime


class PaginatedLeads(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int


class BulkImportPreviewRow(BaseModel):
    name: str
    phone: str
    city: str | None = None


class BulkImportIssue(BaseModel):
    """A user-actionable problem or warning found while reading an import file."""

    row: int | None = None
    field: str | None = None
    code: str
    message: str
    severity: Literal["error", "warning"] = "error"
    value: str | None = None


class BulkImportResult(BaseModel):
    imported: int
    skipped: int
    duplicates_skipped: int = 0
    assignments: dict[str, int]
    issues: list[BulkImportIssue] = Field(default_factory=list)
    issue_count: int = 0
    issues_truncated: bool = False


class DuplicateLeadMatch(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    status: LeadStatus
    assignee_name: str | None = None


class ReassignRequest(BaseModel):
    assigned_to: uuid.UUID | None


class LeadCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class LeadCategoryOptionOut(BaseModel):
    value: str
    label: str
    is_custom: bool
