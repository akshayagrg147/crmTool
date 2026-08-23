import csv
import io
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_admin_or_manager, require_org_user
from app.models.audit import AuditEvent
from app.models.automation import AutomationRule
from app.models.backup import BackupRecord
from app.models.call_log import CallLog
from app.models.custom_field import CustomFieldDefinition, PipelineStage
from app.models.lead import Lead
from app.models.lead_note import LeadAttachment, LeadNote
from app.models.organization import Organization
from app.models.saved_report import SavedReport
from app.models.task import Task
from app.models.user import User, UserRole
from app.schemas.workspace import (
    AuditEventOut,
    AutomationRuleCreate,
    AutomationRuleOut,
    AutomationRuleUpdate,
    BackupOut,
    CustomFieldDefinitionCreate,
    CustomFieldDefinitionOut,
    CustomFieldDefinitionUpdate,
    PaginatedAuditEvents,
    PipelineStageCreate,
    PipelineStageOut,
    PipelineStageUpdate,
    SavedReportCreate,
    SavedReportOut,
)
from app.services.audit import record_audit

router = APIRouter(prefix="/workspace", tags=["workspace"])
BACKUP_ROOT = Path(settings.backup_dir)


@router.get("/custom-fields", response_model=list[CustomFieldDefinitionOut])
async def list_custom_fields(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CustomFieldDefinition)
        .where(CustomFieldDefinition.organization_id == current.organization_id)
        .order_by(CustomFieldDefinition.sort_order, CustomFieldDefinition.created_at)
    )
    return result.scalars().all()


