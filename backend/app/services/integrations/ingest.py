"""Turns normalized provider leads into assigned Lead rows.

Deliberately reuses `assign_batch`, the same round-robin engine used by manual
creation and Excel bulk import, so the rotation pointer stays shared: leads
arriving from IndiaMART continue the same rotation as ones typed in by hand.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import IntegrationStatus, LeadIntegration
from app.models.lead import Lead, LeadCategory, LeadStatus
from app.services.distribution import assign_batch
from app.services.assignment_history import record_assignment
from app.services.integrations.base import NormalizedLead
from app.services.integrations.registry import get_adapter


@dataclass
class IngestResult:
    imported: int = 0
    duplicates: int = 0
    invalid: int = 0
    assignments: dict[str, int] | None = None

    def __post_init__(self) -> None:
        if self.assignments is None:
            self.assignments = {}


async def ingest_leads(
    db: AsyncSession,
    integration: LeadIntegration,
    leads: list[NormalizedLead],
) -> IngestResult:
    """Persists incoming leads, skipping any phone already present in the org.

    The caller owns the transaction; this function flushes but does not commit,
    so a webhook and its integration counters update atomically.
    """
    result = IngestResult()
    if not leads:
        return result

    org_id: uuid.UUID = integration.organization_id
    adapter = get_adapter(integration.provider)

    # Drop rows with no usable phone, then collapse duplicates inside this batch.
    seen: set[str] = set()
    candidates: list[NormalizedLead] = []
    for lead in leads:
        if not lead.phone or not lead.name:
            result.invalid += 1
            continue
        if lead.phone in seen:
            result.duplicates += 1
            continue
        seen.add(lead.phone)
        candidates.append(lead)

    if not candidates:
        return result

    # Skip anything this org already has — matches the bulk-import behaviour.
    existing = await db.execute(
        select(Lead.phone).where(
            Lead.organization_id == org_id,
            Lead.phone.in_([c.phone for c in candidates]),
        )
    )
    existing_phones = {p for (p,) in existing.all()}
    fresh = [c for c in candidates if c.phone not in existing_phones]
    result.duplicates += len(candidates) - len(fresh)

    if not fresh:
        return result

    assignees = await assign_batch(db, org_id, len(fresh))

    new_rows = []
    for lead, assignee in zip(fresh, assignees):
        new_rows.append(
            Lead(
                organization_id=org_id,
                name=lead.name[:255],
                phone=lead.phone[:20],
                city=(lead.city or None) and str(lead.city)[:255],
                state=(lead.state or None) and str(lead.state)[:100],
                source=adapter.lead_source,
                status=LeadStatus.new,
                category=LeadCategory.other,
                interested_categories=[LeadCategory.other.value],
                notes=lead.to_notes(),
                assigned_to=assignee.id if assignee else None,
                created_at=lead.received_at or datetime.now(timezone.utc),
            )
        )
        if assignee:
            result.assignments[assignee.name] = result.assignments.get(assignee.name, 0) + 1

    db.add_all(new_rows)
    await db.flush()
    for lead in new_rows:
        record_assignment(
            db,
            organization_id=org_id,
            lead_id=lead.id,
            previous_assignee_id=None,
            new_assignee_id=lead.assigned_to,
            assigned_by_id=None,
            action="created",
            source="integration",
        )

    result.imported = len(new_rows)

    integration.total_imported += result.imported
    integration.total_duplicates += result.duplicates
    integration.status = IntegrationStatus.active
    integration.last_error = None

    return result
