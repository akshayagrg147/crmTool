# DistriCall

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

Covers: round-robin distribution + concurrency race-safety, last-admin-removal guards, and cross-org data isolation.

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
    /api        auth, users, leads, calls, analytics, super_admin
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
    /pages/app          Dashboard, Leads, Team, Analytics
    /pages/super-admin   Organizations
    /components
    /api                axios client + endpoint wrappers
    /hooks              useAuth, useToast
```

## Notes

- No public sign-up: accounts are created by an org Admin (team members) or the Super Admin (new organizations).
- The last Admin of an organization can never be removed, demoted, or deactivated — enforced server-side.
- Lead distribution is round-robin across **active** telecallers only, with the rotation pointer persisted per-org and row-locked (`SELECT ... FOR UPDATE`) so concurrent lead creation can't double-assign.
- Real telephony, billing, and Firebase/BaaS integrations are intentionally out of scope for this phase.
