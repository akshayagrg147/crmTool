from datetime import datetime

from pydantic import BaseModel

from app.models.integration import IntegrationProvider, IntegrationStatus


class CredentialFieldOut(BaseModel):
    key: str
    label: str
    help: str = ""
    secret: bool = True
    required: bool = True


class IntegrationOut(BaseModel):
    provider: IntegrationProvider
    label: str
    ingestion: str
    docs_url: str = ""
    setup_hint: str = ""
    credential_fields: list[CredentialFieldOut] = []

    is_connected: bool = False
    is_enabled: bool = False
    status: IntegrationStatus = IntegrationStatus.disconnected
    masked_credentials: dict[str, str] = {}
    last_synced_at: datetime | None = None
    last_error: str | None = None
    total_imported: int = 0
    total_duplicates: int = 0
    # Only populated for push providers once connected.
    webhook_url: str | None = None


class IntegrationConnectIn(BaseModel):
    credentials: dict[str, str] = {}
    is_enabled: bool = True


class SyncResultOut(BaseModel):
    imported: int
    duplicates: int
    invalid: int
    assignments: dict[str, int] = {}
    message: str
