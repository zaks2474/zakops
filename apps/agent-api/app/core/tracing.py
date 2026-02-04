"""
Langfuse Tracing Integration — Conditional Activation

Activates automatically when LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
and LANGFUSE_HOST environment variables are set.

When not configured, all tracing calls are silent no-ops.
This module was created as part of AGENT-REMEDIATION-005 (F-001 fix).
"""
import os
import logging
from contextlib import contextmanager
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

# Lazy singleton
_langfuse_client = None
_initialized = False


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
