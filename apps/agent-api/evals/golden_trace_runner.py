#!/usr/bin/env python3
"""
Golden Trace Runner

Runs golden trace evaluations in two modes:
- CI mode: Uses mock_response from trace files for fast, deterministic testing
- Local mode: Calls real agent API at localhost:8095 for integration testing

Usage:
    CI=true python3 apps/agent-api/evals/golden_trace_runner.py
    python3 apps/agent-api/evals/golden_trace_runner.py  # local mode
"""

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Check for httpx availability for local mode
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


@dataclass
class TraceResult:
    """Result of running a single golden trace."""

    trace_id: str
    trace_name: str
    passed: bool
    errors: list[str]
    warnings: list[str]
    expected_tools: list[str]
    actual_tools: list[str]
    expected_approval: bool
    actual_approval: bool


def load_golden_traces(traces_dir: Path) -> list[dict]:
    """Load all golden trace files from the directory."""
    traces = []
    for trace_file in sorted(traces_dir.glob("GT-*.json")):
        with open(trace_file) as f:
            traces.append(json.load(f))
    return traces


def validate_trace_schema(trace: dict) -> list[str]:
    """Basic schema validation for a trace."""
    errors = []
    required_fields = ["id", "version", "name", "description", "input", "expected"]

    for field in required_fields:
        if field not in trace:
            errors.append(f"Missing required field: {field}")

    if "input" in trace:
        if "user_message" not in trace["input"]:
            errors.append("input.user_message is required")

    if "expected" in trace:
        if "tool_calls" not in trace["expected"]:
            errors.append("expected.tool_calls is required")

    return errors


def run_trace_ci_mode(trace: dict) -> TraceResult:
    """Run a trace in CI mode using mock_response."""
    trace_id = trace["id"]
    trace_name = trace["name"]
    errors = []
    warnings = []

    # Validate schema
    schema_errors = validate_trace_schema(trace)
    if schema_errors:
        return TraceResult(
            trace_id=trace_id,
            trace_name=trace_name,
            passed=False,
            errors=schema_errors,
            warnings=[],
            expected_tools=[],
            actual_tools=[],
            expected_approval=False,
            actual_approval=False,
        )

    # Get expected values
    expected = trace["expected"]
    expected_tools = [tc["tool_name"] for tc in expected.get("tool_calls", [])]
    expected_approval = expected.get("requires_approval", False)

    # Get mock response (if available)
    mock = trace.get("mock_response", {})
    if not mock:
        warnings.append("No mock_response defined, using expected as mock")
        mock = expected

    actual_tools = [tc["tool_name"] for tc in mock.get("tool_calls", [])]
    actual_approval = mock.get("requires_approval", False)

    # Compare tool calls
    if set(expected_tools) != set(actual_tools):
        errors.append(
            f"Tool mismatch: expected {expected_tools}, got {actual_tools}"
        )

    # Check tool order matters for sequential calls
    if expected_tools != actual_tools and len(expected_tools) > 1:
        errors.append(
            f"Tool order mismatch: expected {expected_tools}, got {actual_tools}"
        )

    # Compare approval requirement
    if expected_approval != actual_approval:
        errors.append(
            f"Approval mismatch: expected {expected_approval}, got {actual_approval}"
        )

    # Check response contains (if defined and response_text available)
    # At least one of the substrings should be present (OR logic)
    response_contains = expected.get("response_contains", [])
    response_text = mock.get("response_text", "")
    if response_contains:
        found_any = any(
            substring.lower() in response_text.lower()
            for substring in response_contains
        )
        if not found_any:
            errors.append(
                f"Response missing any expected substring: {response_contains}"
            )

    # Check response not contains
    response_not_contains = expected.get("response_not_contains", [])
    for substring in response_not_contains:
        if substring.lower() in response_text.lower():
            errors.append(f"Response contains forbidden substring: '{substring}'")

    passed = len(errors) == 0

    return TraceResult(
        trace_id=trace_id,
        trace_name=trace_name,
        passed=passed,
        errors=errors,
        warnings=warnings,
        expected_tools=expected_tools,
        actual_tools=actual_tools,
        expected_approval=expected_approval,
        actual_approval=actual_approval,
    )


