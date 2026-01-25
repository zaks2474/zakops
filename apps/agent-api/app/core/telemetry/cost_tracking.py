"""Token cost tracking for LLM usage.

Tracks token usage and calculates costs for different LLM providers
to enable cost monitoring and optimization.
"""

import os
from datetime import datetime, UTC
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from enum import Enum


class LLMProvider(str, Enum):
    """Supported LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    VLLM = "vllm"
    AZURE_OPENAI = "azure_openai"
    LOCAL = "local"


@dataclass
class TokenPricing:
    """Pricing per 1K tokens for a model."""

    input_per_1k: float
    output_per_1k: float
    currency: str = "USD"


# Pricing as of 2026-01 (example values)
MODEL_PRICING: Dict[str, TokenPricing] = {
    # OpenAI
    "gpt-4-turbo": TokenPricing(input_per_1k=0.01, output_per_1k=0.03),
    "gpt-4": TokenPricing(input_per_1k=0.03, output_per_1k=0.06),
    "gpt-3.5-turbo": TokenPricing(input_per_1k=0.0005, output_per_1k=0.0015),
    # Anthropic
    "claude-3-opus": TokenPricing(input_per_1k=0.015, output_per_1k=0.075),
    "claude-3-sonnet": TokenPricing(input_per_1k=0.003, output_per_1k=0.015),
    "claude-3-haiku": TokenPricing(input_per_1k=0.00025, output_per_1k=0.00125),
    # Local (compute cost estimate)
    "local-7b": TokenPricing(input_per_1k=0.0001, output_per_1k=0.0003),
    "local-13b": TokenPricing(input_per_1k=0.0002, output_per_1k=0.0006),
    # Default for unknown models
    "default": TokenPricing(input_per_1k=0.001, output_per_1k=0.003),
}


@dataclass
class TokenUsage:
    """Token usage for a single request."""

    input_tokens: int
    output_tokens: int
    total_tokens: int

    @classmethod
    def from_response(cls, response: Dict[str, Any]) -> "TokenUsage":
        """Create TokenUsage from API response.

        Args:
            response: API response with usage info

        Returns:
            TokenUsage instance
        """
        usage = response.get("usage", {})
        return cls(
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        )


@dataclass
class CostRecord:
    """Record of cost for a single LLM call."""

    timestamp: str
    request_id: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_cost: float
    output_cost: float
    total_cost: float
    currency: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class CostTracker:
    """Tracks LLM usage costs across requests.

    Thread-safe cost accumulator for monitoring LLM expenses.
    """

    def __init__(self, custom_pricing: Optional[Dict[str, TokenPricing]] = None):
        """Initialize cost tracker.

        Args:
            custom_pricing: Optional custom pricing overrides
        """
        self._records: List[CostRecord] = []
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_cost = 0.0
        self._pricing = {**MODEL_PRICING, **(custom_pricing or {})}

    def get_pricing(self, model: str) -> TokenPricing:
        """Get pricing for a model.

        Args:
            model: Model name

        Returns:
            TokenPricing for the model
        """
        # Try exact match first
        if model in self._pricing:
            return self._pricing[model]

        # Try prefix match (e.g., "gpt-4-turbo-preview" -> "gpt-4-turbo")
        for known_model in self._pricing:
            if model.startswith(known_model):
                return self._pricing[known_model]

        # Default pricing
        return self._pricing["default"]

    def record_usage(
        self,
        model: str,
        provider: LLMProvider,
        input_tokens: int,
        output_tokens: int,
        request_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CostRecord:
        """Record token usage and calculate cost.

        Args:
            model: Model name
            provider: LLM provider
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            request_id: Optional request identifier
            metadata: Optional additional metadata

        Returns:
            CostRecord with calculated costs
        """
        pricing = self.get_pricing(model)

        input_cost = (input_tokens / 1000) * pricing.input_per_1k
        output_cost = (output_tokens / 1000) * pricing.output_per_1k
        total_cost = input_cost + output_cost

        record = CostRecord(
            timestamp=datetime.now(UTC).isoformat(),
            request_id=request_id,
            model=model,
            provider=provider.value,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            input_cost=input_cost,
            output_cost=output_cost,
            total_cost=total_cost,
            currency=pricing.currency,
            metadata=metadata or {},
        )

        self._records.append(record)
        self._total_input_tokens += input_tokens
        self._total_output_tokens += output_tokens
        self._total_cost += total_cost

        return record

    def record_from_response(
        self,
        model: str,
        provider: LLMProvider,
        response: Dict[str, Any],
        request_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CostRecord:
        """Record usage from API response.

        Args:
            model: Model name
            provider: LLM provider
            response: API response with usage info
            request_id: Optional request identifier
            metadata: Optional additional metadata

        Returns:
            CostRecord with calculated costs
        """
        usage = TokenUsage.from_response(response)
        return self.record_usage(
            model=model,
            provider=provider,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            request_id=request_id,
            metadata=metadata,
        )

    @property
    def total_cost(self) -> float:
        """Get total accumulated cost."""
        return self._total_cost

    @property
    def total_tokens(self) -> int:
        """Get total tokens used."""
        return self._total_input_tokens + self._total_output_tokens

    def get_summary(self) -> Dict[str, Any]:
        """Get usage summary.

        Returns:
            dict with usage statistics
        """
        return {
            "total_requests": len(self._records),
            "total_input_tokens": self._total_input_tokens,
            "total_output_tokens": self._total_output_tokens,
            "total_tokens": self.total_tokens,
            "total_cost": round(self._total_cost, 6),
            "currency": "USD",
            "by_model": self._get_by_model_summary(),
            "by_provider": self._get_by_provider_summary(),
        }

    def _get_by_model_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get usage summary grouped by model."""
        by_model: Dict[str, Dict[str, Any]] = {}

        for record in self._records:
            if record.model not in by_model:
                by_model[record.model] = {
                    "requests": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_cost": 0.0,
                }

            by_model[record.model]["requests"] += 1
            by_model[record.model]["input_tokens"] += record.input_tokens
            by_model[record.model]["output_tokens"] += record.output_tokens
            by_model[record.model]["total_cost"] += record.total_cost

        return by_model

    def _get_by_provider_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get usage summary grouped by provider."""
        by_provider: Dict[str, Dict[str, Any]] = {}

        for record in self._records:
            if record.provider not in by_provider:
                by_provider[record.provider] = {
                    "requests": 0,
                    "total_tokens": 0,
                    "total_cost": 0.0,
                }

            by_provider[record.provider]["requests"] += 1
            by_provider[record.provider]["total_tokens"] += record.total_tokens
            by_provider[record.provider]["total_cost"] += record.total_cost

        return by_provider

    def get_records(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent cost records.

        Args:
            limit: Maximum records to return

        Returns:
            List of record dicts
        """
        return [asdict(r) for r in self._records[-limit:]]

    def reset(self) -> None:
        """Reset all tracked costs."""
        self._records = []
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_cost = 0.0


# Global cost tracker instance
_cost_tracker: Optional[CostTracker] = None


def get_cost_tracker() -> CostTracker:
    """Get the global cost tracker instance.

    Returns:
        CostTracker instance
    """
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker()
    return _cost_tracker


def record_llm_usage(
    model: str,
    provider: LLMProvider,
    input_tokens: int,
    output_tokens: int,
    request_id: str = "",
) -> CostRecord:
    """Convenience function to record LLM usage.

    Args:
        model: Model name
        provider: LLM provider
        input_tokens: Input token count
        output_tokens: Output token count
        request_id: Optional request ID

    Returns:
        CostRecord
    """
    return get_cost_tracker().record_usage(
        model=model,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        request_id=request_id,
    )
