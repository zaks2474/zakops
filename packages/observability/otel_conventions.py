"""OTEL Semantic Conventions for ZakOps.

This module defines OpenTelemetry semantic conventions for consistent
instrumentation across all ZakOps services.
"""

from dataclasses import dataclass
from typing import Any


# PII patterns for validation (do not log these)
PII_PATTERNS = [
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # email
    r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # phone
    r'\b\d{3}[-]?\d{2}[-]?\d{4}\b',  # SSN
    r'\b(?:\d{4}[-\s]?){3}\d{4}\b',  # credit card
    r'\b(?:\d{1,3}\.){3}\d{1,3}\b',  # IP address
]


class SpanNames:
    """Standardized span names for OpenTelemetry traces."""

    @staticmethod
    def http(method: str, route: str) -> str:
        """Generate span name for HTTP operations."""
        return f"HTTP {method} {route}"

    @staticmethod
    def database(operation: str, table: str) -> str:
        """Generate span name for database operations."""
        return f"DB {operation} {table}"

    @staticmethod
    def agent(action: str) -> str:
        """Generate span name for agent operations."""
        return f"Agent {action}"

    @staticmethod
    def llm(model: str, operation: str = "completion") -> str:
        """Generate span name for LLM operations."""
        return f"LLM {model} {operation}"

    @staticmethod
    def tool(tool_name: str) -> str:
        """Generate span name for tool executions."""
        return f"Tool {tool_name}"


@dataclass
class HttpAttributes:
    """HTTP semantic attributes."""
    method: str
    url: str
    status_code: int | None = None
    route: str | None = None
    user_agent: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to OTEL attribute dictionary."""
        attrs = {
            "http.method": self.method,
            "http.url": self.url,
        }
        if self.status_code is not None:
            attrs["http.status_code"] = self.status_code
        if self.route:
            attrs["http.route"] = self.route
        if self.user_agent:
            attrs["http.user_agent"] = self.user_agent
        return attrs


@dataclass
class DbAttributes:
    """Database semantic attributes."""
    system: str  # e.g., "postgresql", "sqlite"
    operation: str  # e.g., "SELECT", "INSERT"
    statement: str | None = None
    table: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to OTEL attribute dictionary."""
        attrs = {
            "db.system": self.system,
            "db.operation": self.operation,
        }
        if self.statement:
            attrs["db.statement"] = self.statement
        if self.table:
            attrs["db.sql.table"] = self.table
        return attrs


@dataclass
class LlmAttributes:
    """LLM semantic attributes."""
    model: str
    provider: str  # e.g., "openai", "anthropic", "local"
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    temperature: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to OTEL attribute dictionary."""
        attrs = {
            "llm.model": self.model,
            "llm.provider": self.provider,
        }
        if self.prompt_tokens is not None:
            attrs["llm.prompt_tokens"] = self.prompt_tokens
        if self.completion_tokens is not None:
            attrs["llm.completion_tokens"] = self.completion_tokens
        if self.total_tokens is not None:
            attrs["llm.total_tokens"] = self.total_tokens
        if self.temperature is not None:
            attrs["llm.temperature"] = self.temperature
        return attrs


@dataclass
class AgentAttributes:
    """Agent semantic attributes."""
    agent_id: str
    action: str
    tool_name: str | None = None
    requires_approval: bool = False
    approved_by: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to OTEL attribute dictionary."""
        attrs = {
            "agent.id": self.agent_id,
            "agent.action": self.action,
            "agent.requires_approval": self.requires_approval,
        }
        if self.tool_name:
            attrs["agent.tool_name"] = self.tool_name
        if self.approved_by:
            attrs["agent.approved_by"] = self.approved_by
        return attrs


def build_http_attributes(
    method: str,
    url: str,
    status_code: int | None = None,
    route: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Build HTTP attributes dictionary."""
    return HttpAttributes(
        method=method,
        url=url,
        status_code=status_code,
        route=route,
        user_agent=user_agent,
    ).to_dict()


def build_llm_attributes(
    model: str,
    provider: str,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    temperature: float | None = None,
) -> dict[str, Any]:
    """Build LLM attributes dictionary."""
    return LlmAttributes(
        model=model,
        provider=provider,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        temperature=temperature,
    ).to_dict()


def build_agent_attributes(
    agent_id: str,
    action: str,
    tool_name: str | None = None,
    requires_approval: bool = False,
    approved_by: str | None = None,
) -> dict[str, Any]:
    """Build Agent attributes dictionary."""
    return AgentAttributes(
        agent_id=agent_id,
        action=action,
        tool_name=tool_name,
        requires_approval=requires_approval,
        approved_by=approved_by,
    ).to_dict()
