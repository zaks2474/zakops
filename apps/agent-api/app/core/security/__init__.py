"""Security module for agent API authentication."""

from app.core.security.agent_auth import (
    AgentAuthError,
    AgentUser,
    InsufficientRoleError,
    InvalidAudienceError,
    InvalidIssuerError,
    MissingRoleError,
    TokenExpiredError,
    create_agent_token,
    generate_test_tokens,
    get_agent_user,
    require_approve_role,
    verify_agent_token,
    AGENT_JWT_AUDIENCE,
    AGENT_JWT_ENFORCE,
    AGENT_JWT_ISSUER,
    AGENT_JWT_REQUIRED_ROLE,
    ROLE_HIERARCHY,
    # F-001/F-002 remediation: service token auth for /agent/* endpoints
    ServiceUser,
    get_service_token_user,
    require_service_token,
)

__all__ = [
    "AgentAuthError",
    "AgentUser",
    "InsufficientRoleError",
    "InvalidAudienceError",
    "InvalidIssuerError",
    "MissingRoleError",
    "TokenExpiredError",
    "create_agent_token",
    "generate_test_tokens",
    "get_agent_user",
    "require_approve_role",
    "verify_agent_token",
    "AGENT_JWT_AUDIENCE",
    "AGENT_JWT_ENFORCE",
    "AGENT_JWT_ISSUER",
    "AGENT_JWT_REQUIRED_ROLE",
    "ROLE_HIERARCHY",
    # F-001/F-002 remediation: service token auth for /agent/* endpoints
    "ServiceUser",
    "get_service_token_user",
    "require_service_token",
]
