import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    admin_name: str = Field(min_length=1, max_length=255)
    admin_phone: str = Field(min_length=6, max_length=20)
    admin_email: EmailStr | None = None
    admin_password: str = Field(min_length=6)

    @field_validator("name", "admin_name", "admin_phone")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("admin_email", mode="before")
    @classmethod
    def blank_email_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    logo_url: str | None = None
    is_active: bool
    plan: str
    created_at: datetime
    user_count: int = 0
    lead_count: int = 0


class OrganizationMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class OrganizationDetailsOut(OrganizationOut):
    members: list[OrganizationMemberOut] = Field(default_factory=list)


class OrganizationUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    plan: Literal["trial", "starter", "professional", "enterprise"]
    admin_name: str = Field(min_length=1, max_length=255)
    admin_phone: str = Field(min_length=6, max_length=20)
    admin_email: EmailStr | None = None
    admin_password: str | None = Field(default=None, min_length=6, max_length=128)

    @field_validator("name", "admin_name", "admin_phone")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value


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
    logo_url: str | None = None
    plan: str
    created_at: datetime


class MyOrganizationUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
