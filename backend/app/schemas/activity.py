import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.lead import LeadStatus


class LeadActivityOut(BaseModel):
    """A normalized event for the lead's single, chronological activity feed."""

    id: uuid.UUID
    lead_id: uuid.UUID
    event_type: Literal["created", "call", "assignment"]
    occurred_at: datetime
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    title: str
    body: str | None = None
    source: str | None = None
    call_outcome: LeadStatus | None = None
    duration_minutes: float | None = None
    order_value: float | None = None
    next_follow_up_at: datetime | None = None
    assignment_action: str | None = None
    previous_assignee_name: str | None = None
    new_assignee_name: str | None = None
