"""This file contains the main application entry point."""

import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import (
    Any,
    Dict,
)

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    Request,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.api import api_router
from app.api.v1.agent import router as agent_router
from app.core.config import Environment, settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.core.metrics import setup_metrics
from app.core.middleware import (
    LoggingContextMiddleware,
    MaskServerHeaderMiddleware,
    MetricsMiddleware,
)
from app.services.database import database_service

# Load environment variables
load_dotenv()

# Initialize Langfuse conditionally (F-001 fix: zero-code-change activation)
# R3 REMEDIATION [P2.2]: Added startup health check
from app.core.tracing import (
    get_langfuse,
    shutdown as shutdown_tracing,
    check_health as check_tracing_health,
    get_health_status as get_tracing_status,
)
langfuse = get_langfuse()  # Returns None if not configured


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events."""
    logger.info(
        "application_startup",
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        api_prefix=settings.API_V1_STR,
    )

    # R3 REMEDIATION [P2.2]: Check Langfuse connectivity on startup
    tracing_health = check_tracing_health()
    if tracing_health.configured and not tracing_health.connected:
        logger.warning(
            "langfuse_startup_warning",
            error=tracing_health.error,
            message="Langfuse is configured but connection failed. Traces will not be recorded.",
        )
    elif tracing_health.connected:
        logger.info(
            "langfuse_startup_success",
            latency_ms=tracing_health.latency_ms,
        )

    yield
    # Flush Langfuse traces on shutdown (no-op if not configured)
    shutdown_tracing()
    logger.info("application_shutdown")


# Disable docs/openapi in non-development environments (UF-005)
_enable_docs = settings.ENVIRONMENT == Environment.DEVELOPMENT or os.getenv("ENABLE_API_DOCS", "false").lower() == "true"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if _enable_docs else None,
    docs_url="/docs" if _enable_docs else None,
    redoc_url="/redoc" if _enable_docs else None,
    lifespan=lifespan,
)

# Set up Prometheus metrics
setup_metrics(app)

# Add server header masking middleware (F-008 fix - reduce fingerprinting surface)
app.add_middleware(MaskServerHeaderMiddleware)

# Add logging context middleware (must be added before other middleware to capture context)
app.add_middleware(LoggingContextMiddleware)

# Add custom metrics middleware
app.add_middleware(MetricsMiddleware)

# Set up rate limiter exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Add validation exception handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors from request data.

    Args:
        request: The request that caused the validation error
        exc: The validation error

    Returns:
        JSONResponse: A formatted error response
    """
    # Log the validation error
    logger.error(
        "validation_error",
        client_host=request.client.host if request.client else "unknown",
        path=request.url.path,
        errors=str(exc.errors()),
    )

    # Format the errors to be more user-friendly
    formatted_errors = []
    for error in exc.errors():
        loc = " -> ".join([str(loc_part) for loc_part in error["loc"] if loc_part != "body"])
        formatted_errors.append({"field": loc, "message": error["msg"]})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": formatted_errors},
    )


# Set up CORS middleware (UF-010: explicit origins instead of wildcard)
_cors_origins = settings.ALLOWED_ORIGINS
if _cors_origins == ["*"]:
    # Replace wildcard with known origins for credential-bearing requests
    _cors_origins = [
        "http://localhost:3003",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)
# ZakOps canonical endpoints are rooted at `/agent/*` per Master Plan v2.
app.include_router(agent_router, prefix="/agent", tags=["agent"])


@app.get("/")
@limiter.limit(settings.RATE_LIMIT_ENDPOINTS["root"][0])
async def root(request: Request):
    """Root endpoint returning basic API information."""
    logger.info("root_endpoint_called")
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "healthy",
        "environment": settings.ENVIRONMENT.value,
        "swagger_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get("/health")
@limiter.limit(settings.RATE_LIMIT_ENDPOINTS["health"][0])
async def health_check(request: Request) -> Dict[str, Any]:
    """Health check endpoint with environment-specific information.

    R3 REMEDIATION [P2.2]: Added tracing health status.

    Returns:
        Dict[str, Any]: Health status information
    """
    logger.info("health_check_called")

    # Check database connectivity
    db_healthy = await database_service.health_check()

    # R3 REMEDIATION [P2.2]: Get tracing health status
    tracing_status = get_tracing_status()
    tracing_healthy = (
        tracing_status is None or  # Not configured = healthy (optional component)
        not tracing_status.get("configured") or  # Not configured
        tracing_status.get("connected")  # Configured and connected
    )

    # Determine tracing component status
    if tracing_status is None or not tracing_status.get("configured"):
        tracing_component = "disabled"
    elif tracing_status.get("connected"):
        tracing_component = "healthy"
    else:
        tracing_component = "degraded"

    response = {
        "status": "healthy" if db_healthy else "degraded",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT.value,
        "components": {
            "api": "healthy",
            "database": "healthy" if db_healthy else "unhealthy",
            "tracing": tracing_component,
        },
        "timestamp": datetime.now().isoformat(),
    }

    # If DB is unhealthy, set the appropriate status code
    status_code = status.HTTP_200_OK if db_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(content=response, status_code=status_code)
