"""Create the first production super admin without demo credentials.

The command is intentionally idempotent: once any super admin exists, it exits
without changing the database. Supply the phone and name through environment
variables. Supply the password through stdin so it does not appear in shell
history or process arguments.
"""

import asyncio
import os
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


async def bootstrap() -> None:
    phone = required_env("BOOTSTRAP_SUPER_ADMIN_PHONE")
    name = os.environ.get("BOOTSTRAP_SUPER_ADMIN_NAME", "Platform Owner").strip()
    email = os.environ.get("BOOTSTRAP_SUPER_ADMIN_EMAIL", "").strip() or None
    password = sys.stdin.readline().rstrip("\r\n")

    if len(phone) < 8 or len(phone) > 20:
        raise SystemExit("BOOTSTRAP_SUPER_ADMIN_PHONE must contain 8 to 20 characters")
    if len(password) < 16:
        raise SystemExit("The bootstrap password must contain at least 16 characters")

    async with AsyncSessionLocal() as db:
        existing_admin = await db.execute(select(User).where(User.role == UserRole.super_admin))
        if existing_admin.scalars().first() is not None:
            print("A super admin already exists; no changes were made.")
            return

        existing_phone = await db.execute(select(User).where(User.phone == phone))
        if existing_phone.scalar_one_or_none() is not None:
            raise SystemExit("A user with that phone already exists")

        db.add(
            User(
                organization_id=None,
                name=name,
                phone=phone,
                email=email,
                password_hash=hash_password(password),
                role=UserRole.super_admin,
                is_active=True,
            )
        )
        await db.commit()
        print(f"Super admin created for phone {phone}.")


if __name__ == "__main__":
    asyncio.run(bootstrap())
