# Risk Assessment: Phase 0 Baseline Audit

**Audit Date**: 2026-01-19
**Status**: Phase 0 Baseline Audit

---

## Executive Summary

This document assesses the risks associated with migrating from the current implementation to the Master Architecture Specification.

---

## Risk Categories

### 1. Data Loss Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| SQLite to PostgreSQL migration corrupts data | HIGH | LOW | Full backup before migration, dual-write phase |
| deal_registry.json migration loses deals | HIGH | LOW | JSON backup, validation scripts |
| Artifact paths become invalid | MEDIUM | MEDIUM | Keep filesystem paths during transition |

### 2. Availability Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Database migration causes downtime | HIGH | MEDIUM | Use dual-write/dual-read strategy |
| Auth rollout breaks all API calls | CRITICAL | MEDIUM | Deploy auth as optional first |
| Workers fail during schema change | MEDIUM | LOW | Feature flags, gradual rollout |

### 3. Compatibility Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Frontend breaks from API changes | HIGH | LOW | Add-only API changes, no removals |
| Existing integrations fail | MEDIUM | LOW | Version API, deprecate don't remove |
| SSE streaming breaks | MEDIUM | LOW | Test thoroughly before deploy |

---

## Migration Phase Risks

### Phase 1: Database Foundation

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Create PostgreSQL tables | LOW | None - additive | Standard migration |
| Add columns to existing tables | MEDIUM | Type mismatches | Test with production data |
| Migrate SQLite data | HIGH | Data loss, corruption | Full backup, validation |
| Migrate deal_registry.json | MEDIUM | JSON parsing errors | Schema validation |

**Rollback Plan**: Restore SQLite from backup, revert code

### Phase 2: Event System

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Create agent_events table | LOW | None - additive | Standard migration |
| Implement event emission | LOW | Performance overhead | Monitor latency |
| Add correlation IDs | LOW | None - additive | Default NULL values |

**Rollback Plan**: Feature flag to disable event emission

### Phase 3: Execution Hardening

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Idempotency middleware | MEDIUM | False duplicates | Careful key generation |
| Outbox pattern | MEDIUM | Message loss | Atomic transactions |
| Inbox deduplication | LOW | None | Standard pattern |

**Rollback Plan**: Disable middleware via feature flag

### Phase 4: Artifact Storage

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Implement ArtifactStore | LOW | None - new interface | Behind feature flag |
| Migrate to storage_uri | MEDIUM | Broken references | Backfill script |
| Add S3 support | LOW | None - optional | Feature flag |

**Rollback Plan**: Fall back to direct filesystem paths

### Phase 5: API Stabilization

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Add new endpoints | LOW | None - additive | Standard development |
| Add response fields | LOW | None - additive | Frontend ignores unknown |
| Standardize errors | MEDIUM | Frontend expects old format | Add new fields, keep old |

**Rollback Plan**: Git revert, redeploy previous version

### Phase 6: HITL/Checkpoint

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Checkpoint save | MEDIUM | State corruption | Validation, testing |
| Checkpoint resume | MEDIUM | Stale state | TTL, cleanup jobs |
| Approval flow | MEDIUM | Action stuck | Timeout, manual override |

**Rollback Plan**: Disable HITL, use direct execution

### Phase 7: Authentication

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Add auth middleware | LOW | None - optional first | Feature flag |
| Implement sessions | MEDIUM | Session loss on restart | Persistent sessions |
| Make auth required | CRITICAL | Breaks all unauthenticated calls | Gradual rollout, testing |

**Rollback Plan**: Feature flag to disable auth requirement

### Phase 8: OpenAPI/Tooling

| Step | Risk Level | Specific Risks | Mitigation |
|------|------------|----------------|------------|
| Generate OpenAPI spec | LOW | None | Validate spec |
| Generate TypeScript client | LOW | Type mismatches | Testing |
| Replace manual API calls | MEDIUM | Client bugs | Parallel testing |

**Rollback Plan**: Revert to manual API calls

---

## Risk Matrix

```
                    PROBABILITY
                LOW    MEDIUM    HIGH
           ┌─────────┬─────────┬─────────┐
    HIGH   │ Data    │ Downtime│         │
           │ Loss    │         │         │
           ├─────────┼─────────┼─────────┤
SEVERITY   │ API     │ Auth    │         │
  MEDIUM   │ Compat  │ Rollout │         │
           ├─────────┼─────────┼─────────┤
    LOW    │ New     │ Event   │         │
           │ Tables  │ System  │         │
           └─────────┴─────────┴─────────┘
```

---

## Critical Path Risks

1. **Database Migration** (Phase 1)
   - All subsequent phases depend on PostgreSQL
   - Must be done first and correctly
   - Recommend: 2-week parallel operation before cutover

2. **Authentication Rollout** (Phase 7)
   - Breaking change when auth becomes required
   - Must have opt-out path
   - Recommend: 1-month opt-in period

3. **Event System** (Phase 2)
   - Critical for observability
   - Performance impact possible
   - Recommend: Monitor latency, tune batch size

---

## Recommended Risk Mitigations

### Pre-Migration

1. **Full System Backup**
   - SQLite database
   - deal_registry.json
   - All artifacts
   - Configuration files

2. **Staging Environment**
   - Mirror production data
   - Test all migrations
   - Validate data integrity

3. **Monitoring Setup**
   - Error rate baseline
   - Latency baseline
   - Query performance baseline

### During Migration

1. **Feature Flags**
   - ENABLE_POSTGRESQL
   - ENABLE_AUTH
   - ENABLE_EVENT_EMISSION
   - ENABLE_OUTBOX

2. **Gradual Rollout**
   - Dual-write before cutover
   - Canary deployments
   - Quick rollback capability

3. **Validation Scripts**
   - Data integrity checks
   - API response comparison
   - Event consistency validation

### Post-Migration

1. **Monitoring Period**
   - 7 days intensive monitoring
   - Error rate alerting
   - Performance regression detection

2. **Cleanup Phase**
   - Remove SQLite after 30 days
   - Archive old configurations
   - Document lessons learned

---

## Risk Acceptance Criteria

| Phase | Acceptable Error Rate | Max Downtime | Rollback Time |
|-------|----------------------|--------------|---------------|
| 1 | 0% data loss | 1 hour | 30 minutes |
| 2 | < 0.1% | 0 | 5 minutes |
| 3 | < 0.1% | 0 | 5 minutes |
| 4 | < 0.1% | 0 | 5 minutes |
| 5 | < 0.1% | 0 | 5 minutes |
| 6 | < 1% | 0 | 15 minutes |
| 7 | < 0.1% | 0 | 5 minutes |
| 8 | < 0.1% | 0 | 5 minutes |

---

## Summary

| Risk Category | Count | Highest Severity |
|---------------|-------|------------------|
| Data Loss | 3 | HIGH |
| Availability | 3 | CRITICAL |
| Compatibility | 3 | HIGH |
| Total Identified | 9 | CRITICAL |

**Overall Assessment**: Migration is feasible with proper planning. The dual-write strategy and feature flags provide adequate protection against most risks. Authentication rollout requires the most careful planning.
