"""Tests for PII redaction module."""

import sys
from pathlib import Path

import pytest

# Add packages to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent))

from packages.security.pii_redaction import (
    PII_PATTERNS,
    detect_pii,
    has_pii,
    redact_dict,
    redact_sensitive_fields,
    redact_text,
)


class TestPIIDetection:
    """Tests for PII detection functions."""

    def test_detect_email(self):
        """Test email detection."""
        text = "Contact me at john.doe@example.com for details"
        matches = detect_pii(text)
        assert len(matches) == 1
        assert matches[0]["type"] == "email"
        assert matches[0]["value"] == "john.doe@example.com"

    def test_detect_phone(self):
        """Test phone number detection."""
        text = "Call me at 555-123-4567"
        matches = detect_pii(text)
        assert len(matches) == 1
        assert matches[0]["type"] == "phone"

    def test_detect_ssn(self):
        """Test SSN detection."""
        text = "SSN: 123-45-6789"
        matches = detect_pii(text)
        assert any(m["type"] == "ssn" for m in matches)

    def test_detect_credit_card(self):
        """Test credit card detection."""
        text = "Card: 4111-1111-1111-1111"
        matches = detect_pii(text)
        assert any(m["type"] == "credit_card" for m in matches)

    def test_detect_ip_address(self):
        """Test IP address detection."""
        text = "Server at 192.168.1.100"
        matches = detect_pii(text)
        assert any(m["type"] == "ip_address" for m in matches)

    def test_detect_multiple_pii(self):
        """Test detection of multiple PII types."""
        text = "Email: test@test.com, Phone: 555-555-5555"
        matches = detect_pii(text)
        assert len(matches) >= 2

    def test_detect_no_pii(self):
        """Test detection with no PII."""
        text = "This is a safe message with no sensitive data"
        matches = detect_pii(text)
        assert len(matches) == 0

    def test_detect_non_string_input(self):
        """Test detection with non-string input."""
        assert detect_pii(None) == []
        assert detect_pii(123) == []
        assert detect_pii([]) == []


class TestPIIRedaction:
    """Tests for PII redaction functions."""

    def test_redact_email(self):
        """Test email redaction."""
        text = "Contact john@example.com"
        result = redact_text(text)
        assert "john@example.com" not in result
        assert "[REDACTED]" in result

    def test_redact_custom_replacement(self):
        """Test custom replacement string."""
        text = "Email: test@test.com"
        result = redact_text(text, replacement="***")
        assert "***" in result
        assert "[REDACTED]" not in result

    def test_redact_specific_types(self):
        """Test redacting only specific PII types."""
        text = "Email: test@test.com, Phone: 555-555-5555"
        result = redact_text(text, pii_types=["email"])
        assert "test@test.com" not in result
        assert "555-555-5555" in result

    def test_redact_preserves_non_pii(self):
        """Test that non-PII content is preserved."""
        text = "Hello World! Email: test@test.com Goodbye!"
        result = redact_text(text)
        assert "Hello World!" in result
        assert "Goodbye!" in result

    def test_redact_dict_values(self):
        """Test dictionary value redaction."""
        data = {
            "name": "John Doe",
            "email": "john@example.com",
            "notes": "Contact at user@test.com",
        }
        result = redact_dict(data)
        assert result["name"] == "John Doe"
        assert "john@example.com" not in result["email"]
        assert "user@test.com" not in result["notes"]

    def test_redact_dict_nested(self):
        """Test nested dictionary redaction."""
        data = {
            "user": {
                "contact": {
                    "email": "test@test.com"
                }
            }
        }
        result = redact_dict(data)
        assert "test@test.com" not in result["user"]["contact"]["email"]

    def test_redact_dict_list_values(self):
        """Test list value redaction in dict."""
        data = {
            "emails": ["a@test.com", "b@test.com"]
        }
        result = redact_dict(data)
        assert "a@test.com" not in str(result)
        assert "b@test.com" not in str(result)

    def test_redact_sensitive_fields(self):
        """Test sensitive field name detection."""
        data = {
            "username": "john",
            "password": "secret123",
            "api_key": "sk-12345",
        }
        result = redact_sensitive_fields(data)
        assert result["username"] == "john"
        assert result["password"] == "[REDACTED]"
        assert result["api_key"] == "[REDACTED]"


class TestPIIInLogs:
    """Tests for PII detection in log-like structures."""

    def test_log_message_with_pii(self):
        """Test detection in log message format."""
        log = "2025-01-25 12:00:00 User john@test.com logged in from 192.168.1.1"
        assert has_pii(log)
        redacted = redact_text(log)
        assert "john@test.com" not in redacted
        assert "192.168.1.1" not in redacted

    def test_structured_log_redaction(self):
        """Test redaction of structured log data."""
        log_entry = {
            "timestamp": "2025-01-25T12:00:00Z",
            "level": "INFO",
            "message": "User logged in",
            "context": {
                "user_email": "user@example.com",
                "ip": "10.0.0.1",
            }
        }
        result = redact_dict(log_entry)
        assert "user@example.com" not in str(result)
        assert "10.0.0.1" not in str(result)
        assert result["level"] == "INFO"

    def test_json_payload_with_pii(self):
        """Test detection in JSON-like payload."""
        payload = {
            "request": {
                "headers": {
                    "Authorization": "Bearer token123"
                },
                "body": {
                    "email": "test@test.com"
                }
            }
        }
        result = redact_dict(payload, redact_sensitive_keys=True)
        # Authorization header should be redacted
        assert "token123" not in str(result)


class TestPIIInTraces:
    """Tests for PII detection in trace-like structures."""

    def test_span_attributes_redaction(self):
        """Test redaction of span attributes."""
        span_attrs = {
            "http.url": "/api/users",
            "user.email": "admin@company.com",
            "db.statement": "SELECT * FROM users WHERE email='test@test.com'",
        }
        result = redact_dict(span_attrs)
        assert "admin@company.com" not in str(result)
        assert "test@test.com" not in str(result)

    def test_trace_context_redaction(self):
        """Test redaction of trace context."""
        trace = {
            "trace_id": "abc123",
            "spans": [
                {
                    "name": "process_user",
                    "attributes": {
                        "input": "Process user john@example.com",
                        "password_hash": "bcrypt$hash"
                    }
                }
            ]
        }
        result = redact_dict(trace, redact_sensitive_keys=True)
        assert "john@example.com" not in str(result)
        # password_hash should be redacted by sensitive key detection
        assert "bcrypt$hash" not in str(result)

    def test_has_pii_function(self):
        """Test the has_pii convenience function."""
        assert has_pii("email@test.com") is True
        assert has_pii("no pii here") is False
        assert has_pii(None) is False
        assert has_pii(123) is False
