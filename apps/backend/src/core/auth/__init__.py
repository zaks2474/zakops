"""
Authentication Module

Phase 7: Authentication & Security

Provides session-based authentication for ZakOps.

Usage:
    from src.core.auth import create_session, validate_session, get_current_operator

Configuration:
    AUTH_REQUIRED=true/false - Enable/disable auth requirement (default: false)
    SESSION_EXPIRY_HOURS=24 - Session expiry in hours
    ALLOW_REGISTRATION=true/false - Allow new user registration
"""

from .operator import (
    Operator,
    authenticate_operator,
    create_operator,
    get_operator_by_id,
    hash_password,
    list_operators,
    update_operator_password,
    verify_password,
)
from .permissions import (
    ROLE_PERMISSIONS,
    Permission,
    check_permission,
    get_permissions_for_role,
    has_permission,
    require_permission,
)
from .session import (
    SESSION_COOKIE_NAME,
    SessionData,
    cleanup_expired_sessions,
    create_session,
    get_active_sessions,
    invalidate_all_sessions,
    invalidate_session,
    validate_session,
)

__all__ = [
    # Session
    "create_session",
    "validate_session",
    "invalidate_session",
    "get_active_sessions",
    "invalidate_all_sessions",
    "cleanup_expired_sessions",
    "SessionData",
    "SESSION_COOKIE_NAME",
    # Operator
    "Operator",
    "authenticate_operator",
    "get_operator_by_id",
    "create_operator",
    "update_operator_password",
    "list_operators",
    "hash_password",
    "verify_password",
    # Permissions
    "Permission",
    "has_permission",
    "require_permission",
    "get_permissions_for_role",
    "check_permission",
    "ROLE_PERMISSIONS",
]
