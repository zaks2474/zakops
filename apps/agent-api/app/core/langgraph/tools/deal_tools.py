"""Deal management tools for LangGraph.

This module provides tools for managing deals in ZakOps,
including transition_deal which requires HITL approval.

F-003 REMEDIATION (RT-1, RT-2):
- transition_deal fetches current stage as ground truth (RT-2)
- Validates to_stage against valid stage enum before approval
- After backend call, verifies stage actually changed (No-Illusions Gate RT-1)
- Returns structured result with backend HTTP status for audit

R3 REMEDIATION [P4.3]: Added deal health scoring.
"""

import os
import json
from contextvars import ContextVar
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

import httpx
from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field

from app.core.logging import logger
from app.core.idempotency import tool_idempotency_key


# External service URLs (use host.docker.internal for Docker)
DEAL_API_URL = os.getenv("DEAL_API_URL", "http://host.docker.internal:8091")
RAG_REST_URL = os.getenv("RAG_REST_URL", "http://host.docker.internal:8052")

# Backend API authentication (R003: agent→backend auth)
ZAKOPS_API_KEY = os.getenv("ZAKOPS_API_KEY", "")

# Environment check for mock behavior
ENVIRONMENT = os.getenv("APP_ENV", "development")
ALLOW_TOOL_MOCKS = os.getenv("ALLOW_TOOL_MOCKS", "false").lower() == "true"

