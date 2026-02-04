#!/usr/bin/env python3
"""
RT-TRACE-SINK Verification Script

Proves that tracing wiring works WITHOUT external Langfuse connection.
This is a local-only test that requires NO API keys.

Usage: python scripts/test_trace_sink.py
Exit: 0 = PASS, 1 = FAIL

Created as part of AGENT-REMEDIATION-005 (F-001 RT-TRACE-SINK).
"""
import sys
import os

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.trace_sink import get_test_sink
from app.core.tracing import trace_span


def test_trace_sink():
    """Verify trace_span records to local sink."""
    sink = get_test_sink()
    sink.enable()
    sink.clear()

    # Trigger a traced operation
    with trace_span("test.operation", {"key": "value"}):
        pass  # Simulated operation

    # Verify span was recorded
    spans = sink.get_spans()
    sink.disable()

    if not spans:
        print("FAIL: No spans recorded")
        return False

    test_span = next((s for s in spans if s["name"] == "test.operation"), None)
    if not test_span:
        print("FAIL: test.operation span not found")
        return False

    if test_span["metadata"].get("key") != "value":
        print("FAIL: Metadata not captured correctly")
        return False

    print("PASS: trace_span correctly wired to local sink")
    print(f"  Recorded spans: {[s['name'] for s in spans]}")
    return True


if __name__ == "__main__":
    success = test_trace_sink()
    sys.exit(0 if success else 1)
