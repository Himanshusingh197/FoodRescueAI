import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import connect_db, close_db
from app.routes import auth, organizations, donations, pickups, notifications, predictions, analytics, admin
from app.services.donation_service import expire_overdue_donations
from app.services.notification_service import send_urgent_donation_alerts

import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

background_task: asyncio.Task = None


async def periodic_tasks():
    """Background loop: expire donations and send urgent alerts every 15 minutes."""
    while True:
        try:
            await expire_overdue_donations()
            await send_urgent_donation_alerts()
        except Exception as e:
            logger.error(f"Background task error: {e}")
        await asyncio.sleep(900)  # 15 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    global background_task
    await connect_db()
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    # Start background periodic tasks
    background_task = asyncio.create_task(periodic_tasks())
    logger.info("Food Rescue AI backend started")
    yield
    if background_task:
        background_task.cancel()
    await close_db()
    logger.info("Food Rescue AI backend stopped")


app = FastAPI(
    title="Food Rescue AI",
    description="Smart Food Waste Reduction Platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(donations.router, prefix="/api/v1")
app.include_router(pickups.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "service": "Food Rescue AI", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "An internal server error occurred"},
    )
