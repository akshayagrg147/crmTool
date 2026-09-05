"""Shared timezone-aware calculations for workplace attendance."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


def get_attendance_timezone() -> ZoneInfo:
    """Return the configured workplace timezone for attendance dates."""
    return ZoneInfo(settings.attendance_timezone)


def as_utc(value: datetime) -> datetime:
    """Normalize a timestamp to an aware UTC datetime."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def attendance_date_for(
    value: datetime | None = None,
    *,
    attendance_tz: ZoneInfo | None = None,
) -> date:
    """Return the local workplace date for a UTC timestamp."""
    current = as_utc(value or datetime.now(timezone.utc))
    return current.astimezone(attendance_tz or get_attendance_timezone()).date()


def local_midnight_utc(
    value: date,
    *,
    attendance_tz: ZoneInfo | None = None,
) -> datetime:
    """Return the start of a local attendance day as a UTC timestamp."""
    return datetime.combine(
        value,
        time.min,
        tzinfo=attendance_tz or get_attendance_timezone(),
    ).astimezone(timezone.utc)


def attendance_day_bounds(
    value: date,
    *,
    attendance_tz: ZoneInfo | None = None,
) -> tuple[datetime, datetime]:
    """Return the UTC start and exclusive end of one local attendance day."""
    tz = attendance_tz or get_attendance_timezone()
    return (
        local_midnight_utc(value, attendance_tz=tz),
        local_midnight_utc(value + timedelta(days=1), attendance_tz=tz),
    )
