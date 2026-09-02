import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_admin_or_manager, require_org_user
from app.models.payroll import (
    AttendanceRecord,
    EmployeePayrollProfile,
    LeaveRequest,
    OrganizationScheduleException,
    OrganizationWorkSchedule,
    TimeEntry,
)
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.payroll import (
    AttendanceApprovalsOut,
    AttendanceCheckIn,
    AttendanceCheckOut,
    AttendanceLocationOut,
    AttendanceLocationUpdate,
    AttendanceOverviewOut,
    AttendanceRecordOut,
    AttendanceStatusOut,
    AttendanceTeamOut,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveRequestReview,
    PayrollEmployeeOut,
    PayrollRateOut,
    PayrollRateUpdate,
    PayrollScheduleExceptionCreate,
    PayrollScheduleExceptionOut,
    PayrollScheduleOut,
    PayrollScheduleUpdate,
    PayrollSummaryOut,
    TimeEntryCreate,
    TimeEntryOut,
    TimeEntryReview,
)

payroll_router = APIRouter(prefix="/payroll", tags=["payroll"])
attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])


def _month_window(month: str | None) -> tuple[str, date, date]:
    value = month or datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        parsed = datetime.strptime(value, "%Y-%m")
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Month must use YYYY-MM format") from exc
    start = parsed.date().replace(day=1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)
    return value, start, end


DEFAULT_WORKING_DAYS = frozenset({0, 1, 2, 3, 4})


def _scheduled_days(
    start: date,
    end: date,
    working_days: set[int] | frozenset[int] = DEFAULT_WORKING_DAYS,
    exceptions: dict[date, bool] | None = None,
) -> int:
    overrides = exceptions or {}
    total = 0
    cursor = start
    while cursor < end:
        is_working = overrides.get(cursor, cursor.weekday() in working_days)
        if is_working:
            total += 1
        cursor += timedelta(days=1)
    return total


def _working_days(start: date, end: date) -> int:
    """Backwards-compatible weekday count used by older callers/tests."""
    return _scheduled_days(start, end)


def _overlap_working_days(
    start: date,
    end: date,
    window_start: date,
    window_end: date,
    working_days: set[int] | frozenset[int] = DEFAULT_WORKING_DAYS,
    exceptions: dict[date, bool] | None = None,
) -> int:
    left = max(start, window_start)
    right = min(end, window_end - timedelta(days=1))
    if right < left:
        return 0
    return _scheduled_days(left, right + timedelta(days=1), working_days, exceptions)


def _decimal(value: object | None) -> Decimal:
    return Decimal(str(value or 0))


def _distance_meters(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    """Return the great-circle distance between two WGS84 coordinates."""
    earth_radius_meters = 6_371_000
    lat_a, lat_b = radians(latitude_a), radians(latitude_b)
    delta_lat = radians(latitude_b - latitude_a)
    delta_lon = radians(longitude_b - longitude_a)
    haversine = sin(delta_lat / 2) ** 2 + cos(lat_a) * cos(lat_b) * sin(delta_lon / 2) ** 2
    return earth_radius_meters * 2 * asin(sqrt(min(1, haversine)))


def _location_configured(organization: Organization) -> bool:
    return (
        getattr(organization, "attendance_latitude", None) is not None
        and getattr(organization, "attendance_longitude", None) is not None
    )


def _location_out(organization: Organization, include_coordinates: bool = False) -> AttendanceLocationOut:
    configured = _location_configured(organization)
    return AttendanceLocationOut(
        configured=configured,
        name=getattr(organization, "attendance_location_name", None),
        latitude=float(organization.attendance_latitude) if configured and include_coordinates else None,
        longitude=float(organization.attendance_longitude) if configured and include_coordinates else None,
        radius_meters=int(organization.attendance_radius_meters or 200),
    )


def _assert_inside_location(organization: Organization, latitude: float, longitude: float) -> None:
    if not _location_configured(organization):
        raise HTTPException(status.HTTP_409_CONFLICT, "Attendance location has not been configured by an admin")
    distance = _distance_meters(
        latitude,
        longitude,
        float(organization.attendance_latitude),
        float(organization.attendance_longitude),
    )
    radius = int(organization.attendance_radius_meters or 200)
    if distance > radius:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"You are about {round(distance)} m away from {organization.attendance_location_name or 'the workplace'}. Check-in is allowed within {radius} m.",
        )


