"""
Event Models

Pydantic models for event data structures with schema versioning.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(UTC)


class EventBase(BaseModel):
    """Base event model with required fields."""

    id: UUID = Field(default_factory=uuid4)
    correlation_id: UUID
    event_type: str
    event_data: dict[str, Any] = Field(default_factory=dict)
    schema_version: int = 1
    source: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }


class AgentEvent(EventBase):
    """Event from agent execution."""

    run_id: UUID | None = None
    thread_id: str | None = None

    @classmethod
    def create(
        cls,
        correlation_id: UUID,
        event_type: str,
        event_data: dict[str, Any],
        run_id: UUID | None = None,
        thread_id: str | None = None,
        source: str = "agent"
    ) -> "AgentEvent":
        return cls(
            correlation_id=correlation_id,
            event_type=event_type,
            event_data=event_data,
            run_id=run_id,
            thread_id=thread_id,
            source=source
        )


class DealEvent(EventBase):
    """Event related to deal lifecycle."""

    deal_id: UUID

    @classmethod
    def create(
        cls,
        deal_id: UUID,
        event_type: str,
        event_data: dict[str, Any],
        source: str = "deal_lifecycle"
    ) -> "DealEvent":
        # correlation_id = deal_id for deal events
        return cls(
            correlation_id=deal_id,
            deal_id=deal_id,
            event_type=event_type,
            event_data=event_data,
            source=source
        )


class ActionEvent(EventBase):
    """Event related to action workflow."""

    action_id: UUID
    deal_id: UUID | None = None

    @classmethod
    def create(
        cls,
        action_id: UUID,
        correlation_id: UUID,
        event_type: str,
        event_data: dict[str, Any],
        deal_id: UUID | None = None,
        source: str = "action_engine"
    ) -> "ActionEvent":
        return cls(
            action_id=action_id,
            correlation_id=correlation_id,
            deal_id=deal_id,
            event_type=event_type,
            event_data=event_data,
            source=source
        )


class WorkerEvent(EventBase):
    """Event from background worker."""

    job_id: UUID

    @classmethod
    def create(
        cls,
        job_id: UUID,
        correlation_id: UUID,
        event_type: str,
        event_data: dict[str, Any],
        source: str = "worker"
    ) -> "WorkerEvent":
        return cls(
            job_id=job_id,
            correlation_id=correlation_id,
            event_type=event_type,
            event_data=event_data,
            source=source
        )
