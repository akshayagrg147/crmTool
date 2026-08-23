import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import AutomationRule
from app.models.lead import Lead
from app.models.lead_note import LeadNote
from app.models.task import Task, TaskPriority, TaskStatus, TaskType
from app.models.user import User, UserRole
from app.services.assignment_history import record_assignment
from app.services.audit import record_audit


def _conditions_match(rule: AutomationRule, lead: Lead | None, context: dict | None) -> bool:
    conditions = rule.conditions or {}
    if not conditions:
        return True
    context = context or {}
    if lead is not None:
        checks = {
            "status": lead.status.value,
            "source": lead.source.value,
            "category": lead.custom_category or lead.category.value,
            "stage_key": lead.stage_key,
        }
        for key, expected in conditions.items():
            if key in checks and str(checks[key]) != str(expected):
                return False
    for key, expected in conditions.items():
        if key in context and str(context[key]) != str(expected):
            return False
    return True


async def run_automations(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    trigger: str,
    lead: Lead | None = None,
    context: dict | None = None,
) -> int:
    """Execute the safe, internal automation actions supported by the CRM.

    Rules are intentionally deterministic: they create a task or a note. They
    never call third-party services and can therefore be retried safely.
    """
    result = await db.execute(
        select(AutomationRule).where(
            AutomationRule.organization_id == organization_id,
            AutomationRule.trigger == trigger,
            AutomationRule.is_active.is_(True),
        )
    )
    rules = result.scalars().all()
    executed = 0
    for rule in rules:
        if not _conditions_match(rule, lead, context):
            continue
        config = rule.action_config or {}
        if rule.action == "create_task" and lead is not None:
            due_at = None
            if config.get("due_in_hours") is not None:
                due_at = datetime.now(timezone.utc) + timedelta(hours=max(0, int(config["due_in_hours"])))
            db.add(
                Task(
                    organization_id=organization_id,
                    lead_id=lead.id,
                    assigned_to=lead.assigned_to,
                    created_by=actor_id,
                    title=str(config.get("title") or rule.name),
                    description=config.get("description"),
                    task_type=TaskType(config.get("task_type", TaskType.task.value)),
                    priority=TaskPriority(config.get("priority", TaskPriority.normal.value)),
                    status=TaskStatus.open,
                    due_at=due_at,
                )
            )
        elif rule.action == "add_note" and lead is not None:
            body = str(config.get("body") or rule.name).strip()
            if body:
                db.add(LeadNote(organization_id=organization_id, lead_id=lead.id, author_id=actor_id, body=body))
        elif rule.action == "assign_manager" and lead is not None:
            manager_id = config.get("manager_id")
            if not manager_id:
                continue
            try:
                manager_uuid = uuid.UUID(str(manager_id))
            except ValueError:
                continue
            manager = await db.scalar(
                select(User).where(
                    User.id == manager_uuid,
                    User.organization_id == organization_id,
                    User.role == UserRole.manager,
                    User.is_active.is_(True),
                )
            )
            if manager is None or lead.assigned_to == manager.id:
                continue
            previous_assignee_id = lead.assigned_to
            lead.assigned_to = manager.id
            record_assignment(
                db,
                organization_id=organization_id,
                lead_id=lead.id,
                previous_assignee_id=previous_assignee_id,
                new_assignee_id=manager.id,
                assigned_by_id=actor_id,
                action="automation",
                source="automation",
            )
        else:
            continue
        record_audit(
            db,
            organization_id=organization_id,
            actor_id=actor_id,
            entity_type="automation",
            entity_id=rule.id,
            action="executed",
            summary=f"Automation rule executed: {rule.name}",
            payload={"trigger": trigger, "action": rule.action, "lead_id": str(lead.id) if lead else None},
        )
        executed += 1
    return executed