@router.post("/custom-fields", response_model=CustomFieldDefinitionOut, status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    payload: CustomFieldDefinitionCreate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(CustomFieldDefinition).where(
            CustomFieldDefinition.organization_id == current.organization_id,
            CustomFieldDefinition.key == payload.key,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A custom field with this key already exists")
    field = CustomFieldDefinition(organization_id=current.organization_id, **payload.model_dump())
    db.add(field)
    record_audit(
        db,
        organization_id=current.organization_id,
        actor_id=current.id,
        entity_type="custom_field",
        entity_id=field.id,
        action="created",
        summary=f"Custom field created: {field.label}",
        payload={"key": field.key, "field_type": field.field_type},
    )
    await db.commit()
    await db.refresh(field)
    return field


@router.patch("/custom-fields/{field_id}", response_model=CustomFieldDefinitionOut)
async def update_custom_field(
    field_id: uuid.UUID,
    payload: CustomFieldDefinitionUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    field = await db.scalar(select(CustomFieldDefinition).where(CustomFieldDefinition.id == field_id, CustomFieldDefinition.organization_id == current.organization_id))
    if field is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Custom field not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(field, key, value)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="custom_field", entity_id=field.id, action="updated", summary=f"Custom field updated: {field.label}")
    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/custom-fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_field(field_id: uuid.UUID, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    field = await db.scalar(select(CustomFieldDefinition).where(CustomFieldDefinition.id == field_id, CustomFieldDefinition.organization_id == current.organization_id))
    if field is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Custom field not found")
    await db.delete(field)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="custom_field", entity_id=field_id, action="deleted", summary=f"Custom field deleted: {field.label}")
    await db.commit()


DEFAULT_STAGES = (
    {"key": "new", "name": "New", "color": "#17324D", "sort_order": 0},
    {"key": "follow_up", "name": "Follow-up", "color": "#B7791F", "sort_order": 1},
    {"key": "converted", "name": "Converted", "color": "#277A67", "sort_order": 2, "is_closed": True, "is_won": True},
    {"key": "lost", "name": "Lost", "color": "#B34747", "sort_order": 3, "is_closed": True},
)


async def _stages(db: AsyncSession, organization_id: uuid.UUID) -> list[PipelineStage]:
    result = await db.execute(select(PipelineStage).where(PipelineStage.organization_id == organization_id).order_by(PipelineStage.sort_order, PipelineStage.created_at))
    stages = list(result.scalars().all())
    if stages:
        return stages
    stages = [PipelineStage(organization_id=organization_id, **stage) for stage in DEFAULT_STAGES]
    db.add_all(stages)
    await db.commit()
    return stages


@router.get("/stages", response_model=list[PipelineStageOut])
async def list_stages(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    return await _stages(db, current.organization_id)


@router.post("/stages", response_model=PipelineStageOut, status_code=status.HTTP_201_CREATED)
async def create_stage(payload: PipelineStageCreate, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await _stages(db, current.organization_id)
    duplicate = await db.scalar(select(PipelineStage).where(PipelineStage.organization_id == current.organization_id, PipelineStage.key == payload.key))
    if duplicate is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A stage with this key already exists")
    stage = PipelineStage(organization_id=current.organization_id, **payload.model_dump())
    db.add(stage)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="stage", entity_id=stage.id, action="created", summary=f"Pipeline stage created: {stage.name}")
    await db.commit()
    await db.refresh(stage)
    return stage


@router.patch("/stages/{stage_id}", response_model=PipelineStageOut)
async def update_stage(stage_id: uuid.UUID, payload: PipelineStageUpdate, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    stage = await db.scalar(select(PipelineStage).where(PipelineStage.id == stage_id, PipelineStage.organization_id == current.organization_id))
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pipeline stage not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(stage, key, value)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="stage", entity_id=stage.id, action="updated", summary=f"Pipeline stage updated: {stage.name}")
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage(stage_id: uuid.UUID, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    stage = await db.scalar(select(PipelineStage).where(PipelineStage.id == stage_id, PipelineStage.organization_id == current.organization_id))
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pipeline stage not found")
    in_use = await db.scalar(select(func.count()).select_from(Lead).where(Lead.organization_id == current.organization_id, Lead.stage_key == stage.key))
    if in_use:
        raise HTTPException(status.HTTP_409_CONFLICT, "Move leads out of this stage before deleting it")
    await db.delete(stage)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="stage", entity_id=stage_id, action="deleted", summary=f"Pipeline stage deleted: {stage.name}")
    await db.commit()


@router.get("/automations", response_model=list[AutomationRuleOut])
async def list_automations(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AutomationRule).where(AutomationRule.organization_id == current.organization_id).order_by(AutomationRule.created_at.desc()))
    return result.scalars().all()


@router.post("/automations", response_model=AutomationRuleOut, status_code=status.HTTP_201_CREATED)
async def create_automation(payload: AutomationRuleCreate, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rule = AutomationRule(organization_id=current.organization_id, created_by=current.id, **payload.model_dump())
    db.add(rule)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="automation", entity_id=rule.id, action="created", summary=f"Automation rule created: {rule.name}")
    await db.commit()
    await db.refresh(rule)
    return rule


@router.patch("/automations/{rule_id}", response_model=AutomationRuleOut)
async def update_automation(rule_id: uuid.UUID, payload: AutomationRuleUpdate, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rule = await db.scalar(select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.organization_id == current.organization_id))
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Automation rule not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="automation", entity_id=rule.id, action="updated", summary=f"Automation rule updated: {rule.name}")
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/automations/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(rule_id: uuid.UUID, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rule = await db.scalar(select(AutomationRule).where(AutomationRule.id == rule_id, AutomationRule.organization_id == current.organization_id))
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Automation rule not found")
    await db.delete(rule)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="automation", entity_id=rule_id, action="deleted", summary=f"Automation rule deleted: {rule.name}")
    await db.commit()


@router.get("/audit", response_model=PaginatedAuditEvents)
async def list_audit_events(
    entity_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    base = select(AuditEvent).where(AuditEvent.organization_id == current.organization_id)
    if entity_type:
        base = base.where(AuditEvent.entity_type == entity_type)
    if action:
        base = base.where(AuditEvent.action == action)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(base.order_by(AuditEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = list(result.scalars().all())
    actor_ids = {item.actor_id for item in items if item.actor_id}
    names: dict[uuid.UUID, str] = {}
    if actor_ids:
        actors = await db.execute(select(User.id, User.name).where(User.id.in_(actor_ids)))
        names = dict(actors.all())
    output = [AuditEventOut.model_validate(item) for item in items]
    for item in output:
        item.actor_name = names.get(item.actor_id) if item.actor_id else None
    return PaginatedAuditEvents(items=output, total=total or 0, page=page, page_size=page_size)


@router.get("/audit/export")
async def export_audit_events(current: CurrentUser = Depends(require_admin_or_manager), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuditEvent).where(AuditEvent.organization_id == current.organization_id).order_by(AuditEvent.created_at.desc()))
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["created_at", "actor_id", "entity_type", "entity_id", "action", "summary"])
    for item in result.scalars().all():
        writer.writerow([item.created_at.isoformat(), item.actor_id or "", item.entity_type, item.entity_id or "", item.action, item.summary])
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit-log.csv"})


@router.get("/reports", response_model=list[SavedReportOut])
async def list_saved_reports(current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedReport).where(SavedReport.organization_id == current.organization_id).order_by(SavedReport.updated_at.desc()))
    return result.scalars().all()


@router.post("/reports", response_model=SavedReportOut, status_code=status.HTTP_201_CREATED)
async def create_saved_report(payload: SavedReportCreate, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    report = SavedReport(organization_id=current.organization_id, created_by=current.id, **payload.model_dump())
    db.add(report)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="report", entity_id=report.id, action="created", summary=f"Saved report created: {report.name}")
    await db.commit()
    await db.refresh(report)
    return report


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_report(report_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    report = await db.scalar(select(SavedReport).where(SavedReport.id == report_id, SavedReport.organization_id == current.organization_id))
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved report not found")
    if current.role not in (UserRole.admin, UserRole.manager) and report.created_by != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the report owner or a manager can delete this report")
    await db.delete(report)
    await db.commit()


def _json_default(value):
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return str(value)


def _json_safe(value):
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return _json_default(value) if isinstance(value, (uuid.UUID, datetime, Enum)) else value


async def _organization_snapshot(db: AsyncSession, organization_id: uuid.UUID) -> dict:
    organization = await db.scalar(select(Organization).where(Organization.id == organization_id))
    users = (await db.execute(select(User).where(User.organization_id == organization_id))).scalars().all()
    leads = (await db.execute(select(Lead).where(Lead.organization_id == organization_id))).scalars().all()
    calls = (await db.execute(select(CallLog).join(Lead, CallLog.lead_id == Lead.id).where(Lead.organization_id == organization_id))).scalars().all()
    tasks = (await db.execute(select(Task).where(Task.organization_id == organization_id))).scalars().all()
    notes = (await db.execute(select(LeadNote).where(LeadNote.organization_id == organization_id))).scalars().all()
    attachments = (await db.execute(select(LeadAttachment).where(LeadAttachment.organization_id == organization_id))).scalars().all()
    stages = (await db.execute(select(PipelineStage).where(PipelineStage.organization_id == organization_id))).scalars().all()
    fields = (await db.execute(select(CustomFieldDefinition).where(CustomFieldDefinition.organization_id == organization_id))).scalars().all()
    rules = (await db.execute(select(AutomationRule).where(AutomationRule.organization_id == organization_id))).scalars().all()

    def dump(rows, fields):
        return [{field: _json_safe(getattr(row, field)) if getattr(row, field) is not None else None for field in fields} for row in rows]

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "organization": {"id": str(organization.id), "name": organization.name, "plan": organization.plan} if organization else None,
        "users": dump(users, ["id", "name", "phone", "email", "role", "is_active", "created_at"]),
        "leads": dump(leads, ["id", "name", "phone", "city", "state", "source", "status", "assigned_to", "stage_key", "custom_fields", "notes", "created_at"]),
        "calls": dump(calls, ["id", "lead_id", "logged_by", "duration_minutes", "outcome", "notes", "created_at", "next_follow_up_at", "order_value"]),
        "tasks": dump(tasks, ["id", "lead_id", "assigned_to", "created_by", "title", "description", "task_type", "priority", "status", "due_at", "completed_at", "created_at"]),
        "notes": dump(notes, ["id", "lead_id", "author_id", "body", "pinned", "created_at", "updated_at"]),
        "attachments": dump(attachments, ["id", "lead_id", "uploaded_by", "filename", "content_type", "size_bytes", "created_at"]),
        "stages": dump(stages, ["id", "key", "name", "color", "sort_order", "is_closed", "is_won"]),
        "custom_fields": dump(fields, ["id", "key", "label", "field_type", "options", "required", "is_active", "sort_order"]),
        "automations": dump(rules, ["id", "name", "trigger", "action", "conditions", "action_config", "is_active", "created_at"]),
    }


@router.post("/backups", response_model=BackupOut, status_code=status.HTTP_201_CREATED)
async def create_backup(current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    snapshot = await _organization_snapshot(db, current.organization_id)
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    backup_id = uuid.uuid4()
    filename = f"talkocrm-backup-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    storage_key = f"{current.organization_id}/{backup_id}.json"
    target = BACKUP_ROOT / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(snapshot, ensure_ascii=False, indent=2, default=_json_default).encode("utf-8")
    target.write_bytes(raw)
    record = BackupRecord(id=backup_id, organization_id=current.organization_id, created_by=current.id, filename=filename, storage_key=storage_key, size_bytes=len(raw), status="ready")
    db.add(record)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="backup", entity_id=backup_id, action="created", summary=f"Workspace backup created: {filename}")
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/backups", response_model=list[BackupOut])
async def list_backups(current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BackupRecord).where(BackupRecord.organization_id == current.organization_id).order_by(BackupRecord.created_at.desc()))
    return result.scalars().all()


@router.get("/backups/{backup_id}/download")
async def download_backup(backup_id: uuid.UUID, current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    record = await db.scalar(select(BackupRecord).where(BackupRecord.id == backup_id, BackupRecord.organization_id == current.organization_id))
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup not found")
    path = BACKUP_ROOT / record.storage_key
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Backup file is no longer available")
    return FileResponse(path, media_type="application/json", filename=record.filename)


@router.get("/export")
async def export_workspace(current: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    snapshot = await _organization_snapshot(db, current.organization_id)
    raw = json.dumps(snapshot, ensure_ascii=False, indent=2, default=_json_default)
    return StreamingResponse(iter([raw]), media_type="application/json", headers={"Content-Disposition": "attachment; filename=talkocrm-export.json"})
