import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditEvent


def record_audit(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    entity_type: str,
    entity_id: uuid.UUID | None,
    action: str,
    summary: str,
    payload: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        summary=summary,
        payload=payload or {},
    )
    db.add(event)
    return event
