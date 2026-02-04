"""
Local Trace Sink — RT-TRACE-SINK Gate

A test-only trace collector that captures spans in-memory.
Used to prove tracing wiring works without external Langfuse connection.

Usage in tests:
    from app.core.trace_sink import LocalTraceSink, get_test_sink

    sink = get_test_sink()
    sink.enable()
    # ... trigger traced operation ...
    spans = sink.get_spans()
    assert any(s["name"] == "agent.invoke" for s in spans)
    sink.disable()

This module was created as part of AGENT-REMEDIATION-005 (F-001 RT-TRACE-SINK).
"""
import threading
from typing import List, Dict, Any, Optional

_local_sink: Optional["LocalTraceSink"] = None
_lock = threading.Lock()


class LocalTraceSink:
    """Collects trace spans in-memory for testing."""

    def __init__(self):
        self._spans: List[Dict[str, Any]] = []
        self._enabled = False
        self._lock = threading.Lock()

    def enable(self):
        """Start collecting spans."""
        with self._lock:
            self._enabled = True
            self._spans = []

    def disable(self):
        """Stop collecting spans."""
        with self._lock:
            self._enabled = False

    def record_span(self, name: str, metadata: Optional[Dict] = None):
        """Record a span. Called by trace_span() when sink is enabled."""
        if not self._enabled:
            return
        with self._lock:
            self._spans.append({
                "name": name,
                "metadata": metadata or {},
            })

    def get_spans(self) -> List[Dict[str, Any]]:
        """Return all collected spans."""
        with self._lock:
            return list(self._spans)

    def clear(self):
        """Clear all collected spans."""
        with self._lock:
            self._spans = []

    def has_span(self, name: str) -> bool:
        """Check if a span with given name was recorded."""
        return any(s["name"] == name for s in self.get_spans())


def get_test_sink() -> LocalTraceSink:
    """Get or create the global test sink."""
    global _local_sink
    with _lock:
        if _local_sink is None:
            _local_sink = LocalTraceSink()
        return _local_sink
