"""Provider-agnostic contract for external lead sources.

Adding a platform means writing one adapter and registering it — nothing in the
ingestion pipeline, API layer or UI needs to change.
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from app.models.integration import IntegrationProvider
from app.models.lead import LeadSource


@dataclass
class CredentialField:
    """Describes one credential input so the frontend can render the form generically."""

    key: str
    label: str
    help: str = ""
    secret: bool = True
    required: bool = True


@dataclass
class NormalizedLead:
    """A lead in our shape, regardless of which platform it came from."""

    name: str
    phone: str
    email: str | None = None
    city: str | None = None
    state: str | None = None
    company: str | None = None
    message: str | None = None
    external_id: str | None = None
    received_at: datetime | None = None
    raw: dict[str, Any] = field(default_factory=dict)

    def to_notes(self) -> str | None:
        """Human-readable provenance note stored on the lead."""
        bits = []
        if self.company:
            bits.append(f"Company: {self.company}")
        if self.email:
            bits.append(f"Email: {self.email}")
        if self.message:
            bits.append(self.message.strip())
        return "\n".join(bits) if bits else None


@dataclass
class ParsedWebhook:
    """Result of parsing an inbound push payload.

    `skipped` carries records we received but could not use (no phone number, or
    not an object) so the count reported back to the provider is truthful rather
    than silently swallowing them.
    """

    leads: list[NormalizedLead] = field(default_factory=list)
    skipped: int = 0


_DIGITS = re.compile(r"\D")


def clean_phone(value: Any) -> str | None:
    """Normalizes to a bare 10-digit Indian number where possible.

    Providers send +91-98200 11122, 09820011122, 919820011122 … all of which must
    dedupe against the same stored lead.
    """
    if value is None:
        return None
    digits = _DIGITS.sub("", str(value))
    if not digits:
        return None
    if len(digits) > 10:
        # strip country code / trunk prefix
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
        else:
            digits = digits[-10:]
    return digits or None


def first_of(payload: dict[str, Any], *keys: str) -> Any:
    """Returns the first non-empty value among candidate keys (case-insensitive).

    Provider field names drift between API versions and contracts, so every
    mapping accepts several spellings rather than breaking on a rename.
    """
    lowered = {str(k).lower(): v for k, v in payload.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value not in (None, "", "null"):
            return value
    return None


class ProviderAdapter(ABC):
    """One per external platform."""

    provider: IntegrationProvider
    lead_source: LeadSource
    label: str
    ingestion: Literal["pull", "push"]
    docs_url: str = ""
    setup_hint: str = ""
    credential_fields: list[CredentialField] = []

    async def verify(self, credentials: dict[str, Any]) -> None:
        """Raises IntegrationError if the credentials are unusable."""
        return None

    async def fetch(self, credentials: dict[str, Any], since: datetime | None) -> list[NormalizedLead]:
        """Pull providers only."""
        raise NotImplementedError(f"{self.label} does not support polling")

    def parse_webhook(self, payload: Any) -> ParsedWebhook:
        """Push providers only."""
        raise NotImplementedError(f"{self.label} does not support webhooks")


class IntegrationError(Exception):
    """Raised for provider-side failures — surfaced to the user as last_error."""
