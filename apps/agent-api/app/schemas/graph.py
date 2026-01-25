"""This file contains the graph schema for the application."""

from typing import (
    Annotated,
    Any,
    Dict,
    List,
    Optional,
)

from langgraph.graph.message import add_messages
from pydantic import (
    BaseModel,
    Field,
)


class PendingToolCall(BaseModel):
    """Pending tool call awaiting approval.

    Attributes:
        tool_name: Name of the tool to execute
        tool_args: Arguments for the tool
        tool_call_id: The original tool call ID
        approval_id: ID of the approval record (if created)
    """

    tool_name: str = Field(..., description="Name of the tool")
    tool_args: Dict[str, Any] = Field(..., description="Tool arguments")
    tool_call_id: str = Field(..., description="Original tool call ID")
    approval_id: Optional[str] = Field(None, description="Approval record ID")


class GraphState(BaseModel):
    """State definition for the LangGraph Agent/Workflow.

    Extended to support HITL (Human-in-the-Loop) workflow with
    approval gates and pending tool calls.

    Attributes:
        messages: The messages in the conversation
        long_term_memory: The long term memory of the conversation
        pending_tool_calls: List of tool calls awaiting approval
        approval_status: Status of pending approval (pending, approved, rejected)
        actor_id: ID of the actor who initiated the request
        metadata: Additional metadata for tracing
    """

    messages: Annotated[list, add_messages] = Field(
        default_factory=list, description="The messages in the conversation"
    )
    long_term_memory: str = Field(default="", description="The long term memory of the conversation")

    # HITL fields
    pending_tool_calls: List[PendingToolCall] = Field(
        default_factory=list, description="Tool calls awaiting approval"
    )
    approval_status: Optional[str] = Field(
        None, description="Status of pending approval: pending, approved, rejected"
    )
    actor_id: Optional[str] = Field(None, description="ID of the actor")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
