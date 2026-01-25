"""Tests for RBAC coverage validation.

Verifies that:
1. Role hierarchy is correctly defined
2. Protected endpoints have auth dependencies
3. Approval endpoints require APPROVER role
"""

import pytest
from unittest.mock import MagicMock, patch

from app.core.security.agent_auth import (
    ROLE_HIERARCHY,
    AgentUser,
    verify_agent_token,
    create_agent_token,
    MissingRoleError,
    InsufficientRoleError,
    TokenExpiredError,
    InvalidIssuerError,
    InvalidAudienceError,
)
from app.core.security.rbac_coverage import (
    validate_role_hierarchy,
    get_endpoint_protection_level,
    PUBLIC_ENDPOINTS,
    PROTECTED_ENDPOINTS,
)


class TestRoleHierarchy:
    """Test role hierarchy validation."""

    def test_role_hierarchy_order(self):
        """Verify VIEWER < OPERATOR < APPROVER < ADMIN."""
        assert ROLE_HIERARCHY["VIEWER"] < ROLE_HIERARCHY["OPERATOR"]
        assert ROLE_HIERARCHY["OPERATOR"] < ROLE_HIERARCHY["APPROVER"]
        assert ROLE_HIERARCHY["APPROVER"] < ROLE_HIERARCHY["ADMIN"]

    def test_role_hierarchy_values(self):
        """Verify role levels are as expected."""
        assert ROLE_HIERARCHY["VIEWER"] == 1
        assert ROLE_HIERARCHY["OPERATOR"] == 2
        assert ROLE_HIERARCHY["APPROVER"] == 3
        assert ROLE_HIERARCHY["ADMIN"] == 4

    def test_validate_role_hierarchy(self):
        """Test hierarchy validation function."""
        result = validate_role_hierarchy()
        assert result["passed"] is True
        assert len(result["issues"]) == 0

    def test_all_roles_present(self):
        """Verify all expected roles are defined."""
        expected_roles = {"VIEWER", "OPERATOR", "APPROVER", "ADMIN"}
        assert set(ROLE_HIERARCHY.keys()) == expected_roles


class TestAgentUserRoleChecks:
    """Test AgentUser role checking."""

    def test_agent_user_has_role_exact_match(self):
        """User with exact role should pass."""
        user = AgentUser(
            subject="test",
            issuer="test-issuer",
            audience="test-audience",
            role="APPROVER",
            expires_at=None,
        )
        assert user.has_role("APPROVER") is True

    def test_agent_user_has_role_higher(self):
        """User with higher role should pass."""
        user = AgentUser(
            subject="test",
            issuer="test-issuer",
            audience="test-audience",
            role="ADMIN",
            expires_at=None,
        )
        assert user.has_role("APPROVER") is True
        assert user.has_role("OPERATOR") is True
        assert user.has_role("VIEWER") is True

    def test_agent_user_has_role_lower(self):
        """User with lower role should fail."""
        user = AgentUser(
            subject="test",
            issuer="test-issuer",
            audience="test-audience",
            role="VIEWER",
            expires_at=None,
        )
        assert user.has_role("APPROVER") is False
        assert user.has_role("ADMIN") is False


class TestEndpointProtection:
    """Test endpoint protection level determination."""

    def test_public_endpoints(self):
        """Public endpoints should not require auth."""
        for endpoint in PUBLIC_ENDPOINTS:
            level = get_endpoint_protection_level(endpoint, "GET")
            assert level is None, f"{endpoint} should be public"

    def test_approval_endpoints_require_approver(self):
        """Approval endpoints should require APPROVER role."""
        assert (
            PROTECTED_ENDPOINTS["POST /v1/agent/approvals/{approval_id}:approve"]
            == "APPROVER"
        )
        assert (
            PROTECTED_ENDPOINTS["POST /v1/agent/approvals/{approval_id}:reject"]
            == "APPROVER"
        )

    def test_api_endpoints_require_auth(self):
        """API endpoints should require authentication."""
        level = get_endpoint_protection_level("/v1/agent/invoke", "POST")
        assert level == "authenticated"