def _attendance_out(record: AttendanceRecord, users: dict[uuid.UUID, User], now: datetime | None = None) -> AttendanceRecordOut:
    current_time = now or datetime.now(timezone.utc)
    end = record.checked_out_at or current_time
    worked_minutes = max(0, round((end - record.checked_in_at).total_seconds() / 60))
    user = users.get(record.user_id)
    return AttendanceRecordOut(
        id=record.id,
        organization_id=record.organization_id,
        user_id=record.user_id,
        user_name=user.name if user else None,
        attendance_date=record.attendance_date,
        checked_in_at=record.checked_in_at,
        checked_out_at=record.checked_out_at,
        check_in_accuracy_meters=float(record.check_in_accuracy_meters) if record.check_in_accuracy_meters is not None else None,
        check_out_accuracy_meters=float(record.check_out_accuracy_meters) if record.check_out_accuracy_meters is not None else None,
        worked_minutes=worked_minutes,
        status="checked_out" if record.checked_out_at else "checked_in",
    )


async def _organization(db: AsyncSession, organization_id: uuid.UUID) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == organization_id))
    organization = result.scalar_one_or_none()
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return organization


def _role_can_review(current: CurrentUser, target: User) -> bool:
    return current.role == UserRole.admin or (current.role == UserRole.manager and target.role == UserRole.telecaller)


def _time_out(entry: TimeEntry, users: dict[uuid.UUID, User]) -> TimeEntryOut:
    user = users.get(entry.user_id)
    submitted_by = users.get(entry.submitted_by) if entry.submitted_by else None
    reviewed_by = users.get(entry.reviewed_by) if entry.reviewed_by else None
    return TimeEntryOut(
        id=entry.id,
        organization_id=entry.organization_id,
        user_id=entry.user_id,
        user_name=user.name if user else None,
        entry_date=entry.entry_date,
        hours=float(entry.hours or 0),
        category=entry.category,
        description=entry.description,
        attendance_record_id=entry.attendance_record_id,
        status=entry.status,
        submitted_by=entry.submitted_by,
        submitted_by_name=submitted_by.name if submitted_by else None,
        reviewed_by=entry.reviewed_by,
        reviewed_by_name=reviewed_by.name if reviewed_by else None,
        reviewed_at=entry.reviewed_at,
        created_at=entry.created_at,
    )


def _leave_out(request: LeaveRequest, users: dict[uuid.UUID, User]) -> LeaveRequestOut:
    user = users.get(request.user_id)
    reviewer = users.get(request.reviewed_by) if request.reviewed_by else None
    return LeaveRequestOut(
        id=request.id,
        organization_id=request.organization_id,
        user_id=request.user_id,
        user_name=user.name if user else None,
        start_date=request.start_date,
        end_date=request.end_date,
        leave_type=request.leave_type,
        reason=request.reason,
        status=request.status,
        reviewed_by=request.reviewed_by,
        reviewed_by_name=reviewer.name if reviewer else None,
        reviewed_at=request.reviewed_at,
        review_note=request.review_note,
        created_at=request.created_at,
    )


async def _org_users(db: AsyncSession, organization_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User).where(User.organization_id == organization_id).order_by(User.created_at, User.name)
    )
    return list(result.scalars().all())


def _schedule_exception_out(
    exception: OrganizationScheduleException,
    users: dict[uuid.UUID, User],
) -> PayrollScheduleExceptionOut:
    creator = users.get(exception.created_by) if exception.created_by else None
    return PayrollScheduleExceptionOut(
        id=exception.id,
        organization_id=exception.organization_id,
        exception_date=exception.exception_date,
        name=exception.name,
        is_working_day=exception.is_working_day,
        created_by=exception.created_by,
        created_by_name=creator.name if creator else None,
        created_at=exception.created_at,
    )


async def _schedule_for_org(db: AsyncSession, organization_id: uuid.UUID) -> OrganizationWorkSchedule | None:
    result = await db.execute(
        select(OrganizationWorkSchedule).where(OrganizationWorkSchedule.organization_id == organization_id)
    )
    return result.scalar_one_or_none()


