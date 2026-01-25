"""PII Redaction Module.

Provides utilities for detecting and redacting Personally Identifiable Information
from text, dictionaries, and structured data.
"""

import re
from typing import Any

# PII patterns with descriptive names
PII_PATTERNS: dict[str, str] = {
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "phone": r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
    "ssn": r'\b\d{3}[-]?\d{2}[-]?\d{4}\b',
    "credit_card": r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
    "ip_address": r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
}

# Compiled patterns for efficiency
_COMPILED_PATTERNS: dict[str, re.Pattern] = {
    name: re.compile(pattern, re.IGNORECASE)
    for name, pattern in PII_PATTERNS.items()
}

# Default redaction placeholder
DEFAULT_REDACTION = "[REDACTED]"

# Sensitive field names (case-insensitive partial matches)
SENSITIVE_FIELDS = [
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "auth",
    "credential",
    "ssn",
    "social_security",
    "credit_card",
    "card_number",
]


def detect_pii(text: str) -> list[dict[str, Any]]:
    """Detect PII in text and return matches with their types.

    Args:
        text: Text to scan for PII

    Returns:
        List of dicts with 'type', 'value', 'start', 'end' keys
    """
    if not isinstance(text, str):
        return []

    matches = []
    for pii_type, pattern in _COMPILED_PATTERNS.items():
        for match in pattern.finditer(text):
            matches.append({
                "type": pii_type,
                "value": match.group(),
                "start": match.start(),
                "end": match.end(),
            })

    return sorted(matches, key=lambda m: m["start"])


def has_pii(text: str) -> bool:
    """Check if text contains any PII.

    Args:
        text: Text to check

    Returns:
        True if PII is detected, False otherwise
    """
    if not isinstance(text, str):
        return False

    for pattern in _COMPILED_PATTERNS.values():
        if pattern.search(text):
            return True
    return False


def redact_text(
    text: str,
    replacement: str = DEFAULT_REDACTION,
    pii_types: list[str] | None = None,
) -> str:
    """Redact PII from text.

    Args:
        text: Text to redact
        replacement: Replacement string for PII
        pii_types: Optional list of PII types to redact (None = all)

    Returns:
        Text with PII redacted
    """
    if not isinstance(text, str):
        return text

    patterns_to_use = (
        {k: v for k, v in _COMPILED_PATTERNS.items() if k in pii_types}
        if pii_types
        else _COMPILED_PATTERNS
    )

    result = text
    for pattern in patterns_to_use.values():
        result = pattern.sub(replacement, result)

    return result


def redact_dict(
    data: dict[str, Any],
    replacement: str = DEFAULT_REDACTION,
    redact_values: bool = True,
    redact_sensitive_keys: bool = True,
) -> dict[str, Any]:
    """Recursively redact PII from dictionary values.

    Args:
        data: Dictionary to redact
        replacement: Replacement string for PII
        redact_values: Whether to scan and redact PII in string values
        redact_sensitive_keys: Whether to redact values of sensitive field names

    Returns:
        New dictionary with PII redacted
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        # Check if key is sensitive
        if redact_sensitive_keys and _is_sensitive_key(key):
            result[key] = replacement
        elif isinstance(value, dict):
            result[key] = redact_dict(
                value, replacement, redact_values, redact_sensitive_keys
            )
        elif isinstance(value, list):
            result[key] = [
                redact_dict(item, replacement, redact_values, redact_sensitive_keys)
                if isinstance(item, dict)
                else (redact_text(item, replacement) if isinstance(item, str) and redact_values else item)
                for item in value
            ]
        elif isinstance(value, str) and redact_values:
            result[key] = redact_text(value, replacement)
        else:
            result[key] = value

    return result


def redact_sensitive_fields(
    data: dict[str, Any],
    replacement: str = DEFAULT_REDACTION,
) -> dict[str, Any]:
    """Redact only sensitive field values (not scanning for PII patterns).

    Args:
        data: Dictionary to process
        replacement: Replacement string

    Returns:
        New dictionary with sensitive fields redacted
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        if _is_sensitive_key(key):
            result[key] = replacement
        elif isinstance(value, dict):
            result[key] = redact_sensitive_fields(value, replacement)
        elif isinstance(value, list):
            result[key] = [
                redact_sensitive_fields(item, replacement)
                if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            result[key] = value

    return result


def _is_sensitive_key(key: str) -> bool:
    """Check if a key name indicates sensitive data."""
    if not isinstance(key, str):
        return False
    key_lower = key.lower()
    return any(sensitive in key_lower for sensitive in SENSITIVE_FIELDS)