# R3 REMEDIATION [P2.1]: Context variable for correlation_id propagation
_correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation_id in context for tool HTTP calls."""
    _correlation_id_ctx.set(correlation_id)


def get_correlation_id() -> str:
    """Get correlation_id from context."""
    return _correlation_id_ctx.get()


def _get_backend_headers() -> dict:
    """Get headers for backend API requests including auth and correlation_id."""
    headers = {"Content-Type": "application/json"}
    if ZAKOPS_API_KEY:
        headers["X-API-Key"] = ZAKOPS_API_KEY
    # R3 REMEDIATION [P2.1]: Include correlation_id for end-to-end tracing
    correlation_id = get_correlation_id()
    if correlation_id:
        headers["X-Correlation-ID"] = correlation_id
    return headers

# F-003 RT-2: Valid stage enum (must match backend DealStage)
VALID_STAGES = frozenset([
    "inbound", "screening", "qualified", "loi",
    "diligence", "closing", "portfolio", "junk", "archived"
])

# R3 REMEDIATION [P4.2]: Stage transition matrix - only valid transitions allowed
# Key = from_stage, Value = set of valid to_stages
VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "inbound": frozenset(["screening", "junk", "archived"]),
    "screening": frozenset(["qualified", "junk", "archived"]),
    "qualified": frozenset(["loi", "junk", "archived"]),
    "loi": frozenset(["diligence", "junk", "archived"]),
    "diligence": frozenset(["closing", "junk", "archived"]),
    "closing": frozenset(["portfolio", "junk", "archived"]),
    "portfolio": frozenset(["archived"]),
    "junk": frozenset(["archived"]),
    "archived": frozenset(),  # Terminal state, no transitions out
}


def _is_valid_transition(from_stage: str, to_stage: str) -> tuple[bool, str]:
    """R3 REMEDIATION [P4.2]: Validate stage transition against matrix.

    Returns:
        (is_valid, error_message) - error_message includes valid alternatives if invalid
    """
    from_lower = from_stage.lower().strip()
    to_lower = to_stage.lower().strip()

    if from_lower not in VALID_TRANSITIONS:
        return False, f"Unknown current stage '{from_stage}'"

    valid_targets = VALID_TRANSITIONS[from_lower]
    if to_lower in valid_targets:
        return True, ""

    if not valid_targets:
        return False, f"Stage '{from_stage}' is a terminal state and cannot transition to other stages"

    return False, f"Invalid transition: {from_stage} → {to_stage}. Valid transitions from {from_stage}: {', '.join(sorted(valid_targets))}"


class TransitionDealInput(BaseModel):
    """Input schema for transition_deal tool.

    Uses extra='forbid' to reject unexpected fields (strict validation).

    NOTE (F-003 RT-2): from_stage is ADVISORY only. The tool fetches
    the actual current stage from the backend as ground truth.
    """
    model_config = ConfigDict(extra="forbid")

    deal_id: str = Field(..., description="The unique identifier of the deal to transition")
    from_stage: str = Field(..., description="Advisory: current stage (tool will verify)")
    to_stage: str = Field(..., description="Target stage to transition the deal to. Valid: inbound, screening, qualified, loi, diligence, closing, portfolio, junk, archived")
    reason: Optional[str] = Field(None, description="Reason for the transition")


class GetDealInput(BaseModel):
    """Input schema for get_deal tool."""

    deal_id: str = Field(..., description="The unique identifier of the deal")


class SearchDealsInput(BaseModel):
    """Input schema for search_deals tool."""

    query: str = Field(..., description="Search query for deals")
    limit: int = Field(default=10, description="Maximum number of results")


class CreateDealInput(BaseModel):
    """Input schema for create_deal tool.

    REMEDIATION-V3 [ZK-ISSUE-0009]: Creates a new deal in the system.
    This tool requires HITL approval before execution.
    """
    model_config = ConfigDict(extra="forbid")

    canonical_name: str = Field(..., description="The canonical name for the deal (e.g., company name)")
    display_name: Optional[str] = Field(None, description="Optional display name for the deal")
    stage: str = Field(default="inbound", description="Initial stage for the deal. Valid: inbound, screening, qualified, loi, diligence, closing, portfolio, junk, archived")
    company_name: Optional[str] = Field(None, description="Company name if different from canonical name")
    broker_name: Optional[str] = Field(None, description="Name of the broker associated with this deal")
    broker_email: Optional[str] = Field(None, description="Email of the broker")
    source: Optional[str] = Field(None, description="Source of the deal (e.g., 'email', 'referral', 'platform')")
    notes: Optional[str] = Field(None, description="Initial notes about the deal")


class AddNoteInput(BaseModel):
    """Input schema for add_note tool.

    REMEDIATION-V3 [ZK-ISSUE-0009]: Add a note to an existing deal.
    """
    deal_id: str = Field(..., description="The unique identifier of the deal")
    content: str = Field(..., description="The content of the note")
    category: str = Field(default="general", description="Category of the note (e.g., 'general', 'research', 'diligence')")


@tool(args_schema=TransitionDealInput)
async def transition_deal(
    deal_id: str,
    from_stage: str,
    to_stage: str,
    reason: Optional[str] = None,
) -> str:
    """Transition a deal from one stage to another.

    This is a sensitive operation that requires human approval (HITL).
    The deal will be moved from the current stage to the target stage.

    F-003 REMEDIATION (RT-1, RT-2):
    - Validates to_stage against valid enum BEFORE approval
    - Fetches current stage from backend as ground truth (from_stage is advisory)
    - After backend call, verifies stage actually changed (No-Illusions Gate)
    - Returns structured result with backend HTTP status for audit

    Args:
        deal_id: The unique identifier of the deal
        from_stage: Advisory current stage (tool verifies against backend)
        to_stage: Target stage to transition to
        reason: Optional reason for the transition

    Returns:
        str: JSON result with ok, error, backend_status, old_stage, new_stage
    """
    logger.info(
        "transition_deal_called",
        deal_id=deal_id,
        from_stage=from_stage,
        to_stage=to_stage,
        reason=reason,
    )

    # F-003 RT-2: Validate to_stage against valid enum BEFORE approval
    to_stage_lower = to_stage.lower().strip()
    if to_stage_lower not in VALID_STAGES:
        error_msg = f"Invalid target stage '{to_stage}'. Valid stages: {', '.join(sorted(VALID_STAGES))}"
        logger.warning("transition_deal_invalid_stage", deal_id=deal_id, to_stage=to_stage)
        return json.dumps({"ok": False, "error": error_msg, "validation_failed": True})

    try:
        headers = _get_backend_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            # F-003 RT-2: Fetch current deal state as ground truth
            get_response = await client.get(f"{DEAL_API_URL}/api/deals/{deal_id}", headers=headers)
            if get_response.status_code != 200:
                return json.dumps({
                    "ok": False,
                    "error": f"Could not fetch deal {deal_id}: HTTP {get_response.status_code}",
                    "backend_status": get_response.status_code,
                })

            deal_data = get_response.json()
            actual_from_stage = deal_data.get("stage", "unknown")
            before_updated_at = deal_data.get("updated_at", "")

            # Log if LLM's from_stage mismatches actual
            if from_stage.lower() != actual_from_stage.lower():
                logger.info(
                    "transition_deal_from_stage_mismatch",
                    deal_id=deal_id,
                    llm_from_stage=from_stage,
                    actual_from_stage=actual_from_stage,
                )

            # R3 REMEDIATION [P4.2]: Validate transition against matrix BEFORE sending to backend
            is_valid, transition_error = _is_valid_transition(actual_from_stage, to_stage_lower)
            if not is_valid:
                logger.warning(
                    "transition_deal_invalid_transition",
                    deal_id=deal_id,
                    from_stage=actual_from_stage,
                    to_stage=to_stage_lower,
                    error=transition_error,
                )
                return json.dumps({
                    "ok": False,
                    "error": transition_error,
                    "validation_failed": True,
                    "from_stage": actual_from_stage,
                    "to_stage": to_stage_lower,
                })

            # Check if already at target stage
            if actual_from_stage.lower() == to_stage_lower:
                return json.dumps({
                    "ok": False,
                    "error": f"Deal {deal_id} is already at stage '{actual_from_stage}'",
                    "current_stage": actual_from_stage,
                })

            # Call backend transition endpoint
            response = await client.post(
                f"{DEAL_API_URL}/api/deals/{deal_id}/transition",
                headers=headers,
                json={
                    "new_stage": to_stage_lower,
                    "reason": reason,
                    "idempotency_key": tool_idempotency_key(
                        thread_id="agent",
                        tool_name="transition_deal",
                        tool_args={
                            "deal_id": deal_id,
                            "from_stage": actual_from_stage,  # Use actual, not LLM's
                            "to_stage": to_stage_lower,
                            "reason": reason,
                        },
                    ),
                },
            )

            backend_status = response.status_code

            if response.status_code != 200:
                error_text = response.text
                logger.error(
                    "transition_deal_backend_rejected",
                    deal_id=deal_id,
                    status_code=backend_status,
                    error=error_text,
                )
                return json.dumps({
                    "ok": False,
                    "error": f"Backend rejected transition: HTTP {backend_status} - {error_text}",
                    "backend_status": backend_status,
                })

            # F-003 RT-1 No-Illusions Gate: Re-fetch and verify stage actually changed
            verify_response = await client.get(f"{DEAL_API_URL}/api/deals/{deal_id}", headers=headers)
            if verify_response.status_code != 200:
                return json.dumps({
                    "ok": False,
                    "error": f"Could not verify transition: HTTP {verify_response.status_code}",
                    "backend_status": backend_status,
                    "verification_failed": True,
                })

            verify_data = verify_response.json()
            after_stage = verify_data.get("stage", "unknown")
            after_updated_at = verify_data.get("updated_at", "")

            # NI-1: Stage must have changed to target
            if after_stage.lower() != to_stage_lower:
                logger.error(
                    "transition_deal_phantom_success",
                    deal_id=deal_id,
                    expected_stage=to_stage_lower,
                    actual_stage=after_stage,
                    backend_status=backend_status,
                )
                return json.dumps({
                    "ok": False,
                    "error": f"Phantom success: backend returned 200 but stage is still '{after_stage}' (expected '{to_stage_lower}')",
                    "backend_status": backend_status,
                    "phantom_success": True,
                    "expected_stage": to_stage_lower,
                    "actual_stage": after_stage,
                })

            # NI-2: updated_at must have changed
            if before_updated_at == after_updated_at and before_updated_at:
                logger.warning(
                    "transition_deal_no_updated_at_change",
                    deal_id=deal_id,
                    before_updated_at=before_updated_at,
                    after_updated_at=after_updated_at,
                )
                # This is a warning, not a failure — updated_at might not change if already recent

            logger.info(
                "transition_deal_verified_success",
                deal_id=deal_id,
                old_stage=actual_from_stage,
                new_stage=after_stage,
                backend_status=backend_status,
            )
            return json.dumps({
                "ok": True,
                "deal_id": deal_id,
                "old_stage": actual_from_stage,
                "new_stage": after_stage,
                "backend_status": backend_status,
                "updated_at": after_updated_at,
            })

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            logger.warning(
                "deal_api_unavailable_mock_response",
                deal_id=deal_id,
                from_stage=from_stage,
                to_stage=to_stage,
                environment=ENVIRONMENT,
            )
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL}",
                "mock": True,
            })
        else:
            logger.error(
                "deal_api_unavailable_fail_closed",
                deal_id=deal_id,
                environment=ENVIRONMENT,
                allow_mocks=ALLOW_TOOL_MOCKS,
            )
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL} and mocks disabled",
            })

    except Exception as e:
        logger.error("transition_deal_error", error=str(e))
        return json.dumps({"ok": False, "error": f"Error transitioning deal: {str(e)}"})


@tool(args_schema=GetDealInput)
async def get_deal(deal_id: str) -> str:
    """Get details of a specific deal.

    Args:
        deal_id: The unique identifier of the deal

    Returns:
        str: Deal details in JSON format
    """
    logger.info("get_deal_called", deal_id=deal_id)

    try:
        headers = _get_backend_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{DEAL_API_URL}/api/deals/{deal_id}", headers=headers)

            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                return f"Deal {deal_id} not found"
            else:
                return f"Error getting deal: {response.text}"

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            # R3 REMEDIATION [P1.6]: Use valid stage enum
            return json.dumps(
                {
                    "deal_id": deal_id,
                    "stage": "qualified",  # Fixed: was "qualification"
                    "status": "active",
                    "note": "MOCK: Deal API unavailable",
                }
            )
        logger.error(
            "deal_api_unavailable_fail_closed",
            deal_id=deal_id,
            environment=ENVIRONMENT,
            allow_mocks=ALLOW_TOOL_MOCKS,
        )
        raise httpx.ConnectError(f"Deal API unavailable at {DEAL_API_URL} and mocks disabled")

    except Exception as e:
        logger.error("get_deal_error", error=str(e))
        return f"Error getting deal: {str(e)}"


async def _search_deals_fallback(query: str, limit: int) -> str:
    """R3 REMEDIATION [P3.4]: Fallback to backend API when RAG is unavailable.

    Searches deals directly via the backend /api/deals endpoint.
    """
    headers = _get_backend_headers()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{DEAL_API_URL}/api/deals",
                headers=headers,
                params={"q": query, "limit": limit},
            )

            if response.status_code == 200:
                data = response.json()
                # Format for user with provenance warning
                return json.dumps({
                    "results": data.get("deals", data.get("results", [])),
                    "total": data.get("total", len(data.get("deals", []))),
                    "provenance": {
                        "source": "backend_api",
                        "note": "Deal search is temporarily using direct database search (RAG unavailable). Results may be less comprehensive.",
                    }
                })
            else:
                return json.dumps({
                    "ok": False,
                    "error": f"Backend search failed: HTTP {response.status_code}",
                })
    except Exception as e:
        logger.error("search_deals_fallback_failed", error=str(e))
        return json.dumps({
            "ok": False,
            "error": f"Both RAG and backend search unavailable: {str(e)}",
        })


@tool(args_schema=SearchDealsInput)
async def search_deals(query: str, limit: int = 10) -> str:
    """Search for deals using RAG.

    R3 REMEDIATION [P3.4]: Added provenance tracking and fallback to backend API.

    Args:
        query: Search query for deals
        limit: Maximum number of results

    Returns:
        str: Search results with provenance metadata
    """
    logger.info("search_deals_called", query=query, limit=limit)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{RAG_REST_URL}/rag/query",
                json={
                    "query": query,
                    "top_k": limit,
                },
            )

            if response.status_code == 200:
                data = response.json()
                # R3 REMEDIATION [P3.4]: Add provenance to RAG results
                results = data.get("results", [])
                return json.dumps({
                    "results": results,
                    "total": data.get("count", len(results)),
                    "provenance": {
                        "source": "rag_rest",
                        "indexed_at": data.get("indexed_at"),  # If provided by RAG
                        "query_latency_ms": data.get("latency_ms"),
                    }
                })
            else:
                # RAG returned error - try fallback
                logger.warning(
                    "rag_rest_error_fallback",
                    query=query,
                    status_code=response.status_code,
                )
                return await _search_deals_fallback(query, limit)

    except httpx.ConnectError:
        # R3 REMEDIATION [P3.4]: Circuit breaker - fallback to backend API
        logger.warning(
            "rag_rest_unavailable_fallback",
            query=query,
            environment=ENVIRONMENT,
        )

        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            return json.dumps({
                "results": [{"id": "deal-001", "title": "Sample Deal", "stage": "loi"}],
                "total": 1,
                "provenance": {
                    "source": "mock",
                    "note": "MOCK: RAG REST unavailable",
                }
            })

        # Try fallback to backend API
        return await _search_deals_fallback(query, limit)

    except Exception as e:
        logger.error("search_deals_error", error=str(e))
        # Try fallback before giving up
        try:
            return await _search_deals_fallback(query, limit)
        except Exception:
            return json.dumps({
                "ok": False,
                "error": f"Deal search unavailable: {str(e)}. Please try again later.",
            })


# REMEDIATION-V3 [ZK-ISSUE-0009]: create_deal agent tool with HITL
@tool(args_schema=CreateDealInput)
async def create_deal(
    canonical_name: str,
    display_name: Optional[str] = None,
    stage: str = "inbound",
    company_name: Optional[str] = None,
    broker_name: Optional[str] = None,
    broker_email: Optional[str] = None,
    source: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Create a new deal in the system.

    This is a sensitive operation that requires human approval (HITL).
    The deal will be created with the specified information.

    REMEDIATION-V3 [ZK-ISSUE-0009]: Agent tool for deal creation with HITL approval.

    Args:
        canonical_name: The canonical name for the deal
        display_name: Optional display name
        stage: Initial stage (default: inbound)
        company_name: Company name if different from canonical name
        broker_name: Name of the broker
        broker_email: Email of the broker
        source: Source of the deal
        notes: Initial notes about the deal

    Returns:
        str: JSON result with ok, deal_id, error, backend_status
    """
    logger.info(
        "create_deal_called",
        canonical_name=canonical_name,
        stage=stage,
        source=source,
    )

    # Validate stage
    stage_lower = stage.lower().strip()
    if stage_lower not in VALID_STAGES:
        error_msg = f"Invalid stage '{stage}'. Valid stages: {', '.join(sorted(VALID_STAGES))}"
        logger.warning("create_deal_invalid_stage", stage=stage)
        return json.dumps({"ok": False, "error": error_msg, "validation_failed": True})

    try:
        headers = _get_backend_headers()

        # Build deal payload
        deal_payload = {
            "canonical_name": canonical_name,
            "stage": stage_lower,
        }
        if display_name:
            deal_payload["display_name"] = display_name

        # Build company_info
        company_info = {}
        if company_name:
            company_info["company_name"] = company_name
        if company_info:
            deal_payload["company_info"] = company_info

        # Build broker info
        broker_info = {}
        if broker_name:
            broker_info["name"] = broker_name
        if broker_email:
            broker_info["email"] = broker_email
        if broker_info:
            deal_payload["broker"] = broker_info

        # Build metadata
        metadata = {}
        if source:
            metadata["source"] = source
        if notes:
            metadata["initial_notes"] = notes
        if metadata:
            deal_payload["metadata"] = metadata

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{DEAL_API_URL}/api/deals",
                headers=headers,
                json=deal_payload,
            )

            backend_status = response.status_code

            if response.status_code == 200 or response.status_code == 201:
                deal_data = response.json()
                deal_id = deal_data.get("deal_id", "unknown")
                logger.info(
                    "create_deal_success",
                    deal_id=deal_id,
                    canonical_name=canonical_name,
                    backend_status=backend_status,
                )
                return json.dumps({
                    "ok": True,
                    "deal_id": deal_id,
                    "canonical_name": canonical_name,
                    "stage": deal_data.get("stage", stage_lower),
                    "backend_status": backend_status,
                })
            else:
                error_text = response.text
                logger.error(
                    "create_deal_backend_rejected",
                    canonical_name=canonical_name,
                    status_code=backend_status,
                    error=error_text,
                )
                return json.dumps({
                    "ok": False,
                    "error": f"Backend rejected deal creation: HTTP {backend_status} - {error_text}",
                    "backend_status": backend_status,
                })

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            logger.warning(
                "deal_api_unavailable_mock_response",
                canonical_name=canonical_name,
                environment=ENVIRONMENT,
            )
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL}",
                "mock": True,
            })
        else:
            logger.error(
                "deal_api_unavailable_fail_closed",
                canonical_name=canonical_name,
                environment=ENVIRONMENT,
                allow_mocks=ALLOW_TOOL_MOCKS,
            )
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL} and mocks disabled",
            })

    except Exception as e:
        logger.error("create_deal_error", error=str(e))
        return json.dumps({"ok": False, "error": f"Error creating deal: {str(e)}"})


