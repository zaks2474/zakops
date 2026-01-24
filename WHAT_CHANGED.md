# HITL Spike Implementation - WHAT CHANGED

**Date**: 2026-01-22
**Phase**: 27 - HITL Spike Implementation
**Status**: Ready for verification

---

## Summary

Implemented the Human-in-the-Loop (HITL) spike for `transition_deal` as specified in Master Plan v2 Section 4.2. The spike demonstrates:

1. LangGraph `interrupt_before` pattern for approval gates
2. Approval persistence with claim-first idempotency
3. MDv2-compliant `/agent/invoke` endpoint
4. Resume endpoints for approve/reject actions
5. Crash recovery (survives kill -9)

---

## Files Created (12)

| File | Purpose |
|------|---------|
| `docs/scaffold-reality-check.md` | Documents scaffold structure, port conflicts, differences from plan |
| `app/models/approval.py` | SQLModel: `Approval`, `ToolExecution` with status enums |
| `app/schemas/agent.py` | MDv2 schemas: `AgentInvokeRequest`, `AgentInvokeResponse`, `PendingApproval` |
| `app/api/v1/agent.py` | Agent router: `/invoke`, `/approvals/{id}:approve`, `/approvals/{id}:reject` |
| `app/core/langgraph/tools/deal_tools.py` | Deal tools: `transition_deal` (HITL), `get_deal`, `search_deals` |
| `app/core/security/agent_auth.py` | JWT auth with iss/aud/role enforcement for agent endpoints |
| `app/core/security/__init__.py` | Security module exports |
| `migrations/001_approvals.sql` | DB schema: `approvals`, `tool_executions` tables + indexes |
| `scripts/bring_up_tests.sh` | Verification script with 14 test scenarios |
| `.env.development` | Environment config with external service URLs |
| `WHAT_CHANGED.md` | This file |

---

## Files Modified (8)

| File | Changes |
|------|---------|
| `docker-compose.yml` | Ports: 8095 (app), 5433 (db), 3001 (grafana); service renamed to `agent-api`; added `host.docker.internal` |
| `app/core/langgraph/graph.py` | Added `approval_gate` node, `execute_approved_tools` node, `interrupt_before`, HITL methods |
| `app/schemas/graph.py` | Extended `GraphState` with `pending_tool_calls`, `approval_status`, `actor_id` |
| `app/schemas/__init__.py` | Export new agent schemas |
| `app/api/v1/api.py` | Include agent router at `/agent` prefix |
| `app/core/langgraph/tools/__init__.py` | Register deal tools |
| `app/core/config.py` | Added HITL settings, external service URLs |
| `pyproject.toml` | Added `httpx` dependency |

---

## New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/agent/invoke` | POST | MDv2 agent invocation |
| `/api/v1/agent/approvals` | GET | List pending approvals |
| `/api/v1/agent/approvals/{id}` | GET | Get approval details |
| `/api/v1/agent/approvals/{id}:approve` | POST | Approve and resume |
| `/api/v1/agent/approvals/{id}:reject` | POST | Reject action |

---

## Architecture Changes

### LangGraph Graph Structure

```
Before:
  chat -> tool_call -> chat -> END

After:
  chat -> tool_call -> chat -> END
       -> approval_gate (interrupt_before) -> execute_approved_tools -> chat
```

### Approval Flow

```
1. User invokes agent with transition_deal intent
2. LLM generates transition_deal tool call
3. Graph detects HITL tool, routes to approval_gate
4. interrupt_before triggers, execution pauses
5. Approval record created in database
6. Response returns with pending_approval
7. User calls :approve or :reject endpoint
8. Graph resumes from checkpoint
9. Tool executes (or rejection message added)
10. Agent continues to completion
```

---

## How To Run

### Prerequisites

```bash
# Ensure Docker is running
docker --version

# Install dependencies if testing locally
cd /home/zaks/zakops-agent-api
pip install -e .
```

### Start Services

```bash
cd /home/zaks/zakops-agent-api

# Build and start
docker compose up -d --build

# Check health
curl http://localhost:8095/health
```

### Run Verification Tests

```bash
cd /home/zaks/zakops-agent-api

# Run full test suite
./scripts/bring_up_tests.sh
```

