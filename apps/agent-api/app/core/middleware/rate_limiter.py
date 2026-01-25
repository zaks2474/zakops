"""Rate limiting middleware for the Agent API.

Implements rate limiting using slowapi with configurable limits
per endpoint classification.
"""

from typing import Callable, Optional
import os

from fastapi import Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from app.core.logging import logger


def get_client_identifier(request: Request) -> str:
    """Get a unique identifier for rate limiting.

    Uses a combination of IP address and Authorization header (if present)
    to identify clients. This prevents authenticated users from being
    rate limited together.

    Args:
        request: FastAPI request object

    Returns:
        str: Client identifier for rate limiting
    """
    ip = get_remote_address(request)
    auth_header = request.headers.get("Authorization", "")

    # Use JWT subject if available (extract from bearer token)
    if auth_header.startswith("Bearer "):
        # Just use a hash of the token for identification
        # Don't decode here - that happens in auth middleware
        token_hash = hash(auth_header[7:]) % 10**8
        return f"{ip}:auth:{token_hash}"

    return ip


# Create the limiter instance
limiter = Limiter(
    key_func=get_client_identifier,
    default_limits=["100 per minute"],
    storage_uri=os.getenv("RATE_LIMIT_STORAGE", "memory://"),
    strategy="fixed-window",
)


# Rate limit decorator shortcuts for different endpoint types
def rate_limit_high_frequency() -> Callable:
    """Rate limit for high-frequency read endpoints (100/min)."""
    return limiter.limit("100 per minute")


def rate_limit_standard() -> Callable:
    """Rate limit for standard endpoints (60/min)."""
    return limiter.limit("60 per minute")


def rate_limit_write_operations() -> Callable:
    """Rate limit for write operations (30/min)."""
    return limiter.limit("30 per minute")


def rate_limit_sensitive() -> Callable:
    """Rate limit for sensitive operations (10/min)."""
    return limiter.limit("10 per minute")


def rate_limit_admin() -> Callable:
    """Rate limit for admin operations (20/min)."""
    return limiter.limit("20 per minute")


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Handle rate limit exceeded errors.

    Returns a JSON response with details about the rate limit.

    Args:
        request: FastAPI request object
        exc: Rate limit exceeded exception

    Returns:
        JSONResponse with 429 status
    """
    client_id = get_client_identifier(request)

    logger.warning(
        "rate_limit_exceeded",
        path=request.url.path,
        method=request.method,
        client_id=client_id,
        detail=str(exc.detail),
    )

    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": "Too many requests. Please slow down.",
            "retry_after": getattr(exc, "retry_after", 60),
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
            "X-RateLimit-Limit": str(getattr(exc, "limit", "unknown")),
        },
    )


def configure_rate_limiting(app) -> None:
    """Configure rate limiting for a FastAPI application.

    Should be called during app startup.

    Args:
        app: FastAPI application instance
    """
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.middleware import SlowAPIMiddleware

    # Set the limiter on the app state
    app.state.limiter = limiter

    # Add the middleware
    app.add_middleware(SlowAPIMiddleware)

    # Add the exception handler
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    logger.info(
        "rate_limiting_configured",
        storage=os.getenv("RATE_LIMIT_STORAGE", "memory://"),
    )


# Export for use in endpoints
__all__ = [
    "limiter",
    "rate_limit_high_frequency",
    "rate_limit_standard",
    "rate_limit_write_operations",
    "rate_limit_sensitive",
    "rate_limit_admin",
    "configure_rate_limiting",
    "rate_limit_exceeded_handler",
    "get_client_identifier",
]
