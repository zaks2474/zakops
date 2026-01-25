"""Retrieval evaluation harness.

This module evaluates retrieval quality via RAG REST.
Target: recall@5 >= 0.80 per Phase 3 requirements.

Metrics:
- recall@k: fraction of relevant documents retrieved in top-k
- Latency stats (P50, P95)
- Per-query breakdown
"""

import asyncio
import json
import os
import statistics
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Fix import path
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class QueryResult:
    """Result of evaluating a single query."""
    query_id: str
    query: str
    expected_urls: List[str]
    expected_keywords: List[str]
    retrieved_urls: List[str]
    retrieved_contents: List[str]
    relevance_scores: List[float]
    recall_at_5: float
    keyword_hit_rate: float
    latency_ms: float
    errors: List[str] = field(default_factory=list)


@dataclass
class RetrievalEvalReport:
    """Overall retrieval evaluation report."""
    timestamp: str
    dataset_version: str
    total_queries: int
    recall_at_5_mean: float
    recall_at_5_min: float
    recall_at_5_max: float
    keyword_hit_rate_mean: float
    latency_p50_ms: float
    latency_p95_ms: float
    latency_mean_ms: float
    per_query_breakdown: List[Dict[str, Any]]
    passed: bool
    threshold: float = 0.80


async def query_rag_rest(query: str, limit: int = 5) -> tuple[List[Dict[str, Any]], float]:
    """Query RAG REST and return results with latency.

    Args:
        query: The search query
        limit: Max results

    Returns:
        Tuple of (results, latency_ms)
    """
    import httpx

    rag_rest_url = os.getenv("RAG_REST_URL", "http://localhost:8052")

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{rag_rest_url}/rag/query",
                json={"query": query, "limit": limit},
            )
            response.raise_for_status()
            data = response.json()
            latency_ms = (time.time() - start_time) * 1000
            return data.get("results", []), latency_ms
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        return [], latency_ms


def compute_recall_at_k(expected_urls: List[str], retrieved_urls: List[str], k: int = 5) -> float:
    """Compute recall@k.

    recall@k = (# of relevant docs in top-k) / (# of relevant docs)

    We use prefix matching for URLs since expected URLs might be prefixes.
    """
    if not expected_urls:
        return 1.0  # No expected docs means perfect recall

    top_k = retrieved_urls[:k]
    hits = 0

    for expected in expected_urls:
        for retrieved in top_k:
            if retrieved.startswith(expected) or expected in retrieved:
                hits += 1
                break

    return hits / len(expected_urls)


def compute_keyword_hit_rate(expected_keywords: List[str], contents: List[str]) -> float:
    """Compute keyword hit rate.

    Returns fraction of expected keywords found in retrieved content.
    """
    if not expected_keywords:
        return 1.0

    all_content = " ".join(contents).lower()
    hits = sum(1 for kw in expected_keywords if kw.lower() in all_content)
    return hits / len(expected_keywords)


async def evaluate_query(query_data: Dict[str, Any]) -> QueryResult:
    """Evaluate a single query.

    Args:
        query_data: Query specification from dataset

    Returns:
        QueryResult with metrics
    """
    query_id = query_data["id"]
    query = query_data["query"]
    expected_urls = query_data.get("expected_urls", [])
    expected_keywords = query_data.get("expected_content_keywords", [])

    errors = []

    try:
        results, latency_ms = await query_rag_rest(query, limit=5)

        retrieved_urls = [r.get("url", "") for r in results]
        retrieved_contents = [r.get("content", "") for r in results]
        relevance_scores = [r.get("similarity", 0.0) for r in results]

        recall_at_5 = compute_recall_at_k(expected_urls, retrieved_urls, k=5)
        keyword_hit_rate = compute_keyword_hit_rate(expected_keywords, retrieved_contents)

    except Exception as e:
        errors.append(str(e))
        retrieved_urls = []
        retrieved_contents = []
        relevance_scores = []
        recall_at_5 = 0.0
        keyword_hit_rate = 0.0
        latency_ms = 0.0

    return QueryResult(
        query_id=query_id,
        query=query,
        expected_urls=expected_urls,
        expected_keywords=expected_keywords,
        retrieved_urls=retrieved_urls,
        retrieved_contents=retrieved_contents,
        relevance_scores=relevance_scores,
        recall_at_5=recall_at_5,
        keyword_hit_rate=keyword_hit_rate,
        latency_ms=latency_ms,
        errors=errors,
    )


