import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_json, encrypt_json, mask
from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin, require_org_user
from app.models.integration import IntegrationProvider, IntegrationStatus, LeadIntegration
from app.schemas.integration import (
    CredentialFieldOut,
    IntegrationConnectIn,
    IntegrationOut,
    SyncResultOut,
)
from app.services.integrations.base import IntegrationError
from app.services.integrations.ingest import ingest_leads
from app.services.integrations.registry import all_adapters, get_adapter

router = APIRouter(prefix="/integrations", tags=["integrations"])
# Public — providers POST here with only the URL token to identify themselves.
webhook_router = APIRouter(prefix="/integrations", tags=["integrations"])


def _webhook_url(row: LeadIntegration | None) -> str | None:
    if row is None or not row.webhook_secret:
        return None
    return f"{settings.public_base_url.rstrip('/')}/api/integrations/webhook/{row.webhook_secret}"


def _to_out(adapter, row: LeadIntegration | None) -> IntegrationOut:
    creds = decrypt_json(row.credentials) if row else {}
    return IntegrationOut(
        provider=adapter.provider,
        label=adapter.label,
        ingestion=adapter.ingestion,
        docs_url=adapter.docs_url,
        setup_hint=adapter.setup_hint,
        credential_fields=[CredentialFieldOut(**f.__dict__) for f in adapter.credential_fields],
        is_connected=row is not None and row.status != IntegrationStatus.disconnected,
        is_enabled=bool(row and row.is_enabled),
        status=row.status if row else IntegrationStatus.disconnected,
        # Never return raw secrets — only a masked hint that something is stored.
        masked_credentials={k: mask(str(v)) for k, v in creds.items() if v},
        last_synced_at=row.last_synced_at if row else None,
        last_error=row.last_error if row else None,
        total_imported=row.total_imported if row else 0,
        total_duplicates=row.total_duplicates if row else 0,
        webhook_url=_webhook_url(row) if adapter.ingestion == "push" else None,
    )


async def _get_row(db: AsyncSession, org_id: uuid.UUID, provider: IntegrationProvider) -> LeadIntegration | None:
    result = await db.execute(
        select(LeadIntegration).where(
            LeadIntegration.organization_id == org_id,
            LeadIntegration.provider == provider,
        )
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(
    current: CurrentUser = Depends(require_org_user),
    db: AsyncSession = Depends(get_db),
):
    """Every supported provider, merged with this org's connection state."""
    result = await db.execute(
        select(LeadIntegration).where(LeadIntegration.organization_id == current.organization_id)
    )
    rows = {r.provider: r for r in result.scalars().all()}
    return [_to_out(a, rows.get(a.provider)) for a in all_adapters()]


@router.put("/{provider}", response_model=IntegrationOut)
async def connect_integration(
    provider: IntegrationProvider,
    payload: IntegrationConnectIn,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    adapter = get_adapter(provider)

    missing = [
        f.label for f in adapter.credential_fields if f.required and not payload.credentials.get(f.key, "").strip()
    ]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Missing required field(s): {', '.join(missing)}")

    row = await _get_row(db, current.organization_id, provider)
    if row is None:
        row = LeadIntegration(organization_id=current.organization_id, provider=provider)
        db.add(row)

    # Merge so a blank field on re-save keeps the previously stored secret.
    existing = decrypt_json(row.credentials)
    merged = {**existing, **{k: v for k, v in payload.credentials.items() if v.strip()}}
    row.credentials = encrypt_json(merged)
    row.is_enabled = payload.is_enabled

    if adapter.ingestion == "push" and not row.webhook_secret:
        row.webhook_secret = secrets.token_urlsafe(32)

    # Pull providers can be validated immediately; push providers have nothing to call.
    if adapter.ingestion == "pull":
        try:
            await adapter.verify(merged)
            row.status = IntegrationStatus.active
            row.last_error = None
        except IntegrationError as exc:
            row.status = IntegrationStatus.error
            row.last_error = str(exc)
    else:
        row.status = IntegrationStatus.active
        row.last_error = None

    await db.commit()
    await db.refresh(row)
    return _to_out(adapter, row)


@router.delete("/{provider}", response_model=IntegrationOut)
async def disconnect_integration(
    provider: IntegrationProvider,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_row(db, current.organization_id, provider)
    if row is not None:
        await db.delete(row)
        await db.commit()
    return _to_out(get_adapter(provider), None)


@router.post("/{provider}/sync", response_model=SyncResultOut)
async def sync_integration(
    provider: IntegrationProvider,
    current: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pull now, rather than waiting for the background poller."""
    adapter = get_adapter(provider)
    if adapter.ingestion != "pull":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{adapter.label} pushes leads to your webhook — there is nothing to pull.",
        )

    row = await _get_row(db, current.organization_id, provider)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{adapter.label} is not connected")

    result = await run_sync(db, row)
    await db.commit()
    return result


async def run_sync(db: AsyncSession, row: LeadIntegration) -> SyncResultOut:
    """Shared by the manual sync endpoint and the background poller.

    Caller commits. Errors are recorded on the integration rather than raised, so
    one failing provider never takes down a poll cycle.
    """
    adapter = get_adapter(row.provider)
    credentials = decrypt_json(row.credentials)
    if not credentials:
        row.status = IntegrationStatus.error
        row.last_error = "Stored credentials could not be read — please reconnect."
        return SyncResultOut(imported=0, duplicates=0, invalid=0, message=row.last_error)

    try:
        leads = await adapter.fetch(credentials, row.last_synced_at)
    except IntegrationError as exc:
        row.status = IntegrationStatus.error
        row.last_error = str(exc)
        return SyncResultOut(imported=0, duplicates=0, invalid=0, message=str(exc))
    except Exception as exc:  # noqa: BLE001 - never let one provider break the cycle
        row.status = IntegrationStatus.error
        row.last_error = f"Unexpected error: {exc}"
        return SyncResultOut(imported=0, duplicates=0, invalid=0, message=row.last_error)

    outcome = await ingest_leads(db, row, leads)
    row.last_synced_at = datetime.now(timezone.utc)

    return SyncResultOut(
        imported=outcome.imported,
        duplicates=outcome.duplicates,
        invalid=outcome.invalid,
        assignments=outcome.assignments or {},
        message=(
            f"Imported {outcome.imported} new lead(s)"
            + (f", skipped {outcome.duplicates} duplicate(s)" if outcome.duplicates else "")
        ),
    )


@webhook_router.post("/webhook/{token}", status_code=status.HTTP_202_ACCEPTED)
async def receive_webhook(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Public endpoint push providers POST leads to.

    The URL token identifies the integration. Returns 202 even for payloads we
    can't use, so the provider does not disable the hook and retry forever.
    """
    result = await db.execute(select(LeadIntegration).where(LeadIntegration.webhook_secret == token))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown webhook token")
    if not row.is_enabled:
        return {"accepted": 0, "message": "Integration is paused"}

    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Body must be JSON")

    adapter = get_adapter(row.provider)
    parsed = adapter.parse_webhook(payload)

    outcome = await ingest_leads(db, row, parsed.leads)
    row.last_synced_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "accepted": outcome.imported,
        "duplicates": outcome.duplicates,
        # Records rejected at parse time (no phone) plus any dropped during ingest.
        "invalid": outcome.invalid + parsed.skipped,
    }
