"""LLM Routing Policy module.

Implements routing policies per Decision Lock:
- Strategy: cost-based-routing
- Fallback chain: local-primary -> cloud-claude
- Blocked fields: ssn, tax_id, bank_account, credit_card
- Allowed conditions: context_overflow, local_model_error, explicit_user_request, complexity_threshold
"""

import re
from typing import List, Optional, Set

# Blocked fields per Decision Lock
BLOCKED_FIELDS: Set[str] = {"ssn", "tax_id", "bank_account", "credit_card"}

# Patterns for detecting blocked PII
BLOCKED_PATTERNS = {
    "ssn": r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b",  # SSN format: 123-45-6789
    "tax_id": r"\b\d{2}[-\s]?\d{7}\b",  # EIN format: 12-3456789
    "bank_account": r"\b(?:bank|account)[-_\s]?(?:number|#|num)?[-_\s:]*\d{8,17}\b",
    "credit_card": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",  # Credit card: 1234-5678-9012-3456
}

# Allowed conditions for cloud escalation
ALLOWED_CONDITIONS: Set[str] = {
    "context_overflow",
    "local_model_error",
    "explicit_user_request",
    "complexity_threshold",
}


def check_blocked_fields(content: str) -> List[str]:
    """Check content for blocked PII fields.

    Args:
        content: Text content to scan

    Returns:
        List of detected blocked field types
    """
    detected = []
    content_lower = content.lower()

    for field, pattern in BLOCKED_PATTERNS.items():
        if re.search(pattern, content, re.IGNORECASE):
            detected.append(field)
        # Also check for explicit mentions
        if field.replace("_", " ") in content_lower or field in content_lower:
            if field not in detected:
                detected.append(field)

    return detected


def should_use_cloud(
    content: str,
    condition: Optional[str] = None,
    force: bool = False,
) -> bool:
    """Determine if cloud LLM should be used.

    Args:
        content: Message content to evaluate
        condition: Allowed condition (if any)
        force: Force cloud usage (admin override)

    Returns:
        True if cloud can be used, False otherwise
    """
    # Never allow cloud with blocked fields (unless forced by admin)
    blocked = check_blocked_fields(content)
    if blocked and not force:
        return False

    # Cloud only allowed with valid condition
    if condition and condition in ALLOWED_CONDITIONS:
        return True

    # Default: use local
    return False


class RoutingPolicy:
    """LLM routing policy manager."""

    def __init__(self):
        """Initialize routing policy."""
        self.strategy = "cost-based-routing"
        self.fallback_chain = ["local-primary", "cloud-claude"]
        self.daily_budget = 50.00
        self.local_target_percent = 80.0

    def get_fallback_chain(self) -> List[str]:
        """Get the model fallback chain.

        Returns:
            List of model identifiers in fallback order
        """
        return self.fallback_chain.copy()

    def select_model(
        self,
        content: str,
        context_tokens: int = 0,
        local_error: bool = False,
        user_requested_cloud: bool = False,
        complexity_score: float = 0.0,
    ) -> str:
        """Select the appropriate model based on routing policy.

        Args:
            content: Message content
            context_tokens: Current context token count
            local_error: Whether local model errored
            user_requested_cloud: Explicit cloud request
            complexity_score: Task complexity score (0-1)

        Returns:
            Selected model identifier
        """
        # Check blocked fields first
        blocked = check_blocked_fields(content)
        if blocked:
            # Force local only when PII present
            return "local-primary"

        # Check conditions for cloud escalation
        condition = None

        if context_tokens > 30000:  # Near 32k limit
            condition = "context_overflow"
        elif local_error:
            condition = "local_model_error"
        elif user_requested_cloud:
            condition = "explicit_user_request"
        elif complexity_score > 0.8:
            condition = "complexity_threshold"

        if condition and should_use_cloud(content, condition):
            return "cloud-claude"

        return "local-primary"

    def get_config_snapshot(self) -> dict:
        """Get current routing configuration snapshot.

        Returns:
            Dictionary with routing configuration
        """
        return {
            "strategy": self.strategy,
            "fallback_chain": self.fallback_chain,
            "daily_budget": self.daily_budget,
            "local_target_percent": self.local_target_percent,
            "blocked_fields": list(BLOCKED_FIELDS),
            "allowed_conditions": list(ALLOWED_CONDITIONS),
        }
