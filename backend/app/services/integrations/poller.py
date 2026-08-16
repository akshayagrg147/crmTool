"""Background poller for pull-based providers (IndiaMART).

Runs as a single asyncio task for the lifetime of the process. Each cycle syncs
every enabled pull integration across all organizations, isolating failures so a
bad key on one tenant never blocks another.

Note: this is per-process. Running multiple API workers would poll once per
worker — move to a dedicated worker or add an advisory lock before scaling out.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.integration import IntegrationStatus, LeadIntegration
from app.services.integrations.registry import get_adapter

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None


async def _run_cycle() -> None:
    from app.api.integrations import run_sync  # local import avoids a circular import

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LeadIntegration).where(
                LeadIntegration.is_enabled.is_(True),
                LeadIntegration.status != IntegrationStatus.disconnected,
            )
        )
        rows = list(result.scalars().all())

        for row in rows:
            if get_adapter(row.provider).ingestion != "pull":
                continue
            try:
                outcome = await run_sync(db, row)
                await db.commit()
                if outcome.imported:
                    logger.info(
                        "integration sync: provider=%s org=%s imported=%s",
                        row.provider.value, row.organization_id, outcome.imported,
                    )
            except Exception:  # noqa: BLE001
                await db.rollback()
                logger.exception("integration sync failed for %s", row.provider.value)


async def _loop() -> None:
    interval = max(60, settings.integration_poll_interval_seconds)
    while True:
        try:
            await _run_cycle()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("integration poll cycle failed")
        await asyncio.sleep(interval)


def start_poller() -> None:
    global _task
    if settings.integration_poll_interval_seconds <= 0:
        logger.info("integration poller disabled")
        return
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())
        logger.info("integration poller started (every %ss)", settings.integration_poll_interval_seconds)


async def stop_poller() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
