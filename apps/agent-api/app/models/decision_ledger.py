"""Decision Ledger model for agent reasoning traceability.

R3 REMEDIATION [P2.6]: Decision ledger captures tool selection reasoning
for explainability and audit purposes.
"""

from datetime import datetime, UTC
from typing import Optional, List
from enum import StrEnum

from sqlmodel import Field, Column
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

from app.models.base import BaseModel


class TriggerType(StrEnum):
    """Type of trigger that initiated the decision."""

    USER_MESSAGE = "user_message"
    TOOL_RESULT = "tool_result"
    SYSTEM_PROMPT = "system_prompt"
    HITL_RESUME = "hitl_resume"


class DecisionLedgerEntry(BaseModel, table=True):
    """Decision ledger entry for agent reasoning traceability.

    R3 REMEDIATION [P2.6]: Captures every tool selection decision with
    full context for explainability, debugging, and audit.

    Attributes:
        id: Primary key (UUID format)
        correlation_id: End-to-end trace ID for request correlation
        thread_id: LangGraph thread ID
        user_id: ID of the user who triggered the request
        deal_id: ID of the deal being operated on (if applicable)

        trigger_type: What triggered this decision (user message, tool result, etc.)
        trigger_content: The content that triggered the decision (truncated)
        prompt_version: Version of the system prompt used

        tools_considered: List of tools that were candidates
        tool_selected: Name of the tool that was selected (or null if no tool)
        selection_reason: LLM's reasoning for the tool selection (if extractable)

        tool_name: Final tool name executed
        tool_args: JSON-serialized tool arguments
        tool_result_preview: Truncated result for quick inspection

        hitl_required: Whether HITL approval was required
        approval_id: Foreign key to approval (if HITL required)
        approval_status: Final approval status

        success: Whether the decision/execution succeeded
        error: Error message if failed
        response_preview: Truncated LLM response to user

        latency_ms: Time from trigger to completion
        token_count: Estimated tokens used for this turn
        created_at: When the decision was made
    """

    __tablename__ = "decision_ledger"

    id: str = Field(primary_key=True)
    correlation_id: Optional[str] = Field(default=None, index=True)
    thread_id: str = Field(index=True)
    user_id: str = Field(index=True)
    deal_id: Optional[str] = Field(default=None, index=True)

    # Trigger context
    trigger_type: TriggerType = Field(
        sa_column=Column(String(50), nullable=False)
    )
    trigger_content: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Truncated trigger content (max 500 chars)"
    )
    prompt_version: Optional[str] = Field(default=None)

    # Tool selection
    tools_considered: Optional[List[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(String)),
        description="Tools that were candidates for selection"
    )
    tool_selected: Optional[str] = Field(
        default=None,
        index=True,
        description="Tool that was selected (null if no tool call)"
    )
    selection_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="LLM reasoning for tool selection"
    )

    # Execution details
    tool_name: Optional[str] = Field(default=None, index=True)
    tool_args: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="JSON-serialized tool arguments"
    )
    tool_result_preview: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Truncated result (max 500 chars)"
    )

    # HITL tracking
    hitl_required: bool = Field(default=False)
    approval_id: Optional[str] = Field(default=None, index=True)
    approval_status: Optional[str] = Field(default=None)

    # Outcome
    success: bool = Field(default=True)
    error: Optional[str] = Field(default=None, sa_column=Column(Text))
    response_preview: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Truncated LLM response (max 500 chars)"
    )

    # Metrics
    latency_ms: Optional[int] = Field(default=None)
    token_count: Optional[int] = Field(default=None)


