"""Agent schemas for MDv2 request/response format.

This module defines the schemas for the agent API endpoints,
including the invoke request, approval responses, and HITL workflow models.
"""

from datetime import datetime
from enum import Enum
from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional,
)

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    ConfigDict,
)


class ApprovalStatus(str, Enum):
    """Status of an approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PendingApproval(BaseModel):
    """Pending approval information returned in invoke response.

    MDv2 Spec Compliant Schema:
        approval_id: Unique identifier for the approval request
        tool: Name of the tool requiring approval
        args: Arguments that will be passed to the tool
        permission_tier: Permission level (CRITICAL for HITL tools)
        requested_by: Actor who requested this action
        requested_at: When the approval was requested
    """

    approval_id: str = Field(..., description="Unique identifier for the approval")
    tool: str = Field(..., description="Name of the tool requiring approval")
    args: Dict[str, Any] = Field(..., description="Arguments for the tool")
    permission_tier: Literal["READ", "WRITE", "CRITICAL"] = Field(
        "CRITICAL", description="Permission tier of the tool"
    )
    requested_by: str = Field(..., description="Actor who requested this action")
    requested_at: datetime = Field(..., description="When the approval was requested")


class AgentInvokeRequest(BaseModel):
    """MDv2 request format for agent invocation.

    Attributes:
        actor_id: Identifier for the calling user/system
        message: The user's message/instruction
        thread_id: Optional thread ID for conversation continuity
        metadata: Optional metadata for tracing/logging
    """

    actor_id: str = Field(..., description="Identifier for the calling user/system")
    message: str = Field(..., description="The user's message/instruction", min_length=1, max_length=10000)
    thread_id: Optional[str] = Field(None, description="Thread ID for conversation continuity")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional metadata")

    @field_validator("actor_id")
    @classmethod
    def validate_actor_id(cls, v: str) -> str:
        """Validate actor_id is not empty."""
        if not v or not v.strip():
            raise ValueError("actor_id cannot be empty")
        return v.strip()


class ActionTaken(BaseModel):
    """Record of an action taken by the agent."""

    tool: str = Field(..., description="Tool name")
    result: Dict[str, Any] = Field(default_factory=dict, description="Tool result")


class AgentInvokeResponse(BaseModel):
    """MDv2 response format for agent invocation.

    Spec-compliant schema with:
        thread_id: Thread ID for this conversation
        status: Response status (completed, awaiting_approval, error)
        content: The agent's response message (optional)
        pending_approval: Approval information if HITL is triggered
        actions_taken: List of actions completed
        error: Error message if status is error
    """

    thread_id: str = Field(..., description="Thread ID for this conversation")
    status: Literal["completed", "awaiting_approval", "error"] = Field(..., description="Response status")
    content: Optional[str] = Field(None, description="Agent's response message")
    pending_approval: Optional[PendingApproval] = Field(None, description="Pending approval if HITL triggered")
    actions_taken: List[ActionTaken] = Field(default_factory=list, description="Actions completed by agent")
    error: Optional[str] = Field(None, description="Error message if status is error")


class ApprovalActionRequest(BaseModel):
    """Request for approving or rejecting an action.

    Attributes:
        actor_id: ID of the user performing the action
        reason: Optional reason (required for rejection)
    """

    actor_id: str = Field(..., description="ID of the user performing the action")
    reason: Optional[str] = Field(None, description="Reason for the action (required for rejection)")


class ApprovalActionResponse(BaseModel):
    """Response after approval/rejection action.

    Attributes:
        approval_id: The approval that was acted upon
        status: New status after action
        thread_id: Thread ID for resuming conversation
        response: Agent response after resumption (for approve)
        message: Status message
    """

    approval_id: str = Field(..., description="The approval ID")
    status: ApprovalStatus = Field(..., description="New status")
    thread_id: str = Field(..., description="Thread ID")
    response: Optional[str] = Field(None, description="Agent response after resumption")
    message: str = Field(..., description="Status message")


class ApprovalListResponse(BaseModel):
    """Response for listing pending approvals.

    Attributes:
        approvals: List of pending approvals
        total: Total count of pending approvals
    """

    approvals: List[PendingApproval] = Field(..., description="List of pending approvals")
    total: int = Field(..., description="Total count")


class ToolExecutionResult(BaseModel):
    """Result of a tool execution.

    Attributes:
        tool_name: Name of the tool that was executed
        success: Whether execution succeeded
        result: The execution result
        error: Error message if failed
        idempotency_key: The idempotency key used
    """

    tool_name: str = Field(..., description="Tool name")
    success: bool = Field(..., description="Success status")
    result: Optional[Any] = Field(None, description="Execution result")
    error: Optional[str] = Field(None, description="Error message")
    idempotency_key: str = Field(..., description="Idempotency key")


# Tools that require HITL approval
# SPIKE SCOPE: Only transition_deal requires approval
# Other tools will be added in Phase 1 after spike validation
HITL_TOOLS = frozenset([
    "transition_deal",
])


def requires_approval(tool_name: str) -> bool:
    """Check if a tool requires HITL approval.

    Args:
        tool_name: Name of the tool to check

    Returns:
        bool: True if the tool requires approval
    """
    return tool_name in HITL_TOOLS