async def _schedule_exceptions_for_org(
    db: AsyncSession,
    organization_id: uuid.UUID,
) -> list[OrganizationScheduleException]:
    result = await db.execute(
        select(OrganizationScheduleException)
        .where(OrganizationScheduleException.organization_id == organization_id)
        .order_by(OrganizationScheduleException.exception_date.asc())
    )
    return list(result.scalars().all())


async def _schedule_response(
    db: AsyncSession,
    organization_id: uuid.UUID,
    schedule: OrganizationWorkSchedule,
) -> PayrollScheduleOut:
    exceptions = await _schedule_exceptions_for_org(db, organization_id)
    users = {user.id: user for user in await _org_users(db, organization_id)}
    return PayrollScheduleOut(
        organization_id=organization_id,
        working_days=sorted(set(schedule.working_days or DEFAULT_WORKING_DAYS)),
        standard_hours_per_day=float(schedule.standard_hours_per_day or 8),
        exceptions=[_schedule_exception_out(item, users) for item in exceptions],
        updated_at=schedule.updated_at,
    )


@payroll_router.get("/schedule", response_model=PayrollScheduleOut)
async def get_payroll_schedule(
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    schedule = await _schedule_for_org(db, current.organization_id)
    if schedule is None:
        schedule = OrganizationWorkSchedule(
            organization_id=current.organization_id,
            working_days=sorted(DEFAULT_WORKING_DAYS),
            standard_hours_per_day=8,
        )
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
    return await _schedule_response(db, current.organization_id, schedule)


@payroll_router.put("/schedule", response_model=PayrollScheduleOut)
async def update_payroll_schedule(
    payload: PayrollScheduleUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    schedule = await _schedule_for_org(db, current.organization_id)
    if schedule is None:
        schedule = OrganizationWorkSchedule(organization_id=current.organization_id)
        db.add(schedule)
    schedule.working_days = payload.working_days
    schedule.standard_hours_per_day = payload.standard_hours_per_day
    await db.commit()
    await db.refresh(schedule)
    return await _schedule_response(db, current.organization_id, schedule)


@payroll_router.post("/schedule/exceptions", response_model=PayrollScheduleExceptionOut, status_code=status.HTTP_201_CREATED)
async def create_payroll_schedule_exception(
    payload: PayrollScheduleExceptionCreate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing_result = await db.execute(
        select(OrganizationScheduleException).where(
            OrganizationScheduleException.organization_id == current.organization_id,
            OrganizationScheduleException.exception_date == payload.exception_date,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A schedule exception already exists for this date")
    exception = OrganizationScheduleException(
        organization_id=current.organization_id,
        exception_date=payload.exception_date,
        name=payload.name,
        is_working_day=payload.is_working_day,
        created_by=current.id,
    )
    db.add(exception)
    await db.commit()
    await db.refresh(exception)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _schedule_exception_out(exception, users)


@payroll_router.delete("/schedule/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payroll_schedule_exception(
    exception_id: uuid.UUID,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrganizationScheduleException).where(
            OrganizationScheduleException.id == exception_id,
            OrganizationScheduleException.organization_id == current.organization_id,
        )
    )
    exception = result.scalar_one_or_none()
    if exception is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule exception not found")
    await db.delete(exception)
    await db.commit()


@payroll_router.get("", response_model=PayrollSummaryOut)
async def payroll_summary(
    month: str | None = Query(default=None),
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    month_value, month_start, month_end = _month_window(month)
    users = [user for user in await _org_users(db, current.organization_id) if user.role != UserRole.super_admin]
    user_ids = [user.id for user in users]
    profiles_result = await db.execute(
        select(EmployeePayrollProfile).where(
            EmployeePayrollProfile.organization_id == current.organization_id,
            EmployeePayrollProfile.user_id.in_(user_ids) if user_ids else False,
        )
    )
    profiles = {profile.user_id: profile for profile in profiles_result.scalars().all()}
    entries_result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.organization_id == current.organization_id,
            TimeEntry.entry_date >= month_start,
            TimeEntry.entry_date < month_end,
            TimeEntry.user_id.in_(user_ids) if user_ids else False,
        ).order_by(TimeEntry.entry_date.desc(), TimeEntry.created_at.desc())
    )
    entries = list(entries_result.scalars().all())
    leaves_result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.organization_id == current.organization_id,
            LeaveRequest.start_date < month_end,
            LeaveRequest.end_date >= month_start,
            LeaveRequest.user_id.in_(user_ids) if user_ids else False,
        ).order_by(LeaveRequest.start_date.desc(), LeaveRequest.created_at.desc())
    )
    leaves = list(leaves_result.scalars().all())
    schedule = await _schedule_for_org(db, current.organization_id)
    working_days = set(schedule.working_days or DEFAULT_WORKING_DAYS) if schedule else set(DEFAULT_WORKING_DAYS)
    schedule_hours = _decimal(schedule.standard_hours_per_day if schedule else 8)
    schedule_exceptions = await _schedule_exceptions_for_org(db, current.organization_id)
    exception_overrides = {item.exception_date: item.is_working_day for item in schedule_exceptions}
    all_users = {user.id: user for user in await _org_users(db, current.organization_id)}
    entries_by_user: dict[uuid.UUID, list[TimeEntry]] = {user_id: [] for user_id in user_ids}
    leaves_by_user: dict[uuid.UUID, list[LeaveRequest]] = {user_id: [] for user_id in user_ids}
    for entry in entries:
        entries_by_user.setdefault(entry.user_id, []).append(entry)
    for leave in leaves:
        leaves_by_user.setdefault(leave.user_id, []).append(leave)

    target_days = _scheduled_days(month_start, month_end, working_days, exception_overrides)
    employee_rows: list[PayrollEmployeeOut] = []
    total_target = Decimal("0")
    total_approved = Decimal("0")
    total_pending = Decimal("0")
    total_leaves = Decimal("0")
    total_pay = Decimal("0")
    for user in users:
        profile = profiles.get(user.id)
        hourly_rate = _decimal(profile.hourly_rate if profile else 0)
        standard_hours = _decimal(profile.standard_hours_per_day if profile else schedule_hours)
        user_entries = entries_by_user.get(user.id, [])
        user_leaves = leaves_by_user.get(user.id, [])
        approved_hours = sum((_decimal(entry.hours) for entry in user_entries if entry.status == "approved"), Decimal("0"))
        pending_hours = sum((_decimal(entry.hours) for entry in user_entries if entry.status == "pending"), Decimal("0"))
        leave_days = sum(
            (
                _overlap_working_days(
                    leave.start_date,
                    leave.end_date,
                    month_start,
                    month_end,
                    working_days,
                    exception_overrides,
                )
                for leave in user_leaves
                if leave.status == "approved"
            ),
            0,
        )
        target_hours = Decimal(target_days) * standard_hours
        estimated_pay = approved_hours * hourly_rate
        total_target += target_hours
        total_approved += approved_hours
        total_pending += pending_hours
        total_leaves += Decimal(leave_days)
        total_pay += estimated_pay
        employee_rows.append(
            PayrollEmployeeOut(
                user_id=user.id,
                name=user.name,
                phone=user.phone,
                role=user.role,
                is_active=user.is_active,
                hourly_rate=float(hourly_rate),
                standard_hours_per_day=float(standard_hours),
                target_hours=float(target_hours),
                approved_hours=float(approved_hours),
                pending_hours=float(pending_hours),
                leave_days=float(leave_days),
                estimated_pay=float(estimated_pay),
                entries=[_time_out(entry, all_users) for entry in user_entries],
                leaves=[_leave_out(leave, all_users) for leave in user_leaves],
            )
        )
    return PayrollSummaryOut(
        month=month_value,
        employees=employee_rows,
        total_target_hours=float(total_target),
        total_approved_hours=float(total_approved),
        total_pending_hours=float(total_pending),
        total_leave_days=float(total_leaves),
        total_estimated_pay=float(total_pay),
    )


@payroll_router.put("/employees/{user_id}", response_model=PayrollRateOut)
async def update_payroll_rate(
    user_id: uuid.UUID,
    payload: PayrollRateUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == current.organization_id)
    )
    user = user_result.scalar_one_or_none()
    if user is None or user.role == UserRole.super_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    result = await db.execute(
        select(EmployeePayrollProfile).where(
            EmployeePayrollProfile.organization_id == current.organization_id,
            EmployeePayrollProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = EmployeePayrollProfile(organization_id=current.organization_id, user_id=user_id)
        db.add(profile)
    profile.hourly_rate = payload.hourly_rate
    profile.standard_hours_per_day = payload.standard_hours_per_day
    await db.commit()
    return PayrollRateOut(user_id=user_id, hourly_rate=payload.hourly_rate, standard_hours_per_day=payload.standard_hours_per_day)


@attendance_router.get("/location", response_model=AttendanceLocationOut)
async def get_attendance_location(
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    organization = await _organization(db, current.organization_id)
    return _location_out(organization, include_coordinates=True)


@attendance_router.put("/location", response_model=AttendanceLocationOut)
async def update_attendance_location(
    payload: AttendanceLocationUpdate,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    organization = await _organization(db, current.organization_id)
    organization.attendance_location_name = payload.name
    organization.attendance_latitude = payload.latitude
    organization.attendance_longitude = payload.longitude
    organization.attendance_radius_meters = payload.radius_meters
    await db.commit()
    await db.refresh(organization)
    return _location_out(organization, include_coordinates=True)


@attendance_router.get("/status", response_model=AttendanceStatusOut)
async def attendance_status(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    organization = await _organization(db, current.organization_id)
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.organization_id == current.organization_id,
            AttendanceRecord.user_id == current.id,
            AttendanceRecord.attendance_date == today,
        )
    )
    record = result.scalar_one_or_none()
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return AttendanceStatusOut(
        attendance_date=today,
        status="checked_out" if record and record.checked_out_at else "checked_in" if record else "not_checked_in",
        location_configured=_location_configured(organization),
        location_name=organization.attendance_location_name,
        radius_meters=int(organization.attendance_radius_meters or 200),
        record=_attendance_out(record, users) if record else None,
    )


@attendance_router.post("/check-in", response_model=AttendanceRecordOut, status_code=status.HTTP_201_CREATED)
async def check_in(
    payload: AttendanceCheckIn,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    organization = await _organization(db, current.organization_id)
    _assert_inside_location(organization, payload.latitude, payload.longitude)
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.organization_id == current.organization_id,
            AttendanceRecord.user_id == current.id,
            AttendanceRecord.attendance_date == today,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Attendance has already been recorded for today")
    record = AttendanceRecord(
        organization_id=current.organization_id,
        user_id=current.id,
        attendance_date=today,
        checked_in_at=datetime.now(timezone.utc),
        check_in_latitude=payload.latitude,
        check_in_longitude=payload.longitude,
        check_in_accuracy_meters=payload.accuracy_meters,
    )
    db.add(record)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Attendance has already been recorded for today") from exc
    await db.refresh(record)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _attendance_out(record, users)


@attendance_router.post("/check-out", response_model=AttendanceRecordOut)
async def check_out(
    payload: AttendanceCheckOut,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    organization = await _organization(db, current.organization_id)
    _assert_inside_location(organization, payload.latitude, payload.longitude)
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.organization_id == current.organization_id,
            AttendanceRecord.user_id == current.id,
            AttendanceRecord.attendance_date == today,
        )
        .with_for_update()
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Check in before checking out")
    if record.checked_out_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Attendance has already been checked out for today")
    checked_out_at = datetime.now(timezone.utc)
    record.checked_out_at = checked_out_at
    record.check_out_latitude = payload.latitude
    record.check_out_longitude = payload.longitude
    record.check_out_accuracy_meters = payload.accuracy_meters
    worked_seconds = max(0, (checked_out_at - record.checked_in_at).total_seconds())
    # Keep the existing payroll approval flow: an attendance session becomes a
    # pending calling entry after check-out, so an admin/manager can approve it.
    if worked_seconds >= 60:
        db.add(
            TimeEntry(
                organization_id=current.organization_id,
                user_id=current.id,
                entry_date=record.attendance_date,
                hours=round(worked_seconds / 3600, 2),
                category="calling",
                description="Attendance check-in session",
                attendance_record_id=record.id,
                status="pending",
                submitted_by=current.id,
            )
        )
    await db.commit()
    await db.refresh(record)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _attendance_out(record, users)


@attendance_router.get("/team", response_model=AttendanceTeamOut)
async def attendance_team(
    month: str | None = Query(default=None),
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    month_value, month_start, month_end = _month_window(month)
    users = await _org_users(db, current.organization_id)
    visible_ids = {user.id for user in users}
    if current.role == UserRole.manager:
        visible_ids = {user.id for user in users if user.id == current.id or user.role == UserRole.telecaller}
    result = await db.execute(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.organization_id == current.organization_id,
            AttendanceRecord.attendance_date >= month_start,
            AttendanceRecord.attendance_date < month_end,
            AttendanceRecord.user_id.in_(visible_ids) if visible_ids else False,
        )
        .order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.checked_in_at.desc())
    )
    user_map = {user.id: user for user in users}
    return AttendanceTeamOut(
        month=month_value,
        records=[_attendance_out(record, user_map) for record in result.scalars().all()],
    )


@attendance_router.get("", response_model=AttendanceOverviewOut)
async def attendance_overview(
    month: str | None = Query(default=None),
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    month_value, month_start, month_end = _month_window(month)
    users = await _org_users(db, current.organization_id)
    user_map = {user.id: user for user in users}
    entries_result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.organization_id == current.organization_id,
            TimeEntry.user_id == current.id,
            TimeEntry.entry_date >= month_start,
            TimeEntry.entry_date < month_end,
        ).order_by(TimeEntry.entry_date.desc(), TimeEntry.created_at.desc())
    )
    leaves_result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.organization_id == current.organization_id,
            LeaveRequest.user_id == current.id,
            LeaveRequest.start_date < month_end,
            LeaveRequest.end_date >= month_start,
        ).order_by(LeaveRequest.start_date.desc(), LeaveRequest.created_at.desc())
    )
    records_result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.organization_id == current.organization_id,
            AttendanceRecord.user_id == current.id,
            AttendanceRecord.attendance_date >= month_start,
            AttendanceRecord.attendance_date < month_end,
        ).order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.checked_in_at.desc())
    )
    records = list(records_result.scalars().all())
    pending_count = 0
    if current.role in (UserRole.admin, UserRole.manager):
        pending_entries_result = await db.execute(
            select(TimeEntry).where(
                TimeEntry.organization_id == current.organization_id,
                TimeEntry.status == "pending",
                TimeEntry.entry_date >= month_start,
                TimeEntry.entry_date < month_end,
            )
        )
        pending_leaves_result = await db.execute(
            select(LeaveRequest).where(
                LeaveRequest.organization_id == current.organization_id,
                LeaveRequest.status == "pending",
                LeaveRequest.start_date < month_end,
                LeaveRequest.end_date >= month_start,
            )
        )
        pending_count = sum(
            1
            for entry in pending_entries_result.scalars().all()
            if current.role == UserRole.admin
            or (user_map.get(entry.user_id) and user_map[entry.user_id].role == UserRole.telecaller)
        )
        pending_count += sum(
            1
            for leave in pending_leaves_result.scalars().all()
            if current.role == UserRole.admin
            or (user_map.get(leave.user_id) and user_map[leave.user_id].role == UserRole.telecaller)
        )
    return AttendanceOverviewOut(
        month=month_value,
        entries=[_time_out(entry, user_map) for entry in entries_result.scalars().all()],
        leaves=[_leave_out(leave, user_map) for leave in leaves_result.scalars().all()],
        records=[_attendance_out(record, user_map) for record in records],
        pending_approvals=pending_count,
    )


