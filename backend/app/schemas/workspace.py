import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


FieldType = Literal["text", "number", "boolean", "date", "select"]


class CustomFieldDefinitionCreate(BaseModel):
    key: str = Field(min_length=2, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=1, max_length=120)
    field_type: FieldType = "text"
    options: list[str] = Field(default_factory=list, max_length=100)
    required: bool = False
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=1000)

    @field_validator("options")
    @classmethod
    def clean_options(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))


class CustomFieldDefinitionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    field_type: FieldType | None = None
    options: list[str] | None = Field(default=None, max_length=100)
    required: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)


class CustomFieldDefinitionOut(CustomFieldDefinitionCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class PipelineStageCreate(BaseModel):
    key: str = Field(min_length=2, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="#17324D", pattern=r"^#[0-9a-fA-F]{6}$")
    sort_order: int = Field(default=0, ge=0, le=1000)
    is_closed: bool = False
    is_won: bool = False


class PipelineStageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    sort_order: int | None = Field(default=None, ge=0, le=1000)
    is_closed: bool | None = None
    is_won: bool | None = None


class PipelineStageOut(PipelineStageCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


AutomationTrigger = Literal["lead_created", "lead_assigned", "status_changed", "callback_due", "task_completed"]
AutomationAction = Literal["create_task", "add_note", "assign_manager"]


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    trigger: AutomationTrigger
    action: AutomationAction
    conditions: dict = Field(default_factory=dict)
    action_config: dict = Field(default_factory=dict)
    is_active: bool = True


class AutomationRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    trigger: AutomationTrigger | None = None
    action: AutomationAction | None = None
    conditions: dict | None = None
    action_config: dict | None = None
    is_active: bool | None = None


class AutomationRuleOut(AutomationRuleCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditEventOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID | None
    actor_id: uuid.UUID | None
    actor_name: str | None = None
    entity_type: str
    entity_id: uuid.UUID | None
    action: str
    summary: str
    payload: dict
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedAuditEvents(BaseModel):
    items: list[AuditEventOut]
    total: int
    page: int
    page_size: int


class SavedReportCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    report_type: Literal["leads", "analytics"] = "leads"
    filters: dict = Field(default_factory=dict)


class SavedReportOut(SavedReportCreate):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BackupOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    filename: str
    size_bytes: int
    status: Literal["ready", "failed"]


class TwoFactorSetupOut(BaseModel):
    secret: str
    otpauth_url: str


class TwoFactorStatusOut(BaseModel):
    enabled: bool

