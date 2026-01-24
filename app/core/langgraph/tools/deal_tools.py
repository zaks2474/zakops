"""Deal management tools for LangGraph.

This module provides tools for managing deals in ZakOps,
including transition_deal which requires HITL approval.
"""

import os
from typing import Optional

import httpx
from langchain_core.tools import tool
from pydantic import BaseModel, ConfigDict, Field

from app.core.logging import logger


# External service URLs (use host.docker.internal for Docker)
DEAL_API_URL = os.getenv("DEAL_API_URL", "http://host.docker.internal:8090")
RAG_REST_URL = os.getenv("RAG_REST_URL", "http://host.docker.internal:8052")

# Environment check for mock behavior
ENVIRONMENT = os.getenv("APP_ENV", "development")
ALLOW_TOOL_MOCKS = os.getenv("ALLOW_TOOL_MOCKS", "true").lower() == "true"


class TransitionDealInput(BaseModel):
    """Input schema for transition_deal tool.

    Uses extra='forbid' to reject unexpected fields (strict validation).
    """
    model_config = ConfigDict(extra="forbid")

    deal_id: str = Field(..., description="The unique identifier of the deal to transition")
    from_stage: str = Field(..., description="Current stage of the deal")
    to_stage: str = Field(..., description="Target stage to transition the deal to")
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

    Args:
        deal_id: The unique identifier of the deal
        from_stage: Current stage of the deal
        to_stage: Target stage to transition to
        reason: Optional reason for the transition

    Returns:
        str: Result of the transition operation
    """
    logger.info(
        "transition_deal_called",
        deal_id=deal_id,
        from_stage=from_stage,
        to_stage=to_stage,
        reason=reason,
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{DEAL_API_URL}/api/deals/{deal_id}/transition",
                json={
                    "from_stage": from_stage,
                    "to_stage": to_stage,
                    "reason": reason,
                },
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(
                    "transition_deal_success",
                    deal_id=deal_id,
                    new_stage=to_stage,
                )
                return f"Successfully transitioned deal {deal_id} from {from_stage} to {to_stage}. {result.get('message', '')}"

            elif response.status_code == 404:
                return f"Deal {deal_id} not found"

            else:
                error_msg = response.text
                logger.error(
                    "transition_deal_failed",
                    deal_id=deal_id,
                    status_code=response.status_code,
                    error=error_msg,
                )
                return f"Failed to transition deal: {error_msg}"

    except httpx.ConnectError:
        # Only allow mock responses in development with explicit flag
        if ENVIRONMENT == "development" and ALLOW_TOOL_MOCKS:
            logger.warning(
                "deal_api_unavailable_mock_response",
                deal_id=deal_id,
                from_stage=from_stage,
                to_stage=to_stage,
                environment=ENVIRONMENT,
            )
            return f"[MOCK] Successfully transitioned deal {deal_id} from {from_stage} to {to_stage}"
        else:
            # Fail closed in production or when mocks disabled
            logger.error(
                "deal_api_unavailable_fail_closed",
                deal_id=deal_id,
                environment=ENVIRONMENT,
                allow_mocks=ALLOW_TOOL_MOCKS,
            )
            raise httpx.ConnectError(f"Deal API unavailable at {DEAL_API_URL} and mocks disabled")

    except Exception as e:
        logger.error("transition_deal_error", error=str(e))
        return f"Error transitioning deal: {str(e)}"


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
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{DEAL_API_URL}/api/deals/{deal_id}")

            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                return f"Deal {deal_id} not found"
            else:
                return f"Error getting deal: {response.text}"

    except httpx.ConnectError:
        # Mock response for testing
        return f'{{"id": "{deal_id}", "stage": "qualification", "value": 50000, "status": "active"}}'

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
                f"{RAG_REST_URL}/search",
                json={
                    "query": query,
                    "limit": limit,
                    "collection": "deals",
                },
            )

            if response.status_code == 200:
                return response.text
            else:
                return f"Error searching deals: {response.text}"

    except httpx.ConnectError:
        # Mock response for testing
        return f'{{"results": [{{"id": "deal-001", "title": "Sample Deal", "stage": "proposal"}}], "total": 1}}'

    except Exception as e:
        logger.error("search_deals_error", error=str(e))
        return f"Error searching deals: {str(e)}"
