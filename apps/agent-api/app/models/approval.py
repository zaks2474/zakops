"""Approval model for HITL (Human-in-the-Loop) workflow.

This module defines the approval persistence model for tracking
pending tool executions that require human approval before proceeding.
"""

from datetime import datetime, UTC
from enum import Enum, StrEnum
from typing import Optional

from sqlmodel import Field, Column
from sqlalchemy import (
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import BaseModel


class ApprovalStatus(StrEnum):
    """Status of an approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CLAIMED = "claimed"  # Tool execution claimed but not yet complete


class Approval(BaseModel, table=True):
    """Approval model for HITL workflow.

    Tracks pending tool executions that require human approval.
    Implements claim-first idempotency pattern.

    Attributes:
        id: Primary key (UUID format)
        thread_id: LangGraph thread ID for checkpoint correlation
        checkpoint_id: LangGraph checkpoint ID for resume
        tool_name: Name of the tool requiring approval
        tool_args: JSON-serialized tool arguments
        actor_id: ID of the actor (user/system) who initiated the request
        status: Current approval status
        idempotency_key: Unique key for claim-first pattern
        claimed_at: Timestamp when execution was claimed
        resolved_at: Timestamp when approved/rejected
        resolved_by: ID of user who approved/rejected
        rejection_reason: Optional reason for rejection
        expires_at: Expiration timestamp for pending approvals
        created_at: When the approval was created
    """

    __tablename__ = "approvals"

    id: str = Field(primary_key=True)
    thread_id: str = Field(index=True)
    checkpoint_id: Optional[str] = Field(default=None)
    tool_name: str = Field(index=True)
    tool_args: str = Field(sa_column=Column(Text))  # JSON serialized
    actor_id: str = Field(index=True)
    status: ApprovalStatus = Field(
        default=ApprovalStatus.PENDING,
        sa_column=Column(String(20), nullable=False),
    )
    idempotency_key: str = Field(unique=True, index=True)
    claimed_at: Optional[datetime] = Field(default=None)
    resolved_at: Optional[datetime] = Field(default=None)
    resolved_by: Optional[str] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)


class ToolExecution(BaseModel, table=True):
    """Tool execution log for idempotency tracking.

    Records all tool executions with their idempotency keys
    to prevent duplicate executions on resume.

    Attributes:
        id: Primary key (UUID format)
        approval_id: Foreign key to approval (if applicable)
        idempotency_key: Unique execution key
        tool_name: Name of the tool executed
        tool_args: JSON-serialized tool arguments
        result: JSON-serialized execution result
        success: Whether execution succeeded
        error_message: Error message if failed
        executed_at: When the tool was executed
        created_at: When the record was created
    """

    __tablename__ = "tool_executions"

    id: str = Field(primary_key=True)
    approval_id: Optional[str] = Field(default=None, index=True)
    idempotency_key: str = Field(unique=True, index=True)
    tool_name: str = Field(index=True)
    tool_args: str = Field(sa_column=Column(Text))  # JSON serialized
    result: Optional[str] = Field(default=None, sa_column=Column(Text))  # JSON serialized
    success: bool = Field(default=False)
    error_message: Optional[str] = Field(default=None)
    executed_at: Optional[datetime] = Field(default=None)


class AuditEventType(StrEnum):
    """Types of audit events for HITL workflow."""

    APPROVAL_CREATED = "approval_created"
    APPROVAL_CLAIMED = "approval_claimed"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    APPROVAL_EXPIRED = "approval_expired"
    TOOL_EXECUTION_STARTED = "tool_execution_started"
    TOOL_EXECUTION_COMPLETED = "tool_execution_completed"
    TOOL_EXECUTION_FAILED = "tool_execution_failed"
    STALE_CLAIM_RECLAIMED = "stale_claim_reclaimed"


class AuditLog(BaseModel, table=True):
    """Immutable audit trail for HITL workflow.

    Records all significant events for compliance and debugging.
    This table is append-only.

    Attributes:
        id: Primary key (UUID format)
        actor_id: ID of the actor who triggered the event
        event_type: Type of event (from AuditEventType enum)
        thread_id: LangGraph thread ID (if applicable)
        approval_id: Related approval ID (if applicable)
        tool_execution_id: Related tool execution ID (if applicable)
        payload: Additional event data as JSON
        created_at: When the event occurred
    """

    __tablename__ = "audit_log"

    id: str = Field(primary_key=True)
    actor_id: str = Field(index=True)
    event_type: AuditEventType = Field(sa_column=Column(String(100), nullable=False))
    thread_id: Optional[str] = Field(default=None, index=True)
    approval_id: Optional[str] = Field(default=None, index=True)
    tool_execution_id: Optional[str] = Field(default=None)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSONB))  # JSONB type matches SQL
