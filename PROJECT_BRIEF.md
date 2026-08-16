# DistriCall — Project Brief

> Handoff document. Everything another developer (or AI agent) needs to understand,
> run, and extend this codebase without reading every file first.

---

## 1. What this is

**DistriCall** is a multi-tenant lead-management / telecalling CRM built for a **pharma
distribution** business in India. Telecallers work a queue of assigned leads, call them,
log outcomes, and schedule callbacks. Managers and admins track pipeline and performance.

Repo: `https://github.com/akshayagrg147/crmTool`

**Three product surfaces, one app:**

| Surface | Who | What they see |
|---|---|---|
| Web app | admin, manager, telecaller | Dashboard, Leads, Follow-ups, Team, Analytics |
| Admin capabilities | admin / manager | Role-gated buttons inside the same pages (add/edit/delete leads, export, team mgmt) |
| Super Admin panel | super_admin | Separate `/super-admin` route — manage organizations, impersonate |

---

## 2. Tech stack

**Backend** — Python 3.12
- FastAPI 0.115 + Uvicorn
- SQLAlchemy 2.0 (async, `asyncpg` driver)
- PostgreSQL (Docker, host port **5433** — remapped to avoid clashing with a native 5432)
- Alembic migrations
- Pydantic v2 / pydantic-settings
- `python-jose` (JWT), `passlib[bcrypt]` (hashing), `slowapi` (rate limiting)
- `openpyxl` (xlsx bulk import)
- pytest + pytest-asyncio + httpx + aiosqlite (tests run on SQLite)

**Frontend** — Node / TypeScript
- React 18 + TypeScript + Vite 5
- Tailwind CSS 3 (custom design tokens)
- TanStack React Query v5 (server state)
- React Router v6
- Recharts (charts), lucide-react (icons), axios, date-fns

---

## 3. Running it locally

Prereqs: Docker, Python 3.12, Node 18+.

```bash
# 1. Database
cd backend
docker compose up -d                 # Postgres on localhost:5433

# 2. Backend
cp .env.example .env
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python -m alembic upgrade head
./venv/bin/python seed.py            # demo org + users + leads
./venv/bin/python -m uvicorn app.main:app --reload   # :8000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                          # :5173
```

**Seeded logins** (all created by `seed.py`):

| Role | Phone | Password |
|---|---|---|
| Super Admin | 9999900000 | `SuperAdmin@123` |
| Admin | 9999900001 | `Admin@123` |
| Manager | 9999900002 | `Manager@123` |
| Telecaller | 9999900003 | `Telecaller@123` |
| Telecaller | 9999900004 | `Telecaller@123` |

> `seed.py` self-guards: if the super admin already exists it exits without writing.

**Other commands**
```bash
./venv/bin/python -m pytest -q       # backend tests (10)
npx tsc -b                           # frontend typecheck
npx vite build                       # production build (validates Tailwind @apply too)
```

**Env vars**

