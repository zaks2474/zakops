"""Shared API routers."""

from .auth import router as auth_router
from .events import router as events_router
from .health import router as health_router
from .hitl import router as hitl_router

__all__ = ["events_router", "hitl_router", "health_router", "auth_router"]
