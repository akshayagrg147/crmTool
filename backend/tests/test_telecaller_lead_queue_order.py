from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token, hash_password
from app.models.lead import Lead, LeadCategory, LeadStatus
from app.models.user import User, UserRole
from tests.conftest import create_org_with_admin


def _token(user):
    return create_access_token(str(user.id), user.role.value, str(user.organization_id))


@pytest.mark.asyncio
async def test_telecaller_queue_prioritizes_overdue_then_call_pending(client, db_session):
    org, _admin = await create_org_with_admin(db_session, "Queue Order QA", "9400000001")
    telecaller = User(
        organization_id=org.id,
        name="Queue Telecaller",
        phone="9400000002",
        password_hash=hash_password("Password@123"),
        role=UserRole.telecaller,
        is_active=True,
    )
    db_session.add(telecaller)
    await db_session.flush()

    now = datetime.now(timezone.utc)
    db_session.add_all(
        [
            Lead(
                organization_id=org.id,
                assigned_to=telecaller.id,
                name="Recently Created Pending",
                phone="9400000003",
                status=LeadStatus.new,
                category=LeadCategory.other,
                created_at=now,
            ),
            Lead(
                organization_id=org.id,
                assigned_to=telecaller.id,
                name="Older Pending",
                phone="9400000004",
                status=LeadStatus.new,
                category=LeadCategory.other,
                created_at=now - timedelta(days=1),
            ),
            Lead(
                organization_id=org.id,
                assigned_to=telecaller.id,
                name="Overdue Callback",
                phone="9400000005",
                status=LeadStatus.follow_up,
                category=LeadCategory.other,
                last_contacted_at=now - timedelta(days=2),
                next_follow_up_at=now - timedelta(hours=1),
                created_at=now - timedelta(days=3),
            ),
            Lead(
                organization_id=org.id,
                assigned_to=telecaller.id,
                name="Already Contacted",
                phone="9400000006",
                status=LeadStatus.not_picked,
                category=LeadCategory.other,
                last_contacted_at=now - timedelta(hours=2),
                created_at=now - timedelta(days=4),
            ),
        ]
    )
    await db_session.commit()

    response = await client.get(
        "/api/leads",
        headers={"Authorization": f"Bearer {_token(telecaller)}"},
        params={"page_size": 20},
    )

    assert response.status_code == 200, response.text
    assert [item["name"] for item in response.json()["items"]] == [
        "Overdue Callback",
        "Older Pending",
        "Recently Created Pending",
        "Already Contacted",
    ]