class DecisionLedgerService:
    """Service for writing decision ledger entries.

    R3 REMEDIATION [P2.6]: Provides async-safe writes to decision ledger.
    """

    MAX_CONTENT_LENGTH = 500

    @classmethod
    def _truncate(cls, content: Optional[str]) -> Optional[str]:
        """Truncate content to max length."""
        if content is None:
            return None
        if len(content) <= cls.MAX_CONTENT_LENGTH:
            return content
        return content[:cls.MAX_CONTENT_LENGTH - 3] + "..."

    @classmethod
    async def log_decision(
        cls,
        session,
        *,
        decision_id: str,
        correlation_id: Optional[str],
        thread_id: str,
        user_id: str,
        deal_id: Optional[str] = None,
        trigger_type: TriggerType,
        trigger_content: Optional[str] = None,
        prompt_version: Optional[str] = None,
        tools_considered: Optional[List[str]] = None,
        tool_selected: Optional[str] = None,
        selection_reason: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_args: Optional[str] = None,
        tool_result_preview: Optional[str] = None,
        hitl_required: bool = False,
        approval_id: Optional[str] = None,
        approval_status: Optional[str] = None,
        success: bool = True,
        error: Optional[str] = None,
        response_preview: Optional[str] = None,
        latency_ms: Optional[int] = None,
        token_count: Optional[int] = None,
    ) -> DecisionLedgerEntry:
        """Log a decision ledger entry.

        Args:
            session: SQLAlchemy async session
            decision_id: Unique ID for this decision
            correlation_id: End-to-end trace ID
            thread_id: LangGraph thread ID
            user_id: User who triggered the request
            deal_id: Deal being operated on (if applicable)
            trigger_type: What triggered this decision
            trigger_content: Content that triggered (will be truncated)
            prompt_version: Version of system prompt
            tools_considered: List of candidate tools
            tool_selected: Tool that was selected
            selection_reason: LLM's reasoning
            tool_name: Final tool executed
            tool_args: Tool arguments as JSON string
            tool_result_preview: Result preview (will be truncated)
            hitl_required: Whether HITL was required
            approval_id: Approval ID if HITL
            approval_status: Final approval status
            success: Whether succeeded
            error: Error message if failed
            response_preview: LLM response (will be truncated)
            latency_ms: Latency in milliseconds
            token_count: Estimated token usage

        Returns:
            The created DecisionLedgerEntry
        """
        entry = DecisionLedgerEntry(
            id=decision_id,
            correlation_id=correlation_id,
            thread_id=thread_id,
            user_id=user_id,
            deal_id=deal_id,
            trigger_type=trigger_type,
            trigger_content=cls._truncate(trigger_content),
            prompt_version=prompt_version,
            tools_considered=tools_considered,
            tool_selected=tool_selected,
            selection_reason=cls._truncate(selection_reason),
            tool_name=tool_name,
            tool_args=tool_args,
            tool_result_preview=cls._truncate(tool_result_preview),
            hitl_required=hitl_required,
            approval_id=approval_id,
            approval_status=approval_status,
            success=success,
            error=cls._truncate(error),
            response_preview=cls._truncate(response_preview),
            latency_ms=latency_ms,
            token_count=token_count,
        )

        session.add(entry)
        await session.commit()
        await session.refresh(entry)

        return entry

    @classmethod
    def log_decision_sync(
        cls,
        session,
        *,
        decision_id: str,
        correlation_id: Optional[str],
        thread_id: str,
        user_id: str,
        deal_id: Optional[str] = None,
        trigger_type: TriggerType,
        trigger_content: Optional[str] = None,
        prompt_version: Optional[str] = None,
        tools_considered: Optional[List[str]] = None,
        tool_selected: Optional[str] = None,
        selection_reason: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_args: Optional[str] = None,
        tool_result_preview: Optional[str] = None,
        hitl_required: bool = False,
        approval_id: Optional[str] = None,
        approval_status: Optional[str] = None,
        success: bool = True,
        error: Optional[str] = None,
        response_preview: Optional[str] = None,
        latency_ms: Optional[int] = None,
        token_count: Optional[int] = None,
    ) -> DecisionLedgerEntry:
        """Synchronous version of log_decision for use with sync sessions.

        R3 REMEDIATION [P2.6/D-7]: Provides sync writes for existing sync DB infra.
        """
        entry = DecisionLedgerEntry(
            id=decision_id,
            correlation_id=correlation_id,
            thread_id=thread_id,
            user_id=user_id,
            deal_id=deal_id,
            trigger_type=trigger_type,
            trigger_content=cls._truncate(trigger_content),
            prompt_version=prompt_version,
            tools_considered=tools_considered,
            tool_selected=tool_selected,
            selection_reason=cls._truncate(selection_reason),
            tool_name=tool_name,
            tool_args=tool_args,
            tool_result_preview=cls._truncate(tool_result_preview),
            hitl_required=hitl_required,
            approval_id=approval_id,
            approval_status=approval_status,
            success=success,
            error=cls._truncate(error),
            response_preview=cls._truncate(response_preview),
            latency_ms=latency_ms,
            token_count=token_count,
        )

        session.add(entry)
        session.commit()
        session.refresh(entry)

        return entry
