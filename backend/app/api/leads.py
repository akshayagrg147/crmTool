import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin_or_manager, require_org_user
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.user import User, UserRole
from app.schemas.lead import (
    BulkImportResult,
    DuplicateLeadMatch,
    LeadCreate,
    LeadOut,
    LeadUpdate,
    LastCallOut,
    PaginatedLeads,
    ReassignRequest,
)
from app.services.distribution import assign_batch, assign_next_telecaller

router = APIRouter(prefix="/leads", tags=["leads"])

LEAD_LOAD_OPTIONS = (
    selectinload(Lead.assignee),
    selectinload(Lead.call_logs),
    selectinload(Lead.product),
)


def _to_out(lead: Lead) -> LeadOut:
    out = LeadOut.model_validate(lead)
    out.assignee_name = lead.assignee.name if lead.assignee else None
    out.product_name = lead.product.name if lead.product else None
    if lead.call_logs:
        latest = lead.call_logs[0]
        out.last_call = LastCallOut(
            outcome=latest.outcome,
            duration_minutes=float(latest.duration_minutes),
            notes=latest.notes,
            created_at=latest.created_at,
        )
    return out


def _build_lead_filter_stmt(
    current: CurrentUser,
    source: LeadSource | None,
    status_filter: LeadStatus | None,
    assigned_to: uuid.UUID | None,
    category: LeadCategory | None,
    state: str | None,
    city: str | None,
    dnd: bool | None,
    q: str | None,
    has_callback: bool | None = None,
):
    stmt = select(Lead).where(Lead.organization_id == current.organization_id)

    if current.role == UserRole.telecaller:
        stmt = stmt.where(Lead.assigned_to == current.id)
    elif assigned_to is not None:
        stmt = stmt.where(Lead.assigned_to == assigned_to)

    if source is not None:
        stmt = stmt.where(Lead.source == source)
    if status_filter is not None:
        stmt = stmt.where(Lead.status == status_filter)
    if category is not None:
        stmt = stmt.where(Lead.category == category)
    if state is not None:
        stmt = stmt.where(Lead.state == state)
    if city is not None:
        stmt = stmt.where(Lead.city == city)
    if dnd is not None:
        stmt = stmt.where(Lead.dnd == dnd)
    if has_callback is not None:
        stmt = stmt.where(Lead.next_follow_up_at.isnot(None) if has_callback else Lead.next_follow_up_at.is_(None))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.phone.ilike(like), Lead.city.ilike(like)))
    return stmt


@router.get("", response_model=PaginatedLeads)
async def list_leads(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
    source: LeadSource | None = None,
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    assigned_to: uuid.UUID | None = None,
    category: LeadCategory | None = None,
    state: str | None = None,
    city: str | None = None,
    dnd: bool | None = None,
    q: str | None = None,
    has_callback: bool | None = None,
    overdue_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
):
    stmt = _build_lead_filter_stmt(
        current, source, status_filter, assigned_to, category, state, city, dnd, q, has_callback
    )
    if overdue_only:
        stmt = stmt.where(Lead.next_follow_up_at.isnot(None), Lead.next_follow_up_at < datetime.now(timezone.utc))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    order_col = Lead.next_follow_up_at.asc().nullslast() if has_callback else Lead.created_at.desc()
    stmt = (
        stmt.options(*LEAD_LOAD_OPTIONS)
        .order_by(order_col)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    leads = list(result.scalars().unique().all())

    return PaginatedLeads(items=[_to_out(l) for l in leads], total=total, page=page, page_size=page_size)


@router.get("/export")
async def export_leads(
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
    source: LeadSource | None = None,
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    assigned_to: uuid.UUID | None = None,
    category: LeadCategory | None = None,
    state: str | None = None,
    city: str | None = None,
    dnd: bool | None = None,
    q: str | None = None,
):
    stmt = _build_lead_filter_stmt(current, source, status_filter, assigned_to, category, state, city, dnd, q)
    stmt = stmt.options(*LEAD_LOAD_OPTIONS).order_by(Lead.created_at.desc())
    result = await db.execute(stmt)
    leads = list(result.scalars().unique().all())

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Name", "Phone", "City", "State", "Category", "Specialty", "Drug License",
        "Product Interest", "Source", "Status", "Assigned To",
        "Credit Limit", "Outstanding", "DND", "Notes", "Created At", "Last Contacted At",
    ])
    for lead in leads:
        writer.writerow([
            lead.name, lead.phone, lead.city or "", lead.state or "", lead.category.value, lead.specialty or "",
            lead.drug_license_number or "",
            lead.product.name if lead.product else "", lead.source.value, lead.status.value,
            lead.assignee.name if lead.assignee else "", lead.credit_limit or "", lead.outstanding_amount or "",
            "Yes" if lead.dnd else "No", lead.notes or "", lead.created_at.isoformat(),
            lead.last_contacted_at.isoformat() if lead.last_contacted_at else "",
        ])
    buffer.seek(0)

    filename = f"leads-export-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def add_lead(
    payload: LeadCreate,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    lead = Lead(
        organization_id=current.organization_id,
        name=payload.name,
        phone=payload.phone,
        city=payload.city,
        state=payload.state,
        source=payload.source,
        notes=payload.notes,
        status=LeadStatus.new,
        category=payload.category,
        drug_license_number=payload.drug_license_number,
        specialty=payload.specialty,
        product_id=payload.product_id,
        credit_limit=payload.credit_limit,
        outstanding_amount=payload.outstanding_amount,
        dnd=payload.dnd,
    )
    assignee = await assign_next_telecaller(db, current.organization_id)
    if assignee:
        lead.assigned_to = assignee.id
    db.add(lead)
    await db.commit()
    result = await db.execute(select(Lead).options(*LEAD_LOAD_OPTIONS).where(Lead.id == lead.id))
    lead = result.scalar_one()
    return _to_out(lead)


