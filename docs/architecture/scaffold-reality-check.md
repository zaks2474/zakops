# Scaffold Reality Check

**Date**: 2026-01-22
**Source Repo**: `wassim249/fastapi-langgraph-agent-production-ready-template`
**Local Path**: `/home/zaks/zakops-agent-api`

---

## 1. Docker Compose Services

```bash
$ docker compose config --services
db
app
cadvisor
grafana
prometheus
```

### Service Details

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| `db` | `pgvector/pgvector:pg16` | 5432:5432 | **CONFLICT**: Existing Postgres on 5432 |
| `app` | Build from Dockerfile | 8000:8000 | **MUST CHANGE**: Need port 8095 |
| `prometheus` | `prom/prometheus:latest` | 9090:9090 | OK |
| `grafana` | `grafana/grafana:latest` | 3000:3000 | **CONFLICT**: OpenWebUI uses 3000 |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:latest` | 8080:8080 | OK |

---

## 2. Python File Structure

```
./evals/helpers.py
./evals/metrics/__init__.py
./evals/schemas.py
./evals/main.py
./evals/evaluator.py
./app/core/logging.py
./app/core/limiter.py
./app/core/langgraph/graph.py          # <-- Main LangGraph agent
./app/core/middleware.py
./app/core/prompts/__init__.py
./app/core/config.py
./app/utils/sanitization.py
./app/utils/graph.py
./app/utils/auth.py
./app/utils/__init__.py
./app/api/v1/chatbot.py                # <-- Existing chat endpoints
./app/api/v1/auth.py
./app/api/v1/api.py                    # <-- Router configuration
./app/main.py                          # <-- FastAPI entrypoint
./app/services/llm.py
./app/services/database.py
./app/services/__init__.py
./app/models/session.py
./app/models/thread.py
./app/models/user.py
./app/models/database.py
./app/models/base.py                   # <-- SQLModel base class
./app/schemas/graph.py                 # <-- GraphState schema
./app/schemas/chat.py
./app/schemas/auth.py
./app/schemas/__init__.py
```

---

## 3. Key Entrypoints

| Purpose | File | Notes |
|---------|------|-------|
| FastAPI App | `app/main.py` | Creates app, includes routers |
| API Router | `app/api/v1/api.py` | Includes auth + chatbot routers |
| LangGraph Agent | `app/core/langgraph/graph.py` | `LangGraphAgent` class |
| GraphState Schema | `app/schemas/graph.py` | Pydantic state model |
| Database Models | `app/models/base.py` | SQLModel base |

---

## 4. Existing LangGraph Implementation

**File**: `app/core/langgraph/graph.py`

### Current Graph Structure
```python
graph_builder = StateGraph(GraphState)
graph_builder.add_node("chat", self._chat, ends=["tool_call", END])
graph_builder.add_node("tool_call", self._tool_call, ends=["chat"])
graph_builder.set_entry_point("chat")
graph_builder.set_finish_point("chat")
# NO interrupt_before parameter
self._graph = graph_builder.compile(checkpointer=checkpointer)
```

### What EXISTS:
- AsyncPostgresSaver with connection pool
- Streaming support via `get_stream_response()`
- Tool execution node (`_tool_call`)
- Langfuse integration for tracing
- Session-based thread_id routing
- Long-term memory (mem0)

### What's MISSING (must implement for HITL):
- `interrupt_before` pattern for approval gates
- `approval_gate` node
- Approval persistence tables
- Resume endpoints (`/agent/approvals/{id}:approve`, `:reject`)
- Tool gateway with claim-first idempotency
- MDv2 schema (`pending_approval` field)

---

## 5. Port & Networking Conflicts

### Required Changes

| What | Current | Required | Action |
|------|---------|----------|--------|
| App Port | 8000 | 8095 | Change in docker-compose.yml |
| DB Port | 5432 | 5433 | Change to avoid conflict with existing PG |
| Grafana Port | 3000 | 3001 | Change to avoid OpenWebUI conflict |
| DB Host | localhost | host.docker.internal | Must use for external service access |

### Database Separation
- Scaffold uses: `POSTGRES_DB` from env
- ZakOps Agent needs: `zakops_agent` (separate database)
- Must NOT share with existing ZakOps databases

---

## 6. Differences from Master Plan v2

| Plan Assumption | Scaffold Reality | Resolution |
|-----------------|------------------|------------|
| Service named `agent-api` | Named `app` | Rename in docker-compose.yml |
| Port 8095 | Port 8000 | Change port mapping |
| HITL exists | Not implemented | Build from scratch |
| Approval tables exist | Not present | Create migrations |
| `interrupt_before` wired | Not present | Add to graph.compile() |
| `/agent/invoke` endpoint | Not present | Create app/api/v1/agent.py |

---

## 7. Implementation Plan for HITL Spike

### Files to Create:
1. `app/api/v1/agent.py` - New agent endpoints
2. `app/models/approval.py` - Approval persistence model
3. `app/schemas/agent.py` - MDv2 request/response schemas
4. `migrations/001_approvals.sql` - Approval tables
5. `scripts/bring_up_tests.sh` - Verification script

### Files to Modify:
1. `docker-compose.yml` - Port changes, service name
2. `app/api/v1/api.py` - Include agent router
3. `app/core/langgraph/graph.py` - Add approval_gate node, interrupt_before
4. `app/schemas/graph.py` - Extend GraphState for approvals
5. `.env.development` - Update connection strings

---

## 8. Environment Variables Required

```bash
# Agent-specific
AGENT_API_PORT=8095
ZAKOPS_AGENT_DB=zakops_agent

# External services (host.docker.internal)
DEAL_API_URL=http://host.docker.internal:8090
RAG_REST_URL=http://host.docker.internal:8052
MCP_URL=http://host.docker.internal:9100

# Database (separate instance)
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=zakops_agent
POSTGRES_USER=agent
POSTGRES_PASSWORD=<secure>
```

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Port 5432 collision | HIGH | Use port 5433 externally |
| Port 3000 collision | MEDIUM | Use port 3001 for Grafana |
| No HITL exists | EXPECTED | Build per plan |
| LangGraph version mismatch | LOW | Check requirements.txt |

---

## 10. Next Steps

1. **Modify docker-compose.yml**: Fix ports, service name
2. **Create approval tables**: `app/models/approval.py` + migration
3. **Add approval_gate node**: Modify `graph.py` with `interrupt_before`
4. **Create agent endpoints**: `app/api/v1/agent.py`
5. **Wire to external services**: Deal API, RAG REST
6. **Create verification script**: `scripts/bring_up_tests.sh`
