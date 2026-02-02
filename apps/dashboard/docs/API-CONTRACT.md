# ZakOps API Contract Audit

**Date**: 2025-12-29
**Backend**: http://localhost:8091
**Frontend Proxy**: http://localhost:3003/api/*

## Backend API Catalog

Source: `/home/zaks/scripts/deal_lifecycle_api.py`

### Deal Endpoints

| Method | Path | Purpose | Frontend Caller |
|--------|------|---------|-----------------|
| GET | /api/deals | List deals with filters | getDeals() |
| GET | /api/deals/{deal_id} | Get single deal | getDeal() |
| GET | /api/deals/{deal_id}/events | Get deal events | getDealEvents() |
| GET | /api/deals/{deal_id}/case-file | Get case file | getDealCaseFile() |
| GET | /api/deals/{deal_id}/enrichment | Get enrichment data | getDealEnrichment() |
| POST | /api/deals/{deal_id}/transition | Transition deal stage | transitionDeal() |
| POST | /api/deals/{deal_id}/note | Add note to deal | addDealNote() |

### Action Endpoints

| Method | Path | Purpose | Frontend Caller |
|--------|------|---------|-----------------|
| GET | /api/actions | List all actions | getActions() |
| GET | /api/actions/due | List due actions | getDueActions() |
| GET | /api/deferred-actions | List deferred actions | N/A |
| GET | /api/deferred-actions/due | List due deferred | N/A |
| POST | /api/actions/{action_id}/execute | Execute action | N/A |
| POST | /api/actions/{action_id}/cancel | Cancel action | N/A |

### Quarantine Endpoints

| Method | Path | Purpose | Frontend Caller |
|--------|------|---------|-----------------|
| GET | /api/quarantine | List items | getQuarantineItems() |
| GET | /api/quarantine/health | Get health status | getQuarantineHealth() |
| GET | /api/quarantine/{id} | Get single item | N/A |
| POST | /api/quarantine/{id}/resolve | Resolve item | resolveQuarantineItem() |

### Chat Endpoints

| Method | Path | Purpose | Frontend Caller |
|--------|------|---------|-----------------|
| POST | /api/chat | SSE streaming chat | streamChatMessage() |
| POST | /api/chat/complete | Non-streaming chat | sendChatMessage() |
| POST | /api/chat/execute-proposal | Execute proposal | executeChatProposal() |
| GET | /api/chat/session/{id} | Get session | getChatSession() |
| GET | /api/chat/llm-health | Provider health | N/A (smoke tests) |

### Other Endpoints

| Method | Path | Purpose | Frontend Caller |
|--------|------|---------|-----------------|
| GET | /api/alerts | Get alerts | getAlerts() |
| GET | /api/pipeline | Get pipeline stats | getPipeline() |
| GET | /api/checkpoints | Get checkpoints | getCheckpoints() |
| GET | /api/metrics/classification | Classification metrics | getClassificationMetrics() |
| GET | /api/version | Get version info | N/A |
| GET | /health | Health check | N/A |

---

## Frontend API Client

Source: `/home/zaks/zakops-dashboard/src/lib/api.ts`

### Exported Functions

| Function | API Call | Status |
|----------|----------|--------|
| getDeals(params?) | GET /api/deals | Working |
| getDeal(id) | GET /api/deals/{id} | Working |
| getDealEvents(id, limit?) | GET /api/deals/{id}/events | Working |
| getDealCaseFile(id) | GET /api/deals/{id}/case-file | Working |
| getDealEnrichment(id) | GET /api/deals/{id}/enrichment | Working |
| getActions(params?) | GET /api/actions | Working |
| getDueActions() | GET /api/actions/due | Working |
| getQuarantineItems() | GET /api/quarantine | Working |
| getQuarantineHealth() | GET /api/quarantine/health | Working |
| resolveQuarantineItem(id, action, dealId?) | POST /api/quarantine/{id}/resolve | Working |
| getAlerts() | GET /api/alerts | Working |
| getClassificationMetrics() | GET /api/metrics/classification | Working |
| getCheckpoints() | GET /api/checkpoints | Working |
| getPipeline() | GET /api/pipeline | Working |
| transitionDeal(id, stage, reason, approver) | POST /api/deals/{id}/transition | Working |
| addDealNote(id, content) | POST /api/deals/{id}/note | Working |
| sendChatMessage(query, scope, sessionId?, options?) | POST /api/chat/complete | Working |
| streamChatMessage(query, scope, sessionId?, options?) | POST /api/chat | Working |
| executeChatProposal(proposalId, sessionId, action, approver) | POST /api/chat/execute-proposal | Working |
| getChatSession(sessionId) | GET /api/chat/session/{id} | Working |

---

## Contract Diff Analysis

### Missing Frontend Callers

Backend endpoints with no frontend caller:

| Endpoint | Reason | Action |
|----------|--------|--------|
| POST /api/actions/{id}/execute | Not exposed in UI | Consider adding to Actions page |
| POST /api/actions/{id}/cancel | Not exposed in UI | Consider adding to Actions page |
| GET /api/quarantine/{id} | Not needed (full list used) | Keep for future |
| GET /api/deferred-actions | Legacy alias | Keep for compat |
| GET /api/deferred-actions/due | Legacy alias | Keep for compat |
| GET /api/enrichment/audit | Admin tool | Not needed in UI |
| GET /api/enrichment/pending-links | Admin tool | Not needed in UI |
| POST /api/enrichment/mark-link-fetched | Admin tool | Not needed in UI |
| POST /api/agents/{name}/invoke | Agent system | Not needed in UI |
| GET /api/agents/{name}/history | Agent system | Not needed in UI |

### Payload/Type Issues

All core endpoints are working. Notable findings:

1. **Zod coercion in frontend**: Numbers may arrive as strings (e.g., "TBD"). Frontend uses `coerceToNumber()` preprocessor.

2. **ChatScopeModel**: Backend expects `{ type: string, deal_id?: string, doc?: object }` not a string.

3. **Proposal types**: Frontend normalizes proposal types via `normalizeChatProposalType()`.

### Query Parameter Mapping

| Frontend Param | Backend Param | Match |
|----------------|---------------|-------|
| stage | stage | YES |
| status | status | YES |
| broker | broker | YES |
| deal_id | deal_id | YES |
| search | (not used) | N/A - client-side only |

---

## Next.js Rewrites

Configured in `next.config.ts`:

```javascript
rewrites: [
  { source: '/api/:path*', destination: 'http://localhost:8091/api/:path*' }
]
```

All `/api/*` calls are proxied to backend at port 8091.

---

## Verified Working

Based on smoke tests (45/45 passing):

- Deal CRUD
- Deal events
- Deal transitions
- Deal notes
- Actions list/due
- Quarantine list/health/resolve
- Chat streaming
- Chat proposals
- Chat execution
- LLM health
- Version endpoint
