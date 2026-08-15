import asyncio
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

TEST_DATABASE_URL = "postgresql+asyncpg://districall:districall@localhost:5433/districall_test"

import app.core.database as database_module

# NullPool: every checkout opens a fresh asyncpg connection and closes it on
# checkin, so no connection ever outlives the event loop it was created on.
# pytest-asyncio (mode=auto) spins up a new loop per test function, and a
# pooled connection reused across loops raises "attached to a different loop".
test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

database_module.engine = test_engine
database_module.AsyncSessionLocal = TestSessionLocal

from app.core.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.distribution_settings import DistributionSettings  # noqa: E402


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


async def create_org_with_admin(db, org_name="TestOrg", admin_phone="9000000001"):
    org = Organization(name=org_name, is_active=True, plan="trial")
    db.add(org)
    await db.flush()
    admin = User(
        organization_id=org.id, name="Admin", phone=admin_phone,
        password_hash=hash_password("Password@123"), role=UserRole.admin, is_active=True,
    )
    db.add(admin)
    db.add(DistributionSettings(organization_id=org.id, rotation_index=0))
    await db.commit()
    await db.refresh(org)
    await db.refresh(admin)
    return org, admin
