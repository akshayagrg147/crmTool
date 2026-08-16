"""IndiaMART Lead Manager (CRM) integration — pull model.

IndiaMART exposes a polling API: you ask for every enquiry in a time window and
they return the buyer's contact details. There is no webhook, so the background
poller drives this on a timer.

Rate limit: IndiaMART throttles this endpoint (roughly one call per 5 minutes per
key) and returns CODE 429 when exceeded, which we surface as a normal error
rather than retrying in a tight loop.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.models.integration import IntegrationProvider
from app.models.lead import LeadSource
from app.services.integrations.base import (
    CredentialField,
    IntegrationError,
    NormalizedLead,
    ProviderAdapter,
    clean_phone,
    first_of,
)

API_URL = "https://mapi.indiamart.com/wservce/crm/crmListing/v2/"
# IndiaMART expects timestamps as DD-Mon-YYYYHH:MM:SS, e.g. 15-Aug-202609:30:00
TIME_FORMAT = "%d-%b-%Y%H:%M:%S"
# How far back to look on the very first sync of a fresh connection.
INITIAL_LOOKBACK = timedelta(days=7)


class IndiaMartAdapter(ProviderAdapter):
    provider = IntegrationProvider.indiamart
    lead_source = LeadSource.indiamart
    label = "IndiaMART"
    ingestion = "pull"
    docs_url = "https://seller.indiamart.com/leadmanager/crmapi"
    setup_hint = (
        "In IndiaMART Seller Panel go to Lead Manager → CRM API and copy your CRM key. "
        "The Lead Manager API is a paid add-on and must be enabled on your account."
    )
    credential_fields = [
        CredentialField(
            key="crm_key",
            label="CRM Key",
            help="From Seller Panel → Lead Manager → CRM API",
            secret=True,
        )
    ]

    async def verify(self, credentials: dict[str, Any]) -> None:
        # A tiny recent window is the cheapest way to prove the key works.
        await self._call(credentials, datetime.now(timezone.utc) - timedelta(minutes=15))

    async def fetch(self, credentials: dict[str, Any], since: datetime | None) -> list[NormalizedLead]:
        start = since or (datetime.now(timezone.utc) - INITIAL_LOOKBACK)
        records = await self._call(credentials, start)
        return [self._normalize(r) for r in records if self._normalize(r) is not None]  # type: ignore[misc]

    async def _call(self, credentials: dict[str, Any], start: datetime) -> list[dict[str, Any]]:
        crm_key = (credentials or {}).get("crm_key")
        if not crm_key:
            raise IntegrationError("IndiaMART CRM key is missing — reconnect the integration.")

        now = datetime.now(timezone.utc)
        params = {
            "glusr_crm_key": crm_key,
            "start_time": start.strftime(TIME_FORMAT),
            "end_time": now.strftime(TIME_FORMAT),
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(API_URL, params=params)
        except httpx.HTTPError as exc:
            raise IntegrationError(f"Could not reach IndiaMART: {exc}") from exc

        if response.status_code != 200:
            raise IntegrationError(f"IndiaMART returned HTTP {response.status_code}")

        try:
            body = response.json()
        except ValueError as exc:
            raise IntegrationError("IndiaMART returned a non-JSON response") from exc

        code = str(body.get("CODE", "")).strip()
        if code == "429":
            raise IntegrationError("IndiaMART rate limit hit — it allows about one sync every 5 minutes.")
        if code not in ("200", ""):
            raise IntegrationError(body.get("MESSAGE") or f"IndiaMART error (code {code})")

        records = body.get("RESPONSE") or []
        if isinstance(records, dict):  # single record comes back unwrapped
            records = [records]
        return [r for r in records if isinstance(r, dict)]

    def _normalize(self, record: dict[str, Any]) -> NormalizedLead | None:
        phone = clean_phone(first_of(record, "SENDER_MOBILE", "SENDER_MOBILE_ALT", "MOB", "mobile"))
        if not phone:
            return None  # unusable without a number to call

        name = first_of(record, "SENDER_NAME", "NAME", "name") or "IndiaMART Enquiry"
        message_parts = [
            first_of(record, "SUBJECT", "QUERY_PRODUCT_NAME", "QUERY_MCAT_NAME"),
            first_of(record, "QUERY_MESSAGE", "MESSAGE"),
        ]
        message = " — ".join(str(p) for p in message_parts if p)

        return NormalizedLead(
            name=str(name).strip(),
            phone=phone,
            email=first_of(record, "SENDER_EMAIL", "SENDER_EMAIL_ALT", "EMAIL"),
            city=first_of(record, "SENDER_CITY", "CITY"),
            state=first_of(record, "SENDER_STATE", "STATE"),
            company=first_of(record, "SENDER_COMPANY", "COMPANY"),
            message=message or None,
            external_id=str(first_of(record, "UNIQUE_QUERY_ID", "QUERY_ID") or "") or None,
            received_at=_parse_time(first_of(record, "QUERY_TIME", "TIME")),
            raw=record,
        )


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%b-%Y %H:%M:%S", TIME_FORMAT, "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(value).strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