def run_trace_local_mode(trace: dict, agent_url: str) -> TraceResult:
    """Run a trace against the real agent API."""
    trace_id = trace["id"]
    trace_name = trace["name"]
    errors = []
    warnings = []

    if not HTTPX_AVAILABLE:
        return TraceResult(
            trace_id=trace_id,
            trace_name=trace_name,
            passed=False,
            errors=["httpx not installed - required for local mode"],
            warnings=[],
            expected_tools=[],
            actual_tools=[],
            expected_approval=False,
            actual_approval=False,
        )

    # Validate schema
    schema_errors = validate_trace_schema(trace)
    if schema_errors:
        return TraceResult(
            trace_id=trace_id,
            trace_name=trace_name,
            passed=False,
            errors=schema_errors,
            warnings=[],
            expected_tools=[],
            actual_tools=[],
            expected_approval=False,
            actual_approval=False,
        )

    # Get expected values
    expected = trace["expected"]
    expected_tools = [tc["tool_name"] for tc in expected.get("tool_calls", [])]
    expected_approval = expected.get("requires_approval", False)

    # Build request payload
    input_data = trace["input"]
    payload = {
        "message": input_data["user_message"],
        "context": input_data.get("context", {}),
    }

    if "conversation_history" in input_data:
        payload["history"] = input_data["conversation_history"]

    # Call agent API
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{agent_url}/api/v1/agent/invoke",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
    except httpx.HTTPError as e:
        return TraceResult(
            trace_id=trace_id,
            trace_name=trace_name,
            passed=False,
            errors=[f"API call failed: {e}"],
            warnings=[],
            expected_tools=expected_tools,
            actual_tools=[],
            expected_approval=expected_approval,
            actual_approval=False,
        )

    # Extract actual values from response
    actual_tools = [tc.get("tool_name", "") for tc in result.get("tool_calls", [])]
    actual_approval = result.get("requires_approval", False)
    response_text = result.get("response", "")

    # Compare tool calls
    if set(expected_tools) != set(actual_tools):
        errors.append(
            f"Tool mismatch: expected {expected_tools}, got {actual_tools}"
        )

    # Compare approval requirement
    if expected_approval != actual_approval:
        errors.append(
            f"Approval mismatch: expected {expected_approval}, got {actual_approval}"
        )

    # Check response contains
    response_contains = expected.get("response_contains", [])
    for substring in response_contains:
        if substring.lower() not in response_text.lower():
            errors.append(f"Response missing expected substring: '{substring}'")

    passed = len(errors) == 0

    return TraceResult(
        trace_id=trace_id,
        trace_name=trace_name,
        passed=passed,
        errors=errors,
        warnings=warnings,
        expected_tools=expected_tools,
        actual_tools=actual_tools,
        expected_approval=expected_approval,
        actual_approval=actual_approval,
    )


def run_golden_traces(
    traces_dir: Path,
    ci_mode: bool = True,
    agent_url: str = "http://localhost:8095",
) -> dict[str, Any]:
    """Run all golden traces and return results."""
    traces = load_golden_traces(traces_dir)

    if not traces:
        return {
            "passed": False,
            "total": 0,
            "passed_count": 0,
            "failed_count": 0,
            "pass_rate": 0.0,
            "errors": ["No golden traces found"],
            "results": [],
        }

    results = []
    for trace in traces:
        if ci_mode:
            result = run_trace_ci_mode(trace)
        else:
            result = run_trace_local_mode(trace, agent_url)
        results.append(result)

    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    pass_rate = (passed_count / len(results)) * 100 if results else 0.0

    return {
        "passed": failed_count == 0,
        "total": len(results),
        "passed_count": passed_count,
        "failed_count": failed_count,
        "pass_rate": pass_rate,
        "mode": "ci" if ci_mode else "local",
        "results": [
            {
                "trace_id": r.trace_id,
                "trace_name": r.trace_name,
                "passed": r.passed,
                "errors": r.errors,
                "warnings": r.warnings,
                "expected_tools": r.expected_tools,
                "actual_tools": r.actual_tools,
            }
            for r in results
        ],
    }


def main():
    """Main entry point."""
    # Determine mode
    ci_mode = os.environ.get("CI", "").lower() in ("true", "1", "yes")

    # Determine paths
    script_dir = Path(__file__).parent
    traces_dir = script_dir / "golden_traces"

    # Agent URL for local mode
    agent_url = os.environ.get("AGENT_URL", "http://localhost:8095")

    print("=" * 60)
    print("Golden Trace Runner")
    print("=" * 60)
    print(f"Mode: {'CI (mock)' if ci_mode else 'Local (real agent)'}")
    print(f"Traces directory: {traces_dir}")
    if not ci_mode:
        print(f"Agent URL: {agent_url}")
    print()

    # Run traces
    results = run_golden_traces(traces_dir, ci_mode=ci_mode, agent_url=agent_url)

    # Print results
    for r in results["results"]:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"{status} {r['trace_id']}: {r['trace_name']}")
        if r["errors"]:
            for error in r["errors"]:
                print(f"       ERROR: {error}")
        if r["warnings"]:
            for warning in r["warnings"]:
                print(f"       WARNING: {warning}")

    print()
    print("-" * 60)
    print(f"Total: {results['total']}")
    print(f"Passed: {results['passed_count']}")
    print(f"Failed: {results['failed_count']}")
    print(f"Pass Rate: {results['pass_rate']:.1f}%")
    print("-" * 60)

    if results["passed"]:
        print("✅ Golden Trace Evaluation PASSED")
    else:
        print("❌ Golden Trace Evaluation FAILED")

    # Exit with appropriate code
    sys.exit(0 if results["passed"] else 1)


if __name__ == "__main__":
    main()