`backend/.env`
```
DATABASE_URL=postgresql+asyncpg://districall:districall@localhost:5433/districall
JWT_SECRET=<long random string>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
IMPERSONATION_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=http://localhost:5173
```
`frontend/.env`
```
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 4. Project structure

```
telecrm/
├── README.md
├── PROJECT_BRIEF.md            ← this file
├── .gitignore
│
├── backend/
│   ├── docker-compose.yml      Postgres 16, host port 5433
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── alembic.ini
│   ├── seed.py                 demo org, users, products, 10 leads, call logs
│   ├── .env.example
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/           5 migrations, run in this order:
│   │       ├── 6692e294096a_initial_schema.py
│   │       ├── 1a2a93264344_pharma_vertical_fields_territories_.py
│   │       ├── c5b7c13f4034_replace_lead_entity_type_with_category.py
│   │       ├── 46fd2645ce7b_add_next_follow_up_at_to_leads_and_call_.py
│   │       └── c1a6455ed4d9_remove_territory_hierarchy_add_state_.py
│   │
│   └── app/
│       ├── main.py             FastAPI app, CORS, router registration
│       ├── core/
│       │   ├── config.py       pydantic-settings, reads .env
│       │   ├── database.py     async engine, session factory, Base
│       │   ├── security.py     JWT encode/decode, bcrypt hashing
│       │   ├── deps.py         CurrentUser + role dependencies  ← auth gate lives here
│       │   └── limiter.py      slowapi rate limiter
│       ├── models/             SQLAlchemy ORM (organization, user, lead, call_log,
│       │                       product, distribution_settings)
│       ├── schemas/            Pydantic request/response models (mirrors models/)
│       ├── api/                route handlers, one file per resource
│       └── services/
│           └── distribution.py round-robin lead assignment engine
│
└── frontend/
    ├── index.html              loads Manrope font
    ├── vite.config.ts          @ alias → src/
    ├── tailwind.config.js      design tokens (colors, radii, shadows, animations)
    ├── tsconfig.json
    │
    └── src/
        ├── main.tsx            providers: QueryClient → Router → Toast → Auth
        ├── App.tsx             routes + ProtectedRoute role gating
        ├── index.css           Tailwind layers + component classes (.card/.btn-*/.input/.badge)
        │
        ├── api/
        │   ├── client.ts       axios instance, token attach, 401 refresh interceptor
        │   ├── endpoints.ts    all API call functions, grouped per resource
        │   └── types.ts        TypeScript mirrors of backend schemas
        │
        ├── hooks/
        │   ├── useAuth.tsx     auth context: login/logout/impersonation
        │   ├── useToast.tsx    toast notifications
        │   ├── useCountUp.ts   animated number counter
        │   └── useAnimateIn.ts fires CSS enter-transitions once data lands
        │
        ├── lib/
        │   ├── format.ts       timeAgo, formatDate, formatCurrency, formatMinutes,
        │   │                   formatCallbackTime, initials, whatsappLink
        │   └── indianStates.ts 36 states + UTs
        │
        ├── components/
        │   ├── AppShell.tsx    top bar, desktop icon rail, mobile drawer + bottom nav
        │   ├── Modal.tsx       portal-based modal  ← see gotcha #3
        │   ├── KpiCard.tsx     animated KPI tile
        │   ├── StatusBadge.tsx StatusBadge / SourceBadge / CategoryBadge / DndBadge
        │   ├── DropdownMenu.tsx portal + viewport-flip positioning
        │   ├── ConfirmModal, EmptyState, Spinner, SettingsModal, NotificationsDropdown
        │   ├── leads/          AddLead, EditLead, LeadDetail, CallLog, BulkImport,
        │   │                   ProductManager modals
        │   ├── team/           AddMemberModal
        │   └── super-admin/    CreateOrgModal
        │
        └── pages/
            ├── Login.tsx
            ├── app/            Dashboard, Leads, FollowUps, Team, Analytics
            └── super-admin/    SuperAdminShell, Organizations
```

---

## 5. Data model

All org-scoped tables carry `organization_id`. Multi-tenancy is enforced in **every query**.

**Organization** — `id, name, is_active, plan, created_at`

**User** — `id, organization_id (null for super_admin), name, phone (unique), email,
password_hash, role, is_active, created_at, state, city`

**Lead** — `id, organization_id, name, phone, city (indexed), state, source, status (indexed),
assigned_to → users, notes, created_at, last_contacted_at, next_follow_up_at (indexed),
category, drug_license_number, specialty, product_id → products, credit_limit,
outstanding_amount, dnd`

**CallLog** — `id, lead_id → leads (cascade), logged_by → users, duration_minutes, outcome,
notes, created_at, order_value, product_id, next_follow_up_at`

**Product** — `id, organization_id, name, sku, created_at`

**DistributionSettings** — `organization_id, rotation_index` (persisted round-robin pointer)

### Enums
```
UserRole      super_admin | admin | manager | telecaller
LeadSource    manual | indiamart | tradeindia | website | referral
LeadStatus    new | follow_up | not_picked | converted | lost
LeadCategory  pharmaceutical | ayurvedic | homeopathic | nutraceutical | generic | other
```

> **Note:** an earlier `Territory` hierarchy (region→zone→area→beat) was **fully removed**
> and replaced by plain `state` + `city` string fields. Don't reintroduce it.
> Likewise `Lead.entity_type` (doctor/chemist/stockist…) was replaced by `Lead.category`.

---

## 6. API surface

Base path: `/api`. All routes except `/auth/login` and `/auth/refresh` require
`Authorization: Bearer <access_token>`.

**Auth** `/api/auth`
```
POST /login                 phone + password → {tokens, user, organization_name}
POST /refresh               refresh token → new token pair
GET  /me
POST /change-password
GET  /impersonation-status
```

**Leads** `/api/leads`
```
GET    /                    paginated + filters: source, status, assigned_to, category,
                            state, city, dnd, q, has_callback, overdue_only, page, page_size