@router.get("/check-duplicate", response_model=list[DuplicateLeadMatch])
async def check_duplicate_phone(
    phone: str = Query(min_length=3),
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Lead)
        .options(selectinload(Lead.assignee))
        .where(Lead.organization_id == current.organization_id, Lead.phone == phone)
    )
    if current.role == UserRole.telecaller:
        stmt = stmt.where(Lead.assigned_to == current.id)
    result = await db.execute(stmt)
    matches = result.scalars().all()
    return [
        DuplicateLeadMatch(
            id=lead.id, name=lead.name, phone=lead.phone, status=lead.status,
            assignee_name=lead.assignee.name if lead.assignee else None,
        )
        for lead in matches
    ]


@router.get("/categories", response_model=list[LeadCategory])
async def list_used_categories(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Lead.category).distinct().where(Lead.organization_id == current.organization_id)
    if current.role == UserRole.telecaller:
        stmt = stmt.where(Lead.assigned_to == current.id)
    result = await db.execute(stmt)
    return sorted((row[0] for row in result.all()), key=lambda c: c.value)


@router.get("/cities", response_model=list[str])
async def list_used_cities(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Lead.city).distinct().where(
        Lead.organization_id == current.organization_id, Lead.city.isnot(None)
    )
    if current.role == UserRole.telecaller:
        stmt = stmt.where(Lead.assigned_to == current.id)
    result = await db.execute(stmt)
    return sorted(row[0] for row in result.all())


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: uuid.UUID,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead)
        .options(*LEAD_LOAD_OPTIONS)
        .where(Lead.id == lead_id, Lead.organization_id == current.organization_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if current.role == UserRole.telecaller and lead.assigned_to != current.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")
    return _to_out(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")

    data = payload.model_dump(exclude_unset=True)
    if current.role == UserRole.telecaller:
        if lead.assigned_to != current.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lead")
        disallowed = set(data.keys()) - {"status", "notes"}
        if disallowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Telecallers can only update status/notes")

    for field, value in data.items():
        setattr(lead, field, value)

    await db.commit()
    result = await db.execute(select(Lead).options(*LEAD_LOAD_OPTIONS).where(Lead.id == lead.id))
    lead = result.scalar_one()
    return _to_out(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    await db.delete(lead)
    await db.commit()


@router.post("/{lead_id}/reassign", response_model=LeadOut)
async def reassign_lead(
    lead_id: uuid.UUID,
    payload: ReassignRequest,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.organization_id == current.organization_id))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")

    if payload.assigned_to is not None:
        user_result = await db.execute(
            select(User).where(User.id == payload.assigned_to, User.organization_id == current.organization_id)
        )
        if user_result.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Assignee not found in this organization")

    lead.assigned_to = payload.assigned_to
    await db.commit()
    result = await db.execute(select(Lead).options(*LEAD_LOAD_OPTIONS).where(Lead.id == lead.id))
    lead = result.scalar_one()
    return _to_out(lead)


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import_leads(
    source: LeadSource,
    file: UploadFile,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    raw = await file.read()
    rows: list[dict] = []

    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx"):
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        header = None
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0:
                header = [str(c or "").strip().lower() for c in row]
                continue
            rows.append(dict(zip(header, row)))
    else:
        text = raw.decode("utf-8-sig", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        rows = [{(k or "").strip().lower(): v for k, v in r.items()} for r in reader]

    category_values = {c.value for c in LeadCategory}

    valid_rows = []
    skipped = 0
    seen_phones: set[str] = set()
    for r in rows:
        name = str(r.get("name") or "").strip()
        phone = str(r.get("phone") or "").strip()
        if not name or not phone or phone in seen_phones:
            skipped += 1
            continue
        seen_phones.add(phone)
        city = str(r.get("city") or "").strip() or None
        category_raw = str(r.get("category") or "").strip().lower()
        category = LeadCategory(category_raw) if category_raw in category_values else LeadCategory.other
        valid_rows.append({"name": name, "phone": phone, "city": city, "category": category})

    if not valid_rows:
        return BulkImportResult(imported=0, skipped=skipped, assignments={})

    existing_result = await db.execute(
        select(Lead.phone).where(
            Lead.organization_id == current.organization_id, Lead.phone.in_([r["phone"] for r in valid_rows])
        )
    )
    existing_phones = {p for (p,) in existing_result.all()}
    duplicates_skipped = sum(1 for r in valid_rows if r["phone"] in existing_phones)
    valid_rows = [r for r in valid_rows if r["phone"] not in existing_phones]

    if not valid_rows:
        return BulkImportResult(imported=0, skipped=skipped, duplicates_skipped=duplicates_skipped, assignments={})

    assignees = await assign_batch(db, current.organization_id, len(valid_rows))
    assignments_count: dict[str, int] = {}
    new_leads = []
    for row, assignee in zip(valid_rows, assignees):
        lead = Lead(
            organization_id=current.organization_id,
            name=row["name"],
            phone=row["phone"],
            city=row["city"],
            source=source,
            status=LeadStatus.new,
            category=row["category"],
            assigned_to=assignee.id if assignee else None,
        )
        new_leads.append(lead)
        if assignee:
            assignments_count[assignee.name] = assignments_count.get(assignee.name, 0) + 1

    db.add_all(new_leads)
    await db.commit()

    return BulkImportResult(
        imported=len(new_leads), skipped=skipped, duplicates_skipped=duplicates_skipped, assignments=assignments_count
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_leads(
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.organization_id == current.organization_id))
    leads = result.scalars().all()
    for lead in leads:
        await db.delete(lead)
    await db.commit()
