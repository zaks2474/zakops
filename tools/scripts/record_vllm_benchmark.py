#!/usr/bin/env python3
"""Record vLLM benchmark results.

Runs inference benchmarks against a vLLM endpoint and records
results for performance tracking.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass, asdict

try:
    import httpx
except ImportError:
    print("httpx not installed. Install with: pip install httpx")
    sys.exit(1)


@dataclass
class BenchmarkResult:
    """Single benchmark request result."""

    request_id: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    ttft_ms: float  # Time to first token
    total_latency_ms: float
    tokens_per_second: float
    success: bool
    error: str = ""


@dataclass
class BenchmarkSummary:
    """Summary of benchmark run."""

    timestamp: str
    endpoint: str
    model: str
    num_requests: int
    concurrent_requests: int
    prompt_template: str

    # Success metrics
    success_rate: float
    total_requests: int
    successful_requests: int
    failed_requests: int

    # Latency metrics (ms)
    latency_mean: float
    latency_median: float
    latency_p50: float
    latency_p90: float
    latency_p95: float
    latency_p99: float
    latency_min: float
    latency_max: float

    # TTFT metrics (ms)
    ttft_mean: float
    ttft_p95: float

    # Throughput metrics
    tokens_per_second_mean: float
    total_input_tokens: int
    total_output_tokens: int
    total_duration_seconds: float
    requests_per_second: float


def percentile(data: List[float], p: float) -> float:
    """Calculate percentile of data."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (p / 100)
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_data) else f
    return sorted_data[f] + (sorted_data[c] - sorted_data[f]) * (k - f)


async def run_single_request(
    client: httpx.AsyncClient,
    url: str,
    model: str,
    prompt: str,
    request_id: int,
    max_tokens: int = 256,
) -> BenchmarkResult:
    """Run a single benchmark request.

    Args:
        client: HTTP client
        url: vLLM endpoint URL
        model: Model name
        prompt: Prompt text
        request_id: Request identifier
        max_tokens: Maximum tokens to generate

    Returns:
        BenchmarkResult
    """
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "stream": True,
    }

    start_time = time.perf_counter()
    ttft = None
    completion_tokens = 0

    try:
        async with client.stream(
            "POST",
            f"{url}/v1/chat/completions",
            json=payload,
            timeout=60.0,
        ) as response:
            if response.status_code != 200:
                end_time = time.perf_counter()
                return BenchmarkResult(
                    request_id=request_id,
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    ttft_ms=0,
                    total_latency_ms=(end_time - start_time) * 1000,
                    tokens_per_second=0,
                    success=False,
                    error=f"HTTP {response.status_code}",
                )

            async for line in response.aiter_lines():
                if not line.strip():
                    continue

                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break

                    try:
                        chunk = json.loads(data)
                        if ttft is None:
                            ttft = time.perf_counter()

                        # Count tokens from streaming response
                        if "choices" in chunk:
                            for choice in chunk["choices"]:
                                if choice.get("delta", {}).get("content"):
                                    completion_tokens += 1
                    except json.JSONDecodeError:
                        continue

        end_time = time.perf_counter()
        total_latency_ms = (end_time - start_time) * 1000
        ttft_ms = (ttft - start_time) * 1000 if ttft else total_latency_ms

        # Estimate prompt tokens (rough approximation)
        prompt_tokens = len(prompt.split()) * 1.3  # ~1.3 tokens per word average

        tokens_per_second = (
            completion_tokens / (total_latency_ms / 1000) if total_latency_ms > 0 else 0
        )

        return BenchmarkResult(
            request_id=request_id,
            prompt_tokens=int(prompt_tokens),
            completion_tokens=completion_tokens,
            total_tokens=int(prompt_tokens) + completion_tokens,
            ttft_ms=ttft_ms,
            total_latency_ms=total_latency_ms,
            tokens_per_second=tokens_per_second,
            success=True,
        )

    except Exception as e:
        end_time = time.perf_counter()
        return BenchmarkResult(
            request_id=request_id,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            ttft_ms=0,
            total_latency_ms=(end_time - start_time) * 1000,
            tokens_per_second=0,
            success=False,
            error=str(e),
        )


async def run_benchmark(
    url: str,
    model: str,
    prompt: str,
    num_requests: int,
    concurrent: int,
    max_tokens: int,
) -> List[BenchmarkResult]:
    """Run the benchmark with specified concurrency.

    Args:
        url: vLLM endpoint URL
        model: Model name
        prompt: Prompt template
        num_requests: Total number of requests
        concurrent: Concurrent requests
        max_tokens: Max tokens per request

    Returns:
        List of BenchmarkResult
    """
    results = []
    semaphore = asyncio.Semaphore(concurrent)

    async def bounded_request(client, request_id):
        async with semaphore:
            return await run_single_request(
                client, url, model, prompt, request_id, max_tokens
            )

    async with httpx.AsyncClient() as client:
        tasks = [bounded_request(client, i) for i in range(num_requests)]
        results = await asyncio.gather(*tasks)

    return list(results)


