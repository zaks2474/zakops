# ZakOps System Architecture
## Single Source of Truth

**Last Updated**: 2026-01-27
**Version**: 2.0.0 (Post-Legacy Decommission)

---

## Overview

ZakOps is a Deal Lifecycle Management system for the MSP market. It consists of:

- **Dashboard**: Next.js web application for users
- **Backend API**: Deal lifecycle operations, pipeline management
- **Agent API**: AI-powered chat assistant (LangGraph + vLLM)
- **Database**: PostgreSQL for persistent storage
- **Cache**: Redis for sessions and queues

---

## Service Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                        │
│                         (User Interface)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD (Next.js)                                 │
│                              PORT 3003                                      │
│                                                                             │
│   Routes:                                                                   │
│   - /dashboard     → Main dashboard view                                    │
│   - /deals         → Deal management                                        │
│   - /chat          → AI chat interface                                      │
│   - /quarantine    → Approval workflows                                     │
│   - /api/*         → API routes (proxy to backend)                          │
└─────────────────────────────────────────────────────────────────────────────┘
            │                                           │
            │ /api/deals, /api/pipeline                 │ /api/chat
            ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│    BACKEND API          │               │    AGENT API            │
│    PORT 8091            │               │    PORT 8095            │
│                         │               │                         │
│  - Deal CRUD            │               │  - LangGraph agent      │
│  - Pipeline operations  │               │  - vLLM "Queen" model   │
│  - Quarantine mgmt      │               │  - Tool execution       │
│  - Event logging        │               │  - RAG integration      │
└─────────────────────────┘               └─────────────────────────┘
            │                                           │
            │                                           │
            ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                        │
│                                                                             │
│   ┌─────────────────────┐         ┌─────────────────────┐                   │
│   │    PostgreSQL       │         │       Redis         │                   │
│   │    PORT 5432        │         │     PORT 6379       │                   │
│   │                     │         │                     │                   │
│   │  - deals            │         │  - sessions         │                   │
│   │  - events           │         │  - cache            │                   │
│   │  - quarantine       │         │  - job queues       │                   │
│   │  - users            │         │                     │                   │
│   └─────────────────────┘         └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Port Assignments

| Port | Service | Container | Status |
|------|---------|-----------|--------|
| 3003 | Dashboard (Next.js) | docker-dashboard-1 | ✅ REQUIRED |
| 8091 | Backend API | zakops-backend-1 | ✅ REQUIRED |
| 8095 | Agent API (vLLM Queen) | zakops-agent-api | ✅ REQUIRED |
| 5432 | PostgreSQL | zakops-postgres / zakops-agent-db | ✅ REQUIRED |
| 6379 | Redis | zakops-redis | ✅ REQUIRED |
| 8052 | RAG Service | rag-rest-api | ⚪ OPTIONAL |
| 3001 | Langfuse | langfuse | ⚪ OPTIONAL |
| 3002 | Grafana | grafana | ⚪ OPTIONAL |
| 3100 | Loki | loki | ⚪ OPTIONAL |

### FORBIDDEN PORTS

| Port | Description | Why Forbidden |
|------|-------------|---------------|
| 8090 | Legacy Python API | DECOMMISSIONED 2026-01-27. Services masked. |

**If you see ANY reference to port 8090, it is LEGACY and must be removed.**

---

## Authentication Architecture

### Dashboard → Agent API

The Agent API requires authentication. Dashboard uses **service token authentication**:

```
Dashboard Request:
  POST http://localhost:8095/api/v1/chatbot/chat
  Headers:
    Content-Type: application/json
    X-Service-Token: <DASHBOARD_SERVICE_TOKEN>
```

**Configuration:**
- Agent API: `DASHBOARD_SERVICE_TOKEN` in `.env.development`
- Dashboard: `DASHBOARD_SERVICE_TOKEN` or `AGENT_SERVICE_TOKEN` in environment

### Agent API Authentication Flow

```
Request arrives
      │
      ▼
┌─────────────────────────┐
│ Check X-Service-Token   │
│ header present?         │
└─────────────────────────┘
      │
      ├── YES → Validate token → If valid: Service Session
      │                        → If invalid: Check JWT
      │
      └── NO → Check Bearer token
                    │
                    ├── Valid JWT → User Session
                    │
                    └── No auth → 401 Unauthorized
```

---

## Directory Structure

```
/home/zaks/zakops-agent-api/
├── apps/
│   ├── dashboard/              # Next.js frontend (PORT 3003)
│   │   ├── src/
│   │   │   ├── app/            # App router pages
│   │   │   │   ├── api/        # API routes
│   │   │   │   │   ├── chat/   # Chat endpoints (→ Agent API)
│   │   │   │   │   ├── deals/  # Deals endpoints (→ Backend)
│   │   │   │   │   └── ...
│   │   │   │   ├── dashboard/  # Dashboard page
│   │   │   │   ├── deals/      # Deals page
│   │   │   │   └── chat/       # Chat page
│   │   │   ├── components/     # React components
│   │   │   ├── lib/            # Utilities, API client
│   │   │   └── hooks/          # React hooks
│   │   ├── .env.local          # Environment config
│   │   └── Dockerfile
│   │
│   ├── backend/                # Python backend API (PORT 8091)
│   │   └── src/
│   │       ├── api/            # API endpoints
│   │       │   └── deal_lifecycle/
│   │       ├── core/           # Business logic
│   │       └── agent/          # Agent integration
│   │
│   └── agent-api/              # LangGraph agent (PORT 8095)
│       ├── app/
│       │   ├── api/v1/         # API endpoints
│       │   │   ├── auth.py     # Authentication
│       │   │   └── chatbot.py  # Chat endpoints
│       │   ├── core/           # Agent logic
│       │   │   ├── config.py   # Configuration
│       │   │   └── langgraph/  # LangGraph agent
│       │   └── tools/          # MCP tools
│       ├── .env.development    # Dev environment
│       └── docker-compose.yml
│
├── deployments/                # Docker configs
│   ├── docker/
│   │   └── docker-compose.yml  # Main compose file
│   ├── bluegreen/              # Blue/green deployment
│   └── demo/                   # Demo environment
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # This file
│   ├── CONSTRAINTS.md          # Behavioral rules
│   └── ATOMIC_TASKS.md         # Task standards
│
├── ops/                        # Operations
│   └── observability/          # Monitoring configs
│
├── tools/                      # Utility scripts
│   ├── gates/                  # Gate scripts
│   └── ops/                    # Operations scripts
│
├── agent.md                    # Agent instructions
└── CLAUDE.md                   # Claude Code instructions (if exists)
```

---

## Data Flow: Deals

```
User clicks "Deals" in browser
         │
         ▼
Dashboard /deals page loads
         │
         ▼
Frontend calls GET /api/deals (dashboard route)
         │
         ▼
Dashboard API route calls Backend API
    fetch('http://localhost:8091/api/deals')
         │
         ▼
Backend queries PostgreSQL
    SELECT * FROM deals WHERE status='active'
         │
         ▼
Response flows back: DB → Backend → Dashboard → Browser
```

---

## Data Flow: Chat

```
User sends message in chat
         │
         ▼
Dashboard /chat page sends POST /api/chat
         │
         ▼
Dashboard API route calls Agent API
    fetch('http://localhost:8095/api/v1/chatbot/chat', {
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': process.env.DASHBOARD_SERVICE_TOKEN
      }
    })
         │
         ▼
Agent API processes with LangGraph
    - Validates service token
    - Creates service session
    - Loads context
    - Executes tools if needed
    - Generates response via vLLM
         │
         ▼
Response returns to Dashboard → Browser
```

---

## Environment Variables

### Dashboard

```bash
# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8091
NEXT_PUBLIC_AGENT_API_URL=http://localhost:8095
API_URL=http://localhost:8091
BACKEND_URL=http://localhost:8091

# Service Token for Agent API authentication
DASHBOARD_SERVICE_TOKEN=<token>
```

### Backend API

```bash
DATABASE_URL=postgresql://zakops:password@localhost:5432/zakops
REDIS_URL=redis://localhost:6379
```

### Agent API

```bash
# Database
POSTGRES_HOST=db
POSTGRES_DB=zakops_agent
POSTGRES_USER=agent
POSTGRES_PASSWORD=<password>

# LLM
VLLM_BASE_URL=http://host.docker.internal:8000/v1
DEFAULT_LLM_MODEL=Qwen/Qwen2.5-32B-Instruct-AWQ

# Authentication
JWT_SECRET_KEY=<secret>
DASHBOARD_SERVICE_TOKEN=<same-token-as-dashboard>

# External Services
DEAL_API_URL=http://host.docker.internal:8091
RAG_REST_URL=http://host.docker.internal:8052
```

---

## Health Checks

```bash
# Dashboard
curl http://localhost:3003/api/health

# Backend API
curl http://localhost:8091/health

# Agent API
curl http://localhost:8095/health

# Chat API Status
curl http://localhost:3003/api/chat

# PostgreSQL
docker exec zakops-agent-db pg_isready -U agent

# Redis
docker exec zakops-redis redis-cli ping
```

---

## Container Management

### View Running Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Restart Services
```bash
# Dashboard
cd /home/zaks/zakops-agent-api/deployments/docker
docker compose restart dashboard

# Agent API
cd /home/zaks/zakops-agent-api/apps/agent-api
docker compose restart agent-api

# Backend
cd /home/zaks/zakops-agent-api/deployments/docker
docker compose restart backend-deal-lifecycle
```

### View Logs
```bash
docker logs zakops-agent-api --tail 100
docker logs docker-dashboard-1 --tail 100
docker logs zakops-backend-1 --tail 100
```

---

## Common Issues

### "0 Deals" in Dashboard
1. Check: Does DB have deals? `SELECT COUNT(*) FROM deals`
2. Check: Does Backend API return them? `curl :8091/api/deals`
3. Check: Does Dashboard API return them? `curl :3003/api/deals`
4. Check: Zod schema matches backend response format

### "AI Agent Unavailable" / Fallback Responses
1. Check: Is Agent API running? `curl :8095/health`
2. Check: Is service token configured? Both services need same token
3. Check: 401 error = auth problem. Verify `X-Service-Token` header
4. Check: Dashboard rebuilt after code changes? `docker compose build dashboard`

### Port 8090 References
- This is LEGACY. Any reference should be removed.
- Services on 8090 have been masked and decommissioned.
- Use 8091 for Backend API, 8095 for Agent API.

### Service Token Mismatch
- Agent API token: `apps/agent-api/.env.development` → `DASHBOARD_SERVICE_TOKEN`
- Dashboard token: `deployments/docker/docker-compose.yml` → `DASHBOARD_SERVICE_TOKEN`
- Both must match exactly

---

## Quick Verification Commands

```bash
# Full system health check
echo "=== System Health ===" && \
curl -s http://localhost:3003/api/chat | jq -r '.status // "Dashboard down"' && \
curl -s http://localhost:8091/health | jq -r '.status // "Backend down"' && \
curl -s http://localhost:8095/health | jq -r '.status // "Agent down"'

# Port verification (8090 should be DEAD)
echo "=== Port Check ===" && \
lsof -i :8090 && echo "FAIL: 8090 alive" || echo "PASS: 8090 dead" && \
lsof -i :3003 > /dev/null && echo "PASS: 3003" || echo "FAIL: 3003" && \
lsof -i :8091 > /dev/null && echo "PASS: 8091" || echo "FAIL: 8091" && \
lsof -i :8095 > /dev/null && echo "PASS: 8095" || echo "FAIL: 8095"
```
