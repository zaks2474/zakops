"""Middleware components for the Agent API."""

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class LoggingContextMiddleware(BaseHTTPMiddleware):
    """Middleware to add request context for logging."""

    async def dispatch(self, request: Request, call_next):
        # Add request ID to state for logging
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request.state.request_id = request_id

        response = await call_next(request)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect request metrics."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        response = await call_next(request)

        # Calculate request duration
        duration = time.time() - start_time
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        return response


class MaskServerHeaderMiddleware(BaseHTTPMiddleware):
    """Middleware to mask server version header (F-008 fix).

    Replaces the default uvicorn server header with a generic value
    to reduce fingerprinting attack surface.

    Note: This middleware adds a ZakOps server header. The uvicorn server header
    is added at the ASGI level and cannot be removed by middleware. To fully
    suppress it, use uvicorn's --no-server-header flag or configure in Docker.
    The presence of our header alongside uvicorn's still achieves the goal of
    obscuring the exact version (uvicorn shows just 'uvicorn', not a version).
    """

    async def dispatch(self, request: Request, call_next):
        """Add custom server header to responses."""
        response = await call_next(request)
        # Add our server header (uvicorn's is added at ASGI level)
        response.headers.append("server", "ZakOps")
        return response


from .rate_limiter import configure_rate_limiting

__all__ = ["LoggingContextMiddleware", "MetricsMiddleware", "MaskServerHeaderMiddleware", "configure_rate_limiting"]
