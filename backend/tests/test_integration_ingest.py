"""End-to-end tests for external lead-source ingestion.

Drives the real public webhook endpoint rather than calling the service directly,
so routing, provider parsing, dedupe and round-robin assignment are all covered.
"""
import secrets

import pytest
from sqlalchemy import select

from app.core.crypto import decrypt_json, encrypt_json
from app.core.security import hash_password
from app.models.integration import IntegrationProvider, IntegrationStatus, LeadIntegration
from app.models.lead import Lead, LeadSource
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


async def _add_telecaller(db, org_id, phone, name):
    tc = User(
        organization_id=org_id, name=name, phone=phone,
        password_hash=hash_password("Password@123"), role=UserRole.telecaller, is_active=True,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


async def _connect_justdial(db, org_id) -> str:
    token = secrets.token_urlsafe(16)
    db.add(
        LeadIntegration(
            organization_id=org_id,
            provider=IntegrationProvider.justdial,
            is_enabled=True,
            status=IntegrationStatus.active,
            credentials=encrypt_json({"signing_secret": "s3cret"}),
            webhook_secret=token,
        )
    )
    await db.commit()
    return token


@pytest.mark.asyncio
async def test_webhook_imports_and_round_robins(client, db_session):
    org, _ = await create_org_with_admin(db_session, admin_phone="9200000001")
    tc1 = await _add_telecaller(db_session, org.id, "9200000010", "TC One")
    tc2 = await _add_telecaller(db_session, org.id, "9200000011", "TC Two")
    token = await _connect_justdial(db_session, org.id)

    payload = [
        {"name": "Ravi Kumar", "mobile": "+91-98111 22233", "city": "Delhi", "category": "Ayurvedic"},
        {"name": "Sunil Shah", "mobile": "9811122244", "city": "Mumbai"},
        {"name": "Meena Rao", "mobile": "09811122255", "city": "Pune"},
        {"name": "Anil Gupta", "mobile": "919811122266", "city": "Jaipur"},
    ]

    resp = await client.post(f"/api/integrations/webhook/{token}", json=payload)
    assert resp.status_code == 202, resp.text
    assert resp.json()["accepted"] == 4

    result = await db_session.execute(select(Lead).where(Lead.organization_id == org.id))
    leads = result.scalars().all()
    assert len(leads) == 4

    # Every phone stored in normalized 10-digit form regardless of inbound format.
    assert {l.phone for l in leads} == {"9811122233", "9811122244", "9811122255", "9811122266"}
    assert all(l.source == LeadSource.justdial for l in leads)
    assert all(l.status.value == "new" for l in leads)

    # Distributed evenly through the shared round-robin engine.
    counts = {tc1.id: 0, tc2.id: 0}
    for lead in leads:
        counts[lead.assigned_to] += 1
    assert counts[tc1.id] == 2 and counts[tc2.id] == 2


@pytest.mark.asyncio
async def test_webhook_skips_duplicates_across_formats(client, db_session):
    """The same number in a different format must not create a second lead."""
    org, _ = await create_org_with_admin(db_session, admin_phone="9200000002")
    await _add_telecaller(db_session, org.id, "9200000020", "TC One")
    token = await _connect_justdial(db_session, org.id)

    first = await client.post(
        f"/api/integrations/webhook/{token}",
        json=[{"name": "Ravi Kumar", "mobile": "9811133344"}],
    )
    assert first.json()["accepted"] == 1

    # Same person, three different notations, plus one genuinely new number.
    second = await client.post(
        f"/api/integrations/webhook/{token}",
        json=[
            {"name": "Ravi Kumar", "mobile": "+91 98111 33344"},
            {"name": "Ravi Kumar", "mobile": "09811133344"},
            {"name": "New Person", "mobile": "9811155566"},
        ],
    )
    body = second.json()
    assert body["accepted"] == 1
    assert body["duplicates"] == 2

    result = await db_session.execute(select(Lead).where(Lead.organization_id == org.id))
    assert len(result.scalars().all()) == 2


@pytest.mark.asyncio
async def test_webhook_rejects_unknown_token(client):
    resp = await client.post("/api/integrations/webhook/not-a-real-token", json=[{"name": "X", "mobile": "9811100000"}])
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_webhook_ignores_records_without_phone(client, db_session):
    org, _ = await create_org_with_admin(db_session, admin_phone="9200000003")
    token = await _connect_justdial(db_session, org.id)

    resp = await client.post(
        f"/api/integrations/webhook/{token}",
        json=[{"name": "No Phone"}, {"name": "Good", "mobile": "9811177788"}],
    )
    body = resp.json()
    assert body["accepted"] == 1
    assert body["invalid"] == 1


@pytest.mark.asyncio
async def test_paused_integration_accepts_nothing(client, db_session):
    org, _ = await create_org_with_admin(db_session, admin_phone="9200000004")
    token = await _connect_justdial(db_session, org.id)

    result = await db_session.execute(
        select(LeadIntegration).where(LeadIntegration.webhook_secret == token)
    )
    row = result.scalar_one()
    row.is_enabled = False
    await db_session.commit()

    resp = await client.post(f"/api/integrations/webhook/{token}", json=[{"name": "X", "mobile": "9811199900"}])
    assert resp.json()["accepted"] == 0

    leads = await db_session.execute(select(Lead).where(Lead.organization_id == org.id))
    assert leads.scalars().all() == []


def test_credentials_round_trip_encrypted():
    """Credentials must not be readable as plaintext in the stored blob."""
    blob = encrypt_json({"crm_key": "super-secret-key"})
    assert "super-secret-key" not in blob
    assert decrypt_json(blob) == {"crm_key": "super-secret-key"}
    assert decrypt_json("garbage") == {}
