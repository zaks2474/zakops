"""Agent API JWT authentication with iss/aud/role enforcement.

This module provides strict JWT validation for agent endpoints including:
- Issuer (iss) claim validation
- Audience (aud) claim validation
- Role claim validation for approve/reject actions
- Token expiration validation

This is separate from the chatbot auth to allow stricter controls on agent operations.
"""

import os
from datetime import datetime, timedelta, UTC
from typing import Optional, List

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt, ExpiredSignatureError

from app.core.config import settings
from app.core.logging import logger


# Agent JWT Settings - configured per Decision Lock §7
# Issuer: zakops-auth
# Audience: zakops-agent
# Roles: VIEWER, OPERATOR, APPROVER, ADMIN
AGENT_JWT_ISSUER = os.getenv("AGENT_JWT_ISSUER", "zakops-auth")
AGENT_JWT_AUDIENCE = os.getenv("AGENT_JWT_AUDIENCE", "zakops-agent")
AGENT_JWT_REQUIRED_ROLE = os.getenv("AGENT_JWT_REQUIRED_ROLE", "APPROVER")
AGENT_JWT_ENFORCE = os.getenv("AGENT_JWT_ENFORCE", "true").lower() == "true"

# Role hierarchy per Decision Lock
ROLE_HIERARCHY = {
    "VIEWER": 1,
    "OPERATOR": 2,
    "APPROVER": 3,
    "ADMIN": 4,
}

security = HTTPBearer(auto_error=False)


class AgentAuthError(Exception):
    """Base exception for agent authentication errors."""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class TokenExpiredError(AgentAuthError):
    """Token has expired."""
    pass


class InvalidIssuerError(AgentAuthError):
    """Token issuer is invalid."""
    pass


class InvalidAudienceError(AgentAuthError):
    """Token audience is invalid."""
    pass


class MissingRoleError(AgentAuthError):
    """Token is missing role claim (invalid token per Decision Lock)."""

    def __init__(self, message: str):
        # Missing required claim = 401 (invalid token)
        super().__init__(message, status_code=401)


class InsufficientRoleError(AgentAuthError):
    """Token has role but insufficient permissions."""

    def __init__(self, message: str):
        # Has role but not sufficient = 403 (forbidden)
        super().__init__(message, status_code=403)


class AgentUser:
    """Represents an authenticated agent user."""

    def __init__(
        self,
        subject: str,
        issuer: str,
        audience: str,
        role: str,
        expires_at: datetime,
    ):
        self.subject = subject
        self.issuer = issuer
        self.audience = audience
        self.role = role
        self.expires_at = expires_at

    def has_role(self, required_role: str) -> bool:
        """Check if user has at least the required role level.

        Uses role hierarchy: VIEWER < OPERATOR < APPROVER < ADMIN
        """
        user_level = ROLE_HIERARCHY.get(self.role, 0)
        required_level = ROLE_HIERARCHY.get(required_role, 0)
        return user_level >= required_level


