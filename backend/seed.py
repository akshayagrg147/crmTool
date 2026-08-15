"""Seed script: one Super Admin, one demo pharma-distribution org with
Admin + Manager + 2 Telecallers, a small product catalog, and ~10
pharma-flavored leads (doctors, chemists, stockists, a hospital) with
call logs — including order values — spread across different hours/days.

Run with: python seed.py
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.call_log import CallLog
from app.models.distribution_settings import DistributionSettings
from app.models.lead import Lead, LeadCategory, LeadSource, LeadStatus
from app.models.organization import Organization
from app.models.product import Product
from app.models.user import User, UserRole

PRODUCTS = [
    ("Cardivas 10mg", "CRD-010"),
    ("Azithral 500", "AZT-500"),
    ("Pantocid DSR", "PAN-DSR"),
    ("Glycomet GP2", "GLY-GP2"),
    ("Montair LC", "MON-LC"),
]

# (name, phone, city, state, category, specialty, drug_license_number, credit_limit, outstanding_amount, dnd)
LEADS = [
    ("Dr. Rohan Mehta", "9820011122", "Mumbai", "Maharashtra", LeadCategory.pharmaceutical, "Cardiology", None, None, None, False),
    ("Priya Medical & General Stores", "9820011123", "Mumbai", "Maharashtra", LeadCategory.pharmaceutical, None, "MH-DL-20231", 150000, 42000, False),
    ("Amit Verma", "9820011124", "Delhi", "Delhi", LeadCategory.ayurvedic, None, "DL-DL-88213", 80000, 91000, False),
    ("Dr. Sneha Iyer", "9820011125", "Bengaluru", "Karnataka", LeadCategory.pharmaceutical, "Pediatrics", None, None, None, False),
    ("Karan Distributors (Stockist)", "9820011126", "Ahmedabad", "Gujarat", LeadCategory.generic, None, "GJ-DL-55021", 500000, 120000, False),
    ("Divya Nair", "9820011127", "Chennai", "Tamil Nadu", LeadCategory.homeopathic, None, "TN-DL-30044", 60000, 8000, False),
    ("St. Vikram Multispeciality Hospital", "9820011128", "Jaipur", "Rajasthan", LeadCategory.pharmaceutical, None, None, 300000, 0, False),
    ("Dr. Anita Desai", "9820011129", "Hyderabad", "Telangana", LeadCategory.nutraceutical, "Diabetology", None, None, None, True),
    ("Rahul Wholesale Chemists", "9820011130", "Surat", "Gujarat", LeadCategory.pharmaceutical, None, "GJ-DL-77190", 400000, 260000, False),
    ("Meera Joshi", "9820011131", "Kolkata", "West Bengal", LeadCategory.ayurvedic, None, "WB-DL-11002", 50000, 5000, False),
]

SOURCES = [LeadSource.indiamart, LeadSource.tradeindia, LeadSource.website, LeadSource.referral, LeadSource.manual]
STATUSES = [LeadStatus.new, LeadStatus.follow_up, LeadStatus.not_picked, LeadStatus.converted]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.phone == "9999900000"))
        if existing.scalar_one_or_none() is not None:
            print("Seed data already present, skipping.")
            return

        super_admin = User(
            organization_id=None,
            name="Suprix Platform Owner",
            phone="9999900000",
            email="owner@suprix.io",
            password_hash=hash_password("SuperAdmin@123"),
            role=UserRole.super_admin,
            is_active=True,
        )
        db.add(super_admin)

        org = Organization(name="Acme Distributors", is_active=True, plan="pro")
        db.add(org)
        await db.flush()

        # --- Product catalog ---
        products = [Product(organization_id=org.id, name=name, sku=sku) for name, sku in PRODUCTS]
        db.add_all(products)
        await db.flush()

        admin = User(
            organization_id=org.id, name="Aditi Admin", phone="9999900001",
            email="admin@acme.test", password_hash=hash_password("Admin@123"),
            role=UserRole.admin, is_active=True,
        )
        manager = User(
            organization_id=org.id, name="Manoj Manager", phone="9999900002",
            email="manager@acme.test", password_hash=hash_password("Manager@123"),
            role=UserRole.manager, is_active=True, state="Maharashtra", city="Mumbai",
        )
        tc1 = User(
            organization_id=org.id, name="Tara Telecaller", phone="9999900003",
            email="tara@acme.test", password_hash=hash_password("Telecaller@123"),
            role=UserRole.telecaller, is_active=True, state="Maharashtra", city="Mumbai",
        )
        tc2 = User(
            organization_id=org.id, name="Tanish Telecaller", phone="9999900004",
            email="tanish@acme.test", password_hash=hash_password("Telecaller@123"),
            role=UserRole.telecaller, is_active=True, state="Maharashtra", city="Pune",
        )
        db.add_all([admin, manager, tc1, tc2])
        db.add(DistributionSettings(organization_id=org.id, rotation_index=0))
        await db.flush()

        telecallers = [tc1, tc2]
        now = datetime.now(timezone.utc)
        leads = []
        for i, (name, phone, city, state, category, specialty, dl_number, credit_limit, outstanding, dnd) in enumerate(LEADS):
            assignee = telecallers[i % len(telecallers)]
            status = STATUSES[i % len(STATUSES)]
            created_at = now - timedelta(days=random.randint(0, 6), hours=random.randint(0, 23))
            lead = Lead(
                organization_id=org.id,
                name=name,
                phone=phone,
                city=city,
                state=state,
                source=SOURCES[i % len(SOURCES)],
                status=status,
                assigned_to=assignee.id,
                notes="Seed demo lead",
                created_at=created_at,
                category=category,
                specialty=specialty,
                drug_license_number=dl_number,
                product_id=random.choice(products).id,
                credit_limit=credit_limit,
                outstanding_amount=outstanding,
                dnd=dnd,
            )
            leads.append(lead)
        db.add_all(leads)
        await db.flush()

        call_logs = []
        for i, lead in enumerate(leads):
            num_calls = random.randint(0, 3) if lead.status != LeadStatus.new else 0
            for c in range(num_calls):
                call_time = lead.created_at + timedelta(hours=random.randint(1, 100))
                outcome = random.choice(list(LeadStatus))
                order_value = round(random.uniform(2000, 45000), 2) if outcome == LeadStatus.converted else None
                call_logs.append(
                    CallLog(
                        lead_id=lead.id,
                        logged_by=lead.assigned_to,
                        duration_minutes=round(random.uniform(0.5, 12), 2),
                        outcome=outcome,
                        notes="Seed demo call",
                        created_at=call_time,
                        order_value=order_value,
                        product_id=lead.product_id if order_value else None,
                    )
                )
                lead.last_contacted_at = call_time
        db.add_all(call_logs)

        await db.commit()
        print("Seed complete:")
        print("  Super Admin  -> phone: 9999900000  password: SuperAdmin@123")
        print("  Admin        -> phone: 9999900001  password: Admin@123")
        print("  Manager      -> phone: 9999900002  password: Manager@123")
        print("  Telecaller 1 -> phone: 9999900003  password: Telecaller@123")
        print("  Telecaller 2 -> phone: 9999900004  password: Telecaller@123")
        print(f"  {len(products)} products, {len(leads)} leads, {len(call_logs)} call logs created for org '{org.name}'.")


if __name__ == "__main__":
    asyncio.run(seed())