GET    /export              CSV download (admin/manager only)
POST   /                    create (auto-assigns via round-robin)
GET    /check-duplicate     ?phone= → existing matches
GET    /categories          distinct categories actually in use
GET    /cities              distinct cities actually in use
GET    /{lead_id}
PATCH  /{lead_id}           telecallers may only change status/notes
DELETE /{lead_id}
POST   /{lead_id}/reassign
POST   /bulk-import         ?source= + CSV/XLSX upload, auto-distributes
DELETE /                    clear all leads in org (destructive)
```

**Calls** `/api/leads/{lead_id}/calls`
```
POST /                      log a call; sets lead.status, last_contacted_at, next_follow_up_at
GET  /                      call history for a lead
```

**Follow-ups** `/api/follow-ups`
```
GET /                       paginated log of every follow-up message across leads
                            filters: telecaller_id, outcome, q, date_from, date_to
```

**Team** `/api/users` — `GET /`, `POST /`, `PATCH /{id}`, `DELETE /{id}`

**Products** `/api/products` — `GET /`, `POST /`, `PATCH /{id}`, `DELETE /{id}`

**Organization** `/api/organization` — `GET /`, `PATCH /`

**Analytics** — `GET /api/dashboard`, `GET /api/analytics?range=today|7d|all&assignee_id=`

**Super Admin** `/api/super-admin`
```
GET  /organizations
POST /organizations
POST /organizations/{org_id}/suspend
POST /organizations/{org_id}/reactivate
GET  /stats
POST /impersonate           → token scoped to that org
```

---

## 7. Auth & permissions

JWT access (15 min) + refresh (7 days). Frontend stores them in `localStorage`
(`districall_access_token` / `districall_refresh_token`) and auto-refreshes on 401
via an axios interceptor.

Permission gates live in `backend/app/core/deps.py`:

| Dependency | Allows |
|---|---|
| `get_current_user` | any authenticated user |
| `require_org_user` | admin, manager, telecaller (blocks super_admin from org routes) |
| `require_admin_or_manager` | admin, manager |
| `require_admin` | admin only |
| `require_super_admin` | super_admin only |

**Telecaller restrictions** (enforced server-side, not just hidden in UI):
- only see leads where `assigned_to == self`
- may only PATCH `status` and `notes`
- **cannot** export CSV, add/edit/delete leads, or manage team
- analytics/follow-ups scoped to their own activity

**Guard rails:** cannot demote/deactivate/delete the last admin of an org; cannot delete
the last member. Deleting a user reassigns their leads to Unassigned rather than cascading.

---

## 8. Key business logic

**Round-robin distribution** (`app/services/distribution.py`)
Each org has a persisted `rotation_index`. On assignment the row is locked with
`SELECT … FOR UPDATE` (race-safe), the next active telecaller is picked, and the pointer
advances. **The pointer is shared between single-add and bulk-import**, so if you upload 5
leads to 10 telecallers, the next upload continues from telecaller 6. This is verified
behaviour — don't "fix" it into per-batch resetting.

**Callback scheduling**
Logging a call with outcome `follow_up` can set `next_follow_up_at` (quick options: 10 min /
20 min / 1 hour / tomorrow 10 AM, or an exact datetime — past datetimes are blocked).
Stored on **both** the CallLog (historical record) and the Lead (current state). Any other
outcome clears it. A callback whose time has passed renders as **"Pending — overdue"** in red
across Leads, Lead Detail, Dashboard and the Follow-ups page.

**Follow-up queue**
`GET /leads?has_callback=true` sorts by `next_follow_up_at` ascending (most urgent first);
`overdue_only=true` narrows to past-due. This is the "which call do I make next" view.

**Duplicate detection** — phone lookup on the Add Lead form warns (but does not block);
bulk import silently skips phones already in the org.

---

## 9. Frontend architecture

**Routing** (`App.tsx`) — `ProtectedRoute` checks token + role, redirects by role:
super_admin → `/super-admin`, telecaller → `/leads`, others → `/dashboard`.

**Server state** — React Query. Query keys in use: `["dashboard"]`, `["analytics", range,
memberFilter]`, `["leads", filters]`, `["team"]`, `["products"]`, `["lead-categories"]`,
`["lead-cities"]`, `["call-history", leadId]`, `["follow-ups", filters]`.
Mutations invalidate the relevant keys — **if you add a field that feeds a filter dropdown,
remember to invalidate `lead-categories` / `lead-cities` too.**
List queries use `placeholderData: keepPreviousData` for flicker-free filtering.

**Design system** — tokens in `tailwind.config.js`, component classes in `index.css`.
Deliberately restrained B2B look: single sans typeface (Manrope), blue `#2563EB` primary,
cool slate neutrals, 10px card radius, **hairline borders + 1px shadow** (depth comes from
the border, not a large diffuse shadow), 8px buttons.
Reusable classes: `.card`, `.card-interactive`, `.btn-primary/.btn-secondary/.btn-ghost`,
`.input`, `.badge`, `.panel-header`, `.skeleton`, `.scroll-shadow-x`.

