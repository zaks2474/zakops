from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from actions.engine.models import ActionError, ActionPayload, ArtifactMetadata


@dataclass(frozen=True)
class ExecutionContext:
    """
    Executor context.

    Keep this intentionally small and explicit: executors should not reach out to
    global singletons directly.
    """

    action: ActionPayload
    deal: dict[str, Any] | None = None
    case_file: dict[str, Any] | None = None
    tool_gateway: Any = None
    cloud_allowed: bool = False
    registry: Any = None


@dataclass(frozen=True)
class ExecutionResult:
    outputs: dict[str, Any] = field(default_factory=dict)
    artifacts: list[ArtifactMetadata] = field(default_factory=list)


class ActionExecutionError(RuntimeError):
    """Structured executor error that maps directly to ActionError."""

    def __init__(self, error: ActionError):
        super().__init__(error.message)
        self.error = error


class ActionExecutor:
    """Interface for action execution plugins."""

    action_type: str = ""

    def validate(self, payload: ActionPayload) -> tuple[bool, str | None]:
        return True, None

    def dry_run(self, payload: ActionPayload, ctx: ExecutionContext) -> ExecutionResult:
        raise ActionExecutionError(
            ActionError(
                code="dry_run_not_supported",
                message=f"Dry-run not supported for action type {payload.type}",
                category="validation",
                retryable=False,
            )
        )

    def estimate_cost(self, payload: ActionPayload, ctx: ExecutionContext) -> dict[str, Any]:
        return {"estimated_cost_usd": 0.0}

    def execute(self, payload: ActionPayload, ctx: ExecutionContext) -> ExecutionResult:
        raise NotImplementedError