@attendance_router.get("/approvals", response_model=AttendanceApprovalsOut)
async def attendance_approvals(
    month: str | None = Query(default=None),
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    _month_value, month_start, month_end = _month_window(month)
    users = await _org_users(db, current.organization_id)
    user_map = {user.id: user for user in users}
    entries_result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.organization_id == current.organization_id,
            TimeEntry.status == "pending",
            TimeEntry.entry_date >= month_start,
            TimeEntry.entry_date < month_end,
        ).order_by(TimeEntry.entry_date.asc(), TimeEntry.created_at.asc())
    )
    leaves_result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.organization_id == current.organization_id,
            LeaveRequest.status == "pending",
            LeaveRequest.start_date < month_end,
            LeaveRequest.end_date >= month_start,
        ).order_by(LeaveRequest.start_date.asc(), LeaveRequest.created_at.asc())
    )
    entries = [entry for entry in entries_result.scalars().all() if current.role == UserRole.admin or (user_map.get(entry.user_id) and user_map[entry.user_id].role == UserRole.telecaller)]
    leaves = [leave for leave in leaves_result.scalars().all() if current.role == UserRole.admin or (user_map.get(leave.user_id) and user_map[leave.user_id].role == UserRole.telecaller)]
    return AttendanceApprovalsOut(
        time_entries=[_time_out(entry, user_map) for entry in entries],
        leaves=[_leave_out(leave, user_map) for leave in leaves],
    )


