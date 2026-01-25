# Phase 6 Report: HITL & Checkpoints

**Date**: 2026-01-19
**Status**: Complete

---

## Summary

Phase 6 implemented Human-in-the-Loop (HITL) approval workflows and durable execution checkpoints. The system provides configurable risk assessment, approval workflows, and checkpoint persistence for resumable execution.

---

## Deliverables

| Deliverable | Status | Notes |
|-------------|--------|-------|
| RiskAssessor | ✅ | Configurable risk rules, 4 risk levels |
| ApprovalWorkflow | ✅ | Approve/reject/escalate with audit trail |
| CheckpointStore | ✅ | Uses execution_checkpoints table |
| HITL API Endpoints | ✅ | `/api/hitl/*` router |
| Integration with Events | ✅ | Events recorded in deal_events |

---

## Risk Levels

| Level | Requires Approval | Use Case |
|-------|-------------------|----------|
| low | No | Read-only operations (list, get, fetch) |
| medium | No (configurable) | Data enrichment, analysis |
| high | Yes | Document generation, stage changes |
| critical | Yes | External communication, financial ops |

---

## Architecture

### Risk Assessment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     RiskAssessor                             │
│                                                              │
│   assess_risk(action_type, inputs, context)                 │
│       │                                                      │
│       ▼                                                      │
│   ┌──────────────────┐                                       │
│   │ Match Rules      │                                       │
│   │ (action_types,   │                                       │
│   │  patterns)       │                                       │
│   └────────┬─────────┘                                       │
│            │                                                 │
│   ┌────────┴────────────────┐                               │
│   │ Calculate Risk Level    │                               │
│   │ - Bulk operations +0.2  │                               │
│   │ - Financial data +0.15  │                               │
│   │ - External comms +0.1   │                               │
│   └────────┬────────────────┘                               │
│            ▼                                                 │
│   RiskAssessment(level, requires_approval, reasons)         │
└─────────────────────────────────────────────────────────────┘
```

### Approval Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   ApprovalWorkflow                           │
│                                                              │
│   ┌───────────┐     ┌──────────┐     ┌───────────┐         │
│   │  Request  │────▶│ Pending  │────▶│ Approved  │         │
│   │  Approval │     │          │     │           │         │
│   └───────────┘     └────┬─────┘     └───────────┘         │
│                          │                                   │
│                    ┌─────┴─────┐                            │
│                    ▼           ▼                            │
│              ┌──────────┐ ┌───────────┐                     │
│              │ Rejected │ │ Escalated │                     │
│              └──────────┘ └───────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### Checkpoint Store

```
┌─────────────────────────────────────────────────────────────┐
│                    CheckpointStore                           │
│                                                              │
│   save_checkpoint(correlation_id, name, data)               │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────┐                   │
│   │ zakops.execution_checkpoints        │                   │
│   │ - correlation_id                    │                   │
│   │ - action_id                         │                   │
│   │ - checkpoint_name                   │                   │
│   │ - checkpoint_data (JSONB)           │                   │
│   │ - sequence_number                   │                   │
│   │ - status (active/resumed/expired)   │                   │
│   └─────────────────────────────────────┘                   │
│                                                              │
│   Checkpoint Types:                                          │
│   - state: General execution state                          │
│   - approval_gate: Waiting for approval                     │
│   - external_call: Waiting for external response            │
│   - timer: Scheduled continuation                           │
│   - error_recovery: Before retry attempt                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Quality Gates

| Gate | Status |
|------|--------|
| Risk assessment works | ✅ |
| Correct risk levels assigned | ✅ |
| HITL imports work | ✅ |
| API router compiles | ✅ |
| Frontend builds | ✅ |

---

