"""Cost Tracking module.

Implements cost accounting per Decision Lock:
- Daily budget: $50 max
- Track cost per day and per thread
- Target: >=80% tasks handled locally
"""

from datetime import date, datetime
from typing import Dict, Optional
from collections import defaultdict


class CostTracker:
    """Track LLM usage costs."""

    def __init__(self):
        """Initialize cost tracker."""
        self._daily_costs: Dict[str, float] = defaultdict(float)
        self._thread_costs: Dict[str, float] = defaultdict(float)
        self._local_count: int = 0
        self._cloud_count: int = 0
        self.daily_budget = 50.00

    def record_usage(
        self,
        thread_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost: Optional[float] = None,
    ) -> None:
        """Record LLM usage.

        Args:
            thread_id: Thread identifier
            model: Model used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cost: Explicit cost (if known)
        """
        today = str(date.today())

        # Calculate cost if not provided
        if cost is None:
            if "cloud" in model or "claude" in model:
                # Claude pricing estimate (per 1K tokens)
                cost = (input_tokens * 0.008 + output_tokens * 0.024) / 1000
                self._cloud_count += 1
            else:
                # Local model - no cost
                cost = 0.0
                self._local_count += 1

        self._daily_costs[today] += cost
        self._thread_costs[thread_id] += cost

    def get_daily_spend(self, day: Optional[str] = None) -> float:
        """Get spending for a specific day.

        Args:
            day: Date string (YYYY-MM-DD), defaults to today

        Returns:
            Total spend for the day
        """
        if day is None:
            day = str(date.today())
        return self._daily_costs.get(day, 0.0)

    def get_thread_costs(self) -> Dict[str, float]:
        """Get costs by thread.

        Returns:
            Dictionary mapping thread_id to cost
        """
        return dict(self._thread_costs)

    def get_local_count(self) -> int:
        """Get count of local model requests.

        Returns:
            Number of local model requests
        """
        return self._local_count

    def get_cloud_count(self) -> int:
        """Get count of cloud model requests.

        Returns:
            Number of cloud model requests
        """
        return self._cloud_count

    def get_local_percent(self) -> float:
        """Get percentage of requests handled locally.

        Returns:
            Percentage (0-100) of local requests
        """
        total = self._local_count + self._cloud_count
        if total == 0:
            return 100.0
        return (self._local_count / total) * 100

    def check_budget(self) -> bool:
        """Check if daily budget is exceeded.

        Returns:
            True if under budget, False if exceeded
        """
        return self.get_daily_spend() < self.daily_budget

    def get_budget_remaining(self) -> float:
        """Get remaining budget for today.

        Returns:
            Remaining budget amount
        """
        return self.daily_budget - self.get_daily_spend()


# Singleton instance
_tracker: Optional[CostTracker] = None


def get_cost_tracker() -> CostTracker:
    """Get the global cost tracker instance.

    Returns:
        CostTracker singleton
    """
    global _tracker
    if _tracker is None:
        _tracker = CostTracker()
    return _tracker
