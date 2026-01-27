"""External service resilience configuration.

This module defines timeouts, retries, backoff, and circuit breaker
configurations for external service calls per P1-RESILIENCE-001.

Services covered:
- Backend API (:8091)
- RAG REST (:8052)
- MCP (:9100)
- vLLM (:8000)
- Langfuse (:3001)
"""

import json
from dataclasses import dataclass, asdict, field
from typing import Dict, Optional
from enum import Enum

from app.core.logging import logger


class ServiceState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"       # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open" # Testing recovery


@dataclass
class RetryConfig:
    """Retry configuration with exponential backoff."""
    max_attempts: int = 3
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 10.0
    exponential_base: float = 2.0
    jitter: bool = True


@dataclass
class TimeoutConfig:
    """Timeout configuration for HTTP requests."""
    connect_timeout_seconds: float = 5.0
    read_timeout_seconds: float = 30.0
    total_timeout_seconds: float = 60.0


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration."""
    failure_threshold: int = 5         # Failures before opening
    success_threshold: int = 2         # Successes before closing
    timeout_seconds: float = 30.0      # Time before half-open
    half_open_max_calls: int = 1       # Calls allowed in half-open


@dataclass
class ServiceConfig:
    """Complete resilience configuration for a service."""
    name: str
    base_url: str
    timeout: TimeoutConfig = field(default_factory=TimeoutConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    health_endpoint: Optional[str] = None
    critical: bool = False  # If True, failures are escalated

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "base_url": self.base_url,
            "timeout": asdict(self.timeout),
            "retry": asdict(self.retry),
            "circuit_breaker": asdict(self.circuit_breaker),
            "health_endpoint": self.health_endpoint,
            "critical": self.critical,
        }


# Service configurations per Decision Lock
RESILIENCE_CONFIG: Dict[str, ServiceConfig] = {
    "deal_api": ServiceConfig(
        name="Backend API",
        base_url="${DEAL_API_URL:-http://host.docker.internal:8091}",
        timeout=TimeoutConfig(
            connect_timeout_seconds=5.0,
            read_timeout_seconds=30.0,
            total_timeout_seconds=60.0,
        ),
        retry=RetryConfig(
            max_attempts=3,
            base_delay_seconds=0.5,
            max_delay_seconds=10.0,
        ),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=5,
            success_threshold=2,
            timeout_seconds=30.0,
        ),
        health_endpoint="/health",
        critical=True,  # Deal transitions are critical
    ),

    "rag_rest": ServiceConfig(
        name="RAG REST",
        base_url="${RAG_REST_URL:-http://host.docker.internal:8052}",
        timeout=TimeoutConfig(
            connect_timeout_seconds=5.0,
            read_timeout_seconds=60.0,  # Retrieval can be slow
            total_timeout_seconds=90.0,
        ),
        retry=RetryConfig(
            max_attempts=2,
            base_delay_seconds=1.0,
            max_delay_seconds=5.0,
        ),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=1,
            timeout_seconds=60.0,
        ),
        health_endpoint="/health",
        critical=False,  # Degraded mode without RAG is acceptable
    ),

    "mcp": ServiceConfig(
        name="MCP Server",
        base_url="${MCP_URL:-http://host.docker.internal:9100}",
        timeout=TimeoutConfig(
            connect_timeout_seconds=5.0,
            read_timeout_seconds=30.0,
            total_timeout_seconds=45.0,
        ),
        retry=RetryConfig(
            max_attempts=3,
            base_delay_seconds=0.5,
            max_delay_seconds=8.0,
        ),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=5,
            success_threshold=2,
            timeout_seconds=30.0,
        ),
        health_endpoint="/health",
        critical=False,  # Direct tools can substitute
    ),

    "vllm": ServiceConfig(
        name="vLLM Inference",
        base_url="${VLLM_BASE_URL:-http://host.docker.internal:8000/v1}",
        timeout=TimeoutConfig(
            connect_timeout_seconds=5.0,
            read_timeout_seconds=120.0,  # LLM inference can be slow
            total_timeout_seconds=180.0,
        ),
        retry=RetryConfig(
            max_attempts=2,
            base_delay_seconds=2.0,
            max_delay_seconds=10.0,
        ),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=1,
            timeout_seconds=60.0,
        ),
        health_endpoint="/health",
        critical=True,  # No LLM = no agent
    ),

    "langfuse": ServiceConfig(
        name="Langfuse Tracing",
        base_url="${LANGFUSE_HOST:-http://localhost:3001}",
        timeout=TimeoutConfig(
            connect_timeout_seconds=3.0,
            read_timeout_seconds=10.0,
            total_timeout_seconds=15.0,
        ),
        retry=RetryConfig(
            max_attempts=2,
            base_delay_seconds=0.5,
            max_delay_seconds=3.0,
        ),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=10,  # More tolerant for non-critical
            success_threshold=1,
            timeout_seconds=60.0,
        ),
        health_endpoint="/api/public/health",
        critical=False,  # Agent works without tracing
    ),
}


def get_resilience_config_snapshot() -> dict:
    """Get a snapshot of all resilience configurations.

    Returns:
        dict: JSON-serializable config snapshot
    """
    return {
        "version": "1.0.0",
        "services": {
            name: config.to_dict()
            for name, config in RESILIENCE_CONFIG.items()
        },
        "defaults": {
            "timeout": asdict(TimeoutConfig()),
            "retry": asdict(RetryConfig()),
            "circuit_breaker": asdict(CircuitBreakerConfig()),
        }
    }


def export_resilience_config(filepath: str) -> None:
    """Export resilience configuration to JSON file.

    Args:
        filepath: Path to output JSON file
    """
    snapshot = get_resilience_config_snapshot()

    with open(filepath, 'w') as f:
        json.dump(snapshot, f, indent=2)

    logger.info("resilience_config_exported", filepath=filepath)


def get_service_config(service_name: str) -> Optional[ServiceConfig]:
    """Get configuration for a specific service.

    Args:
        service_name: Name of the service (deal_api, rag_rest, mcp, vllm, langfuse)

    Returns:
        ServiceConfig if found, None otherwise
    """
    return RESILIENCE_CONFIG.get(service_name)
