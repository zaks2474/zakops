# UI Link Map

**Audit Date**: 2026-01-19
**Repository**: zakops-dashboard
**Status**: Phase 0 Baseline Audit

---

## Application Pages

| Page Path | File Location | Status |
|-----------|---------------|--------|
| `/` | src/app/page.tsx | Exists |
| `/dashboard` | src/app/dashboard/page.tsx | Exists |
| `/deals` | src/app/deals/page.tsx | Exists |
| `/deals/[id]` | src/app/deals/[id]/page.tsx | Exists |
| `/actions` | src/app/actions/page.tsx | Exists |
| `/quarantine` | src/app/quarantine/page.tsx | Exists |
| `/chat` | src/app/chat/page.tsx | Exists |
| `/agent/activity` | src/app/agent/activity/page.tsx | Exists |
| `/onboarding` | src/app/onboarding/page.tsx | Exists |
| `/hq` | src/app/hq/page.tsx | Exists |
| `/ui-test` | src/app/ui-test/page.tsx | Exists (dev only) |

---

## Sidebar Navigation (nav-config.ts)

| Menu Item | Target Route | Icon | Keyboard Shortcut |
|-----------|--------------|------|-------------------|
| Dashboard | /dashboard | dashboard | d, d |
| Operator HQ | /hq | hq | g, h |
| Deals | /deals | product | g, d |
| Actions | /actions | kanban | g, a |
| Quarantine | /quarantine | warning | g, q |
| Chat | /chat | chat | g, c |
| Agent Activity | /agent/activity | agent | g, g |
| Onboarding | /onboarding | onboarding | g, o |

---

## Deep Links Found in Components

### Dashboard Page (/dashboard)
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| Deal card | Deal name | /deals/{deal_id} |
| "View all deals" | View all | /deals |
| Quarantine card | View quarantine | /quarantine |

### Agent Activity Widget
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| AgentActivityWidget | "View All Activity" | /agent/activity |
| AgentStatusIndicator | Status indicator | /agent/activity |

### Deal Workspace (/deals/[id])
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| DealHeader | Back arrow | /deals |
| Chat button | "Open Chat" | /chat?deal_id={dealId} |
| Actions link | "View Actions" | /actions?deal_id={dealId} |
| External links | Material URLs | External (new tab) |

### Pipeline Overview (HQ)
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| Stage cards | Stage name | /deals?stage={stage} |
| "View all deals" | Link | /deals |
| "View quarantine" | Link | /quarantine |

### Actions Page
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| ActionCard | Deal name | /deals/{deal_id} |
| Artifact download | Download link | /api/actions/{id}/artifact/{artifact_id} |

### Quarantine Page
| Source Component | Link Text/Action | Target Route |
|------------------|------------------|--------------|
| Material links | External URL | External (new tab) |

---

## Next.js API Routes (Frontend BFF)

| Route File | HTTP Methods | Endpoint |
|------------|--------------|----------|
| src/app/api/actions/[id]/route.ts | GET | /api/actions/:id |
| src/app/api/actions/[id]/archive/route.ts | POST | /api/actions/:id/archive |
| src/app/api/actions/bulk/archive/route.ts | POST | /api/actions/bulk/archive |
| src/app/api/actions/bulk/delete/route.ts | POST | /api/actions/bulk/delete |
| src/app/api/actions/clear-completed/route.ts | POST | /api/actions/clear-completed |
| src/app/api/actions/completed-count/route.ts | GET | /api/actions/completed-count |
| src/app/api/agent/activity/route.ts | GET | /api/agent/activity |
| src/app/api/events/route.ts | GET | /api/events |

**Note**: Most API calls go directly to the backend via Next.js rewrites, not through these BFF routes.

---

## External Links

| Component | Link Target | Type |
|-----------|-------------|------|
| cta-github.tsx | github.com/Kiranism/next-shadcn-dashboard-starter | External |
| Artifact downloads | Backend artifact URLs | Download |
| Material links (CIM, etc.) | External vendor portals | External |
| Broker email links | mailto:{email} | Email client |

---

## Route Dependencies Summary

| UI Page | Backend API Endpoints Called |
|---------|------------------------------|
| /dashboard | /api/deals, /api/pipeline, /api/alerts, /api/quarantine/health |
| /deals | /api/deals |
| /deals/[id] | /api/deals/{id}, /api/deals/{id}/events, /api/deals/{id}/materials, /api/deals/{id}/enrichment |
| /actions | /api/actions, /api/actions/capabilities, /api/actions/metrics |
| /quarantine | /api/actions/quarantine, /api/quarantine |
| /chat | /api/chat, /api/chat/complete (SSE), /api/chat/execute-proposal |
| /agent/activity | /api/agent/activity (via Next.js API route) |
| /hq | /api/pipeline, /api/quarantine/health |
| /onboarding | No backend calls (local state) |

---

## Missing Routes (Spec vs Current)

| Spec Route | Status | Notes |
|------------|--------|-------|
| GET /api/dashboard/overview | Missing | Dashboard uses multiple endpoints instead |
| GET /api/hq/stats | Missing | HQ uses /api/pipeline instead |
| GET /api/agent/runs | Missing | No agent_runs table exists |
| GET /api/deals/:id/workspace | Missing | Uses multiple endpoints instead |

---

## Hardcoded Routes Found

| File | Line | Route | Notes |
|------|------|-------|-------|
| nav-config.ts | Multiple | All sidebar routes | Centralized - good |
| Various components | Multiple | /deals, /actions, etc. | Uses <Link> - good |

**Assessment**: Navigation is well-structured with centralized config. No significant hardcoding issues.
