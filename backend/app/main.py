from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import analytics, auth, call_logs, leads, organization, products, super_admin, users
from app.core.config import settings
from app.core.limiter import limiter

app = FastAPI(title="DistriCall API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(call_logs.router, prefix="/api")
app.include_router(call_logs.followups_router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(super_admin.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(organization.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
