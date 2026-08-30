import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserRole


TimeEntryCategory = Literal["calling", "event", "training", "admin", "other"]
TimeEntryStatus = Literal["pending", "approved", "rejected"]
LeaveStatus = Literal["pending", "approved", "rejected"]


class PayrollRateUpdate(BaseModel):
    hourly_rate: float = Field(ge=0, le=100000, description="Pay per approved hour in INR")
    standard_hours_per_day: float = Field(default=8, gt=0, le=24)


class PayrollRateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    hourly_rate: float
    standard_hours_per_day: float


class PayrollScheduleUpdate(BaseModel):
    working_days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], min_length=1, max_length=7)
    standard_hours_per_day: float = Field(default=8, gt=0, le=24)

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value) or any(day < 0 or day > 6 for day in value):
            raise ValueError("Working days must be unique weekday numbers from 0 (Monday) to 6 (Sunday)")
        return sorted(value)


class PayrollScheduleExceptionCreate(BaseModel):
    exception_date: date
    name: str = Field(min_length=1, max_length=120)
    is_working_day: bool = False

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A name is required")
        return value


class PayrollScheduleExceptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    exception_date: date
    name: str
    is_working_day: bool
    created_by: uuid.UUID | None
    created_by_name: str | None = None
    created_at: datetime


class PayrollScheduleOut(BaseModel):
    organization_id: uuid.UUID
    working_days: list[int]
    standard_hours_per_day: float
    exceptions: list[PayrollScheduleExceptionOut] = Field(default_factory=list)
    updated_at: datetime | None = None


class TimeEntryCreate(BaseModel):
    user_id: uuid.UUID | None = None
    entry_date: date
    hours: float = Field(ge=0, le=24)
    category: TimeEntryCategory = "calling"
    description: str | None = Field(default=None, max_length=500)
    status: TimeEntryStatus = "pending"

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class TimeEntryReview(BaseModel):
    status: TimeEntryStatus


class TimeEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    entry_date: date
    hours: float
    category: str
    description: str | None
    status: str
    submitted_by: uuid.UUID | None
    submitted_by_name: str | None = None
    reviewed_by: uuid.UUID | None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None
    created_at: datetime


class LeaveRequestCreate(BaseModel):
    user_id: uuid.UUID | None = None
    start_date: date
    end_date: date
    leave_type: Literal["casual", "sick", "planned", "personal", "other"] = "personal"
    reason: str = Field(min_length=2, max_length=500)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Reason is required")
        return value


class LeaveRequestReview(BaseModel):
    status: LeaveStatus
    review_note: str | None = Field(default=None, max_length=500)


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    start_date: date
    end_date: date
    leave_type: str
    reason: str
    status: str
    reviewed_by: uuid.UUID | None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime


class PayrollEmployeeOut(BaseModel):
    user_id: uuid.UUID
    name: str
    phone: str
    role: UserRole
    is_active: bool
    hourly_rate: float
    standard_hours_per_day: float
    target_hours: float
    approved_hours: float
    pending_hours: float
    leave_days: float
    estimated_pay: float
    entries: list[TimeEntryOut] = Field(default_factory=list)
    leaves: list[LeaveRequestOut] = Field(default_factory=list)


class PayrollSummaryOut(BaseModel):
    month: str
    employees: list[PayrollEmployeeOut]
    total_target_hours: float
    total_approved_hours: float
    total_pending_hours: float
    total_leave_days: float
    total_estimated_pay: float


class AttendanceOverviewOut(BaseModel):
    month: str
    entries: list[TimeEntryOut]
    leaves: list[LeaveRequestOut]
    pending_approvals: int


class AttendanceApprovalsOut(BaseModel):
    time_entries: list[TimeEntryOut]
    leaves: list[LeaveRequestOut]