### Manual Testing

```bash
# 1. Basic invoke (no approval needed)
curl -X POST http://localhost:8095/api/v1/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "actor_id": "user-001",
    "message": "What is 2+2?"
  }'

# 2. Invoke with transition_deal (triggers HITL)
curl -X POST http://localhost:8095/api/v1/agent/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "actor_id": "user-001",
    "message": "Transition deal DEAL-001 from lead to qualification"
  }'

# 3. List pending approvals
curl http://localhost:8095/api/v1/agent/approvals

# 4. Approve an action (replace {id} with actual approval_id)
curl -X POST http://localhost:8095/api/v1/agent/approvals/{id}:approve \
  -H "Content-Type: application/json" \
  -d '{"actor_id": "approver-001"}'
```

---

## Test Artifacts

After running `./scripts/bring_up_tests.sh`, check:

```
./gate_artifacts/
├── health.json                    # T0: Health check response
├── invoke_hitl.json               # T1: HITL trigger result
├── approve.json                   # T3: Approval result
├── approve_again.json             # T4: Double-approve idempotency
├── concurrent_approves.log        # T5: Concurrent approval race (N=20)
├── checkpoint_kill9_test.log      # T6: Kill-9 crash recovery
├── tool_call_validation_test.log  # T8: Tool arg validation (extra="forbid")
├── dependency_licenses.json       # T9: All package licenses
├── copyleft_findings.json         # T9b: GPL/AGPL/LGPL findings (if any)
├── db_invariants.sql.out          # T2/T9/T10: DB assertions + audit log
├── mock_safety_test.log           # T11: Mock configuration safety
├── streaming_test.log             # T12: SSE streaming test
├── hitl_scope_test.log            # T13: HITL scope verification
├── auth_negative_tests.json       # T14: JWT auth negative tests (expired/iss/aud/role)
├── build.log                      # Docker build output
└── run.log                        # Full test run log
```

---

## Deviations from Plan

| Plan | Reality | Resolution |
|------|---------|------------|
| Service named `agent-api` | Was `app` | Renamed in docker-compose.yml |
| Port 8095 | Was 8000 | Changed port mapping |
| Separate DB on 5432 | Collision with existing PG | Changed to 5433 external |
| HITL exists | Did not exist | Built from scratch |
| Grafana on 3000 | OpenWebUI + Langfuse conflict | Changed to 3002 (Langfuse owns 3001) |

---

## Known Limitations

1. **Mock Tool Responses**: When Deal API (:8090) is unavailable in development mode (`APP_ENV=development` AND `ALLOW_TOOL_MOCKS=true`), `transition_deal` returns mock success. In production or when `ALLOW_TOOL_MOCKS=false`, it fails closed.
2. **Long-term Memory Disabled**: Per Decision Lock (RAG REST only), direct pgvector/mem0 queries are disabled by default (`DISABLE_LONG_TERM_MEMORY=true`). Set to `false` to re-enable for non-spike environments with RAG REST integration.
3. **Authentication**: JWT auth with iss/aud/role validation implemented but disabled by default. Set `AGENT_JWT_ENFORCE=true` to enable.
4. **Concurrency**: Approval claims use database-level locking (not distributed lock)

---

## Next Steps

1. Run `./scripts/bring_up_tests.sh` to verify spike
2. Wire to actual Deal API (:8090) when available
3. Enable JWT enforcement (`AGENT_JWT_ENFORCE=true`) in production
4. Implement tool execution logging to `tool_executions` table
5. Add metrics for approval latency and throughput

---

## Logs Location

```bash
# Docker logs
docker compose logs agent-api

# Container logs
docker logs zakops-agent-api

# Application logs (inside container)
docker exec zakops-agent-api cat /app/logs/app.log
```

---

## Port Summary

| Service | Internal | External | Purpose |
|---------|----------|----------|---------|
| agent-api | 8000 | 8095 | Agent API |
| db | 5432 | 5433 | PostgreSQL (zakops_agent) |
| prometheus | 9090 | 9091 | Metrics |
| grafana | 3000 | 3002 | Dashboards (3001 reserved for Langfuse) |
| cadvisor | 8080 | 8081 | Container metrics |
