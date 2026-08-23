import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, require_org_user
from app.models.lead import Lead
from app.models.lead_note import LeadAttachment, LeadNote
from app.models.user import UserRole
from app.schemas.note import LeadAttachmentOut, LeadNoteCreate, LeadNoteOut, LeadNoteUpdate
from app.services.audit import record_audit

router = APIRouter(prefix="/leads", tags=["notes"])
ATTACHMENT_ROOT = Path(settings.attachment_dir)


async def _lead_for_user(lead_id: uuid.UUID, current: CurrentUser, db: AsyncSession) -> Lead:
    lead = await db.scalar(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")
    return lead


@router.get("/{lead_id}/notes", response_model=list[LeadNoteOut])
async def list_notes(lead_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    result = await db.execute(
        select(LeadNote).options(selectinload(LeadNote.author)).where(LeadNote.lead_id == lead_id, LeadNote.organization_id == current.organization_id).order_by(LeadNote.pinned.desc(), LeadNote.created_at.desc())
    )
    return [
        LeadNoteOut(
            id=note.id,
            lead_id=note.lead_id,
            author_id=note.author_id,
            author_name=note.author.name if note.author else None,
            body=note.body,
            pinned=note.pinned,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note in result.scalars().all()
    ]


@router.post("/{lead_id}/notes", response_model=LeadNoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(lead_id: uuid.UUID, payload: LeadNoteCreate, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    note = LeadNote(organization_id=current.organization_id, lead_id=lead_id, author_id=current.id, **payload.model_dump())
    db.add(note)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="lead_note", entity_id=note.id, action="created", summary="Lead note added", payload={"lead_id": str(lead_id)})
    await db.commit()
    result = await db.execute(select(LeadNote).options(selectinload(LeadNote.author)).where(LeadNote.id == note.id))
    note = result.scalar_one()
    return LeadNoteOut(id=note.id, lead_id=note.lead_id, author_id=note.author_id, author_name=note.author.name if note.author else None, body=note.body, pinned=note.pinned, created_at=note.created_at, updated_at=note.updated_at)


@router.patch("/{lead_id}/notes/{note_id}", response_model=LeadNoteOut)
async def update_note(lead_id: uuid.UUID, note_id: uuid.UUID, payload: LeadNoteUpdate, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    note = await db.scalar(select(LeadNote).where(LeadNote.id == note_id, LeadNote.lead_id == lead_id, LeadNote.organization_id == current.organization_id))
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    if current.role == UserRole.telecaller and note.author_id != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the note author can update this note")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="lead_note", entity_id=note.id, action="updated", summary="Lead note updated")
    await db.commit()
    result = await db.execute(select(LeadNote).options(selectinload(LeadNote.author)).where(LeadNote.id == note.id))
    note = result.scalar_one()
    return LeadNoteOut(id=note.id, lead_id=note.lead_id, author_id=note.author_id, author_name=note.author.name if note.author else None, body=note.body, pinned=note.pinned, created_at=note.created_at, updated_at=note.updated_at)


@router.delete("/{lead_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(lead_id: uuid.UUID, note_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    note = await db.scalar(select(LeadNote).where(LeadNote.id == note_id, LeadNote.lead_id == lead_id, LeadNote.organization_id == current.organization_id))
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    if current.role == UserRole.telecaller and note.author_id != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the note author can delete this note")
    await db.delete(note)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="lead_note", entity_id=note_id, action="deleted", summary="Lead note deleted")
    await db.commit()


@router.get("/{lead_id}/attachments", response_model=list[LeadAttachmentOut])
async def list_attachments(lead_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    result = await db.execute(select(LeadAttachment).options(selectinload(LeadAttachment.uploader)).where(LeadAttachment.lead_id == lead_id, LeadAttachment.organization_id == current.organization_id).order_by(LeadAttachment.created_at.desc()))
    return [LeadAttachmentOut(id=item.id, lead_id=item.lead_id, uploaded_by=item.uploaded_by, uploaded_by_name=item.uploader.name if item.uploader else None, filename=item.filename, content_type=item.content_type, size_bytes=item.size_bytes, created_at=item.created_at) for item in result.scalars().all()]


@router.post("/{lead_id}/attachments", response_model=LeadAttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(lead_id: uuid.UUID, file: UploadFile = File(...), current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    raw = await file.read()
    if not raw:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The selected file is empty")
    if len(raw) > settings.max_attachment_size_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Attachments must be smaller than {settings.max_attachment_size_bytes // (1024 * 1024)} MB")
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", Path(file.filename or "attachment").name)[:180] or "attachment"
    attachment_id = uuid.uuid4()
    storage_key = f"{current.organization_id}/{lead_id}/{attachment_id}-{safe_name}"
    target = ATTACHMENT_ROOT / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    attachment = LeadAttachment(id=attachment_id, organization_id=current.organization_id, lead_id=lead_id, uploaded_by=current.id, filename=safe_name, storage_key=storage_key, content_type=file.content_type, size_bytes=len(raw))
    db.add(attachment)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="lead_attachment", entity_id=attachment.id, action="created", summary=f"Attachment uploaded: {safe_name}", payload={"lead_id": str(lead_id), "size_bytes": len(raw)})
    await db.commit()
    result = await db.execute(select(LeadAttachment).options(selectinload(LeadAttachment.uploader)).where(LeadAttachment.id == attachment.id))
    attachment = result.scalar_one()
    return LeadAttachmentOut(id=attachment.id, lead_id=attachment.lead_id, uploaded_by=attachment.uploaded_by, uploaded_by_name=attachment.uploader.name if attachment.uploader else None, filename=attachment.filename, content_type=attachment.content_type, size_bytes=attachment.size_bytes, created_at=attachment.created_at)


@router.get("/{lead_id}/attachments/{attachment_id}/download")
async def download_attachment(lead_id: uuid.UUID, attachment_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    attachment = await db.scalar(select(LeadAttachment).where(LeadAttachment.id == attachment_id, LeadAttachment.lead_id == lead_id, LeadAttachment.organization_id == current.organization_id))
    if attachment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    path = ATTACHMENT_ROOT / attachment.storage_key
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment file is no longer available")
    return FileResponse(path, media_type=attachment.content_type or "application/octet-stream", filename=attachment.filename)


@router.delete("/{lead_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(lead_id: uuid.UUID, attachment_id: uuid.UUID, current: CurrentUser = Depends(require_org_user), db: AsyncSession = Depends(get_db)):
    await _lead_for_user(lead_id, current, db)
    attachment = await db.scalar(select(LeadAttachment).where(LeadAttachment.id == attachment_id, LeadAttachment.lead_id == lead_id, LeadAttachment.organization_id == current.organization_id))
    if attachment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    if current.role == UserRole.telecaller and attachment.uploaded_by != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the uploader or a manager can delete this attachment")
    path = ATTACHMENT_ROOT / attachment.storage_key
    if path.is_file():
        path.unlink()
    await db.delete(attachment)
    record_audit(db, organization_id=current.organization_id, actor_id=current.id, entity_type="lead_attachment", entity_id=attachment_id, action="deleted", summary=f"Attachment deleted: {attachment.filename}")
    await db.commit()