@attendance_router.post("/time-entries", response_model=TimeEntryOut, status_code=status.HTTP_201_CREATED)
async def create_time_entry(
    payload: TimeEntryCreate,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    target_id = payload.user_id or current.id
    target_result = await db.execute(select(User).where(User.id == target_id, User.organization_id == current.organization_id))
    target = target_result.scalar_one_or_none()
    if target is None or target.role == UserRole.super_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    if target_id == current.id and current.role == UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins cannot submit personal work time")
    if target_id != current.id and current.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can record time for another employee")
    entry = TimeEntry(
        organization_id=current.organization_id,
        user_id=target_id,
        entry_date=payload.entry_date,
        hours=payload.hours,
        category=payload.category,
        description=payload.description,
        status=payload.status if current.role == UserRole.admin else "pending",
        submitted_by=current.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _time_out(entry, users)


@attendance_router.patch("/time-entries/{entry_id}", response_model=TimeEntryOut)
async def review_time_entry(
    entry_id: uuid.UUID,
    payload: TimeEntryReview,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.organization_id == current.organization_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Time entry not found")
    target_result = await db.execute(select(User).where(User.id == entry.user_id, User.organization_id == current.organization_id))
    target = target_result.scalar_one_or_none()
    if target is None or not _role_can_review(current, target):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only review telecaller time entries")
    entry.status = payload.status
    entry.reviewed_by = current.id
    entry.reviewed_at = None if payload.status == "pending" else datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _time_out(entry, users)


@attendance_router.post("/leave-requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    payload: LeaveRequestCreate,
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    target_id = payload.user_id or current.id
    target_result = await db.execute(select(User).where(User.id == target_id, User.organization_id == current.organization_id))
    target = target_result.scalar_one_or_none()
    if target is None or target.role == UserRole.super_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Employee not found")
    if target_id == current.id and current.role == UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins cannot submit personal leave requests")
    if target_id != current.id and current.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can create leave for another employee")
    if payload.end_date < payload.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "End date cannot be before start date")
    request = LeaveRequest(
        organization_id=current.organization_id,
        user_id=target_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        leave_type=payload.leave_type,
        reason=payload.reason,
        status="pending",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _leave_out(request, users)


@attendance_router.patch("/leave-requests/{request_id}", response_model=LeaveRequestOut)
async def review_leave_request(
    request_id: uuid.UUID,
    payload: LeaveRequestReview,
    current: CurrentUser = Depends(require_admin_or_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id, LeaveRequest.organization_id == current.organization_id))
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    target_result = await db.execute(select(User).where(User.id == request.user_id, User.organization_id == current.organization_id))
    target = target_result.scalar_one_or_none()
    if target is None or not _role_can_review(current, target):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only review telecaller leave requests")
    request.status = payload.status
    request.reviewed_by = current.id
    request.reviewed_at = None if payload.status == "pending" else datetime.now(timezone.utc)
    request.review_note = payload.review_note.strip() if payload.review_note else None
    await db.commit()
    await db.refresh(request)
    users = {user.id: user for user in await _org_users(db, current.organization_id)}
    return _leave_out(request, users)
