"""RAG REST client service.

This module provides the exclusive retrieval interface for the Agent API.
All retrieval operations MUST go through RAG REST - no direct pgvector queries.

Per Decision Lock §9: Single retrieval path (no split-brain)
"""

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.logging import logger


# RAG REST configuration
RAG_REST_URL = getattr(settings, 'RAG_REST_URL', os.getenv("RAG_REST_URL", "http://host.docker.internal:8052"))
RAG_REST_TIMEOUT = float(os.getenv("RAG_REST_TIMEOUT", "30.0"))


@dataclass
class RetrievalResult:
    """A single retrieval result from RAG REST."""
    url: str
    content: str
    similarity: float
    chunk_number: int = 0
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class RetrievalResponse:
    """Response from RAG REST query endpoint."""
    query: str
    results: List[RetrievalResult]
    count: int
    latency_ms: float = 0.0


class RAGRESTClient:
    """Client for RAG REST service.

    This is the ONLY allowed retrieval interface for the Agent API.
    Direct pgvector queries are prohibited per Decision Lock.
    """

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        """Initialize RAG REST client.

        Args:
            base_url: Base URL for RAG REST service
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or RAG_REST_URL
        self.timeout = timeout or RAG_REST_TIMEOUT
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def health_check(self) -> Dict[str, Any]:
        """Check RAG REST service health.

        Returns:
            Service info including version, status, and available endpoints
        """
        try:
            client = await self._get_client()
            response = await client.get("/")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("rag_rest_health_check_failed", error=str(e), base_url=self.base_url)
            raise

    async def query(
        self,
        query: str,
        limit: int = 5,
        threshold: float = 0.5,
    ) -> RetrievalResponse:
        """Query the knowledge base via RAG REST.

        This is the ONLY allowed retrieval method per Decision Lock.

        Args:
            query: The search query
            limit: Maximum number of results (default 5)
            threshold: Minimum similarity threshold

        Returns:
            RetrievalResponse with results and metadata
        """
        import time
        start_time = time.time()

        try:
            client = await self._get_client()
            response = await client.post(
                "/rag/query",
                json={
                    "query": query,
                    "limit": limit,
                    "threshold": threshold,
                },
            )
            response.raise_for_status()
            data = response.json()

            latency_ms = (time.time() - start_time) * 1000

            results = [
                RetrievalResult(
                    url=r.get("url", ""),
                    content=r.get("content", ""),
                    similarity=r.get("similarity", 0.0),
                    chunk_number=r.get("chunk_number", 0),
                    metadata=r.get("metadata"),
                )
                for r in data.get("results", [])
            ]

            logger.debug(
                "rag_rest_query_success",
                query_preview=query[:50],
                result_count=len(results),
                latency_ms=round(latency_ms, 2),
            )

            return RetrievalResponse(
                query=data.get("query", query),
                results=results,
                count=data.get("count", len(results)),
                latency_ms=latency_ms,
            )

        except httpx.HTTPError as e:
            logger.error(
                "rag_rest_query_failed",
                query_preview=query[:50],
                error=str(e),
            )
            raise

    async def get_stats(self) -> Dict[str, Any]:
        """Get RAG REST database statistics.

        Returns:
            Stats including total_chunks, unique_urls, embedding info
        """
        try:
            client = await self._get_client()
            response = await client.get("/rag/stats")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("rag_rest_get_stats_failed", error=str(e))
            raise

    async def get_sources(self) -> List[Dict[str, Any]]:
        """Get available sources in the knowledge base.

        Returns:
            List of sources with chunk counts
        """
        try:
            client = await self._get_client()
            response = await client.get("/rag/sources")
            response.raise_for_status()
            data = response.json()
            return data.get("sources", [])
        except httpx.HTTPError as e:
            logger.error("rag_rest_get_sources_failed", error=str(e))
            raise


# Singleton instance
_rag_rest_client: Optional[RAGRESTClient] = None


def get_rag_rest_client() -> RAGRESTClient:
    """Get the RAG REST client singleton.

    Returns:
        RAGRESTClient instance
    """
    global _rag_rest_client
    if _rag_rest_client is None:
        _rag_rest_client = RAGRESTClient()
    return _rag_rest_client


async def retrieve(query: str, limit: int = 5) -> RetrievalResponse:
    """Convenience function for retrieval via RAG REST.

    This is the canonical retrieval function for the Agent API.
    All retrieval MUST go through this function or RAGRESTClient.

    Args:
        query: The search query
        limit: Maximum results

    Returns:
        RetrievalResponse with results
    """
    client = get_rag_rest_client()
    return await client.query(query, limit=limit)
