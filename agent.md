# ZakOps Agent Instructions

## MANDATORY PRE-FLIGHT

Before starting ANY task in this repository, you MUST:

### 1. Read Architecture Documentation

```
Read: docs/ARCHITECTURE.md
```

This contains the current system architecture, ports, services, and data flows.

### 2. Read Constraint Guide

```
Read: docs/CONSTRAINTS.md
```

This contains forbidden patterns, verification requirements, and behavioral rules.

### 3. Read Task Decomposition Standards

```
Read: docs/ATOMIC_TASKS.md
```

This contains rules for breaking work into atomic, verifiable steps.

### 4. Verify Environment

Run the environment check before making changes:

```bash
# Port 8090 must be DEAD (legacy)
lsof -i :8090 && echo "FAIL: Legacy port alive" || echo "PASS: 8090 dead"

# Required ports must be ALIVE
for port in 3003 8091 8095; do
  lsof -i :$port > /dev/null 2>&1 && echo "PASS: $port" || echo "FAIL: $port"
done
```

**If you skip these steps, your work may be rejected.**

---

## Quick Reference

| Service | Port | Purpose |
|---------|------|---------|
| Dashboard | 3003 | Next.js frontend |
| Backend API | 8091 | Deal lifecycle API |
| Agent API | 8095 | LangGraph agent (vLLM Queen) |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache/queue |

**FORBIDDEN: Port 8090 (legacy, decommissioned)**

---

## Core Principles

### 1. Atomic Tasks
Break every task into small, independently verifiable steps. See `docs/ATOMIC_TASKS.md`.

### 2. Browser Verification
API success ≠ UI success. Always verify UI changes in browser.

### 3. Evidence Required
Every claim needs proof (commands, screenshots, outputs).

### 4. No Assumptions
If unclear, investigate. Don't guess about architecture or ports.

---

## Health Check Commands

```bash
# Quick health check
curl -s http://localhost:3003/api/chat | jq -r '.status'   # Dashboard
curl -s http://localhost:8091/health | jq -r '.status'     # Backend
curl -s http://localhost:8095/health | jq -r '.status'     # Agent
```

---

## Common Workflows

### Testing Chat Flow

```bash
# 1. Check Agent API directly (requires auth)
curl -s http://localhost:8095/api/v1/chatbot/chat \
  -X POST -H "Content-Type: application/json" \
  -H "X-Service-Token: $DASHBOARD_SERVICE_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# 2. Check through Dashboard (auth handled internally)
curl -s http://localhost:3003/api/chat \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"Hello"}'
```

### Restarting Services

```bash
# Agent API
cd /home/zaks/zakops-agent-api/apps/agent-api
docker compose restart agent-api

# Dashboard
cd /home/zaks/zakops-agent-api/deployments/docker
docker compose restart dashboard

# Backend
cd /home/zaks/zakops-agent-api/deployments/docker
docker compose restart backend-deal-lifecycle
```

### Viewing Logs

```bash
docker logs zakops-agent-api --tail 100 -f
docker logs docker-dashboard-1 --tail 100 -f
docker logs zakops-backend-1 --tail 100 -f
```

---

## Change Log Location

All changes must be documented in:
```
/home/zaks/bookkeeping/CHANGES.md
```

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/ARCHITECTURE.md` | System architecture, ports, data flows |
| `docs/CONSTRAINTS.md` | Rules, forbidden patterns, verification standards |
| `docs/ATOMIC_TASKS.md` | Task decomposition, evidence requirements |
| `/home/zaks/bookkeeping/CHANGES.md` | Change log (record all changes here) |
| `/home/zaks/bookkeeping/docs/ONBOARDING.md` | Session onboarding guide |

---

## Critical Rules Summary

1. **Port 8090 is FORBIDDEN** - Legacy, decommissioned
2. **Browser verification required** - curl ≠ UI works
3. **Evidence for every claim** - No unsubstantiated statements
4. **Atomic steps** - Small, verifiable, with evidence
5. **Document changes** - Record in CHANGES.md
6. **Don't assume** - Read docs or investigate
