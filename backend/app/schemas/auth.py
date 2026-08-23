import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    phone: str = Field(min_length=1, max_length=30)
    password: str
    country_code: str | None = Field(default=None, max_length=8)
    otp: str | None = Field(default=None, min_length=6, max_length=6)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID | None
    name: str
    phone: str
    email: str | None
    role: UserRole
    is_active: bool


class LoginResponse(BaseModel):
    tokens: TokenPair
    user: UserOut
    organization_name: str | None = None


class ImpersonationInfo(BaseModel):
    is_impersonating: bool
    impersonated_by_name: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
