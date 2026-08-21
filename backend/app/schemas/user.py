import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=6, max_length=20)
    email: EmailStr
    role: UserRole
    password: str = Field(min_length=6)
    state: str = Field(min_length=1, max_length=100)
    city: str = Field(min_length=1, max_length=100)

    @field_validator("name", "phone", "state", "city")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value


class TeamMemberUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    state: str | None = None
    city: str | None = None


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    active_leads_count: int = 0
    state: str | None = None
    city: str | None = None
