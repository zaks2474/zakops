"""Tests for token cost tracking.

Verifies that cost tracking correctly calculates and accumulates
LLM usage costs.
"""

import pytest
from app.core.telemetry.cost_tracking import (
    CostTracker,
    LLMProvider,
    TokenPricing,
    TokenUsage,
    MODEL_PRICING,
    record_llm_usage,
    get_cost_tracker,
)


class TestTokenUsage:
    """Test TokenUsage dataclass."""

    def test_from_response_openai_format(self):
        """Parse OpenAI response format."""
        response = {
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150,
            }
        }

        usage = TokenUsage.from_response(response)

        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.total_tokens == 150

    def test_from_response_missing_usage(self):
        """Handle missing usage data gracefully."""
        response = {}

        usage = TokenUsage.from_response(response)

        assert usage.input_tokens == 0
        assert usage.output_tokens == 0
        assert usage.total_tokens == 0


class TestTokenPricing:
    """Test token pricing configuration."""

    def test_known_models_have_pricing(self):
        """Verify pricing exists for common models."""
        expected_models = [
            "gpt-4-turbo",
            "gpt-3.5-turbo",
            "claude-3-sonnet",
        ]

        for model in expected_models:
            assert model in MODEL_PRICING
            pricing = MODEL_PRICING[model]
            assert pricing.input_per_1k > 0
            assert pricing.output_per_1k > 0

    def test_default_pricing_exists(self):
        """Default pricing should exist for unknown models."""
        assert "default" in MODEL_PRICING


class TestCostTracker:
    """Test CostTracker functionality."""

    def test_record_usage_calculates_cost(self):
        """Recording usage should calculate correct cost."""
        tracker = CostTracker()

        record = tracker.record_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=1000,
            output_tokens=500,
            request_id="test-1",
        )

        # gpt-3.5-turbo: $0.0005/1K input, $0.0015/1K output
        expected_input_cost = (1000 / 1000) * 0.0005  # $0.0005
        expected_output_cost = (500 / 1000) * 0.0015  # $0.00075

        assert record.input_cost == pytest.approx(expected_input_cost)
        assert record.output_cost == pytest.approx(expected_output_cost)
        assert record.total_cost == pytest.approx(expected_input_cost + expected_output_cost)

    def test_accumulates_total_cost(self):
        """Total cost should accumulate across requests."""
        tracker = CostTracker()

        tracker.record_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=1000,
            output_tokens=500,
        )

        tracker.record_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=1000,
            output_tokens=500,
        )

        # Two identical requests = 2x cost
        single_cost = (1000 / 1000) * 0.0005 + (500 / 1000) * 0.0015
        assert tracker.total_cost == pytest.approx(single_cost * 2)

    def test_accumulates_total_tokens(self):
        """Total tokens should accumulate."""
        tracker = CostTracker()

        tracker.record_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=100,
            output_tokens=50,
        )

        tracker.record_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=200,
            output_tokens=100,
        )

        assert tracker.total_tokens == 450  # 100+50+200+100

    def test_get_summary(self):
        """Summary should include all statistics."""
        tracker = CostTracker()

        tracker.record_usage(
            model="gpt-4-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=500,
            output_tokens=200,
        )

        summary = tracker.get_summary()

        assert summary["total_requests"] == 1
        assert summary["total_input_tokens"] == 500
        assert summary["total_output_tokens"] == 200
        assert summary["total_cost"] > 0
        assert "by_model" in summary
        assert "gpt-4-turbo" in summary["by_model"]

    def test_by_provider_summary(self):
        """Summary should group by provider."""
        tracker = CostTracker()

        tracker.record_usage(
            model="gpt-4-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=100,
            output_tokens=50,
        )

        tracker.record_usage(
            model="claude-3-sonnet",
            provider=LLMProvider.ANTHROPIC,
            input_tokens=100,
            output_tokens=50,
        )

        summary = tracker.get_summary()

        assert "openai" in summary["by_provider"]
        assert "anthropic" in summary["by_provider"]
        assert summary["by_provider"]["openai"]["requests"] == 1
        assert summary["by_provider"]["anthropic"]["requests"] == 1

    def test_unknown_model_uses_default_pricing(self):
        """Unknown models should use default pricing."""
        tracker = CostTracker()

        record = tracker.record_usage(
            model="some-unknown-model",
            provider=LLMProvider.LOCAL,
            input_tokens=1000,
            output_tokens=1000,
        )

        # Should use default pricing
        default_pricing = MODEL_PRICING["default"]
        expected_cost = (
            (1000 / 1000) * default_pricing.input_per_1k
            + (1000 / 1000) * default_pricing.output_per_1k
        )
        assert record.total_cost == pytest.approx(expected_cost)

    def test_custom_pricing(self):
        """Custom pricing should override defaults."""
        custom = {
            "my-model": TokenPricing(input_per_1k=0.1, output_per_1k=0.2),
        }
        tracker = CostTracker(custom_pricing=custom)

        record = tracker.record_usage(
            model="my-model",
            provider=LLMProvider.LOCAL,
            input_tokens=1000,
            output_tokens=1000,
        )

        expected_cost = 0.1 + 0.2  # 1K tokens each
        assert record.total_cost == pytest.approx(expected_cost)

    def test_reset(self):
        """Reset should clear all accumulated data."""
        tracker = CostTracker()

        tracker.record_usage(
            model="gpt-4-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=1000,
            output_tokens=500,
        )

        assert tracker.total_cost > 0
        assert tracker.total_tokens > 0

        tracker.reset()

        assert tracker.total_cost == 0
        assert tracker.total_tokens == 0
        assert len(tracker.get_records()) == 0

    def test_get_records(self):
        """Get records should return recent records."""
        tracker = CostTracker()

        for i in range(5):
            tracker.record_usage(
                model="gpt-3.5-turbo",
                provider=LLMProvider.OPENAI,
                input_tokens=100,
                output_tokens=50,
                request_id=f"req-{i}",
            )

        records = tracker.get_records(limit=3)

        assert len(records) == 3
        # Should be most recent
        assert records[-1]["request_id"] == "req-4"

    def test_record_from_response(self):
        """Record from API response format."""
        tracker = CostTracker()

        response = {
            "usage": {
                "prompt_tokens": 150,
                "completion_tokens": 75,
                "total_tokens": 225,
            }
        }

        record = tracker.record_from_response(
            model="gpt-4-turbo",
            provider=LLMProvider.OPENAI,
            response=response,
            request_id="test-response",
        )

        assert record.input_tokens == 150
        assert record.output_tokens == 75
        assert record.total_cost > 0


class TestGlobalCostTracker:
    """Test global cost tracker functions."""

    def test_get_cost_tracker_singleton(self):
        """get_cost_tracker should return same instance."""
        tracker1 = get_cost_tracker()
        tracker2 = get_cost_tracker()

        assert tracker1 is tracker2

    def test_record_llm_usage_convenience(self):
        """Convenience function should work."""
        # Reset tracker for clean test
        get_cost_tracker().reset()

        record = record_llm_usage(
            model="gpt-3.5-turbo",
            provider=LLMProvider.OPENAI,
            input_tokens=100,
            output_tokens=50,
            request_id="convenience-test",
        )

        assert record.total_cost > 0
        assert get_cost_tracker().total_tokens == 150


class TestLLMProvider:
    """Test LLMProvider enum."""

    def test_provider_values(self):
        """Verify provider string values."""
        assert LLMProvider.OPENAI.value == "openai"
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        assert LLMProvider.VLLM.value == "vllm"
        assert LLMProvider.LOCAL.value == "local"
