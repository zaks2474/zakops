"""Agent API endpoints for HITL workflow.

This module provides the MDv2-compliant agent endpoints including
invoke, approval, and rejection endpoints for the HITL spike.

SPIKE SCOPE: Only transition_deal requires approval.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, UTC
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, text

from app.core.config import settings
from app.core.idempotency import tool_idempotency_key
from app.core.langgraph.graph import LangGraphAgent
from app.core.limiter import limiter
from app.core.logging import logger
from app.core.security import get_agent_user, require_approve_role, AgentUser
from app.models.approval import Approval, ApprovalStatus, ToolExecution, AuditLog, AuditEventType
from app.schemas.agent import (
    AgentInvokeRequest,
    AgentInvokeResponse,
    ApprovalActionRequest,
    ApprovalActionResponse,
    ApprovalListResponse,
    PendingApproval,
    ActionTaken,
    ApprovalStatus as SchemaApprovalStatus,
)
from app.services.database import database_service

router = APIRouter()
agent = LangGraphAgent()

# Default approval timeout (1 hour)
APPROVAL_TIMEOUT_SECONDS = int(getattr(settings, 'HITL_APPROVAL_TIMEOUT_SECONDS', 3600))

# Stale claim timeout (5 minutes) - for recovering from kill -9 during claim
STALE_CLAIM_TIMEOUT_SECONDS = 300


def _write_audit_log(
    db: Session,
    event_type: AuditEventType,
    actor_id: str,
    thread_id: Optional[str] = None,
    approval_id: Optional[str] = None,
    tool_execution_id: Optional[str] = None,
    payload: Optional[dict] = None,
) -> None:
    """Write an audit log entry.

    Args:
        db: Database session
        event_type: Type of audit event
        actor_id: ID of the actor triggering the event
        thread_id: Related thread ID (optional)
        approval_id: Related approval ID (optional)
        tool_execution_id: Related tool execution ID (optional)
        payload: Additional event data (optional)
    """
    audit_entry = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=actor_id,
        event_type=event_type,
        thread_id=thread_id,
        approval_id=approval_id,
        tool_execution_id=tool_execution_id,
        payload=payload or {},
    )
    db.add(audit_entry)
    # Note: caller is responsible for commit


async def _reclaim_stale_approvals(db: Session) -> int:
    """Reclaim approvals stuck in 'claimed' status due to crashes.

    Returns:
        int: Number of approvals reclaimed
    """
    stale_threshold = datetime.now(UTC) - timedelta(seconds=STALE_CLAIM_TIMEOUT_SECONDS)

    result = db.exec(
        text("""
            UPDATE approvals
            SET status = 'pending', claimed_at = NULL
            WHERE status = 'claimed'
              AND claimed_at < :threshold
            RETURNING id
        """),
        params={"threshold": stale_threshold},
    )
    reclaimed = result.fetchall()

    if reclaimed:
        # Write audit log for each reclaimed approval
        for r in reclaimed:
            _write_audit_log(
                db=db,
                event_type=AuditEventType.STALE_CLAIM_RECLAIMED,
                actor_id="system",
                approval_id=r[0],
                payload={"stale_threshold_seconds": STALE_CLAIM_TIMEOUT_SECONDS},
            )
        db.commit()

        logger.warning(
            "reclaimed_stale_approvals",
            count=len(reclaimed),
            approval_ids=[r[0] for r in reclaimed],
        )

    return len(reclaimed)


@router.post("/invoke", response_model=AgentInvokeResponse)
@limiter.limit("50 per minute")
async def invoke_agent(
    request: Request,
    invoke_request: AgentInvokeRequest,
    user: Optional[AgentUser] = Depends(get_agent_user),
):
    """Invoke the agent with a message.

    This endpoint processes user messages through the LangGraph agent.
    If the agent attempts to use a tool that requires approval (HITL),
    it will return a pending_approval response instead of completing.

    SPIKE: Only transition_deal triggers HITL.

    Args:
        request: The FastAPI request object
        invoke_request: The MDv2 invoke request

    Returns:
        AgentInvokeResponse: The agent response or pending approval
    """
    try:
        # Generate or use provided thread_id
        thread_id = invoke_request.thread_id or str(uuid.uuid4())

        logger.info(
            "agent_invoke_started",
            actor_id=invoke_request.actor_id,
            thread_id=thread_id,
            message_length=len(invoke_request.message),
        )

        # Call the agent with HITL support
        result = await agent.invoke_with_hitl(
            message=invoke_request.message,
            thread_id=thread_id,
            actor_id=invoke_request.actor_id,
            metadata=invoke_request.metadata,
        )

        # Check if HITL was triggered (pending approval)
        if result.get("pending_approval"):
            pending = result["pending_approval"]
            return AgentInvokeResponse(
                thread_id=thread_id,
                status="awaiting_approval",
                content=None,
                pending_approval=PendingApproval(
                    approval_id=pending["approval_id"],
                    tool=pending["tool_name"],
                    args=pending["tool_args"],
                    permission_tier="CRITICAL",
                    requested_by=invoke_request.actor_id,
                    requested_at=pending.get("requested_at", datetime.now(UTC)),
                ),
                actions_taken=[],
                error=None,
            )

        # Normal completion
        actions = result.get("actions_taken", [])
        return AgentInvokeResponse(
            thread_id=thread_id,
            status="completed",
            content=result.get("response", ""),
            pending_approval=None,
            actions_taken=[ActionTaken(tool=a["tool"], result=a.get("result", {})) for a in actions],
            error=None,
        )

    except Exception as e:
        logger.error(
            "agent_invoke_failed",
            actor_id=invoke_request.actor_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/approvals/{approval_id}:approve", response_model=AgentInvokeResponse)
@limiter.limit("30 per minute")
async def approve_action(
    request: Request,
    approval_id: str,
    action_request: ApprovalActionRequest,
    user: Optional[AgentUser] = Depends(require_approve_role),
):
    """Approve a pending action and resume the agent.

    Uses atomic conditional update (WHERE status='pending') to ensure
    only one caller can claim the approval under concurrent requests.

    Returns MDv2-compliant AgentInvokeResponse with status="completed"
    after successful execution.

    Args:
        request: The FastAPI request object
        approval_id: The approval ID to approve
        action_request: The approval action request
        user: Authenticated user (when JWT enforcement is enabled)

    Returns:
        AgentInvokeResponse: MDv2-compliant response with completed status

    Raises:
        HTTPException: 404 if not found, 409 if already claimed/resolved
    """
    # Bind actor_id to JWT subject when enforcement is enabled (prevents spoofing)
    actor_id = user.subject if user else action_request.actor_id

    try:
        with database_service.get_session_maker() as db:
            # Reclaim any stale approvals first (crash recovery)
            await _reclaim_stale_approvals(db)

            # ATOMIC CLAIM: Single UPDATE with WHERE status='pending'
            # Only one concurrent caller can win this race
            result = db.exec(
                text("""
                    UPDATE approvals
                    SET status = 'claimed',
                        claimed_at = :claimed_at
                    WHERE id = :approval_id
                      AND status = 'pending'
                      AND (expires_at IS NULL OR expires_at > :now)
                    RETURNING id, thread_id, checkpoint_id, tool_name, tool_args, idempotency_key
                """),
                params={
                    "approval_id": approval_id,
                    "claimed_at": datetime.now(UTC),
                    "now": datetime.now(UTC),
                }
            )
            claimed = result.fetchone()

            if not claimed:
                # Check why claim failed
                approval = db.get(Approval, approval_id)
                if not approval:
                    raise HTTPException(status_code=404, detail="Approval not found")
                if approval.status == ApprovalStatus.EXPIRED or (
                    approval.expires_at and datetime.now(UTC) > approval.expires_at
                ):
                    # Update to expired if not already
                    approval.status = ApprovalStatus.EXPIRED
                    db.add(approval)
                    db.commit()
                    raise HTTPException(status_code=400, detail="Approval has expired")
                if approval.status in (ApprovalStatus.APPROVED, ApprovalStatus.REJECTED):
                    raise HTTPException(
                        status_code=409,
                        detail=f"Approval already resolved (status: {approval.status})"
                    )
                if approval.status == ApprovalStatus.CLAIMED:
                    raise HTTPException(
                        status_code=409,
                        detail="Approval already claimed by another request"
                    )
                raise HTTPException(status_code=400, detail="Cannot claim approval")

            db.commit()

            # Extract claimed data
            _, thread_id, checkpoint_id, tool_name, tool_args_json, idempotency_key = claimed
            tool_args = json.loads(tool_args_json)

            # Write audit log for claim
            _write_audit_log(
                db=db,
                event_type=AuditEventType.APPROVAL_CLAIMED,
                actor_id=actor_id,
                thread_id=thread_id,
                approval_id=approval_id,
                payload={"idempotency_key": idempotency_key, "tool_name": tool_name},
            )
            db.commit()

            logger.info(
                "approval_claimed_atomic",
                approval_id=approval_id,
                actor_id=actor_id,
                idempotency_key=idempotency_key,
            )

        # CLAIM-FIRST: Record tool execution BEFORE calling the tool
        with database_service.get_session_maker() as db:
            # Check if already executed (idempotency)
            existing = db.exec(
                select(ToolExecution).where(
                    ToolExecution.idempotency_key == idempotency_key,
                    ToolExecution.success.is_(True)
                )
            ).first()

            if existing:
                logger.info(
                    "tool_already_executed",
                    approval_id=approval_id,
                    execution_id=existing.id,
                )
                # Mark approval as approved and return cached result
                approval = db.get(Approval, approval_id)
                approval.status = ApprovalStatus.APPROVED
                approval.resolved_at = datetime.now(UTC)
                approval.resolved_by = actor_id
                db.add(approval)
                db.commit()

                # Return MDv2-compliant response
                return AgentInvokeResponse(
                    thread_id=thread_id,
                    status="completed",
                    content=existing.result,
                    pending_approval=None,
                    actions_taken=[ActionTaken(tool=tool_name, result={"ok": True, "cached": True})],
                    error=None,
                )

            # Create execution record BEFORE executing (claim-first)
            execution = ToolExecution(
                id=str(uuid.uuid4()),
                approval_id=approval_id,
                idempotency_key=idempotency_key,
                tool_name=tool_name,
                tool_args=tool_args_json,
                success=False,  # Will update after execution
                executed_at=datetime.now(UTC),
            )
            db.add(execution)
            db.commit()
            execution_id = execution.id

            # Write audit log for tool execution started
            _write_audit_log(
                db=db,
                event_type=AuditEventType.TOOL_EXECUTION_STARTED,
                actor_id=actor_id,
                thread_id=thread_id,
                approval_id=approval_id,
                tool_execution_id=execution_id,
                payload={"tool_name": tool_name, "idempotency_key": idempotency_key},
            )
            db.commit()

            logger.info(
                "tool_execution_claimed",
                execution_id=execution_id,
                idempotency_key=idempotency_key,
            )

        # Resume the agent from checkpoint
        try:
            result = await agent.resume_after_approval(
                thread_id=thread_id,
                checkpoint_id=checkpoint_id,
                tool_name=tool_name,
                tool_args=tool_args,
                approval_id=approval_id,
            )

            # Mark execution as successful
            with database_service.get_session_maker() as db:
                execution = db.get(ToolExecution, execution_id)
                execution.success = True
                execution.result = result.get("response")
                db.add(execution)

                # Mark approval as approved
                approval = db.get(Approval, approval_id)
                approval.status = ApprovalStatus.APPROVED
                approval.resolved_at = datetime.now(UTC)
                approval.resolved_by = actor_id
                db.add(approval)

                # Write audit logs for completion
                _write_audit_log(
                    db=db,
                    event_type=AuditEventType.TOOL_EXECUTION_COMPLETED,
                    actor_id=actor_id,
                    thread_id=thread_id,
                    approval_id=approval_id,
                    tool_execution_id=execution_id,
                    payload={"success": True},
                )
                _write_audit_log(
                    db=db,
                    event_type=AuditEventType.APPROVAL_APPROVED,
                    actor_id=actor_id,
                    thread_id=thread_id,
                    approval_id=approval_id,
                    payload={"resolved_by": actor_id},
                )
                db.commit()

            logger.info(
                "approval_approved",
                approval_id=approval_id,
                actor_id=actor_id,
                thread_id=thread_id,
                execution_id=execution_id,
            )

            # Return MDv2-compliant response with status="completed"
            return AgentInvokeResponse(
                thread_id=thread_id,
                status="completed",
                content=result.get("response"),
                pending_approval=None,
                actions_taken=[ActionTaken(tool=tool_name, result={"ok": True})],
                error=None,
            )

        except Exception as resume_error:
            # Mark execution as failed
            with database_service.get_session_maker() as db:
                execution = db.get(ToolExecution, execution_id)
                execution.success = False
                execution.error_message = str(resume_error)
                db.add(execution)

                # Rollback claim on failure (allow retry)
                approval = db.get(Approval, approval_id)
                approval.status = ApprovalStatus.PENDING
                approval.claimed_at = None
                db.add(approval)

                # Write audit log for failure
                _write_audit_log(
                    db=db,
                    event_type=AuditEventType.TOOL_EXECUTION_FAILED,
                    actor_id=actor_id,
                    thread_id=thread_id,
                    approval_id=approval_id,
                    tool_execution_id=execution_id,
                    payload={"error": str(resume_error), "rolled_back": True},
                )
                db.commit()

            logger.error(
                "approval_execution_failed",
                approval_id=approval_id,
                error=str(resume_error),
            )
            raise HTTPException(
                status_code=500,
                detail="An internal error occurred"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "approval_failed",
            approval_id=approval_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/approvals/{approval_id}:reject", response_model=AgentInvokeResponse)
@limiter.limit("30 per minute")
async def reject_action(
    request: Request,
    approval_id: str,
    action_request: ApprovalActionRequest,
    user: Optional[AgentUser] = Depends(require_approve_role),
):
    """Reject a pending action.

    Uses atomic conditional update to prevent race conditions.
    Returns MDv2-compliant AgentInvokeResponse.

    Args:
        request: The FastAPI request object
        approval_id: The approval ID to reject
        action_request: The rejection request (reason recommended)
        user: Authenticated user (when JWT enforcement is enabled)

    Returns:
        AgentInvokeResponse: MDv2-compliant response indicating rejection
    """
    # Bind actor_id to JWT subject when enforcement is enabled (prevents spoofing)
    actor_id = user.subject if user else action_request.actor_id

    try:
        with database_service.get_session_maker() as db:
            # ATOMIC REJECT: Single UPDATE with WHERE status='pending'
            result = db.exec(
                text("""
                    UPDATE approvals
                    SET status = 'rejected',
                        resolved_at = :resolved_at,
                        resolved_by = :resolved_by,
                        rejection_reason = :reason
                    WHERE id = :approval_id
                      AND status = 'pending'
                    RETURNING id, thread_id, checkpoint_id, tool_name
                """),
                params={
                    "approval_id": approval_id,
                    "resolved_at": datetime.now(UTC),
                    "resolved_by": actor_id,
                    "reason": action_request.reason or "No reason provided",
                }
            )
            rejected = result.fetchone()

            if not rejected:
                approval = db.get(Approval, approval_id)
                if not approval:
                    raise HTTPException(status_code=404, detail="Approval not found")
                raise HTTPException(
                    status_code=409,
                    detail=f"Cannot reject approval (status: {approval.status})"
                )

            # Write audit log for rejection
            _write_audit_log(
                db=db,
                event_type=AuditEventType.APPROVAL_REJECTED,
                actor_id=actor_id,
                thread_id=None,  # Will set after extraction
                approval_id=approval_id,
                payload={"reason": action_request.reason or "No reason provided"},
            )
            db.commit()

            _, thread_id, checkpoint_id, tool_name = rejected

            logger.info(
                "approval_rejected",
                approval_id=approval_id,
                actor_id=actor_id,
                reason=action_request.reason,
            )

            # Resume agent with rejection notice
            await agent.resume_after_rejection(
                thread_id=thread_id,
                checkpoint_id=checkpoint_id,
                tool_name=tool_name,
                rejection_reason=action_request.reason,
            )

            # Return MDv2-compliant response for rejection
            # Rejection is a completed state (the request was processed)
            rejection_message = f"Action rejected: {action_request.reason or 'No reason provided'}"
            return AgentInvokeResponse(
                thread_id=thread_id,
                status="completed",
                content=rejection_message,
                pending_approval=None,
                actions_taken=[],  # No actions taken since rejected
                error=None,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "rejection_failed",
            approval_id=approval_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/approvals", response_model=ApprovalListResponse)
@limiter.limit("60 per minute")
async def list_pending_approvals(
    request: Request,
    actor_id: Optional[str] = None,
    user: Optional[AgentUser] = Depends(get_agent_user),
):
    """List pending approvals.

    Args:
        request: The FastAPI request object
        actor_id: Optional filter by actor ID

    Returns:
        ApprovalListResponse: List of pending approvals
    """
    try:
        with database_service.get_session_maker() as db:
            # Reclaim stale approvals first
            await _reclaim_stale_approvals(db)

            statement = select(Approval).where(Approval.status == ApprovalStatus.PENDING)

            if actor_id:
                statement = statement.where(Approval.actor_id == actor_id)

            approvals = db.exec(statement).all()

            pending_list = [
                PendingApproval(
                    approval_id=a.id,
                    tool=a.tool_name,
                    args=json.loads(a.tool_args),
                    permission_tier="CRITICAL",
                    requested_by=a.actor_id,
                    requested_at=a.created_at or datetime.now(UTC),
                )
                for a in approvals
                if not a.expires_at or datetime.now(UTC) < a.expires_at
            ]

            return ApprovalListResponse(
                approvals=pending_list,
                total=len(pending_list),
            )

    except Exception as e:
        logger.error("list_approvals_failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/approvals/{approval_id}", response_model=PendingApproval)
@limiter.limit("60 per minute")
async def get_approval(
    request: Request,
    approval_id: str,
    user: Optional[AgentUser] = Depends(get_agent_user),
):
    """Get a specific approval by ID.

    Args:
        request: The FastAPI request object
        approval_id: The approval ID

    Returns:
        PendingApproval: The approval details
    """
    try:
        with database_service.get_session_maker() as db:
            approval = db.get(Approval, approval_id)
            if not approval:
                raise HTTPException(status_code=404, detail="Approval not found")

            return PendingApproval(
                approval_id=approval.id,
                tool=approval.tool_name,
                args=json.loads(approval.tool_args),
                permission_tier="CRITICAL",
                requested_by=approval.actor_id,
                requested_at=approval.created_at or datetime.now(UTC),
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_approval_failed", approval_id=approval_id, error=str(e))
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ============================================================================
# Thread State Endpoint (MDv2 Spec Compliant)
# ============================================================================

class ThreadStateResponse(BaseModel):
    """Thread state response per MDv2 spec."""
    thread_id: str
    status: str
    pending_approval: Optional[PendingApproval] = None


@router.get("/threads/{thread_id}/state", response_model=ThreadStateResponse)
@limiter.limit("60 per minute")
async def get_thread_state(
    request: Request,
    thread_id: str,
    user: Optional[AgentUser] = Depends(get_agent_user),
):
    """Get the current state of a thread.

    Used to check if a thread has pending approvals or has completed.

    Args:
        request: The FastAPI request object
        thread_id: The thread ID to check

    Returns:
        ThreadStateResponse: Current thread state
    """
    try:
        with database_service.get_session_maker() as db:
            # Check for pending approvals on this thread
            approval = db.exec(
                select(Approval).where(
                    Approval.thread_id == thread_id,
                    Approval.status.in_([ApprovalStatus.PENDING, ApprovalStatus.CLAIMED])
                )
            ).first()

            if approval:
                pending = PendingApproval(
                    approval_id=approval.id,
                    tool=approval.tool_name,
                    args=json.loads(approval.tool_args),
                    permission_tier="CRITICAL",
                    requested_by=approval.actor_id,
                    requested_at=approval.created_at or datetime.now(UTC),
                )
                return ThreadStateResponse(
                    thread_id=thread_id,
                    status="awaiting_approval",
                    pending_approval=pending,
                )

            # No pending approval - check if thread exists via checkpoint
            # For now, return completed status
            return ThreadStateResponse(
                thread_id=thread_id,
                status="completed",
                pending_approval=None,
            )

    except Exception as e:
        logger.error("get_thread_state_failed", thread_id=thread_id, error=str(e))
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ============================================================================
# Streaming Endpoint (MDv2 Spec Compliant)
# ============================================================================


@router.post("/invoke/stream")
@limiter.limit("30 per minute")
async def invoke_agent_stream(
    request: Request,
    invoke_request: AgentInvokeRequest,
    user: Optional[AgentUser] = Depends(get_agent_user),
):
    """Stream agent invocation responses via SSE.

    This endpoint processes user messages through the LangGraph agent
    and streams incremental responses as Server-Sent Events.

    SPIKE STATUS: Basic implementation - returns events for start/content/end.
    Full streaming integration with LangGraph pending Phase 2.

    Args:
        request: The FastAPI request object
        invoke_request: The MDv2 invoke request

    Returns:
        StreamingResponse: SSE stream of agent events
    """
    thread_id = invoke_request.thread_id or str(uuid.uuid4())

    async def event_generator():
        """Generate SSE events for the agent response."""
        try:
            # Send start event
            yield f"event: start\ndata: {{\"thread_id\": \"{thread_id}\"}}\n\n"

            # Call the agent with HITL support
            result = await agent.invoke_with_hitl(
                message=invoke_request.message,
                thread_id=thread_id,
                actor_id=invoke_request.actor_id,
                metadata=invoke_request.metadata,
            )

            # Check if HITL was triggered
            if result.get("pending_approval"):
                pending = result["pending_approval"]
                approval_data = {
                    "approval_id": pending["approval_id"],
                    "tool": pending["tool_name"],
                    "args": pending["tool_args"],
                    "permission_tier": "CRITICAL",
                    "requested_by": invoke_request.actor_id,
                }
                yield f"event: awaiting_approval\ndata: {json.dumps(approval_data)}\n\n"
            else:
                # Stream content (for now, send as single chunk)
                content = result.get("response", "")
                if content:
                    yield f"event: content\ndata: {json.dumps({'content': content})}\n\n"

            # Send end event with status
            status = "awaiting_approval" if result.get("pending_approval") else "completed"
            yield f"event: end\ndata: {{\"status\": \"{status}\", \"thread_id\": \"{thread_id}\"}}\n\n"

        except Exception as e:
            logger.error(
                "agent_stream_failed",
                actor_id=invoke_request.actor_id,
                error=str(e),
            )
            yield f"event: error\ndata: {{\"error\": \"An internal error occurred\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
