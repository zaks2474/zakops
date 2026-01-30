"""
Outbox Models

Phase 3: Execution Hardening
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(UTC)


class OutboxStatus(str, Enum):
    """Status of an outbox entry."""
    PENDING = "pending"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED = "failed"
    DEAD = "dead"  # Exceeded max attempts


class OutboxEntry(BaseModel):
    """An entry in the outbox table."""

    id: UUID = Field(default_factory=uuid4)
    correlation_id: UUID
    aggregate_type: str = "event"
    aggregate_id: str = ""
    event_type: str
    schema_version: int = 1
    event_data: dict[str, Any] = Field(default_factory=dict)
    trace_id: UUID | None = None

    status: OutboxStatus = OutboxStatus.PENDING
    attempts: int = 0
    max_attempts: int = 5

    last_attempt_at: datetime | None = None
    next_attempt_at: datetime | None = None
    delivered_at: datetime | None = None
    error_message: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
        }
