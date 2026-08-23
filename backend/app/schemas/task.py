import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus, TaskType


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    lead_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    task_type: TaskType = TaskType.task
    priority: TaskPriority = TaskPriority.normal
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    lead_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    task_type: TaskType | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    due_at: datetime | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    lead_id: uuid.UUID | None
    assigned_to: uuid.UUID | None
    assigned_to_name: str | None = None
    created_by: uuid.UUID | None
    created_by_name: str | None = None
    lead_name: str | None = None
    lead_phone: str | None = None
    title: str
    description: str | None
    task_type: TaskType
    priority: TaskPriority
    status: TaskStatus
    due_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class PaginatedTasks(BaseModel):
    items: list[TaskOut]
    total: int
    page: int
    page_size: int
