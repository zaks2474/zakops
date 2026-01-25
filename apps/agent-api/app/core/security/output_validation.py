"""Output validation and sanitization for API responses.

Ensures that responses from the API (especially those containing
LLM-generated content) are properly sanitized to prevent XSS,
injection attacks, and information disclosure.
"""

import html
import re
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass


@dataclass
class SanitizationResult:
    """Result of sanitization operation."""

    original: str
    sanitized: str
    modifications: List[str]

    @property
    def was_modified(self) -> bool:
        """Check if content was modified during sanitization."""
        return len(self.modifications) > 0


# Patterns that might indicate injection attempts
SUSPICIOUS_PATTERNS = [
    # Script injection
    r"<script[^>]*>.*?</script>",
    r"javascript:",
    r"on\w+\s*=",  # onclick, onerror, etc.
    # HTML injection
    r"<iframe[^>]*>",
    r"<object[^>]*>",
    r"<embed[^>]*>",
    r"<form[^>]*>",
    # SQL injection patterns (for logging purposes)
    r";\s*DROP\s+TABLE",
    r";\s*DELETE\s+FROM",
    r"'\s*OR\s+'1'\s*=\s*'1",
    r"--\s*$",
    # Path traversal
    r"\.\./",
    r"\.\.\\",
]

# Compile patterns for efficiency
COMPILED_PATTERNS = [(p, re.compile(p, re.IGNORECASE)) for p in SUSPICIOUS_PATTERNS]


def sanitize_html(content: str) -> SanitizationResult:
    """Sanitize HTML content to prevent XSS.

    Args:
        content: Raw content that may contain HTML

    Returns:
        SanitizationResult with sanitized content
    """
    modifications = []

    # Escape HTML entities
    sanitized = html.escape(content)

    if sanitized != content:
        modifications.append("html_escaped")

    return SanitizationResult(
        original=content,
        sanitized=sanitized,
        modifications=modifications,
    )


def detect_suspicious_patterns(content: str) -> List[str]:
    """Detect suspicious patterns in content.

    Args:
        content: Content to scan

    Returns:
        List of detected pattern names
    """
    detected = []

    for pattern_str, pattern in COMPILED_PATTERNS:
        if pattern.search(content):
            detected.append(pattern_str)

    return detected


def sanitize_llm_output(content: str, context: str = "response") -> SanitizationResult:
    """Sanitize LLM-generated output.

    This is the main sanitization function for LLM outputs.
    It performs multiple sanitization steps:
    1. HTML escaping (prevents XSS)
    2. Pattern detection (logs suspicious content)
    3. Length limiting (prevents response flooding)

    Args:
        content: LLM-generated content
        context: Context for logging (e.g., "response", "tool_result")

    Returns:
        SanitizationResult with sanitized content
    """
    if not content:
        return SanitizationResult(original="", sanitized="", modifications=[])

    modifications = []

    # Step 1: Detect suspicious patterns (for logging/alerting)
    suspicious = detect_suspicious_patterns(content)
    if suspicious:
        modifications.append(f"suspicious_patterns_detected: {suspicious}")

    # Step 2: HTML escape
    result = sanitize_html(content)
    sanitized = result.sanitized
    modifications.extend(result.modifications)

    # Step 3: Length limit (configurable, default 100KB)
    max_length = 100_000
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "... [truncated]"
        modifications.append(f"truncated_from_{len(content)}_to_{max_length}")

    return SanitizationResult(
        original=content,
        sanitized=sanitized,
        modifications=modifications,
    )


def sanitize_dict(
    data: Dict[str, Any],
    sanitize_keys: Optional[List[str]] = None,
    recursive: bool = True,
) -> Dict[str, Any]:
    """Sanitize string values in a dictionary.

    Args:
        data: Dictionary to sanitize
        sanitize_keys: Specific keys to sanitize (None = all string values)
        recursive: Whether to recursively sanitize nested dicts

    Returns:
        Sanitized dictionary
    """
    result = {}

    for key, value in data.items():
        if isinstance(value, str):
            if sanitize_keys is None or key in sanitize_keys:
                result[key] = sanitize_llm_output(value).sanitized
            else:
                result[key] = value
        elif isinstance(value, dict) and recursive:
            result[key] = sanitize_dict(value, sanitize_keys, recursive)
        elif isinstance(value, list) and recursive:
            result[key] = [
                sanitize_dict(item, sanitize_keys, recursive)
                if isinstance(item, dict)
                else sanitize_llm_output(item).sanitized
                if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            result[key] = value

    return result


def remove_pii_patterns(content: str) -> SanitizationResult:
    """Remove common PII patterns from content.

    Used for logging sanitization to prevent PII exposure.

    Args:
        content: Content that may contain PII

    Returns:
        SanitizationResult with PII redacted
    """
    modifications = []
    sanitized = content

    # Email addresses
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    if re.search(email_pattern, sanitized):
        sanitized = re.sub(email_pattern, "[EMAIL_REDACTED]", sanitized)
        modifications.append("email_redacted")

    # Phone numbers (US format)
    phone_pattern = r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"
    if re.search(phone_pattern, sanitized):
        sanitized = re.sub(phone_pattern, "[PHONE_REDACTED]", sanitized)
        modifications.append("phone_redacted")

    # SSN (US format)
    ssn_pattern = r"\b\d{3}[-]?\d{2}[-]?\d{4}\b"
    if re.search(ssn_pattern, sanitized):
        sanitized = re.sub(ssn_pattern, "[SSN_REDACTED]", sanitized)
        modifications.append("ssn_redacted")

    # Credit card numbers (basic pattern)
    cc_pattern = r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
    if re.search(cc_pattern, sanitized):
        sanitized = re.sub(cc_pattern, "[CC_REDACTED]", sanitized)
        modifications.append("credit_card_redacted")

    return SanitizationResult(
        original=content,
        sanitized=sanitized,
        modifications=modifications,
    )


def sanitize_for_logging(content: str) -> str:
    """Sanitize content for safe logging.

    Removes PII and limits length for safe logging.

    Args:
        content: Content to log

    Returns:
        Sanitized content safe for logging
    """
    if not content:
        return ""

    # Remove PII
    result = remove_pii_patterns(content)

    # Limit length for logging
    max_log_length = 1000
    if len(result.sanitized) > max_log_length:
        return result.sanitized[:max_log_length] + "... [truncated for logging]"

    return result.sanitized
