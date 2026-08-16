import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead_assignment import LeadAssignmentHistory


def record_assignment(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    lead_id: uuid.UUID,
    previous_assignee_id: uuid.UUID | None,
    new_assignee_id: uuid.UUID | None,
    assigned_by_id: uuid.UUID | None,
    action: str,
    source: str,
) -> None:
    db.add(
        LeadAssignmentHistory(
            organization_id=organization_id,
            lead_id=lead_id,
            previous_assignee_id=previous_assignee_id,
            new_assignee_id=new_assignee_id,
            assigned_by_id=assigned_by_id,
            action=action,
            source=source,
        )
    )
