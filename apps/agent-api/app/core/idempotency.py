"""Idempotency key generation for tool executions.

This module provides deterministic, restart-safe idempotency key generation
using SHA-256 hashing of canonical JSON representations.

IMPORTANT: Never use Python hash() or uuid4() for idempotency keys as they
are not deterministic across restarts.
"""

import hashlib
import json
from typing import Any, Dict


def tool_idempotency_key(thread_id: str, tool_name: str, tool_args: Dict[str, Any]) -> str:
    """Generate a deterministic idempotency key for tool execution.

    Uses SHA-256 hash of canonical JSON representation to ensure:
    - Restart-safe: Same inputs always produce same key
    - Collision-resistant: Different inputs produce different keys
    - Order-independent: Dict key order doesn't affect result

    Args:
        thread_id: The LangGraph thread ID
        tool_name: Name of the tool being executed
        tool_args: Tool arguments (will be canonicalized)

    Returns:
        str: Deterministic idempotency key in format:
             "{thread_id}:{tool_name}:{sha256_hash}"

    Example:
        >>> key = tool_idempotency_key("thread-123", "transition_deal", {"deal_id": "D001"})
        >>> # Same inputs always produce same key across restarts
    """
    # Canonical JSON: sorted keys, no extra whitespace, ASCII-safe
    # Include thread_id and tool_name in the hash input for uniqueness
    canonical = json.dumps(
        {"thread_id": thread_id, "tool_name": tool_name, "args": tool_args},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False
    )

    # SHA-256 hash for deterministic, collision-resistant key
    # Return only the hash (64 chars) to comply with backend max length
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def approval_idempotency_key(thread_id: str, tool_name: str, tool_args: Dict[str, Any]) -> str:
    """Generate idempotency key for approval records.

    This is an alias for tool_idempotency_key to make intent clear.
    Approval and tool execution share the same idempotency key.

    Args:
        thread_id: The LangGraph thread ID
        tool_name: Name of the tool requiring approval
        tool_args: Tool arguments

    Returns:
        str: Deterministic idempotency key
    """
    return tool_idempotency_key(thread_id, tool_name, tool_args)


def validate_idempotency_key(key: str) -> bool:
    """Validate idempotency key format.

    Args:
        key: The idempotency key to validate

    Returns:
        bool: True if key matches expected format (64 char hex SHA-256)
    """
    # Key should be exactly 64 hex characters (SHA-256 hash)
    if len(key) != 64:
        return False

    try:
        int(key, 16)  # Verify it's valid hex
        return True
    except ValueError:
        return False
