"""Deal management tools for LangGraph.

This module provides tools for managing deals in ZakOps,
including transition_deal which requires HITL approval.

F-003 REMEDIATION (RT-1, RT-2):
- transition_deal fetches current stage as ground truth (RT-2)
- Validates to_stage against valid stage enum before approval
- After backend call, verifies stage actually changed (No-Illusions Gate RT-1)
- Returns structured result with backend HTTP status for audit
"""

import os
import json
from typing import Optional

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


def _get_backend_headers() -> dict:
    """Get headers for backend API requests including auth."""
    headers = {"Content-Type": "application/json"}
    if ZAKOPS_API_KEY:
        headers["X-API-Key"] = ZAKOPS_API_KEY
    return headers

# F-003 RT-2: Valid stage enum (must match backend DealStage)
VALID_STAGES = frozenset([
    "inbound", "screening", "qualified", "loi",
    "diligence", "closing", "portfolio", "junk", "archived"
])


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
            return json.dumps(
                {
                    "deal_id": deal_id,
                    "stage": "qualification",
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


@tool(args_schema=SearchDealsInput)
async def search_deals(query: str, limit: int = 10) -> str:
    """Search for deals using RAG.

    Args:
        query: Search query for deals
        limit: Maximum number of results

    Returns:
        str: Search results
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
                return response.text
            else:
                return f"Error searching deals: {response.text}"

    except httpx.ConnectError:
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            return json.dumps(
                {
                    "results": [{"id": "deal-001", "title": "Sample Deal", "stage": "proposal"}],
                    "total": 1,
                    "note": "MOCK: RAG REST unavailable",
                }
            )
        logger.error(
            "rag_rest_unavailable_fail_closed",
            query=query,
            environment=ENVIRONMENT,
            allow_mocks=ALLOW_TOOL_MOCKS,
        )
        raise httpx.ConnectError(f"RAG REST unavailable at {RAG_REST_URL} and mocks disabled")

    except Exception as e:
        logger.error("search_deals_error", error=str(e))
        return f"Error searching deals: {str(e)}"
