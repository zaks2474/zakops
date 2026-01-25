"""Tests for output sanitization.

Verifies that output validation properly sanitizes LLM outputs
and other API responses to prevent XSS, injection, and info disclosure.
"""

import pytest
from app.core.security.output_validation import (
    sanitize_html,
    sanitize_llm_output,
    sanitize_dict,
    detect_suspicious_patterns,
    remove_pii_patterns,
    sanitize_for_logging,
)


class TestHtmlSanitization:
    """Test HTML sanitization."""

    def test_escapes_script_tags(self):
        """Script tags should be escaped."""
        content = '<script>alert("xss")</script>'
        result = sanitize_html(content)

        assert "<script>" not in result.sanitized
        assert "&lt;script&gt;" in result.sanitized
        assert result.was_modified

    def test_escapes_html_entities(self):
        """HTML entities should be escaped."""
        content = '<div onclick="evil()">Click</div>'
        result = sanitize_html(content)

        assert "<div" not in result.sanitized
        assert "onclick" not in result.sanitized or "&quot;" in result.sanitized
        assert result.was_modified

    def test_preserves_safe_content(self):
        """Safe content should not be modified."""
        content = "Hello, this is a safe message."
        result = sanitize_html(content)

        assert result.sanitized == content
        assert not result.was_modified

    def test_escapes_angle_brackets(self):
        """Angle brackets should be escaped."""
        content = "Use <b>bold</b> for emphasis"
        result = sanitize_html(content)

        assert "<b>" not in result.sanitized
        assert "&lt;b&gt;" in result.sanitized


class TestSuspiciousPatternDetection:
    """Test suspicious pattern detection."""

    def test_detects_script_injection(self):
        """Detect script injection attempts."""
        content = '<script>document.cookie</script>'
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) > 0

    def test_detects_event_handlers(self):
        """Detect event handler injection."""
        content = '<img onerror="evil()" src="x">'
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) > 0

    def test_detects_javascript_urls(self):
        """Detect javascript: URL injection."""
        content = '<a href="javascript:alert(1)">click</a>'
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) > 0

    def test_detects_sql_injection(self):
        """Detect SQL injection patterns."""
        content = "'; DROP TABLE users; --"
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) > 0

    def test_detects_path_traversal(self):
        """Detect path traversal attempts."""
        content = "../../etc/passwd"
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) > 0

    def test_safe_content_no_patterns(self):
        """Safe content should not trigger detection."""
        content = "This is a normal response about user data."
        patterns = detect_suspicious_patterns(content)

        assert len(patterns) == 0


class TestLlmOutputSanitization:
    """Test LLM output sanitization."""

    def test_sanitizes_xss_in_llm_output(self):
        """XSS in LLM output should be sanitized."""
        content = 'The result is: <script>alert("pwned")</script>'
        result = sanitize_llm_output(content)

        assert "<script>" not in result.sanitized
        assert "pwned" in result.sanitized  # Content preserved, just escaped

    def test_truncates_long_output(self):
        """Very long output should be truncated."""
        content = "x" * 200_000
        result = sanitize_llm_output(content)

        assert len(result.sanitized) < 110_000  # Some buffer for truncation message
        assert "[truncated]" in result.sanitized

    def test_handles_empty_content(self):
        """Empty content should be handled gracefully."""
        result = sanitize_llm_output("")

        assert result.sanitized == ""
        assert not result.was_modified

    def test_logs_suspicious_patterns(self):
        """Suspicious patterns should be logged in modifications."""
        content = "Result: <iframe src='evil.com'></iframe>"
        result = sanitize_llm_output(content)

        assert any("suspicious" in m for m in result.modifications)


class TestDictSanitization:
    """Test dictionary sanitization."""

    def test_sanitizes_string_values(self):
        """String values should be sanitized."""
        data = {"message": "<script>bad</script>", "count": 42}
        result = sanitize_dict(data)

        assert "<script>" not in result["message"]
        assert result["count"] == 42

    def test_recursive_sanitization(self):
        """Nested dicts should be sanitized."""
        data = {"outer": {"inner": "<script>nested</script>"}}
        result = sanitize_dict(data, recursive=True)

        assert "<script>" not in result["outer"]["inner"]

    def test_sanitizes_list_items(self):
        """List items should be sanitized."""
        data = {"items": ["<b>one</b>", "<script>two</script>"]}
        result = sanitize_dict(data)

        assert all("<script>" not in item for item in result["items"])

    def test_specific_keys_only(self):
        """Only specified keys should be sanitized."""
        data = {"safe": "<b>keep</b>", "sanitize": "<script>remove</script>"}
        result = sanitize_dict(data, sanitize_keys=["sanitize"])

        # 'safe' should be unchanged, 'sanitize' should be escaped
        assert result["safe"] == "<b>keep</b>"
        assert "<script>" not in result["sanitize"]


class TestPiiRemoval:
    """Test PII removal for logging."""

    def test_redacts_email(self):
        """Email addresses should be redacted."""
        content = "Contact user@example.com for help"
        result = remove_pii_patterns(content)

        assert "user@example.com" not in result.sanitized
        assert "[EMAIL_REDACTED]" in result.sanitized

    def test_redacts_phone(self):
        """Phone numbers should be redacted."""
        content = "Call 555-123-4567 for support"
        result = remove_pii_patterns(content)

        assert "555-123-4567" not in result.sanitized
        assert "[PHONE_REDACTED]" in result.sanitized

    def test_redacts_ssn(self):
        """SSN should be redacted."""
        content = "SSN: 123-45-6789"
        result = remove_pii_patterns(content)

        assert "123-45-6789" not in result.sanitized
        assert "[SSN_REDACTED]" in result.sanitized

    def test_redacts_credit_card(self):
        """Credit card numbers should be redacted."""
        content = "Card: 4111-1111-1111-1111"
        result = remove_pii_patterns(content)

        assert "4111-1111-1111-1111" not in result.sanitized
        assert "[CC_REDACTED]" in result.sanitized

    def test_preserves_non_pii(self):
        """Non-PII content should be preserved."""
        content = "User ID 12345 completed task"
        result = remove_pii_patterns(content)

        assert result.sanitized == content
        assert not result.was_modified


class TestLoggingSanitization:
    """Test sanitization for logging."""

    def test_truncates_long_content(self):
        """Long content should be truncated for logging."""
        content = "x" * 5000
        result = sanitize_for_logging(content)

        assert len(result) < 1100  # 1000 + truncation message
        assert "[truncated" in result

    def test_removes_pii_for_logging(self):
        """PII should be removed for logging."""
        content = "User email: test@example.com"
        result = sanitize_for_logging(content)

        assert "test@example.com" not in result
        assert "[EMAIL_REDACTED]" in result

    def test_handles_empty(self):
        """Empty content should return empty string."""
        assert sanitize_for_logging("") == ""
        assert sanitize_for_logging(None) == ""
