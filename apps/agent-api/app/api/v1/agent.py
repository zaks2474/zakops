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
from app.core.security import (
    get_agent_user,
    require_approve_role,
    AgentUser,
    # F-001/F-002 remediation: use service token auth for /agent/* endpoints
    ServiceUser,
    get_service_token_user,
    require_service_token,
)
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
    user: ServiceUser = Depends(require_service_token),
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
    user: ServiceUser = Depends(require_service_token),
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
    # F-001/F-002: With service token auth, trust the actor_id from the request
    # The dashboard is a trusted internal service that passes the UI user's identity
    actor_id = action_request.actor_id

    try:
        with database_service.get_session_maker() as db:
            # Reclaim any stale approvals first (crash recovery)
            await _reclaim_stale_approvals(db)

            # UF-003: Ownership check — verify request actor matches approval actor
            pre_check = db.get(Approval, approval_id)
            if pre_check and actor_id and pre_check.actor_id != actor_id:
                raise HTTPException(status_code=403, detail="Insufficient permissions")

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
                    # F003-P2-001: Lazy expiry enforcement - mark as expired and return 410
                    if approval.status != ApprovalStatus.EXPIRED:
                        approval.status = ApprovalStatus.EXPIRED
                        db.add(approval)
                        _write_audit_log(
                            db=db,
                            event_type=AuditEventType.APPROVAL_EXPIRED,
                            actor_id=actor_id,
                            thread_id=approval.thread_id,
                            approval_id=approval_id,
                            payload={"expires_at": approval.expires_at.isoformat() if approval.expires_at else None},
                        )
                        db.commit()
                    raise HTTPException(status_code=410, detail="Approval has expired")
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

            # Extract execution status and tool result (No-Illusions Gate)
            tool_executed = result.get("tool_executed", False)
            tool_result = result.get("tool_result")

            # Determine actual success based on tool execution (RT-A.1)
            actual_success = tool_executed and tool_result is not None
            if tool_result and isinstance(tool_result, dict):
                # Check if tool itself reported failure
                actual_success = actual_success and tool_result.get("ok", True)

            # Mark execution with ACTUAL status (not assumed success)
            with database_service.get_session_maker() as db:
                execution = db.get(ToolExecution, execution_id)
                execution.success = actual_success
                execution.result = json.dumps(tool_result) if tool_result else result.get("response")
                db.add(execution)

                # Mark approval as approved
                approval = db.get(Approval, approval_id)
                approval.status = ApprovalStatus.APPROVED
                approval.resolved_at = datetime.now(UTC)
                approval.resolved_by = actor_id
                db.add(approval)

                # Write audit logs for completion with actual status
                _write_audit_log(
                    db=db,
                    event_type=AuditEventType.TOOL_EXECUTION_COMPLETED,
                    actor_id=actor_id,
                    thread_id=thread_id,
                    approval_id=approval_id,
                    tool_execution_id=execution_id,
                    payload={"success": actual_success, "tool_executed": tool_executed},
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
                tool_executed=tool_executed,
                actual_success=actual_success,
            )

            # Return MDv2-compliant response with ACTUAL tool result (not hardcoded)
            return AgentInvokeResponse(
                thread_id=thread_id,
                status="completed",
                content=result.get("response"),
                pending_approval=None,
                actions_taken=[ActionTaken(tool=tool_name, result=tool_result or {"ok": actual_success})],
                error=None if actual_success else "Tool execution did not complete",
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
    user: ServiceUser = Depends(require_service_token),
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
    # F-001/F-002: With service token auth, trust the actor_id from the request
    actor_id = action_request.actor_id

    try:
        with database_service.get_session_maker() as db:
            # UF-003: Ownership check — verify request actor matches approval actor
            pre_check = db.get(Approval, approval_id)
            if pre_check and actor_id and pre_check.actor_id != actor_id:
                raise HTTPException(status_code=403, detail="Insufficient permissions")

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

            # F-006 FIX: Extract values BEFORE writing audit log
            _, thread_id, checkpoint_id, tool_name = rejected

            # Write audit log for rejection with proper thread_id
            _write_audit_log(
                db=db,
                event_type=AuditEventType.APPROVAL_REJECTED,
                actor_id=actor_id,
                thread_id=thread_id,  # F-006: Include thread_id for traceability
                approval_id=approval_id,
                payload={
                    "reason": action_request.reason or "No reason provided",
                    "tool_name": tool_name,
                },
            )
            db.commit()

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
    user: ServiceUser = Depends(require_service_token),
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

            # F003-P2-001: Lazy expiry - mark expired approvals before listing
            now = datetime.now(UTC)
            expired_count = db.exec(
                text("""
                    UPDATE approvals
                    SET status = 'expired'
                    WHERE status = 'pending'
                      AND expires_at IS NOT NULL
                      AND expires_at < :now
                """),
                params={"now": now}
            )
            if expired_count.rowcount > 0:
                logger.info("lazy_expiry_cleanup", expired_count=expired_count.rowcount)
                db.commit()

            statement = select(Approval).where(Approval.status == ApprovalStatus.PENDING)

            # Filter by actor_id if provided (optional — dashboard can see all pending approvals)
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
                # Double-check expiry (should all be valid after cleanup, but belt-and-suspenders)
                if not a.expires_at or now < a.expires_at
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
    user: ServiceUser = Depends(require_service_token),
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

            # F-001/F-002: Dashboard service token has full visibility to all approvals

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
    user: ServiceUser = Depends(require_service_token),
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
            thread_query = select(Approval).where(
                Approval.thread_id == thread_id,
                Approval.status.in_([ApprovalStatus.PENDING, ApprovalStatus.CLAIMED])
            )
            # F-001/F-002: Dashboard service token has full visibility
            approval = db.exec(thread_query).first()

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
    user: ServiceUser = Depends(require_service_token),
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


# ============================================================================
# Activity Endpoint (RT-ACT-1 Compliant)
# F003-P1-001 + F003-CL-003 Remediation
# ============================================================================


class ActivityEvent(BaseModel):
    """Single activity event from audit_log."""
    id: str
    event_type: str
    label: str  # Human-readable label
    timestamp: str  # ISO format
    thread_id: Optional[str] = None
    approval_id: Optional[str] = None
    tool_execution_id: Optional[str] = None
    tool_name: Optional[str] = None


class ActivityStats(BaseModel):
    """Aggregated activity stats."""
    total_events: int
    approvals_today: int
    tool_executions_today: int
    events_last_24h: int


class ActivityResponse(BaseModel):
    """Activity endpoint response with pagination."""
    events: list[ActivityEvent]
    stats: ActivityStats
    pagination: dict  # {limit, offset, total, has_more}


def _event_to_label(event_type: str, payload: dict) -> str:
    """Generate human-readable label from event type and payload.

    RT-ACT-1: Labels are generated server-side for consistency.
    """
    labels = {
        "approval_created": "Approval requested",
        "approval_claimed": "Approval processing started",
        "approval_approved": "Approval granted",
        "approval_rejected": "Approval rejected",
        "approval_expired": "Approval expired",
        "tool_execution_started": "Tool execution started",
        "tool_execution_completed": "Tool execution completed",
        "tool_execution_failed": "Tool execution failed",
        "stale_claim_reclaimed": "Stale claim recovered",
    }
    base_label = labels.get(event_type, event_type.replace("_", " ").title())

    # Add tool name if present
    tool_name = payload.get("tool_name")
    if tool_name:
        base_label = f"{base_label}: {tool_name}"

    return base_label


def _redact_payload(payload: dict) -> Optional[str]:
    """Extract safe tool_name from payload, redact sensitive data.

    RT-ACT-1: Never return raw payloads, tokens, or full error stacks.
    """
    return payload.get("tool_name")


@router.get("/activity", response_model=ActivityResponse)
@limiter.limit("60 per minute")
async def get_activity(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    user: ServiceUser = Depends(require_service_token),
):
    """Get agent activity feed from audit_log.

    F003-P1-001 + F003-CL-003 Remediation: Wires activity endpoint to real audit_log data.

    RT-ACT-1 Specs:
    - Pagination: limit/offset with default limit=50
    - Ordering: newest-first (created_at DESC, id DESC)
    - Redaction: Only safe fields returned (no raw payloads/tokens)
    - Correlation: Each event has at least one correlation key

    Args:
        request: The FastAPI request object
        limit: Max events to return (default 50, max 100)
        offset: Number of events to skip

    Returns:
        ActivityResponse: Paginated activity events with stats
    """
    # Clamp limit to reasonable bounds
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    try:
        with database_service.get_session_maker() as db:
            # Query audit_log with pagination and deterministic ordering
            # RT-ACT-1: ORDER BY created_at DESC, id DESC for stable tie-break
            query = text("""
                SELECT id, event_type, created_at, thread_id, approval_id,
                       tool_execution_id, payload
                FROM audit_log
                ORDER BY created_at DESC, id DESC
                LIMIT :limit OFFSET :offset
            """)

            result = db.exec(query, params={"limit": limit, "offset": offset})
            rows = result.fetchall()

            # Get total count for pagination
            count_query = text("SELECT COUNT(*) FROM audit_log")
            total = db.exec(count_query).scalar() or 0

            # Get stats (events in last 24h, approvals today, tool executions today)
            stats_query = text("""
                SELECT
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as events_24h,
                    COUNT(*) FILTER (
                        WHERE event_type LIKE 'approval_%'
                        AND created_at > DATE_TRUNC('day', NOW())
                    ) as approvals_today,
                    COUNT(*) FILTER (
                        WHERE event_type LIKE 'tool_execution_%'
                        AND created_at > DATE_TRUNC('day', NOW())
                    ) as tool_executions_today
                FROM audit_log
            """)
            stats_result = db.exec(stats_query).fetchone()

            # Transform rows to ActivityEvent
            events = []
            for row in rows:
                payload = row.payload if isinstance(row.payload, dict) else {}
                events.append(ActivityEvent(
                    id=row.id,
                    event_type=row.event_type,
                    label=_event_to_label(row.event_type, payload),
                    timestamp=row.created_at.isoformat() if row.created_at else "",
                    thread_id=row.thread_id,
                    approval_id=row.approval_id,
                    tool_execution_id=row.tool_execution_id,
                    tool_name=_redact_payload(payload),
                ))

            return ActivityResponse(
                events=events,
                stats=ActivityStats(
                    total_events=total,
                    approvals_today=stats_result.approvals_today if stats_result else 0,
                    tool_executions_today=stats_result.tool_executions_today if stats_result else 0,
                    events_last_24h=stats_result.events_24h if stats_result else 0,
                ),
                pagination={
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + len(events) < total,
                },
            )

    except Exception as e:
        logger.error("get_activity_failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred")
