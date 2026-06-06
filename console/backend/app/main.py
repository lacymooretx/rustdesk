from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import AsyncSessionLocal, async_engine
from app.models import Base  # noqa: F401 — imports all models so create_all picks them up
from app.middleware.audit import AuditMiddleware
from app.routes import access_rules, address_books, api_tokens, audit, auth, connections, device_groups, devices, heartbeat, notifications, strategies, update, user_groups, users
from app.services.auth import create_initial_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed admin. Shutdown: dispose engine."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await create_initial_admin(session)

    yield

    await async_engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# -- CORS --
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Audit middleware --
app.add_middleware(AuditMiddleware)

# -- Routers --
app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(users.router)
app.include_router(device_groups.router)
app.include_router(user_groups.router)
app.include_router(access_rules.router)
app.include_router(heartbeat.router)
app.include_router(audit.router)
app.include_router(connections.router)
app.include_router(strategies.router)
app.include_router(address_books.router)
app.include_router(api_tokens.router)
app.include_router(notifications.router)
app.include_router(update.router)


# -- Health check --
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
