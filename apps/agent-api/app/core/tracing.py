"""
Langfuse Tracing Integration — Conditional Activation

R3 REMEDIATION [P2.2]: Enhanced with startup health check and span tracking.

Activates automatically when LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
and LANGFUSE_HOST environment variables are set.

When not configured, all tracing calls are silent no-ops.
This module was created as part of AGENT-REMEDIATION-005 (F-001 fix).
"""
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional, List, Any, Dict

# Use structlog logger from app.core.logging for consistent logging style
try:
    from app.core.logging import logger
except ImportError:
    # Fallback for standalone testing
    import logging
    logger = logging.getLogger(__name__)

# Lazy singleton
_langfuse_client = None
_initialized = False
_health_status: Optional[Dict[str, Any]] = None


@dataclass
class TracingHealthStatus:
    """R3 REMEDIATION [P2.2]: Health status for tracing system."""
    configured: bool
    connected: bool
    latency_ms: Optional[float]
    error: Optional[str]


def _is_configured() -> bool:
    """Check if all required Langfuse environment variables are set."""
    return all([
        os.getenv("LANGFUSE_PUBLIC_KEY"),
        os.getenv("LANGFUSE_SECRET_KEY"),
        os.getenv("LANGFUSE_HOST"),
    ])


def get_langfuse():
    """
    Returns the Langfuse client if configured, None otherwise.
    Safe to call repeatedly — uses lazy singleton pattern.
    """
    global _langfuse_client, _initialized

    if _initialized:
        return _langfuse_client

    _initialized = True

    if not _is_configured():
        logger.info("Langfuse tracing not configured — running without traces. "
                    "Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST to enable.")
        return None

    try:
        from langfuse import Langfuse
        _langfuse_client = Langfuse(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
            host=os.getenv("LANGFUSE_HOST"),
        )
        logger.info("Langfuse tracing initialized successfully.")
        return _langfuse_client
    except Exception as e:
        logger.warning(f"Langfuse initialization failed (non-fatal): {e}")
        return None


def get_callback_handler(**kwargs):
    """
    Returns a Langfuse CallbackHandler if configured, None otherwise.
    Safe for use in langchain/langgraph callbacks lists.

    Args:
        **kwargs: Optional parameters to pass to CallbackHandler
                  (e.g., environment, debug, user_id, session_id)
    """
    if not _is_configured():
        return None

    try:
        from langfuse.langchain import CallbackHandler
        return CallbackHandler(**kwargs) if kwargs else CallbackHandler()
    except Exception as e:
        logger.warning(f"Failed to create Langfuse CallbackHandler (non-fatal): {e}")
        return None


def get_callbacks(**kwargs) -> List[Any]:
    """
    Returns a list of callback handlers for use in langchain/langgraph.
    Returns empty list if Langfuse is not configured.

    Args:
        **kwargs: Optional parameters to pass to CallbackHandler

    Usage:
        config = {"callbacks": get_callbacks()}
        # or with parameters:
        config = {"callbacks": get_callbacks(user_id="abc", session_id="xyz")}
    """
    handler = get_callback_handler(**kwargs)
    return [handler] if handler else []


@contextmanager
def trace_span(name: str, metadata: Optional[dict] = None):
    """
    Context manager for tracing a span. No-op if Langfuse is not configured.

    Usage:
        with trace_span("process_approval", {"approval_id": "abc"}):
            # ... your code here
    """
    # Record to local sink (for testing) - imported inside to avoid circular deps
    try:
        from app.core.trace_sink import get_test_sink
        sink = get_test_sink()
        sink.record_span(name, metadata)
    except ImportError:
        pass  # trace_sink module may not exist yet

    client = get_langfuse()
    if client is None:
        yield None
        return

    trace = client.trace(name=name, metadata=metadata or {})
    try:
        yield trace
    finally:
        try:
            client.flush()
        except Exception:
            pass  # Non-fatal — never break business logic for tracing


def shutdown():
    """Flush and close Langfuse client. Call on app shutdown."""
    global _langfuse_client
    if _langfuse_client:
        try:
            _langfuse_client.flush()
            _langfuse_client.shutdown()
        except Exception:
            pass
        _langfuse_client = None


# R3 REMEDIATION [P2.2]: Startup health check and span tracking

def check_health() -> TracingHealthStatus:
    """R3 REMEDIATION [P2.2]: Check Langfuse connectivity on startup.

    Returns health status including:
    - configured: Whether env vars are set
    - connected: Whether connection succeeded
    - latency_ms: Round-trip time to Langfuse
    - error: Error message if connection failed
    """
    global _health_status

    if not _is_configured():
        status = TracingHealthStatus(
            configured=False,
            connected=False,
            latency_ms=None,
            error="Langfuse not configured (missing LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, or LANGFUSE_HOST)"
        )
        logger.info("langfuse_health_check", status="not_configured")
        _health_status = status.__dict__
        return status

    start_time = time.time()
    try:
        client = get_langfuse()
        if client is None:
            status = TracingHealthStatus(
                configured=True,
                connected=False,
                latency_ms=None,
                error="Langfuse client failed to initialize"
            )
            logger.warning("langfuse_health_check", status="init_failed")
            _health_status = status.__dict__
            return status

        # Attempt a simple operation to verify connectivity
        # Create and immediately flush a test trace
        test_trace = client.trace(
            name="_health_check",
            metadata={"purpose": "startup_health_check"}
        )
        client.flush()

        latency_ms = (time.time() - start_time) * 1000

        status = TracingHealthStatus(
            configured=True,
            connected=True,
            latency_ms=round(latency_ms, 2),
            error=None
        )
        logger.info(
            "langfuse_health_check",
            status="connected",
            latency_ms=status.latency_ms,
            host=os.getenv("LANGFUSE_HOST"),
        )
        _health_status = status.__dict__
        return status

    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        status = TracingHealthStatus(
            configured=True,
            connected=False,
            latency_ms=round(latency_ms, 2),
            error=str(e)
        )
        logger.warning(
            "langfuse_health_check",
            status="connection_failed",
            error=str(e),
            latency_ms=status.latency_ms,
        )
        _health_status = status.__dict__
        return status


