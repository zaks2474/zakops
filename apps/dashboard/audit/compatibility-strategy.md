# Compatibility Strategy

**Audit Date**: 2026-01-19
**Status**: Phase 0 Baseline Audit

---

## Guiding Principle

**All changes must be backward compatible. No existing functionality should break during migration.**

The frontend UI is polished and working. All changes will be backend-focused and must maintain API compatibility.

---

## Safe Additions (No Risk)

These can be added without affecting existing code:

| Change | Risk Level | Notes |
|--------|------------|-------|
| New PostgreSQL tables | None | No existing code uses these |
| New columns with DEFAULT NULL | None | Existing queries unaffected |
| New indexes | None | Only improves performance |
| New API endpoints | None | Existing endpoints unchanged |
| New event types | None | Additive to event system |

### Tables Safe to Create

```sql
-- These tables don't exist, can be created freely
CREATE TABLE operators (...);
CREATE TABLE agent_runs (...);
CREATE TABLE agent_events (...);
CREATE TABLE run_checkpoints (...);
CREATE TABLE deal_threads (...);
CREATE TABLE outbox (...);
CREATE TABLE inbox (...);
CREATE TABLE idempotency_keys (...);
```

---

## Modifications Requiring Care

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Adding columns to actions table | Medium | Add with DEFAULT first, then migrate |
| Migrating SQLite to PostgreSQL | High | Run parallel systems during transition |
| Adding authentication | High | Add as optional first, then require |
| Changing response shapes | Medium | Add fields only, don't remove |

### SQLite to PostgreSQL Migration Strategy

```
Phase 1: Deploy PostgreSQL (parallel)
├── Create PostgreSQL database
├── Create all spec tables
├── Keep SQLite running (read/write)
└── PostgreSQL empty (ready)

Phase 2: Dual-Write
├── Write to both SQLite and PostgreSQL
├── Read from SQLite (primary)
├── Validate PostgreSQL data matches
└── Fix any discrepancies

Phase 3: Read Migration
├── Write to both
├── Read from PostgreSQL (primary)
├── SQLite as backup
└── Monitor for issues

Phase 4: SQLite Retirement
├── Stop writing to SQLite
├── PostgreSQL only
├── Keep SQLite backup for 30 days
└── Archive and delete
```

---

## API Compatibility Rules

### Adding New Endpoints

Safe to add:
```python
# New endpoint - no impact on existing
@app.get("/api/dashboard/overview")
async def dashboard_overview():
    ...
```

### Modifying Existing Endpoints

**DO**:
```python
# Add optional fields to response
return {
    "deal_id": deal.id,
    "name": deal.name,
    "trace_id": trace_id,  # NEW - additive
}
```

**DON'T**:
```python
# Remove or rename fields
return {
    "id": deal.id,  # WRONG - changed from deal_id
    # name removed - WRONG
}
```

### Adding Required Parameters

Wrong way:
```python
# Breaks existing calls
@app.get("/api/deals")
async def list_deals(operator_id: str):  # Now required - BREAKS
```

Right way:
```python
# Optional with default
@app.get("/api/deals")
async def list_deals(operator_id: Optional[str] = None):  # Safe
```

---

## Breaking Changes to Avoid

| Change | Why It Breaks | Alternative |
|--------|---------------|-------------|
| DROP TABLE | Data loss | Archive instead |
| DROP COLUMN | Existing code fails | Deprecate first |
| Rename without alias | Existing code fails | Add alias/view |
| Change response shape | UI breaks | Add fields only |
| Remove API endpoint | UI breaks | Deprecate, redirect |
| Change authentication | All calls fail | Opt-in first |

---

## Database Compatibility

### Adding Columns

```sql
-- Safe: nullable with default
ALTER TABLE actions ADD COLUMN trace_id UUID DEFAULT NULL;
ALTER TABLE actions ADD COLUMN correlation_id UUID DEFAULT NULL;

-- After data backfill, can add NOT NULL constraint
-- But only after verifying all rows have values
```

### Index Creation

```sql
-- Use CONCURRENTLY to avoid locks (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_actions_trace ON actions(trace_id);
```

### Foreign Keys

```sql
-- Add FK only after ensuring referential integrity
-- First: backfill missing references
-- Then: add constraint
ALTER TABLE actions
ADD CONSTRAINT fk_actions_operator
FOREIGN KEY (operator_id) REFERENCES operators(id);
```

---

## Frontend Compatibility

The frontend expects specific API response shapes. Document current contracts:

### Current Response Shapes (Must Maintain)

**GET /api/deals**
```typescript
{
  deals: Deal[];
  count?: number;
}
// OR just Deal[] (both supported)
```

**GET /api/actions**
```typescript
{
  actions: KineticAction[];
  count?: number;
}
// OR just KineticAction[]
```

### Safe to Add

```typescript
// Adding trace_id to responses is safe
{
  deals: Deal[];
  count?: number;
  trace_id: string;  // NEW - frontend ignores unknown fields
}
```

---

## Feature Flag Strategy

For risky changes, use feature flags:

```python
# Environment-based flags
ENABLE_POSTGRESQL = os.getenv("ENABLE_POSTGRESQL", "false") == "true"
ENABLE_AUTH = os.getenv("ENABLE_AUTH", "false") == "true"
ENABLE_EVENT_EMISSION = os.getenv("ENABLE_EVENT_EMISSION", "false") == "true"

# Gradual rollout
if ENABLE_POSTGRESQL:
    db = PostgreSQLConnection()
else:
    db = SQLiteConnection()
```

---

## Migration Phases

### Phase 1: Database Foundation (No Breaking Changes)
1. Create PostgreSQL database
2. Create all new tables
3. Add new columns (nullable)
4. Deploy alongside SQLite

### Phase 2: Dual-Write (Low Risk)
1. Write to both databases
2. Read from SQLite
3. Validate consistency
4. Monitor for issues

### Phase 3: Observability (No Breaking Changes)
1. Implement event emission
2. Add trace_id, correlation_id
3. All additive changes

### Phase 4: Authentication (High Risk)
1. Deploy auth as optional
2. Add to frontend (opt-in)
3. Monitor adoption
4. Make required (breaking)

---

## Rollback Plan

For each migration step:

1. **Before migration**: Full database backup
2. **Test in staging**: Full migration rehearsal
3. **Production deploy**: During low-traffic window
4. **Monitor**: 15-minute observation period
5. **Rollback trigger**: >1% error rate increase
6. **Rollback procedure**: Documented and tested

### Rollback Commands

```bash
# Database rollback
pg_restore --clean zakops_backup_YYYYMMDD.dump

# Code rollback
git revert HEAD
kubectl rollout undo deployment/zakops-api

# Feature flag rollback
ENABLE_POSTGRESQL=false
kubectl rollout restart deployment/zakops-api
```

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| Additive only | Add columns, tables, endpoints - never remove |
| Backward compatible | All existing API calls must work |
| Feature flags | Risky features behind flags |
| Dual systems | Run old/new in parallel |
| Gradual migration | Phase-based approach |
| Rollback ready | Tested rollback for every change |
