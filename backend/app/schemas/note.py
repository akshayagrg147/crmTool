import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LeadNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    pinned: bool = False


class LeadNoteUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=10000)
    pinned: bool | None = None


class LeadNoteOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None = None
    body: str
    pinned: bool
    created_at: datetime
    updated_at: datetime


class LeadAttachmentOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    uploaded_by: uuid.UUID | None
    uploaded_by_name: str | None = None
    filename: str
    content_type: str | None
    size_bytes: int
    created_at: datetime
