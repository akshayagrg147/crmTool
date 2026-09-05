"""Close forgotten attendance sessions at the next local midnight.

This module runs in its own Compose service so the job survives web-browser
closures and is not duplicated by future FastAPI worker scaling. It reconciles
once per minute, which also catches up safely after a restart or a brief
database outage while preserving the real midnight cutoff.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine
from app.models.payroll import AttendanceRecord, TimeEntry
from app.services.attendance_clock import (
    as_utc,
    attendance_date_for,
    get_attendance_timezone,
    local_midnight_utc,
)

logger = logging.getLogger(__name__)

AUTO_CHECKOUT_DESCRIPTION = "Attendance automatically checked out at midnight"
_RECONCILIATION_INTERVAL_SECONDS = 60
_MAX_CONSECUTIVE_FAILURES = 3
_HEALTH_FILE = Path(os.getenv("ATTENDANCE_CLOSER_HEALTH_FILE", "/tmp/attendance-closer-health"))


async def close_stale_attendance_records(
    db: AsyncSession,
    *,
    now: datetime | None = None,
    attendance_tz: ZoneInfo | None = None,
) -> int:
    """Close open sessions that began before today's local midnight.

    The stored checkout is always the midnight following the check-in's local
    calendar day, even when this worker catches up later after a restart.
    """
    tz = attendance_tz or get_attendance_timezone()
    today = attendance_date_for(now, attendance_tz=tz)
    current_day_start = local_midnight_utc(today, attendance_tz=tz)

    result = await db.execute(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.checked_out_at.is_(None),
            AttendanceRecord.checked_in_at < current_day_start,
        )
        .with_for_update(skip_locked=True)
    )
    records = list(result.scalars().all())
    if not records:
        return 0

    record_ids = [record.id for record in records]
    entry_result = await db.execute(
        select(TimeEntry.attendance_record_id).where(TimeEntry.attendance_record_id.in_(record_ids))
    )
    existing_entry_record_ids = set(entry_result.scalars().all())

    for record in records:
        checked_in_at = as_utc(record.checked_in_at)
        checked_in_date = checked_in_at.astimezone(tz).date()
        checked_out_at = local_midnight_utc(checked_in_date + timedelta(days=1), attendance_tz=tz)
        record.checked_out_at = checked_out_at

        worked_seconds = max(0, (checked_out_at - checked_in_at).total_seconds())
        if worked_seconds < 60 or record.id in existing_entry_record_ids:
            continue
        db.add(
            TimeEntry(
                organization_id=record.organization_id,
                user_id=record.user_id,
                # Use the actual local check-in date, not the legacy UTC date
                # that older records may have stored.
                entry_date=checked_in_date,
                hours=round(worked_seconds / 3600, 2),
                category="calling",
                description=AUTO_CHECKOUT_DESCRIPTION,
                attendance_record_id=record.id,
                status="pending",
                submitted_by=record.user_id,
            )
        )

    await db.flush()
    return len(records)


async def _run_cycle() -> int:
    async with AsyncSessionLocal() as db:
        try:
            closed = await close_stale_attendance_records(db)
            await db.commit()
            return closed
        except Exception:
            await db.rollback()
            raise


def _write_heartbeat() -> None:
    """Make a successful database cycle observable to Compose health checks."""
    _HEALTH_FILE.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")


async def _loop() -> None:
    consecutive_failures = 0
    while True:
        try:
            closed = await _run_cycle()
            _write_heartbeat()
            consecutive_failures = 0
            if closed:
                logger.info("attendance auto-checkout: closed %s forgotten session(s)", closed)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            consecutive_failures += 1
            logger.exception("attendance auto-checkout cycle failed")
            if consecutive_failures >= _MAX_CONSECUTIVE_FAILURES:
                raise RuntimeError(
                    "attendance auto-checkout failed for "
                    f"{consecutive_failures} consecutive cycles; restarting service"
                )
        await asyncio.sleep(_RECONCILIATION_INTERVAL_SECONDS)


async def main() -> None:
    logger.info(
        "attendance auto-checkout worker started (timezone=%s; reconciliation=%ss)",
        get_attendance_timezone().key,
        _RECONCILIATION_INTERVAL_SECONDS,
    )
    try:
        await _loop()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