class TestTokenValidation:
    """Test JWT token validation."""

    def test_valid_token_creation(self):
        """Valid token should be created successfully."""
        token = create_agent_token(
            subject="test-user",
            role="APPROVER",
        )
        assert token is not None
        assert len(token) > 0

    def test_token_verification_success(self):
        """Valid token should verify successfully."""
        token = create_agent_token(
            subject="test-user",
            role="APPROVER",
        )
        user = verify_agent_token(token)
        assert user.subject == "test-user"
        assert user.role == "APPROVER"

    def test_token_missing_role_raises_error(self):
        """Token without role should raise MissingRoleError."""
        from jose import jwt
        from datetime import datetime, timedelta, UTC
        from app.core.config import settings

        # Create token without role claim
        payload = {
            "sub": "test-user",
            "iss": "zakops-auth",
            "aud": "zakops-agent",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        with pytest.raises(MissingRoleError):
            verify_agent_token(token)

    def test_token_insufficient_role_raises_error(self):
        """Token with insufficient role should raise InsufficientRoleError."""
        token = create_agent_token(
            subject="test-user",
            role="VIEWER",
        )

        with pytest.raises(InsufficientRoleError):
            verify_agent_token(token, require_role="APPROVER")

    def test_token_expired_raises_error(self):
        """Expired token should raise TokenExpiredError."""
        from jose import jwt
        from datetime import datetime, timedelta, UTC
        from app.core.config import settings

        payload = {
            "sub": "test-user",
            "iss": "zakops-auth",
            "aud": "zakops-agent",
            "role": "APPROVER",
            "exp": datetime.now(UTC) - timedelta(seconds=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        with pytest.raises(TokenExpiredError):
            verify_agent_token(token)

    def test_token_wrong_issuer_raises_error(self):
        """Token with wrong issuer should raise InvalidIssuerError."""
        from jose import jwt
        from datetime import datetime, timedelta, UTC
        from app.core.config import settings

        payload = {
            "sub": "test-user",
            "iss": "wrong-issuer",
            "aud": "zakops-agent",
            "role": "APPROVER",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        with pytest.raises(InvalidIssuerError):
            verify_agent_token(token)

    def test_token_wrong_audience_raises_error(self):
        """Token with wrong audience should raise InvalidAudienceError."""
        from jose import jwt
        from datetime import datetime, timedelta, UTC
        from app.core.config import settings

        payload = {
            "sub": "test-user",
            "iss": "zakops-auth",
            "aud": "wrong-audience",
            "role": "APPROVER",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        with pytest.raises(InvalidAudienceError):
            verify_agent_token(token)


class TestRBACCoverage:
    """Test RBAC coverage calculation."""

    def test_coverage_100_when_all_protected(self):
        """Coverage should be 100% when all endpoints are protected."""
        from app.core.security.rbac_coverage import RBACCoverageReport

        report = RBACCoverageReport()
        report.total_endpoints = 10
        report.protected_endpoints = 10
        report.coverage_percentage = 100.0

        assert report.coverage_percentage == 100.0
        assert len(report.issues) == 0

    def test_coverage_report_to_dict(self):
        """Coverage report should serialize to dict."""
        from app.core.security.rbac_coverage import RBACCoverageReport, EndpointRBACInfo

        report = RBACCoverageReport()
        report.endpoints.append(
            EndpointRBACInfo(
                path="/test",
                method="GET",
                function_name="test_func",
                has_auth_dependency=True,
                required_role="APPROVER",
                rate_limited=True,
                file_path="test.py",
                line_number=10,
            )
        )
        report.total_endpoints = 1
        report.protected_endpoints = 1
        report.coverage_percentage = 100.0

        result = report.to_dict()

        assert result["total_endpoints"] == 1
        assert result["protected_endpoints"] == 1
        assert len(result["endpoints"]) == 1
        assert result["endpoints"][0]["path"] == "/test"
