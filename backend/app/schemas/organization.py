import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    admin_name: str
    admin_phone: str
    admin_email: EmailStr | None = None
    admin_password: str = Field(min_length=6)


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    is_active: bool
    plan: str
    created_at: datetime
    user_count: int = 0
    lead_count: int = 0


class PlatformStats(BaseModel):
    total_organizations: int
    total_users: int
    total_leads: int
    active_organizations: int
    growth: list[dict]


class ImpersonateRequest(BaseModel):
    organization_id: uuid.UUID


class MyOrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    plan: str
    created_at: datetime


class MyOrganizationUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
