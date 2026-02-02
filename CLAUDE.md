# ZakOps Agent API (Monorepo)

## Pre-Flight
Before ANY task, read these docs:
1. `docs/ARCHITECTURE.md` — system architecture, ports, data flows
2. `docs/CONSTRAINTS.md` — forbidden patterns, verification rules
3. `docs/ATOMIC_TASKS.md` — task decomposition standards

## Monorepo Structure
```
apps/
  dashboard/      → Next.js frontend (port 3003, bare process NOT Docker)
  agent-api/      → LangGraph agent (port 8095, Docker)
packages/
  contracts/      → OpenAPI spec (zakops-api.json) — PROTECTED
deployments/
  docker/         → Docker Compose configs
tools/
  ops/            → operational scripts
```

## Services

| Service | Port | How to run |
|---------|------|------------|
| Dashboard | 3003 | `cd apps/dashboard && npm run dev -- -p 3003` |
| Agent API | 8095 | `cd apps/agent-api && docker compose restart agent-api` |
| **Port 8090** | — | **FORBIDDEN (legacy, decommissioned)** |

## Dashboard
- Runs as **bare Next.js process** (not Docker — container crashes with EADDRINUSE)
- Logs: `/home/zaks/bookkeeping/logs/dashboard.log`
- Uses Zod `.safeParse()` on all API responses — schema mismatches cause silent empty results
- Proxies `/api/*` to backend (port 8091) via Next.js rewrites

## Agent API
- LangGraph + vLLM (Qwen 2.5-32B-Instruct-AWQ)
- Tools: `duckduckgo_search`, `search_deals`, `get_deal`, `list_deals`, `transition_deal`
- Tools call backend API via HTTP (port 8091), NOT direct DB
- Auth: `X-Service-Token` header for dashboard→agent communication
- DB: `zakops_agent` (LangGraph checkpoints)

## Protected Paths
- `packages/contracts/openapi/zakops-api.json` — OpenAPI contract

## Golden Commands
```bash
# Dashboard
cd apps/dashboard && npm run dev -- -p 3003

# Agent API
cd apps/agent-api && docker compose restart agent-api

# Health
curl -s http://localhost:3003/api/chat | jq -r '.status'
curl -s http://localhost:8095/health | jq -r '.status'
```

## Hazards
- `deployments/docker/docker-compose.yml` maps agent-api as `8095:8095` but Dockerfile EXPOSEs 8000
  (works because app binds to `0.0.0.0:8095` via env)
- Dashboard Docker container (`docker-dashboard-1`) conflicts with bare process on `network_mode: host`

## Change Log
Record all changes in `/home/zaks/bookkeeping/CHANGES.md`.
