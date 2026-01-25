# Gap Matrix: Current State vs Master Architecture Spec

**Audit Date**: 2026-01-19
**Status**: Phase 0 Baseline Audit

---

## Executive Summary

| Category | Current State | Spec Requirement | Gap Severity |
|----------|---------------|------------------|--------------|
| Database Engine | SQLite | PostgreSQL | CRITICAL |
| Core Tables | 6 tables (actions) | 12+ tables | CRITICAL |
| Event System | Partial (audit only) | Full agent_events | CRITICAL |
| Correlation IDs | Not implemented | Required everywhere | CRITICAL |
| Outbox/Inbox | Not implemented | Required | HIGH |
| Storage Abstraction | None | ArtifactStore | HIGH |
| Authentication | Not implemented | Session-based | HIGH |
| API Endpoints | 74 endpoints | 90% coverage | MEDIUM |
| UI Components | Fully implemented | N/A | COMPLETE |

---

## Database Tables

| Spec Table | Current State | Gap | Migration Risk | Priority |
|------------|---------------|-----|----------------|----------|
| `operators` | Not exists | Create table | Low | P0 |
| `deals` | JSON file only | Create PostgreSQL table | Medium | P0 |
| `artifacts` | SQLite action_artifacts | Migrate + add columns | Medium | P0 |
| `emails` | Not exists | Create table | Low | P0 |
| `actions` | SQLite (partial schema) | Migrate + add columns | Medium | P0 |
| `agent_runs` | Not exists | Create table | Low | P0 |
| `agent_events` | action_audit_events only | Create + migrate | Low | P0 |
| `run_checkpoints` | Not exists | Create table | Low | P1 |
| `deal_threads` | Not exists | Create table | Low | P1 |
| `outbox` | Not exists | Create table | Low | P1 |
| `inbox` | Not exists | Create table | Low | P1 |
| `idempotency_keys` | Not exists | Create table | Low | P1 |
| `agent_events_archive` | Not exists | Create table | Low | P2 |

---

## Column Additions Required

### actions Table

| Column | Spec Requirement | Current | Action |
|--------|------------------|---------|--------|
| operator_id | UUID FK | Missing | Add |
| run_id | UUID FK | Missing | Add |
| trace_id | UUID | Missing | Add |
| correlation_id | UUID | Missing | Add |
| causation_id | UUID | Missing | Add |
| approved_by | UUID FK | Missing | Add |
| approved_at | TIMESTAMPTZ | Missing | Add |
| rejection_reason | TEXT | Missing | Add |
| archived_at | TIMESTAMPTZ | Missing | Add |

### artifacts Table

| Column | Spec Requirement | Current | Action |
|--------|------------------|---------|--------|
| storage_uri | VARCHAR(1000) | Missing | Add |
| storage_key | VARCHAR(500) | Missing | Add |
| deal_id | UUID FK | Present | Keep |

---

## API Endpoints

### Dashboard Endpoints

| Spec Endpoint | Current State | Gap | Notes |
|---------------|---------------|-----|-------|
| GET /api/dashboard/overview | Missing | Create | Dashboard uses multiple calls |
| GET /api/hq/stats | Missing | Create | HQ uses /api/pipeline |

### Deal Endpoints

| Spec Endpoint | Current State | Gap | Notes |
|---------------|---------------|-----|-------|
| GET /api/deals | Exists | None | |
| GET /api/deals/:id | Exists | None | |
| GET /api/deals/:id/workspace | Missing | Create | Combined endpoint |
| POST /api/deals | Missing | Create | With idempotency |
| PATCH /api/deals/:id | Missing | Create | |

### Action Endpoints

| Spec Endpoint | Current State | Gap | Notes |
|---------------|---------------|-----|-------|
| GET /api/actions | Exists | None | |
| GET /api/actions/:id | Exists | None | |
| POST /api/actions/:id/approve | Exists | Add Idempotency-Key | |
| POST /api/actions/:id/reject | Exists | Add Idempotency-Key | |
| POST /api/actions/:id/archive | Exists | None | |
| DELETE /api/actions/:id | Exists | None | |
| POST /api/actions/bulk/archive | Exists | None | |
| POST /api/actions/bulk/delete | Exists | None | |
| POST /api/actions/clear-completed | Exists | None | |
| GET /api/actions/completed-count | Exists | None | |

### Agent Activity Endpoints

| Spec Endpoint | Current State | Gap | Notes |
|---------------|---------------|-----|-------|
| GET /api/agent/activity | Missing | Create | Needs agent_events |
| GET /api/agent/runs | Missing | Create | Needs agent_runs |

### Quarantine Endpoints

| Spec Endpoint | Current State | Gap | Notes |
|---------------|---------------|-----|-------|
| GET /api/quarantine | Exists | None | |
| POST /api/quarantine/:id/approve | Different | Refactor | Uses action workflow |
| POST /api/quarantine/:id/reject | Different | Refactor | Uses action workflow |

---

## Infrastructure

| Spec Requirement | Current State | Gap | Notes |
|------------------|---------------|-----|-------|
| Event emission system | Partial | Implement | Only action_audit_events |
| Idempotency middleware | Not implemented | Create | |
| Background workers | Exists | Keep | Action runner |
| Outbox publisher | Not implemented | Create | |
| ArtifactStore abstraction | Not implemented | Create | |
| Feature flag system | Partial | Enhance | Basic env vars only |
| Route registry | Not implemented | Create | For UI consistency |

---

## Storage

| Spec Requirement | Current State | Gap | Notes |
|------------------|---------------|-----|-------|
| Configurable artifact path | Yes | None | DATAROOM_ROOT env |
| ArtifactStore interface | No | Create | |
| LocalFilesystemArtifactStore | No | Create | |
| S3/MinIO support | No | Create | |
| Structured artifact keys | No | Implement | deal/{id}/type/file |

---

## Security

| Spec Requirement | Current State | Gap | Notes |
|------------------|---------------|-----|-------|
| Session-based auth | Not implemented | Create | CRITICAL |
| Operator identity from session | Not implemented | Create | CRITICAL |
| Resource authorization | Not implemented | Create | |

---

## Frontend (zakops-dashboard)

| Spec Requirement | Current State | Gap | Notes |
|------------------|---------------|-----|-------|
| Dashboard page | Exists | None | |
| Operator HQ | Exists | None | |
| Deals listing | Exists | None | |
| Deal workspace | Exists | None | |
| Actions page | Exists | None | |
| Quarantine page | Exists | None | |
| Agent activity | Exists | API missing | Needs backend |
| Onboarding | Exists | None | |
| Chat | Exists | None | |
| Command palette | Exists | None | |
| SSE streaming | Exists | None | |

**Assessment**: Frontend is feature-complete. All gaps are backend-related.

---

## Legend

- P0 = Critical path, blocks other work
- P1 = High priority, needed for production
- P2 = Nice to have, can defer
- CRITICAL = Blocks deployment
- HIGH = Significant risk
- MEDIUM = Manageable risk
- LOW = Minor issue

---

## Summary Statistics

| Category | Total | Complete | Partial | Missing |
|----------|-------|----------|---------|---------|
| Database Tables | 13 | 1 | 1 | 11 |
| API Endpoints | ~50 | 40 | 5 | 5 |
| Infrastructure | 7 | 1 | 2 | 4 |
| Security | 3 | 0 | 0 | 3 |
| UI Features | 10 | 10 | 0 | 0 |