> Changing a token in `tailwind.config.js` restyles the whole app — that's the intended
> leverage point. Avoid hardcoding hex values in components (chart colors are the
> unavoidable exception since Recharts needs literals).

---

## 10. Gotchas — real bugs hit in this codebase

These cost real debugging time. Read before changing the related area.

1. **Alembic + Postgres enums.** `sa.Enum(...)` inside `op.add_column()` does **not** create
   the Postgres type (it only auto-creates via `op.create_table`). You must explicitly call
   `postgresql.ENUM(...).create(op.get_bind(), checkfirst=True)` first and pass
   `create_type=False` on the column. Also: adding a NOT NULL column to a populated table
   needs `server_default`.

2. **Dropping a table with inbound FKs.** Autogenerate emits `drop_table` before dropping the
   dependent foreign keys, which fails. Reorder so FK constraints drop first.

3. **`position: fixed` is not viewport-relative under a transformed ancestor.** Every page is
   wrapped in `animate-fade-in-up`, whose `both` fill-mode leaves a permanent `transform` on
   the wrapper. That made it the containing block for fixed-position modals, pushing them
   off-screen on long pages. **`Modal.tsx` renders through a React portal into `document.body`**
   to escape this. Don't "simplify" that away. Same reason `DropdownMenu.tsx` is portal-based.

4. **Recharts + React 18 StrictMode.** Chart animations were originally disabled
   (`isAnimationActive={false}`) to dodge a blank-chart bug. They are now re-enabled with
   explicit `animationDuration` and verified rendering. If charts ever render blank, this is
   the first suspect.

5. **`requestAnimationFrame`'s timestamp is not guaranteed to share `performance.now()`'s time
   origin.** `useCountUp` originally mixed them; in an embedded webview they were 3.4s apart,
   so the first frame computed as "already finished" and the number snapped instead of
   counting. The hook now seeds its clock from the first rAF callback. Never mix the two.

6. **Refs as effect guards break under StrictMode.** A `prevValueRef` guard in `useCountUp`
   survived the mount→unmount→remount cycle, so the second mount bailed early and the counter
   froze at 0. The dependency array is the correct guard.

7. **Front-loaded easing looks like no animation.** `ease-smooth`
   (`cubic-bezier(0.16,1,0.3,1)`) reaches ~88% in the first 270ms. Bars use plain `ease-out`.

8. **The dev database contains real user-entered data.** Never run `docker compose down -v`.
   Schema changes must use additive, data-preserving migrations.

---

## 11. Current state

- Backend: **10/10 tests pass** (`pytest -q`) — covers org isolation, round-robin
  distribution, last-admin guard.
- Frontend: `tsc -b` clean, production `vite build` succeeds.
- Test coverage is thin — only the three areas above. No frontend tests at all.
- `frontend` bundle is ~825 KB (single chunk); code-splitting not done.
- Everything runs locally only; no deployment/CI configured.

### Sensible next steps
- Frontend tests (Vitest + Testing Library), more backend endpoint tests
- Code-split the frontend bundle
- CI (GitHub Actions: pytest + tsc + build)
- Deployment config; move JWT secret to a real secret store
- Rotate the demo passwords in `seed.py` before any real use
- Server-side pagination on the Follow-ups page as call volume grows
