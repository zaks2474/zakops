# Recommended Migration Order

**Audit Date**: 2026-01-19
**Status**: Phase 0 Baseline Audit

---

## Dependency Graph

```
Phase 0 (Audit) ──────► COMPLETE
       │
       ▼
Phase 1 (Database) ───► Foundation for all others
       │
       ├────────────────┬────────────────┐
       ▼                ▼                ▼
Phase 2 (Events)   Phase 4 (Storage)  Phase 5 (API)
       │                │                │
       └────────┬───────┘                │
                ▼                        │
         Phase 3 (Workers)               │
                │                        │
                └────────┬───────────────┘
                         ▼
                  Phase 6 (HITL)
                         │
                         ▼
                  Phase 7 (Auth)
                         │
                         ▼
                  Phase 8 (OpenAPI)
```

---

## Phase 1: Database Foundation

**Priority**: P0 (Critical Path)
**Risk**: Medium
**Dependencies**: None

### Batch 1.1: PostgreSQL Setup

1. Create PostgreSQL database
2. Configure connection pool
3. Set up migrations framework (Alembic)
4. Create `operators` table
5. Create `deals` table (PostgreSQL version)

### Batch 1.2: Core Execution Tables

Order matters - foreign keys require parent tables first.

1. `agent_runs` - No dependencies
2. `agent_events` - Depends on agent_runs
3. `run_checkpoints` - Depends on agent_runs

### Batch 1.3: Reliability Tables

4. `outbox` - No dependencies
5. `inbox` - No dependencies
6. `idempotency_keys` - No dependencies

### Batch 1.4: Integration Tables

7. `deal_threads` - Depends on deals
8. `agent_events_archive` - Mirrors agent_events

### Batch 1.5: Column Additions

9. Add `trace_id`, `correlation_id`, `causation_id` to `actions`
10. Add `operator_id`, `run_id` to `actions`
11. Add `archived_at`, `approved_by`, `approved_at` to `actions`
12. Add `storage_uri`, `storage_key` to `artifacts`

### Batch 1.6: Data Migration

13. Migrate deal_registry.json to PostgreSQL deals table
14. Migrate SQLite actions to PostgreSQL
15. Migrate SQLite action_audit_events to agent_events
16. Migrate SQLite action_artifacts to PostgreSQL

---

## Phase 2: Event System (After Phase 1)

**Priority**: P0 (Critical Path)
**Risk**: Low
**Dependencies**: Phase 1 (agent_events table)

1. Create EventEmitter service class
2. Define event type registry (enum/constants)
3. Implement emit_event() function
4. Add event emission to action state transitions
5. Add event emission to deal state transitions
6. Verify events appear in agent_events table
7. Create event query endpoints

---

## Phase 3: Execution Hardening (After Phase 2)

**Priority**: P1
**Risk**: Medium
**Dependencies**: Phase 2 (events)

1. Implement idempotency middleware
2. Add Idempotency-Key header handling
3. Update action creation to use idempotency
4. Implement outbox publisher service
5. Implement inbox consumer pattern
6. Add retry with exponential backoff
7. Implement dead letter queue
8. Add worker health monitoring

---

## Phase 4: Artifact Storage (After Phase 1)

**Priority**: P1
**Risk**: Medium
**Dependencies**: Phase 1 (storage_uri column)

1. Define ArtifactStore abstract interface
2. Implement LocalFilesystemArtifactStore
3. Update artifact creation to use ArtifactStore
4. Backfill existing artifacts with storage_uri
5. Implement S3ArtifactStore (for future)
6. Add get_artifact_store() factory
7. Update all artifact references to use storage_uri

---

## Phase 5: API Stabilization (After Phase 1)

**Priority**: P1
**Risk**: Low
**Dependencies**: Phase 1 (database)

1. Create /api/dashboard/overview endpoint
2. Create /api/hq/stats endpoint
3. Create /api/deals/:id/workspace endpoint
4. Create /api/agent/activity endpoint
5. Create /api/agent/runs endpoint
6. Add trace_id, correlation_id to all responses
7. Standardize error response format
8. Document all endpoints

---

## Phase 6: HITL/Checkpoint (After Phase 2, 3)

**Priority**: P1
**Risk**: Medium
**Dependencies**: Phase 2, Phase 3

1. Implement checkpoint save (pause_for_approval)
2. Store checkpoint state in run_checkpoints
3. Implement checkpoint resume (resume_after_approval)
4. Add checkpoint expiry cleanup job
5. Update action approval to trigger resume
6. Test full HITL flow end-to-end

---

## Phase 7: Authentication (After Phase 5)

**Priority**: P1
**Risk**: High
**Dependencies**: Phase 5 (API stable), Phase 1 (operators table)

1. Create session management service
2. Implement get_current_operator() dependency
3. Add session middleware (optional first)
4. Create login/logout endpoints
5. Add auth to frontend (opt-in)
6. Make auth required (breaking change)
7. Add resource authorization checks

---

## Phase 8: OpenAPI/Tooling (After Phase 5, 6, 7)

**Priority**: P2
**Risk**: Low
**Dependencies**: All API work complete

1. Generate OpenAPI spec from FastAPI
2. Validate spec completeness
3. Generate TypeScript client
4. Replace manual API calls in frontend
5. Implement tool discovery pattern
6. Create capability manifest endpoints

---

## Quick Reference

| Phase | Name | Priority | Risk | Depends On |
|-------|------|----------|------|------------|
| 0 | Audit | P0 | None | - |
| 1 | Database | P0 | Medium | Phase 0 |
| 2 | Events | P0 | Low | Phase 1 |
| 3 | Workers | P1 | Medium | Phase 2 |
| 4 | Storage | P1 | Medium | Phase 1 |
| 5 | API | P1 | Low | Phase 1 |
| 6 | HITL | P1 | Medium | Phase 2, 3 |
| 7 | Auth | P1 | High | Phase 5, 1 |
| 8 | OpenAPI | P2 | Low | Phase 5, 6, 7 |

---

## Parallel Execution Opportunities

These phases can run in parallel:

```
After Phase 1:
├── Phase 2 (Events) ─────────┐
├── Phase 4 (Storage) ────────┤ Can run in parallel
└── Phase 5 (API) ────────────┘

After Phase 2:
├── Phase 3 (Workers) ────────┐
└── Phase 6 (HITL) ───────────┘ Can start together
```

---

## Milestone Checkpoints

### M1: Database Ready
- [ ] PostgreSQL running
- [ ] All tables created
- [ ] Data migrated from SQLite
- [ ] All tests passing

### M2: Observability Ready
- [ ] Events emitting correctly
- [ ] Correlation IDs working
- [ ] Event queries functional

### M3: Production Hardened
- [ ] Idempotency working
- [ ] Outbox/inbox functional
- [ ] Workers with retry
- [ ] Storage abstracted

### M4: API Complete
- [ ] All spec endpoints exist
- [ ] Response shapes standardized
- [ ] Documentation complete

### M5: Auth Enabled
- [ ] Authentication working
- [ ] Authorization working
- [ ] Frontend integrated

### M6: Fully Compliant
- [ ] OpenAPI spec generated
- [ ] TypeScript client working
- [ ] All gaps closed
