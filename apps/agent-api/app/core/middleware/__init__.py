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


from .rate_limiter import configure_rate_limiting

__all__ = ["LoggingContextMiddleware", "MetricsMiddleware", "configure_rate_limiting"]