def create_agent_token(
    subject: str,
    role: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    issuer: Optional[str] = None,
    audience: Optional[str] = None,
) -> str:
    """Create a JWT token for agent API access.

    Per Decision Lock §7: Required claims are sub, role, exp, iss, aud.
    Role must be one of: VIEWER, OPERATOR, APPROVER, ADMIN.

    Args:
        subject: The subject (typically actor_id)
        role: User role (VIEWER, OPERATOR, APPROVER, ADMIN)
        expires_delta: Token expiration time
        issuer: Override default issuer
        audience: Override default audience

    Returns:
        str: Encoded JWT token
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=1)

    expire = datetime.now(UTC) + expires_delta

    payload = {
        "sub": subject,
        "iss": issuer or AGENT_JWT_ISSUER,
        "aud": audience or AGENT_JWT_AUDIENCE,
        "role": role or AGENT_JWT_REQUIRED_ROLE,
        "exp": expire,
        "iat": datetime.now(UTC),
    }

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    logger.info(
        "agent_token_created",
        subject=subject,
        issuer=payload["iss"],
        audience=payload["aud"],
        role=payload["role"],
        expires_at=expire.isoformat(),
    )

    return token


def verify_agent_token(token: str, require_role: Optional[str] = None) -> AgentUser:
    """Verify an agent JWT token with strict validation.

    Per Decision Lock §7: Required claims are sub, role, exp, iss, aud.

    Args:
        token: The JWT token to verify
        require_role: Specific role required (defaults to AGENT_JWT_REQUIRED_ROLE)

    Returns:
        AgentUser: The authenticated user

    Raises:
        TokenExpiredError: If token is expired
        InvalidIssuerError: If issuer doesn't match
        InvalidAudienceError: If audience doesn't match
        MissingRoleError: If role claim is missing (401)
        InsufficientRoleError: If role is present but insufficient (403)
        AgentAuthError: For other authentication failures
    """
    if not token:
        raise AgentAuthError("Missing token")

    try:
        # Decode with full verification
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=AGENT_JWT_AUDIENCE,
            issuer=AGENT_JWT_ISSUER,
        )

        subject = payload.get("sub")
        if not subject:
            raise AgentAuthError("Missing subject in token")

        issuer = payload.get("iss")
        audience = payload.get("aud")
        role = payload.get("role")  # Singular per Decision Lock
        exp = payload.get("exp")

        # Convert exp to datetime
        expires_at = datetime.fromtimestamp(exp, tz=UTC) if exp else datetime.now(UTC)

        # Check role claim exists (required per Decision Lock)
        if not role:
            logger.warning(
                "agent_auth_missing_role_claim",
                subject=subject,
            )
            raise MissingRoleError("Missing required role claim in token")

        # Validate role is in hierarchy
        if role not in ROLE_HIERARCHY:
            logger.warning(
                "agent_auth_invalid_role",
                subject=subject,
                role=role,
                valid_roles=list(ROLE_HIERARCHY.keys()),
            )
            raise MissingRoleError(f"Invalid role: {role}")

        # Check role level is sufficient
        required_role = require_role or AGENT_JWT_REQUIRED_ROLE
        if required_role:
            user_level = ROLE_HIERARCHY.get(role, 0)
            required_level = ROLE_HIERARCHY.get(required_role, 0)
            if user_level < required_level:
                logger.warning(
                    "agent_auth_insufficient_role",
                    subject=subject,
                    required_role=required_role,
                    actual_role=role,
                )
                raise InsufficientRoleError(
                    f"Insufficient role: {role} (requires {required_role})"
                )

        logger.info(
            "agent_token_verified",
            subject=subject,
            issuer=issuer,
            role=role,
        )

        return AgentUser(
            subject=subject,
            issuer=issuer,
            audience=audience,
            role=role,
            expires_at=expires_at,
        )

    except ExpiredSignatureError:
        logger.warning("agent_token_expired")
        raise TokenExpiredError("Token has expired")

    except JWTError as e:
        error_str = str(e).lower()

        # Check for specific errors
        if "audience" in error_str:
            logger.warning("agent_token_invalid_audience", error=str(e))
            raise InvalidAudienceError("Invalid audience")
        elif "issuer" in error_str:
            logger.warning("agent_token_invalid_issuer", error=str(e))
            raise InvalidIssuerError("Invalid issuer")
        else:
            logger.warning("agent_token_invalid", error=str(e))
            raise AgentAuthError(f"Invalid token: {e}")


async def get_agent_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[AgentUser]:
    """FastAPI dependency to get authenticated agent user.

    If AGENT_JWT_ENFORCE is False, returns None and allows unauthenticated access.
    If AGENT_JWT_ENFORCE is True, requires valid JWT.

    Args:
        request: The FastAPI request
        credentials: The bearer token credentials

    Returns:
        Optional[AgentUser]: The authenticated user, or None if not enforced

    Raises:
        HTTPException: If authentication fails when enforcement is enabled
    """
    if not AGENT_JWT_ENFORCE:
        # Auth not enforced - allow through
        logger.debug("agent_auth_not_enforced")
        return None

    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return verify_agent_token(credentials.credentials)
    except InsufficientRoleError:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions",
        )
    except (TokenExpiredError, InvalidIssuerError, InvalidAudienceError,
            MissingRoleError, AgentAuthError):
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_approve_role(
    user: Optional[AgentUser] = Depends(get_agent_user),
) -> Optional[AgentUser]:
    """Dependency that requires the APPROVER role for approve/reject endpoints.

    This is used specifically for the :approve and :reject endpoints.
    Per Decision Lock §7: APPROVER role required for approve actions.
    """
    if not AGENT_JWT_ENFORCE:
        return None

    if user and not user.has_role(AGENT_JWT_REQUIRED_ROLE):
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient role: {user.role} (requires {AGENT_JWT_REQUIRED_ROLE})",
        )

    return user


# Helper to generate test tokens for auth negative tests
def generate_test_tokens() -> dict:
    """Generate test tokens for auth negative testing.

    Per Decision Lock §7: JWT uses `role` (singular) claim.

    Returns dict with tokens for:
    - valid: A valid token with APPROVER role
    - expired: An expired token
    - wrong_iss: Token with wrong issuer
    - wrong_aud: Token with wrong audience
    - no_role: Token without role claim (401)
    - insufficient_role: Token with VIEWER role (403)
    """
    from datetime import timedelta

    # Valid token with APPROVER role
    valid = create_agent_token(
        subject="test-user",
        role="APPROVER",
    )

    # Expired token (1 second ago)
    expired_payload = {
        "sub": "test-user",
        "iss": AGENT_JWT_ISSUER,
        "aud": AGENT_JWT_AUDIENCE,
        "role": "APPROVER",
        "exp": datetime.now(UTC) - timedelta(seconds=1),
        "iat": datetime.now(UTC) - timedelta(hours=1),
    }
    expired = jwt.encode(expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Wrong issuer
    wrong_iss_payload = {
        "sub": "test-user",
        "iss": "wrong-issuer",
        "aud": AGENT_JWT_AUDIENCE,
        "role": "APPROVER",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    wrong_iss = jwt.encode(wrong_iss_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Wrong audience
    wrong_aud_payload = {
        "sub": "test-user",
        "iss": AGENT_JWT_ISSUER,
        "aud": "wrong-audience",
        "role": "APPROVER",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    wrong_aud = jwt.encode(wrong_aud_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # No role claim (missing required claim = 401)
    no_role_payload = {
        "sub": "test-user",
        "iss": AGENT_JWT_ISSUER,
        "aud": AGENT_JWT_AUDIENCE,
        # "role" intentionally missing
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    no_role = jwt.encode(no_role_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Insufficient role (VIEWER when APPROVER required = 403)
    insufficient_role_payload = {
        "sub": "test-user",
        "iss": AGENT_JWT_ISSUER,
        "aud": AGENT_JWT_AUDIENCE,
        "role": "VIEWER",  # Not sufficient for approve
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iat": datetime.now(UTC),
    }
    insufficient_role = jwt.encode(insufficient_role_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    return {
        "valid": valid,
        "expired": expired,
        "wrong_iss": wrong_iss,
        "wrong_aud": wrong_aud,
        "no_role": no_role,
        "insufficient_role": insufficient_role,
    }