def get_health_status() -> Optional[Dict[str, Any]]:
    """Get the last health check status."""
    return _health_status


# R3 REMEDIATION [P2.2]: Span types for agent observability

class SpanType:
    """Predefined span types for agent tracing."""
    AGENT_TURN = "agent_turn"
    TOOL_EXECUTION = "tool_execution"
    LLM_CALL = "llm_call"
    HITL_APPROVAL = "hitl_approval"
    MEMORY_RETRIEVAL = "memory_retrieval"
    RAG_SEARCH = "rag_search"


@contextmanager
def trace_agent_turn(
    thread_id: str,
    user_id: str,
    correlation_id: Optional[str] = None,
    prompt_version: Optional[str] = None,
    prompt_hash: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """R3 REMEDIATION [P2.2]: Trace an agent turn (user message → response).

    Usage:
        with trace_agent_turn(thread_id, user_id, correlation_id, prompt_version) as span:
            # ... process agent turn
            if span:
                span.update(metadata={"tools_called": ["get_deal"]})
    """
    full_metadata = {
        "span_type": SpanType.AGENT_TURN,
        "thread_id": thread_id,
        "user_id": user_id,
        "correlation_id": correlation_id,
        "prompt_version": prompt_version,
        "prompt_hash": prompt_hash,
        **(metadata or {}),
    }

    with trace_span(f"agent_turn:{thread_id[:8]}", full_metadata) as span:
        yield span


@contextmanager
def trace_tool_execution(
    tool_name: str,
    thread_id: str,
    correlation_id: Optional[str] = None,
    tool_args: Optional[dict] = None,
    metadata: Optional[dict] = None,
):
    """R3 REMEDIATION [P2.2]: Trace a tool execution.

    Usage:
        with trace_tool_execution("get_deal", thread_id, correlation_id, {"deal_id": "DL-123"}) as span:
            result = await tool.ainvoke(args)
            if span:
                span.update(metadata={"success": True})
    """
    # Redact sensitive values from tool_args
    safe_args = _redact_tool_args(tool_args) if tool_args else None

    full_metadata = {
        "span_type": SpanType.TOOL_EXECUTION,
        "tool_name": tool_name,
        "thread_id": thread_id,
        "correlation_id": correlation_id,
        "tool_args": safe_args,
        **(metadata or {}),
    }

    with trace_span(f"tool:{tool_name}", full_metadata) as span:
        yield span


@contextmanager
def trace_llm_call(
    model: str,
    thread_id: str,
    correlation_id: Optional[str] = None,
    prompt_version: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """R3 REMEDIATION [P2.2]: Trace an LLM API call.

    Usage:
        with trace_llm_call(model_name, thread_id, correlation_id) as span:
            response = await llm.call(messages)
            if span:
                span.update(metadata={"tokens": response.token_count})
    """
    full_metadata = {
        "span_type": SpanType.LLM_CALL,
        "model": model,
        "thread_id": thread_id,
        "correlation_id": correlation_id,
        "prompt_version": prompt_version,
        **(metadata or {}),
    }

    with trace_span(f"llm:{model[:20]}", full_metadata) as span:
        yield span


@contextmanager
def trace_hitl_approval(
    approval_id: str,
    tool_name: str,
    thread_id: str,
    correlation_id: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """R3 REMEDIATION [P2.2]: Trace HITL approval flow.

    Usage:
        with trace_hitl_approval(approval_id, tool_name, thread_id) as span:
            result = await process_approval(approval_id)
            if span:
                span.update(metadata={"approved": result.approved})
    """
    full_metadata = {
        "span_type": SpanType.HITL_APPROVAL,
        "approval_id": approval_id,
        "tool_name": tool_name,
        "thread_id": thread_id,
        "correlation_id": correlation_id,
        **(metadata or {}),
    }

    with trace_span(f"hitl:{tool_name}", full_metadata) as span:
        yield span


def _redact_tool_args(args: dict) -> dict:
    """Redact sensitive values from tool arguments for safe logging."""
    if not args:
        return {}

    sensitive_keys = {
        "password", "secret", "token", "api_key", "apikey",
        "authorization", "auth", "credential", "key"
    }

    redacted = {}
    for key, value in args.items():
        key_lower = key.lower()
        if any(s in key_lower for s in sensitive_keys):
            redacted[key] = "[REDACTED]"
        elif isinstance(value, str) and len(value) > 200:
            redacted[key] = value[:200] + "...[truncated]"
        else:
            redacted[key] = value

    return redacted
