"""JustDial lead integration — push model.

JustDial delivers leads by POSTing them to a URL you register with them, so
there is nothing to poll. Each organization gets its own webhook URL carrying an
unguessable token; an optional shared secret adds HMAC verification on top.

JustDial's field names vary between contracts and campaign types, so every field
is resolved from a list of candidate keys and the untouched payload is retained.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.integration import IntegrationProvider
from app.models.lead import LeadSource
from app.services.integrations.base import (
    CredentialField,
    NormalizedLead,
    ParsedWebhook,
    ProviderAdapter,
    clean_phone,
    first_of,
)


class JustDialAdapter(ProviderAdapter):
    provider = IntegrationProvider.justdial
    lead_source = LeadSource.justdial
    label = "JustDial"
    ingestion = "push"
    docs_url = "https://www.justdial.com/"
    setup_hint = (
        "Share the webhook URL below with your JustDial account manager and ask them to "
        "enable real-time lead push to it. If they give you a signing secret, paste it "
        "here so we can verify every request."
    )
    credential_fields = [
        CredentialField(
            key="signing_secret",
            label="Signing secret (optional)",
            help="If JustDial provides one, we verify the HMAC signature on every incoming lead.",
            secret=True,
            required=False,
        )
    ]

    def parse_webhook(self, payload: Any) -> ParsedWebhook:
        # Accept a single lead, a bare list, or a wrapper object containing a list.
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            nested = first_of(payload, "leads", "data", "records", "response")
            records = nested if isinstance(nested, list) else [payload]
        else:
            return ParsedWebhook()

        parsed = ParsedWebhook()
        for record in records:
            normalized = self._normalize(record) if isinstance(record, dict) else None
            if normalized:
                parsed.leads.append(normalized)
            else:
                parsed.skipped += 1
        return parsed

    def _normalize(self, record: dict[str, Any]) -> NormalizedLead | None:
        phone = clean_phone(
            first_of(record, "mobile", "phone", "mobile_number", "mobileno", "contact", "prefix_mobile")
        )
        if not phone:
            return None

        name = first_of(record, "name", "customer_name", "prefix_name", "username") or "JustDial Lead"
        message_parts = [
            first_of(record, "category", "cat", "branchcategory"),
            first_of(record, "requirement", "message", "query", "comments"),
        ]
        message = " — ".join(str(p) for p in message_parts if p)

        return NormalizedLead(
            name=str(name).strip(),
            phone=phone,
            email=first_of(record, "email", "email_id", "emailid"),
            city=first_of(record, "city", "area", "brancharea", "location"),
            state=first_of(record, "state", "branchstate"),
            company=first_of(record, "company", "company_name"),
            message=message or None,
            external_id=str(first_of(record, "leadid", "lead_id", "docid", "id") or "") or None,
            received_at=_parse_time(first_of(record, "date", "datetime", "lead_date", "created_at")),
            raw=record,
        )


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S"):
        try:
            return datetime.strptime(str(value).strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