# REMEDIATION-V3 [ZK-ISSUE-0009]: add_note agent tool
# R3 REMEDIATION [P1.3]: Added idempotency key
@tool(args_schema=AddNoteInput)
async def add_note(
    deal_id: str,
    content: str,
    category: str = "general",
) -> str:
    """Add a note to an existing deal.

    Args:
        deal_id: The unique identifier of the deal
        content: The content of the note
        category: Category of the note

    Returns:
        str: JSON result with ok, event_id, error, backend_status
    """
    logger.info(
        "add_note_called",
        deal_id=deal_id,
        category=category,
    )

    try:
        headers = _get_backend_headers()

        # R3 REMEDIATION [P1.3]: Generate idempotency key for note creation
        idempotency_key = tool_idempotency_key(
            thread_id="agent",
            tool_name="add_note",
            tool_args={
                "deal_id": deal_id,
                "content": content,
                "category": category,
            }
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{DEAL_API_URL}/api/deals/{deal_id}/notes",
                headers=headers,
                json={
                    "content": content,
                    "category": category,
                    "idempotency_key": idempotency_key,
                },
            )

            backend_status = response.status_code

            if response.status_code == 201:
                result = response.json()
                logger.info(
                    "add_note_success",
                    deal_id=deal_id,
                    event_id=result.get("event_id"),
                    backend_status=backend_status,
                )
                return json.dumps({
                    "ok": True,
                    "deal_id": deal_id,
                    "event_id": result.get("event_id"),
                    "backend_status": backend_status,
                })
            elif response.status_code == 404:
                return json.dumps({
                    "ok": False,
                    "error": f"Deal {deal_id} not found",
                    "backend_status": backend_status,
                })
            else:
                error_text = response.text
                logger.error(
                    "add_note_backend_rejected",
                    deal_id=deal_id,
                    status_code=backend_status,
                    error=error_text,
                )
                return json.dumps({
                    "ok": False,
                    "error": f"Backend rejected note: HTTP {backend_status} - {error_text}",
                    "backend_status": backend_status,
                })

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL}",
                "mock": True,
            })
        else:
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL} and mocks disabled",
            })

    except Exception as e:
        logger.error("add_note_error", error=str(e))
        return json.dumps({"ok": False, "error": f"Error adding note: {str(e)}"})


