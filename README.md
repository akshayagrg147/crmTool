# TalkoCRM

A lead-management & telecalling CRM for telecaller teams — Web App, Admin Panel (role-gated section of the Web App), and a separate Super Admin Panel for the platform owner.

## Stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (async, asyncpg), PostgreSQL (Docker), Alembic, Pydantic v2, JWT auth
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, React Query, Recharts

## Prerequisites

- Python 3.11+ (3.12 recommended)
- Node.js 20+
- Docker (for local Postgres)

## 1. Start Postgres

```bash
cd backend
docker compose up -d
```

This starts Postgres on **host port 5433** (mapped to avoid colliding with any Postgres already running on your machine at 5432).

## 2. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### Seeded accounts

| Role | Phone | Password |
|---|---|---|
| Super Admin | `9999900000` | `SuperAdmin@123` |
| Admin (Acme Distributors) | `9999900001` | `Admin@123` |
| Manager | `9999900002` | `Manager@123` |
| Telecaller 1 | `9999900003` | `Telecaller@123` |
| Telecaller 2 | `9999900004` | `Telecaller@123` |

### Run backend tests

```bash
cd backend
source venv/bin/activate
python -m pytest -q
```

Covers: round-robin distribution + concurrency race-safety, last-admin-removal guards, cross-org data isolation, and payroll/attendance role boundaries.

## 3. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The web app is now live at `http://localhost:5173`.

- Log in as a **Telecaller** to see the day-to-day Web App scoped to "My Leads".
- Log in as **Admin**/**Manager** to see the Admin Panel capabilities (Team, bulk import, analytics) inside the same app.
- Log in as **Super Admin** to land on `/super-admin` — the platform-owner panel for managing client organizations, viewing platform-wide stats, and impersonating an org's Admin for support.

## Project structure

```
/backend
  /app
    /api        auth, users, leads, calls, analytics, attendance, payroll, super_admin
    /models     SQLAlchemy models
    /schemas    Pydantic v2 schemas
    /services   distribution engine (round-robin, row-locked)
    /core       config, JWT/security, org-scoping dependency
    main.py
  /alembic
  /tests
  docker-compose.yml
  seed.py
/frontend
  /src
    /pages/app          Dashboard, Leads, Team, Analytics, Attendance, Payroll, WhatsApp tracking
    /pages/super-admin   Organizations
    /components
    /api                axios client + endpoint wrappers
    /hooks              useAuth, useToast
```

## Notes

- No public sign-up: accounts are created by an org Admin (team members) or the Super Admin (new organizations).
- Super Admins can upload an optional PNG/JPG/WebP organization logo. Logos are stored in a private S3 bucket and shown throughout that organization’s authenticated workspace through a signed proxy URL.
- The last Admin of an organization can never be removed, demoted, or deactivated — enforced server-side.
- Lead distribution is round-robin across **active** telecallers only, with the rotation pointer persisted per-org and row-locked (`SELECT ... FOR UPDATE`) so concurrent lead creation can't double-assign.
- Telecallers can reassign only their own leads, and only to an active Manager in the same organization. Admins and Managers retain their existing reassignment controls.
- Telecallers can mark a lead as Lost with a required reason and manager handoff; Admins and Managers can review the resulting Lost Deals table and filter it by reporting telecaller.
- Attendance and payroll are separated by role: Managers and telecallers can submit work-time and leave requests; Admins review and approve team requests, set each employee's hourly rate, and calculate approved-hours pay in the private Payroll workspace. Admin accounts are review-only for personal attendance and leave. Logged calls are captured automatically as approved calling time; extra categories such as events, training, and admin work can be logged separately.
- Payroll uses each organization's configurable work schedule (Monday-Friday by default, with optional Saturdays/Sundays), daily target hours, and date overrides for holidays or one-off working days. Estimated pay is calculated from approved hours only; pending and rejected submissions are excluded, while approved leave days and schedule targets are shown alongside each employee's monthly totals.
- Real telephony, billing, and Firebase/BaaS integrations are intentionally out of scope for this phase.
- WhatsApp tracking is admin-only. Admins can create multiple named instances per employee, click Connect to display a per-number WhatsApp Web QR code, and review the messages delivered by that instance. The private `whatsapp-bridge` service persists each session and posts `status` or `message` events to the instance webhook. This is an unofficial WhatsApp Web integration; use the official WhatsApp Cloud API when Meta-supported automation is required. The CRM does not store WhatsApp passwords or expose employee messages to managers/telecallers.

## Production deployment

For the single-instance AWS EC2 deployment, use [DEPLOY_AWS_EC2.md](./DEPLOY_AWS_EC2.md).
The production Compose stack exposes only the Nginx frontend on port 80; FastAPI
and PostgreSQL remain on a private Docker network.
