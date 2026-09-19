import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routes.auth_routes import router as auth_router
from app.routes.scheme_routes import scheme_router
from app.routes.application_routes import application_router
from app.routes.admin_routes import admin_router
from app.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization and uploads directory."""
    # Create all database tables if they do not already exist
    Base.metadata.create_all(bind=engine)

    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="PM-KISAN Scheme Application Portal and AI-Driven Anomaly Detection System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local uploads directory for static file access
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(scheme_router, prefix=settings.API_V1_STR)
app.include_router(application_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Health check endpoint to verify backend service readiness."""
    return HealthResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version="1.0.0",
    )


@app.get("/", tags=["Root"])
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "api_prefix": settings.API_V1_STR,
    }