# R3 REMEDIATION [P4.3]: Deal health scoring configuration
# Defines expected days per stage before deal is considered stale
STAGE_EXPECTED_DAYS: Dict[str, int] = {
    "inbound": 7,      # Should be screened within a week
    "screening": 14,   # Should be qualified/rejected within 2 weeks
    "qualified": 21,   # Should progress to LOI within 3 weeks
    "loi": 30,         # Should be signed within a month
    "diligence": 60,   # Due diligence can take up to 2 months
    "closing": 30,     # Should close within a month
    "portfolio": 365,  # Active portfolio company, no time limit
    "junk": 365,       # Archived, no time limit
    "archived": 365,   # Archived, no time limit
}


def calculate_deal_health_score(deal_data: Dict[str, Any]) -> Dict[str, Any]:
    """R3 REMEDIATION [P4.3]: Calculate deal health score based on multiple factors.

    Health score is 0-100 where:
    - 80-100: Healthy (green)
    - 50-79: Needs attention (yellow)
    - 0-49: At risk (red)

    Factors considered:
    - Time in current stage vs expected
    - Days since last activity
    - Completeness of key fields
    - Stage-appropriate milestones

    Args:
        deal_data: Deal data dictionary from backend

    Returns:
        Dict with score, status, factors, and recommendations
    """
    score = 100  # Start at perfect health
    factors = []
    recommendations = []

    # Extract deal data
    stage = deal_data.get("stage", "inbound").lower()
    created_at_str = deal_data.get("created_at")
    updated_at_str = deal_data.get("updated_at")
    stage_changed_at_str = deal_data.get("stage_changed_at") or updated_at_str
    canonical_name = deal_data.get("canonical_name", "")
    company_info = deal_data.get("company_info", {})
    broker = deal_data.get("broker", {})
    metadata = deal_data.get("metadata", {})

    now = datetime.utcnow()

    # Factor 1: Time in current stage (max -40 points)
    if stage_changed_at_str:
        try:
            # Handle ISO format with or without milliseconds
            stage_changed_at_str = stage_changed_at_str.replace("Z", "+00:00")
            if "." in stage_changed_at_str:
                stage_changed_at = datetime.fromisoformat(stage_changed_at_str.split("+")[0])
            else:
                stage_changed_at = datetime.fromisoformat(stage_changed_at_str.split("+")[0])

            days_in_stage = (now - stage_changed_at).days
            expected_days = STAGE_EXPECTED_DAYS.get(stage, 30)

            if days_in_stage > expected_days * 2:
                # Significantly overdue
                penalty = min(40, 20 + (days_in_stage - expected_days * 2) // 7 * 5)
                score -= penalty
                factors.append(f"In {stage} stage for {days_in_stage} days (expected: {expected_days})")
                recommendations.append(f"Deal has been in {stage} for too long. Consider advancing or archiving.")
            elif days_in_stage > expected_days:
                # Slightly overdue
                penalty = min(20, 10 + (days_in_stage - expected_days) // 7 * 5)
                score -= penalty
                factors.append(f"In {stage} stage for {days_in_stage} days (expected: {expected_days})")
                recommendations.append(f"Deal approaching time threshold in {stage}. Review progress.")
            else:
                factors.append(f"On track: {days_in_stage}/{expected_days} days in {stage}")
        except (ValueError, TypeError) as e:
            logger.debug("deal_health_date_parse_error", error=str(e))

    # Factor 2: Days since last activity (max -30 points)
    if updated_at_str:
        try:
            updated_at_str = updated_at_str.replace("Z", "+00:00")
            if "." in updated_at_str:
                updated_at = datetime.fromisoformat(updated_at_str.split("+")[0])
            else:
                updated_at = datetime.fromisoformat(updated_at_str.split("+")[0])

            days_since_update = (now - updated_at).days

            if days_since_update > 30:
                penalty = min(30, 15 + (days_since_update - 30) // 7 * 5)
                score -= penalty
                factors.append(f"No activity for {days_since_update} days")
                recommendations.append("No recent activity. Add a note or update to show progress.")
            elif days_since_update > 14:
                score -= 10
                factors.append(f"No activity for {days_since_update} days")
            else:
                factors.append(f"Recent activity: {days_since_update} days ago")
        except (ValueError, TypeError) as e:
            logger.debug("deal_health_date_parse_error", error=str(e))

    # Factor 3: Field completeness (max -20 points)
    missing_fields = []
    if not canonical_name:
        missing_fields.append("canonical_name")
    if not company_info.get("company_name"):
        if stage in ["qualified", "loi", "diligence", "closing"]:
            missing_fields.append("company_name")

    # Stage-specific requirements
    if stage in ["loi", "diligence", "closing", "portfolio"]:
        if not broker.get("name") and not broker.get("email"):
            missing_fields.append("broker contact info")

    if missing_fields:
        penalty = min(20, len(missing_fields) * 5)
        score -= penalty
        factors.append(f"Missing fields: {', '.join(missing_fields)}")
        recommendations.append(f"Complete missing information: {', '.join(missing_fields)}")
    else:
        factors.append("All required fields complete")

    # Factor 4: Stage-specific health checks (max -10 points)
    if stage == "diligence":
        # In diligence, should have notes
        notes_count = deal_data.get("notes_count", metadata.get("notes_count", 0))
        if notes_count == 0:
            score -= 10
            factors.append("No notes in due diligence stage")
            recommendations.append("Add diligence notes to document findings.")

    if stage == "loi":
        # In LOI, should have deal value
        if not deal_data.get("value") and not metadata.get("estimated_value"):
            score -= 5
            factors.append("No deal value set for LOI stage")
            recommendations.append("Set estimated deal value for proper tracking.")

    # Determine status based on score
    if score >= 80:
        status = "healthy"
        status_color = "green"
    elif score >= 50:
        status = "needs_attention"
        status_color = "yellow"
    else:
        status = "at_risk"
        status_color = "red"

    # Ensure score is in bounds
    score = max(0, min(100, score))

    return {
        "score": score,
        "status": status,
        "status_color": status_color,
        "factors": factors,
        "recommendations": recommendations,
        "stage": stage,
    }


class GetDealHealthInput(BaseModel):
    """Input schema for get_deal_health tool."""

    deal_id: str = Field(..., description="The unique identifier of the deal")


@tool(args_schema=GetDealHealthInput)
async def get_deal_health(deal_id: str) -> str:
    """R3 REMEDIATION [P4.3]: Get health score and recommendations for a deal.

    Analyzes deal data and returns a health score (0-100) with:
    - Status (healthy/needs_attention/at_risk)
    - Contributing factors
    - Recommendations for improvement

    Args:
        deal_id: The unique identifier of the deal

    Returns:
        str: JSON result with health score and analysis
    """
    logger.info("get_deal_health_called", deal_id=deal_id)

    try:
        headers = _get_backend_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{DEAL_API_URL}/api/deals/{deal_id}", headers=headers)

            if response.status_code == 200:
                deal_data = response.json()
                health_result = calculate_deal_health_score(deal_data)
                health_result["deal_id"] = deal_id
                health_result["ok"] = True

                logger.info(
                    "deal_health_calculated",
                    deal_id=deal_id,
                    score=health_result["score"],
                    status=health_result["status"],
                )

                return json.dumps(health_result)
            elif response.status_code == 404:
                return json.dumps({
                    "ok": False,
                    "error": f"Deal {deal_id} not found",
                })
            else:
                return json.dumps({
                    "ok": False,
                    "error": f"Could not fetch deal: HTTP {response.status_code}",
                })

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            # Return mock health score
            return json.dumps({
                "ok": True,
                "deal_id": deal_id,
                "score": 75,
                "status": "needs_attention",
                "status_color": "yellow",
                "factors": ["MOCK: Deal API unavailable"],
                "recommendations": ["Verify deal API connectivity"],
                "stage": "unknown",
                "mock": True,
            })
        else:
            return json.dumps({
                "ok": False,
                "error": f"Deal API unavailable at {DEAL_API_URL}",
            })

    except Exception as e:
        logger.error("get_deal_health_error", error=str(e))
        return json.dumps({"ok": False, "error": f"Error calculating deal health: {str(e)}"})
