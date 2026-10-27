"""
Test configuration.

Key design:
- Build a test_app with a no-op lifespan so the production lifespan
  (which spins up its own Motor client + background tasks) never runs.
- Each test fixture calls connect_db() / close_db() itself, so Motor is
  always created inside the same event loop that the test runs in.
- function-scope loops (pytest-asyncio default) prevent cross-loop errors.
"""
import pytest
import os
from contextlib import asynccontextmanager

# Must be set before any app import
os.environ["DATABASE_NAME"] = "food_rescue_ai_test"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from httpx import AsyncClient, ASGITransport

from app.config import settings
settings.DATABASE_NAME = "food_rescue_ai_test"

# Import routes directly
from app.routes import auth, organizations, donations, pickups, notifications, predictions, analytics, admin as admin_router
from app.database import connect_db, close_db, get_db


# ── Build a minimal test app with no-op lifespan ─────────────────────────────

@asynccontextmanager
async def _noop_lifespan(app):
    """Skip production startup (Motor init, background tasks)."""
    yield


def _build_test_app() -> FastAPI:
    test_app = FastAPI(title="Food Rescue AI Test", lifespan=_noop_lifespan)
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    prefix = "/api/v1"
    test_app.include_router(auth.router, prefix=prefix)
    test_app.include_router(organizations.router, prefix=prefix)
    test_app.include_router(donations.router, prefix=prefix)
    test_app.include_router(pickups.router, prefix=prefix)
    test_app.include_router(notifications.router, prefix=prefix)
    test_app.include_router(predictions.router, prefix=prefix)
    test_app.include_router(analytics.router, prefix=prefix)
    test_app.include_router(admin_router.router, prefix=prefix)

    @test_app.get("/api/v1/health")
    async def health():
        return {"status": "healthy"}

    return test_app


TEST_APP = _build_test_app()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
async def client():
    """
    Per-test client.  Motor is connected inside this fixture's own event loop,
    so there is no cross-loop Future error.  The test DB is dropped on teardown.
    """
    await connect_db()
    async with AsyncClient(
        transport=ASGITransport(app=TEST_APP),
        base_url="http://test",
    ) as c:
        yield c
    db = get_db()
    await db.client.drop_database(settings.DATABASE_NAME)
    await close_db()


async def _get_token(client, email: str, role: str) -> str:
    reg = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "testpass123",
        "full_name": f"Test {role.title()}",
        "role": role,
    })
    assert reg.status_code in (201, 409), f"Register failed ({reg.status_code}): {reg.text}"
    login = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "testpass123",
    })
    assert login.status_code == 200, f"Login failed ({login.status_code}): {login.text}"
    return login.json()["access_token"]


@pytest.fixture
async def donor_token(client):
    return await _get_token(client, "donor@test.com", "donor")


@pytest.fixture
async def recipient_token(client):
    return await _get_token(client, "recipient@test.com", "recipient")


@pytest.fixture
async def admin_token(client):
    return await _get_token(client, "admin@test.com", "admin")
