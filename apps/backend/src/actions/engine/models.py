from __future__ import annotations

import hashlib
import json
import os
import socket
import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ActionStatus = Literal["PENDING_APPROVAL", "READY", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]
ActionSource = Literal["chat", "ui", "system"]
RiskLevel = Literal["low", "medium", "high"]
ErrorCategory = Literal["validation", "dependency", "cloud_policy", "cloud_transient", "io", "unknown"]
StepStatus = Literal["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "SKIPPED"]


def now_utc() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def now_utc_iso() -> str:
    return now_utc().isoformat().replace("+00:00", "Z")


def safe_uuid() -> str:
    return str(uuid.uuid4())


def compute_idempotency_key(*parts: str) -> str:
    raw = "|".join([p.strip() for p in parts if (p or "").strip()])
    if not raw:
        raw = safe_uuid()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ActionError(BaseModel):
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    category: ErrorCategory = "unknown"
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}


class AuditEvent(BaseModel):
    audit_id: str = Field(default_factory=safe_uuid)
    timestamp: str = Field(default_factory=now_utc_iso)
    event: str = Field(min_length=1)
    actor: str = Field(min_length=1)
    details: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}


class ArtifactMetadata(BaseModel):
    artifact_id: str = Field(default_factory=safe_uuid)
    filename: str = Field(min_length=1)
    mime_type: str = Field(min_length=1)
    path: str = Field(min_length=1, description="Absolute filesystem path")
    size_bytes: int = 0
    sha256: str | None = None
    created_at: str = Field(default_factory=now_utc_iso)
    download_url: str | None = None

    model_config = {"extra": "forbid"}


class ActionStep(BaseModel):
    """
    Persisted workflow step within an action.

    Steps enable:
    - Resumable workflows (restart from last completed step)
    - Audit trail per step
    - Approval gates on specific steps (e.g., send email)
    """
    step_id: str = Field(default_factory=safe_uuid)
    action_id: str = Field(min_length=1)
    step_index: int = Field(ge=0)
    name: str = Field(min_length=1, max_length=100)  # e.g., "gather_context", "draft_email", "send_email"
    status: StepStatus = "PENDING"
    started_at: str | None = None
    ended_at: str | None = None
    output_ref: str | None = None  # JSON pointer to artifact or outputs key
    error: ActionError | None = None
    requires_approval: bool = False  # Gate before execution (e.g., send email)
    approved_by: str | None = None
    approved_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}


class ActionPayload(BaseModel):
    action_id: str = Field(default_factory=lambda: f"ACT-{now_utc().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}")
    deal_id: str | None = None
    capability_id: str | None = None

    type: str = Field(min_length=1, description="Namespaced action type, e.g. DOCUMENT.GENERATE_LOI")
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=500)
    status: ActionStatus = "PENDING_APPROVAL"

    created_at: str = Field(default_factory=now_utc_iso)
    updated_at: str = Field(default_factory=now_utc_iso)
    started_at: str | None = None
    completed_at: str | None = None
    duration_seconds: float | None = None

    created_by: str = Field(min_length=1)
    source: ActionSource = "ui"

    risk_level: RiskLevel = "medium"
    requires_human_review: bool = True

    idempotency_key: str = Field(min_length=1)

    inputs: dict[str, Any] = Field(default_factory=dict)
    outputs: dict[str, Any] = Field(default_factory=dict)
    error: ActionError | None = None

    retry_count: int = 0
    max_retries: int = 3
    next_attempt_at: str | None = None  # ISO8601

    audit_trail: list[AuditEvent] = Field(default_factory=list)
    artifacts: list[ArtifactMetadata] = Field(default_factory=list)
    steps: list[ActionStep] = Field(default_factory=list)

    hidden_from_quarantine: bool = Field(default=False)
    quarantine_hidden_at: str | None = None
    quarantine_hidden_by: str | None = None
    quarantine_hidden_reason: str | None = None

    # Runner / lease state (server-managed)
    runner_lock_owner: str | None = None
    runner_lock_expires_at: str | None = None
    runner_heartbeat_at: str | None = None

    model_config = {"extra": "forbid"}


class RunnerLease(BaseModel):
    runner_name: str
    owner_id: str
    lease_expires_at: str
    heartbeat_at: str
    pid: int
    host: str

    model_config = {"extra": "forbid"}


def default_runner_owner_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def json_loads(raw: str | None) -> Any:
    if not raw:
        return None
    return json.loads(raw)