## API Endpoints Added

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hitl/assess-risk` | POST | Assess risk for an action |
| `/api/hitl/approval-queue` | GET | Get pending approvals |
| `/api/hitl/actions/{id}/approve` | POST | Approve an action |
| `/api/hitl/actions/{id}/reject` | POST | Reject an action |
| `/api/hitl/actions/{id}/quarantine` | POST | Quarantine for review |
| `/api/hitl/actions/{id}/checkpoints` | GET | List action checkpoints |
| `/api/hitl/actions/{id}/checkpoints/{name}` | GET | Get checkpoint data |
| `/api/hitl/actions/{id}/checkpoints/{id}/resume` | POST | Mark as resumed |
| `/api/hitl/risk-rules` | GET | Get configured risk rules |

---

## Files Created

### zakops-backend

```
src/core/hitl/__init__.py           (new)
src/core/hitl/risk.py               (new)
src/core/hitl/approval.py           (new)
src/core/hitl/checkpoint.py         (new)
src/api/shared/routers/__init__.py  (updated)
src/api/shared/routers/hitl.py      (new)
```

### zakops-dashboard

```
.claude/reports/phase6-hitl-checkpoints.md (new)
```

---

## Default Risk Rules

| Rule Name | Risk Level | Applies To |
|-----------|------------|------------|
| external_email | critical | COMMUNICATION.SEND_EMAIL |
| document_generation | high | DOCUMENT.GENERATE_* |
| high_value_operation | high | *PAYMENT*, *TRANSFER* |
| data_enrichment | medium | *ENRICH*, *PROFILE* |
| analysis | medium | ANALYSIS.* |
| read_only | low | *GET*, *LIST*, *READ* |

---

## Usage Examples

### Assess Risk Before Action

```python
from src.core.hitl import assess_risk

# Assess risk for an action
assessment = assess_risk(
    "COMMUNICATION.SEND_EMAIL",
    inputs={"recipient": "external@example.com"}
)

print(f"Risk: {assessment.risk_level.value}")
print(f"Requires approval: {assessment.requires_approval}")
```

### Save Checkpoint During Execution

```python
from src.core.hitl import get_checkpoint_store

store = await get_checkpoint_store()

# Save checkpoint after step 1
await store.save_checkpoint(
    correlation_id=deal_id,
    checkpoint_name="after_document_generation",
    checkpoint_data={
        "document_id": doc.id,
        "step": 1,
        "processed_pages": 50
    },
    action_id=action_id
)
```

### Resume from Checkpoint

```python
from src.core.hitl import get_checkpoint_store

store = await get_checkpoint_store()

# Get latest checkpoint for action
checkpoint = await store.get_latest_checkpoint(action_id=action_id)

if checkpoint:
    step = checkpoint.checkpoint_data.get("step", 0)
    # Resume from this step...
    await store.mark_resumed(checkpoint.checkpoint_id, resumed_by="system")
```

### Request Approval

```python
from src.core.hitl import get_approval_workflow, assess_risk

# Assess risk first
assessment = assess_risk(action_type, inputs)

if assessment.requires_approval:
    workflow = await get_approval_workflow()
    await workflow.request_approval(
        action_id=action_id,
        action_type=action_type,
        correlation_id=deal_id,
        inputs=inputs
    )
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| ZAKOPS_HITL_DEFAULT_RISK_LEVEL | medium | Default risk when no rules match |
| ZAKOPS_HITL_DEFAULT_REQUIRES_APPROVAL | true | Default approval requirement |
| ZAKOPS_HITL_AUTO_APPROVE_LOW_RISK | false | Auto-approve low risk actions |

---

## Compatibility Notes

- **NO breaking changes** to existing action approval flow
- HITL is **ADDITIVE** — enhances safety without breaking workflows
- Existing actions continue to work unchanged
- Checkpoints are **optional** for existing code
- Risk rules are **configurable**, not hardcoded

---

## Database Tables Used

### zakops.execution_checkpoints (from Phase 1)
- id (UUID, PK)
- correlation_id (UUID)
- action_id (VARCHAR, FK)
- run_id (UUID)
- checkpoint_name (VARCHAR)
- checkpoint_type (VARCHAR)
- checkpoint_data (JSONB)
- sequence_number (INTEGER)
- status (VARCHAR)
- expires_at (TIMESTAMPTZ)
- resumed_at (TIMESTAMPTZ)
- resumed_by (UUID)
- created_at (TIMESTAMPTZ)

### zakops.deal_events (for approval tracking)
- Used to record approval requests, decisions, and escalations
- Event types: hitl.approval_requested, hitl.approved, hitl.rejected, hitl.escalated

---

## Next Steps

1. **Phase 7**: Authentication - Operator identity for approvals
2. **Phase 8**: OpenAPI Specification
3. **Integration**: Connect HITL to action engine create flow
4. **Router Integration**: Include HITL router in main API app

---

## GitHub URLs

- **Backend**: https://github.com/zaks2474/zakops-backend
- **Dashboard**: https://github.com/zaks2474/zakops-dashboard
