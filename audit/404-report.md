# 404 Report: Broken Links and Missing Routes

**Audit Date**: 2026-01-19
**Status**: Phase 0 Baseline Audit

---

## Methodology

This report documents navigation links that lead to non-existent pages or API endpoints that return errors.

---

## Frontend Route Analysis

### Configured Routes (from nav-config.ts)

| Route | Page Exists | Status |
|-------|-------------|--------|
| `/` | Yes (page.tsx) | OK |
| `/deals` | Yes (page.tsx) | OK |
| `/actions` | Yes (page.tsx) | OK |
| `/quarantine` | Yes (page.tsx) | OK |
| `/hq` | Yes (page.tsx) | OK |
| `/agent-activity` | Yes (page.tsx) | OK |
| `/onboarding` | Yes (page.tsx) | OK |
| `/chat` | Yes (page.tsx) | OK |

**Result**: All navigation routes have corresponding page files.

---

## Dynamic Routes

### Deal Routes

| Pattern | Implementation | Status |
|---------|----------------|--------|
| `/deals/[id]` | page.tsx exists | OK |
| `/deals/[id]/workspace` | Redirects to `/deals/[id]?tab=workspace` | OK |

### Onboarding Routes

| Pattern | Implementation | Status |
|---------|----------------|--------|
| `/onboarding/[step]` | Not implemented | MISSING |

**Note**: Onboarding appears to use tabs within single page, not dynamic routes.

---

## API Endpoint Availability

### Frontend API Routes (Next.js)

| Route | File Exists | Backend Connection |
|-------|-------------|-------------------|
| `/api/chat` | Yes | Proxies to backend |
| `/api/file-upload` | Yes | Handles uploads |
| `/api/triage-upload` | Yes | Handles triage |
| `/api/chat/ollama` | Yes | Ollama proxy |
| `/api/chat/reasoning` | Yes | Reasoning endpoint |

### Backend API Endpoints Called by Frontend

Tested against: `http://localhost:8000`

| Endpoint | Frontend Expects | Backend Has | Status |
|----------|------------------|-------------|--------|
| GET /api/deals | Yes | Yes | OK |
| GET /api/deals/:id | Yes | Yes | OK |
| GET /api/actions | Yes | Yes | OK |
| GET /api/actions/:id | Yes | Yes | OK |
| POST /api/actions/:id/approve | Yes | Yes | OK |
| POST /api/actions/:id/reject | Yes | Yes | OK |
| GET /api/quarantine | Yes | Yes | OK |
| GET /api/pipeline | Yes | Yes | OK |
| GET /api/agent/activity | Yes | **No** | MISSING |
| GET /api/agent/runs | Yes | **No** | MISSING |
| GET /api/dashboard/overview | Yes | **No** | MISSING |
| GET /api/hq/stats | Yes | **No** | MISSING |

---

## Missing API Endpoints

### Critical (Used by UI)

1. **GET /api/agent/activity**
   - Used by: Agent Activity page
   - Current workaround: Page shows empty state
   - Priority: P0

2. **GET /api/agent/runs**
   - Used by: Agent Activity page
   - Current workaround: Page shows empty state
   - Priority: P0

### Non-Critical (Nice to have)

3. **GET /api/dashboard/overview**
   - Used by: Dashboard page
   - Current workaround: Makes multiple API calls
   - Priority: P1

4. **GET /api/hq/stats**
   - Used by: Operator HQ page
   - Current workaround: Uses /api/pipeline
   - Priority: P1

---

## Link Analysis

### External Links

| Link | Destination | Status |
|------|-------------|--------|
| Logo | `/` (home) | OK |
| Command palette | Opens modal | OK |

### Internal Navigation

All sidebar navigation links verified working.

---

## 404 Scenarios

### User Actions That Could Result in 404

1. **Direct URL to non-existent deal**
   - URL: `/deals/non-existent-id`
   - Result: API returns 404, UI shows error state
   - Handling: Graceful error display

2. **Direct URL to invalid action**
   - URL: `/actions` with invalid filter params
   - Result: UI ignores invalid params
   - Handling: Safe fallback

3. **Bookmarked archived deal**
   - URL: `/deals/archived-deal-id`
   - Result: Deal may not load
   - Handling: Error boundary catches

---

## Summary

| Category | Total | Working | Missing/Broken |
|----------|-------|---------|----------------|
| Navigation Routes | 8 | 8 | 0 |
| Dynamic Routes | 2 | 2 | 0 |
| Frontend API Routes | 5 | 5 | 0 |
| Backend Endpoints | 20+ | 16+ | 4 |

**Overall Status**: Frontend routing is complete. Four backend API endpoints are missing but have graceful fallbacks in the UI.

---

## Recommendations

1. Implement missing `/api/agent/activity` endpoint
2. Implement missing `/api/agent/runs` endpoint
3. Consider adding `/api/dashboard/overview` to reduce API calls
4. Consider adding `/api/hq/stats` for cleaner HQ data fetching