def calculate_summary(
    results: List[BenchmarkResult],
    url: str,
    model: str,
    prompt: str,
    concurrent: int,
    total_duration: float,
) -> BenchmarkSummary:
    """Calculate benchmark summary statistics.

    Args:
        results: List of benchmark results
        url: Endpoint URL
        model: Model name
        prompt: Prompt used
        concurrent: Concurrency level
        total_duration: Total benchmark duration

    Returns:
        BenchmarkSummary
    """
    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    latencies = [r.total_latency_ms for r in successful]
    ttfts = [r.ttft_ms for r in successful]
    tps = [r.tokens_per_second for r in successful if r.tokens_per_second > 0]

    return BenchmarkSummary(
        timestamp=datetime.now().isoformat(),
        endpoint=url,
        model=model,
        num_requests=len(results),
        concurrent_requests=concurrent,
        prompt_template=prompt[:100] + "..." if len(prompt) > 100 else prompt,
        success_rate=len(successful) / len(results) * 100 if results else 0,
        total_requests=len(results),
        successful_requests=len(successful),
        failed_requests=len(failed),
        latency_mean=statistics.mean(latencies) if latencies else 0,
        latency_median=statistics.median(latencies) if latencies else 0,
        latency_p50=percentile(latencies, 50),
        latency_p90=percentile(latencies, 90),
        latency_p95=percentile(latencies, 95),
        latency_p99=percentile(latencies, 99),
        latency_min=min(latencies) if latencies else 0,
        latency_max=max(latencies) if latencies else 0,
        ttft_mean=statistics.mean(ttfts) if ttfts else 0,
        ttft_p95=percentile(ttfts, 95),
        tokens_per_second_mean=statistics.mean(tps) if tps else 0,
        total_input_tokens=sum(r.prompt_tokens for r in successful),
        total_output_tokens=sum(r.completion_tokens for r in successful),
        total_duration_seconds=total_duration,
        requests_per_second=len(successful) / total_duration if total_duration > 0 else 0,
    )


def main():
    """Run vLLM benchmark."""
    parser = argparse.ArgumentParser(description="vLLM Benchmark Tool")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="vLLM endpoint URL",
    )
    parser.add_argument(
        "--model",
        default="default",
        help="Model name",
    )
    parser.add_argument(
        "--prompt",
        default="Explain the concept of machine learning in simple terms.",
        help="Prompt to use for benchmark",
    )
    parser.add_argument(
        "--num-requests",
        type=int,
        default=10,
        help="Number of requests to run",
    )
    parser.add_argument(
        "--concurrent",
        type=int,
        default=1,
        help="Concurrent requests",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=256,
        help="Max tokens per response",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (JSON)",
    )

    args = parser.parse_args()

    print(f"vLLM Benchmark")
    print(f"==============")
    print(f"URL: {args.url}")
    print(f"Model: {args.model}")
    print(f"Requests: {args.num_requests}")
    print(f"Concurrent: {args.concurrent}")
    print(f"Max tokens: {args.max_tokens}")
    print()

    # Run benchmark
    print("Running benchmark...")
    start_time = time.perf_counter()
    results = asyncio.run(
        run_benchmark(
            args.url,
            args.model,
            args.prompt,
            args.num_requests,
            args.concurrent,
            args.max_tokens,
        )
    )
    total_duration = time.perf_counter() - start_time

    # Calculate summary
    summary = calculate_summary(
        results, args.url, args.model, args.prompt, args.concurrent, total_duration
    )

    # Print summary
    print()
    print("Results")
    print("=======")
    print(f"Success Rate: {summary.success_rate:.1f}%")
    print(f"Successful: {summary.successful_requests}/{summary.total_requests}")
    print()
    print("Latency (ms):")
    print(f"  Mean: {summary.latency_mean:.2f}")
    print(f"  P50:  {summary.latency_p50:.2f}")
    print(f"  P90:  {summary.latency_p90:.2f}")
    print(f"  P95:  {summary.latency_p95:.2f}")
    print(f"  P99:  {summary.latency_p99:.2f}")
    print()
    print(f"TTFT Mean: {summary.ttft_mean:.2f}ms")
    print(f"TTFT P95:  {summary.ttft_p95:.2f}ms")
    print()
    print(f"Tokens/sec (mean): {summary.tokens_per_second_mean:.2f}")
    print(f"Requests/sec: {summary.requests_per_second:.2f}")
    print(f"Total duration: {summary.total_duration_seconds:.2f}s")

    # Write output
    output_path = args.output
    if not output_path:
        project_root = Path(__file__).parent.parent.parent
        artifacts_dir = project_root / "artifacts" / "benchmarks"
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        output_path = artifacts_dir / f"vllm_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    output = {
        "summary": asdict(summary),
        "results": [asdict(r) for r in results],
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print()
    print(f"Results written to: {output_path}")

    # Return non-zero if too many failures
    if summary.success_rate < 95:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
