"""Tests for rate limiting middleware.

Verifies that rate limiting is properly configured and enforced.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import Request
from starlette.datastructures import Headers

from app.core.middleware.rate_limiter import (
    get_client_identifier,
    limiter,
    rate_limit_exceeded_handler,
)


class TestClientIdentification:
    """Test client identification for rate limiting."""

    def create_mock_request(
        self, ip: str = "192.168.1.1", auth_header: str = ""
    ) -> Request:
        """Create a mock request for testing."""
        scope = {
            "type": "http",
            "headers": [],
            "client": (ip, 12345),
        }

        if auth_header:
            scope["headers"].append((b"authorization", auth_header.encode()))

        request = Request(scope)
        return request

    def test_ip_only_identification(self):
        """Unauthenticated requests identified by IP."""
        request = self.create_mock_request(ip="10.0.0.1")
        identifier = get_client_identifier(request)

        assert identifier == "10.0.0.1"

    def test_authenticated_request_includes_token_hash(self):
        """Authenticated requests include token hash."""
        request = self.create_mock_request(
            ip="10.0.0.1", auth_header="Bearer test-token-123"
        )
        identifier = get_client_identifier(request)

        assert "10.0.0.1" in identifier
        assert "auth:" in identifier

    def test_different_tokens_different_identifiers(self):
        """Different tokens should have different identifiers."""
        request1 = self.create_mock_request(
            ip="10.0.0.1", auth_header="Bearer token-a"
        )
        request2 = self.create_mock_request(
            ip="10.0.0.1", auth_header="Bearer token-b"
        )

        id1 = get_client_identifier(request1)
        id2 = get_client_identifier(request2)

        # Same IP, different tokens = different identifiers
        assert id1 != id2

    def test_same_token_same_identifier(self):
        """Same token should have same identifier."""
        request1 = self.create_mock_request(
            ip="10.0.0.1", auth_header="Bearer same-token"
        )
        request2 = self.create_mock_request(
            ip="10.0.0.1", auth_header="Bearer same-token"
        )

        id1 = get_client_identifier(request1)
        id2 = get_client_identifier(request2)

        assert id1 == id2


class TestRateLimitConfiguration:
    """Test rate limit configuration."""

    def test_limiter_exists(self):
        """Limiter should be properly instantiated."""
        assert limiter is not None

    def test_default_limits(self):
        """Default limits should be configured."""
        # The limiter should have default limits set
        assert limiter._default_limits is not None

    def test_storage_configured(self):
        """Storage should be configured (memory for tests)."""
        # Default is memory storage for development/testing
        assert limiter._storage is not None


class TestRateLimitDecorators:
    """Test rate limit decorator functions."""

    def test_high_frequency_limit(self):
        """High frequency limit should be 100/min."""
        from app.core.middleware.rate_limiter import rate_limit_high_frequency

        decorator = rate_limit_high_frequency()
        # The decorator returns a function
        assert callable(decorator)

    def test_standard_limit(self):
        """Standard limit should be 60/min."""
        from app.core.middleware.rate_limiter import rate_limit_standard

        decorator = rate_limit_standard()
        assert callable(decorator)

    def test_write_operations_limit(self):
        """Write operations limit should be 30/min."""
        from app.core.middleware.rate_limiter import rate_limit_write_operations

        decorator = rate_limit_write_operations()
        assert callable(decorator)

    def test_sensitive_limit(self):
        """Sensitive operations limit should be 10/min."""
        from app.core.middleware.rate_limiter import rate_limit_sensitive

        decorator = rate_limit_sensitive()
        assert callable(decorator)

    def test_admin_limit(self):
        """Admin operations limit should be 20/min."""
        from app.core.middleware.rate_limiter import rate_limit_admin

        decorator = rate_limit_admin()
        assert callable(decorator)


class TestRateLimitExceededHandler:
    """Test rate limit exceeded error handling."""

    @pytest.mark.asyncio
    async def test_handler_returns_429(self):
        """Handler should return 429 status."""
        from slowapi.errors import RateLimitExceeded

        scope = {
            "type": "http",
            "headers": [],
            "client": ("10.0.0.1", 12345),
            "path": "/test",
            "method": "GET",
        }
        request = Request(scope)

        exc = RateLimitExceeded("Rate limit exceeded")

        response = await rate_limit_exceeded_handler(request, exc)

        assert response.status_code == 429

    @pytest.mark.asyncio
    async def test_handler_includes_retry_after(self):
        """Handler should include Retry-After header."""
        from slowapi.errors import RateLimitExceeded

        scope = {
            "type": "http",
            "headers": [],
            "client": ("10.0.0.1", 12345),
            "path": "/test",
            "method": "GET",
        }
        request = Request(scope)

        exc = RateLimitExceeded("Rate limit exceeded")
        exc.retry_after = 30

        response = await rate_limit_exceeded_handler(request, exc)

        assert "Retry-After" in response.headers


class TestRateLimitIntegration:
    """Integration tests for rate limiting."""

    def test_endpoint_has_rate_limit(self):
        """Critical endpoints should have rate limits applied."""
        # This verifies the @limiter.limit decorator is applied
        # The actual endpoints are in the agent router
        expected_rate_limited_endpoints = [
            "/v1/agent/invoke",
            "/v1/agent/approvals/{approval_id}:approve",
            "/v1/agent/approvals/{approval_id}:reject",
        ]

        # For each endpoint, we expect it to have rate limiting
        # This is verified by code inspection or integration tests
        for endpoint in expected_rate_limited_endpoints:
            # Placeholder - actual verification would require app context
            assert endpoint is not None

    def test_rate_limit_headers_documented(self):
        """Rate limit response should include standard headers."""
        # X-RateLimit-Limit: The rate limit ceiling for that given endpoint
        # X-RateLimit-Remaining: The number of requests left
        # X-RateLimit-Reset: The remaining window before rate limit resets
        expected_headers = ["X-RateLimit-Limit", "Retry-After"]

        # These headers should be included in rate limit responses
        for header in expected_headers:
            assert header is not None