async def run_eval(dataset_path: Optional[str] = None) -> RetrievalEvalReport:
    """Run the retrieval evaluation.

    Args:
        dataset_path: Path to the queries dataset JSON

    Returns:
        RetrievalEvalReport with results
    """
    if dataset_path is None:
        dataset_path = Path(__file__).parent / "datasets" / "retrieval" / "v1" / "queries.json"

    with open(dataset_path) as f:
        dataset = json.load(f)

    queries = dataset.get("queries", [])
    results: List[QueryResult] = []

    for query_data in queries:
        result = await evaluate_query(query_data)
        results.append(result)

    # Calculate aggregate metrics
    recall_scores = [r.recall_at_5 for r in results]
    keyword_rates = [r.keyword_hit_rate for r in results]
    latencies = [r.latency_ms for r in results if r.latency_ms > 0]

    recall_at_5_mean = statistics.mean(recall_scores) if recall_scores else 0.0
    recall_at_5_min = min(recall_scores) if recall_scores else 0.0
    recall_at_5_max = max(recall_scores) if recall_scores else 0.0
    keyword_hit_rate_mean = statistics.mean(keyword_rates) if keyword_rates else 0.0

    if latencies:
        latency_mean = statistics.mean(latencies)
        latency_sorted = sorted(latencies)
        p50_idx = int(len(latency_sorted) * 0.50)
        p95_idx = min(int(len(latency_sorted) * 0.95), len(latency_sorted) - 1)
        latency_p50 = latency_sorted[p50_idx]
        latency_p95 = latency_sorted[p95_idx]
    else:
        latency_mean = 0.0
        latency_p50 = 0.0
        latency_p95 = 0.0

    # Per-query breakdown
    per_query = [
        {
            "query_id": r.query_id,
            "query": r.query,
            "recall_at_5": round(r.recall_at_5, 4),
            "keyword_hit_rate": round(r.keyword_hit_rate, 4),
            "latency_ms": round(r.latency_ms, 2),
            "retrieved_count": len(r.retrieved_urls),
            "errors": r.errors,
        }
        for r in results
    ]

    # Passed if recall@5 >= 0.80
    passed = recall_at_5_mean >= 0.80

    return RetrievalEvalReport(
        timestamp=datetime.utcnow().isoformat() + "Z",
        dataset_version=dataset.get("version", "unknown"),
        total_queries=len(queries),
        recall_at_5_mean=recall_at_5_mean,
        recall_at_5_min=recall_at_5_min,
        recall_at_5_max=recall_at_5_max,
        keyword_hit_rate_mean=keyword_hit_rate_mean,
        latency_p50_ms=latency_p50,
        latency_p95_ms=latency_p95,
        latency_mean_ms=latency_mean,
        per_query_breakdown=per_query,
        passed=passed,
    )


def main():
    """Run evaluation and output results."""
    report = asyncio.run(run_eval())

    output = {
        "timestamp": report.timestamp,
        "dataset_version": report.dataset_version,
        "total_queries": report.total_queries,
        "recall_at_5": round(report.recall_at_5_mean, 4),
        "recall_at_5_pct": f"{report.recall_at_5_mean * 100:.1f}%",
        "recall_at_5_min": round(report.recall_at_5_min, 4),
        "recall_at_5_max": round(report.recall_at_5_max, 4),
        "keyword_hit_rate": round(report.keyword_hit_rate_mean, 4),
        "latency_p50_ms": round(report.latency_p50_ms, 2),
        "latency_p95_ms": round(report.latency_p95_ms, 2),
        "latency_mean_ms": round(report.latency_mean_ms, 2),
        "per_query_breakdown": report.per_query_breakdown,
        "threshold": report.threshold,
        "passed": report.passed,
        "RETRIEVAL_EVAL": "PASSED" if report.passed else "FAILED",
    }

    # Write to gate artifacts
    artifacts_path = Path(__file__).parent.parent / "gate_artifacts" / "retrieval_eval_results.json"
    with open(artifacts_path, "w") as f:
        json.dump(output, f, indent=2)

    print(json.dumps(output, indent=2))
    return 0 if report.passed else 1


if __name__ == "__main__":
    sys.exit(main())
