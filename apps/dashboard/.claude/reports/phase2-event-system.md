# Phase 2 Report: Event System

**Date**: 2026-01-19
**Status**: Complete

---

## Summary

Phase 2 implemented a unified event system providing full observability across the Agent, Execution, and Data planes. The system uses the existing `zakops.agent_events` and `zakops.deal_events` tables, routing events appropriately based on type and context.

---

## Deliverables

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Event Taxonomy | ✅ | 5 domains, 25+ event types |
| Event Models | ✅ | Pydantic models with versioning |
| Event Publisher | ✅ | Routes to appropriate table |
| Event Query Service | ✅ | Unified view from both tables |
| REST API Endpoints | ✅ | `/api/events/*` router |
| Integration Decorators | ✅ | `@emit_deal_event`, `@emit_action_event` |

---

## Event Types Defined

| Domain | Event Types |
|--------|-------------|
| deal | created, updated, stage_changed, profile_enriched, archived |
| action | created, approved, rejected, executing, completed, failed, quarantined |
| agent | run_started, run_completed, run_failed, tool_called, tool_completed, tool_failed, thinking, waiting_approval |
| worker | job_queued, job_started, job_completed, job_failed, job_retrying, job_dlq |
| system | startup, shutdown, health_check, error |

---

## Architecture

### Event Routing

Events are routed to the appropriate table based on type:

```
┌─────────────────────────────────────────────────────────────┐
│                     EventPublisher                          │
│                                                             │
│   publish(event)                                            │
│       │                                                     │
│       ▼                                                     │
│   ┌─────────────────┐                                       │
│   │ Route by domain │                                       │
│   └────────┬────────┘                                       │
│            │                                                │
│   ┌────────┴────────┐                                       │
│   ▼                 ▼                                       │
│ deal.*           agent.*                                    │
│ action.*         (with run_id/thread_id)                    │
│ worker.*              │                                     │
│   │                   │                                     │
│   ▼                   ▼                                     │
│ zakops.deal_events   zakops.agent_events                    │
└─────────────────────────────────────────────────────────────┘
```

### Event Query

The EventQueryService provides a unified view by querying both tables:

```
┌─────────────────────────────────────────────────────────────┐
│                   EventQueryService                          │
│                                                              │
│   get_recent() / get_by_correlation_id()                     │
│       │                                                      │
│       ├──────────────┬──────────────┐                        │
│       ▼              ▼              ▼                        │
│   agent_events   deal_events     Combine                     │
│       │              │             & Sort                    │
│       └──────────────┴──────────────┘                        │
│                      │                                       │
│                      ▼                                       │
│              Unified Event List                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quality Gates

| Gate | Status |
|------|--------|
| Event tables ready | ✅ |
| Event system compiles | ✅ |
| Taxonomy imports work | ✅ |
| API router compiles | ✅ |
| Frontend builds | ✅ |

---

## API Endpoints Added

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events/recent` | GET | Recent events for dashboard |
| `/api/events/by-correlation/{id}` | GET | Events for a deal |
| `/api/events/by-run/{id}` | GET | Events for an agent run |
| `/api/events/stats` | GET | Event statistics |
| `/api/events/{id}` | GET | Single event detail |

---

## Files Created

### zakops-backend

```
src/core/events/__init__.py         (new)
src/core/events/taxonomy.py         (new)
src/core/events/models.py           (new)
src/core/events/publisher.py        (new)
src/core/events/query.py            (new)
src/core/events/integration.py      (new)
src/core/__init__.py                (updated)
src/api/shared/routers/__init__.py  (new)
src/api/shared/routers/events.py    (new)
```

### zakops-dashboard

```
.claude/reports/phase2-event-system.md (new)
```

---

## Database Tables Used

### zakops.agent_events
- Purpose: Agent execution events (runs, tool calls)
- Constraints: event_type must be one of allowed types
- Requires: run_id, thread_id (foreign keys)

### zakops.deal_events
- Purpose: Deal lifecycle and general events
- No event_type constraint
- Links to deal_id

---

## Usage Examples

### Publishing Deal Events

```python
from src.core.events import publish_deal_event, DealEventType

# When a deal is created
await publish_deal_event(
    deal_id=deal.deal_id,
    event_type=DealEventType.CREATED.value,
    event_data={"name": deal.canonical_name, "stage": deal.stage}
)
```

### Publishing Action Events

```python
from src.core.events import publish_action_event, ActionEventType

# When an action is approved
await publish_action_event(
    action_id=action.action_id,
    correlation_id=correlation_id,
    event_type=ActionEventType.APPROVED.value,
    event_data={"approved_by": operator.email},
    deal_id=action.deal_id
)
```

### Using Integration Decorators

```python
from src.core.events.integration import emit_deal_event, DealEventType

@emit_deal_event(DealEventType.UPDATED)
async def update_deal(deal_id: UUID, updates: dict) -> dict:
    # Business logic here
    return {"deal_id": deal_id, **updated_deal}
```

### Querying Events

```python
from src.core.events import get_query_service

service = await get_query_service()

# Get recent events
events = await service.get_recent(limit=50)

# Get events for a deal
deal_events = await service.get_by_correlation_id(deal_id)

# Get event statistics
stats = await service.get_stats()
```

---

## Issues Encountered

1. **agent_events table constraints**: The existing table has:
   - CHECK constraint limiting event_type to specific agent types
   - Required run_id and thread_id foreign keys

   **Resolution**: Events are routed to the appropriate table:
   - Agent events (with run_id/thread_id) -> agent_events
   - Deal/Action/Worker events -> deal_events

2. **Existing table structure**: The tables were already created with specific schemas

   **Resolution**: Adapted the publisher and query service to work with existing structure

---

## Compatibility Notes

- **NO breaking changes** to existing API endpoints
- Event publishing is **ADDITIVE** - existing functionality unchanged
- Query service provides **unified view** across both tables
- **Frontend unchanged** - no modifications required

---

## Next Steps

1. **Phase 3**: Idempotency Middleware - Request-level idempotency
2. **Phase 4**: Artifact Storage - ArtifactStore abstraction
3. **Integration**: Add event publishing to existing deal/action lifecycle code
4. **Router Integration**: Include events router in main API app

---

## GitHub URLs

- **Backend**: https://github.com/zaks2474/zakops-backend
- **Dashboard**: https://github.com/zaks2474/zakops-dashboard
