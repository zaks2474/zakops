# UI → API Dependency Map

**Audit Date**: 2026-01-19
**Phase**: 1 Pre-Phase Deliverable
**Purpose**: Document all API endpoints called by the frontend

---

## API Client Overview

**File**: `src/lib/api.ts`
**Lines**: ~1850
**Pattern**: Centralized API client with Zod validation

All API calls go through the centralized client. The frontend uses Next.js rewrites to proxy `/api/*` to the backend, so all calls use relative paths.

---

## Critical Endpoints (Must Not Break)

These endpoints are actively used by the UI and their response shapes MUST be preserved:

| Endpoint | Method | Used By | Response Contract |
|----------|--------|---------|-------------------|
| `/api/deals` | GET | Dashboard, Deals page | `{ deals: Deal[], count?: number }` or `Deal[]` |
| `/api/deals/:id` | GET | DealWorkspace | `DealDetail` object |
| `/api/deals/:id/events` | GET | DealWorkspace | `{ events: Event[], count?: number }` or `Event[]` |
| `/api/actions` | GET | ActionsPage | `{ actions: KineticAction[], count?: number }` |
| `/api/actions/:id` | GET | ActionDetail | `KineticAction` object |
| `/api/actions/:id/approve` | POST | ActionsPage, Quarantine | `{ success: boolean, action?: KineticAction }` |
| `/api/actions/:id/execute` | POST | ActionsPage | `{ success: boolean, action?: KineticAction }` |
| `/api/quarantine` | GET | QuarantinePage | `{ items: QuarantineItem[], count?: number }` |
| `/api/actions/quarantine` | GET | QuarantinePage | `QuarantineItem[]` |
| `/api/pipeline` | GET | HQ page | `{ total_active: number, stages: Record<string, PipelineStage> }` |
| `/api/chat` | POST | ChatPanel | SSE stream of `ChatStreamEvent` |
| `/api/chat/complete` | POST | ChatPanel | `ChatResponse` object |

---

## API Endpoints Called by UI

### Deal Endpoints

| Endpoint | Method | Function | Response Shape | Used By |
|----------|--------|----------|----------------|---------|
| `/api/deals` | GET | `getDeals()` | `Deal[]` | Dashboard, DealsPage |
| `/api/deals/:id` | GET | `getDeal()` | `DealDetail` | DealWorkspace |
| `/api/deals/:id/events` | GET | `getDealEvents()` | `DealEvent[]` | DealWorkspace |
| `/api/deals/:id/case-file` | GET | `getDealCaseFile()` | `unknown` | DealWorkspace |
| `/api/deals/:id/enrichment` | GET | `getDealEnrichment()` | `DealEnrichment` | DealWorkspace |
| `/api/deals/:id/materials` | GET | `getDealMaterials()` | `DealMaterials` | DealWorkspace |
| `/api/deals/:id/transition` | POST | `transitionDeal()` | `{ success, message }` | DealWorkspace |
| `/api/deals/:id/note` | POST | `addDealNote()` | `{ success, event_id }` | DealWorkspace |
| `/api/deals/:id/archive` | POST | `archiveDeal()` | `{ archived, deal_id }` | DealsPage |
| `/api/deals/bulk-archive` | POST | `bulkArchiveDeals()` | `{ archived[], skipped[] }` | DealsPage |

### Kinetic Action Endpoints

| Endpoint | Method | Function | Response Shape | Used By |
|----------|--------|----------|----------------|---------|
| `/api/actions` | GET | `getKineticActions()` | `KineticAction[]` | ActionsPage |
| `/api/actions` | POST | `createKineticAction()` | `{ success, action_id, action }` | CreateAction |
| `/api/actions/:id` | GET | `getKineticAction()` | `KineticAction` | ActionDetail |
| `/api/actions/:id` | DELETE | `deleteKineticAction()` | `{ success, action_id }` | ActionsPage |
| `/api/actions/:id/approve` | POST | `approveKineticAction()` | `{ success, action }` | ActionsPage |
| `/api/actions/:id/execute` | POST | `runKineticAction()` | `{ success, action }` | ActionsPage |
| `/api/actions/:id/cancel` | POST | `cancelKineticAction()` | `{ success, action }` | ActionsPage |
| `/api/actions/:id/retry` | POST | `retryKineticAction()` | `{ success, action }` | ActionsPage |
| `/api/actions/:id/update` | POST | `updateKineticActionInputs()` | `{ success, action }` | ActionDetail |
| `/api/actions/:id/archive` | POST | `archiveKineticAction()` | `{ success, action_id }` | ActionsPage |
| `/api/actions/:id/artifact/:artifactId` | GET | `getArtifactDownloadUrl()` | File download | ActionDetail |
| `/api/actions/capabilities` | GET | `getCapabilities()` | `{ capabilities[], count }` | CreateAction |
| `/api/actions/metrics` | GET | `getActionMetrics()` | `ActionMetrics` | ActionsPage |
| `/api/actions/bulk/archive` | POST | `bulkArchiveKineticActions()` | `{ success, archived_count }` | ActionsPage |
| `/api/actions/bulk/delete` | POST | `bulkDeleteKineticActions()` | `{ success, deleted_count }` | ActionsPage |
| `/api/actions/clear-completed` | POST | `clearCompletedActions()` | `{ success, affected_count }` | ActionsPage |
| `/api/actions/completed-count` | GET | `getCompletedActionsCount()` | `{ count }` | ActionsPage |

### Quarantine Endpoints

| Endpoint | Method | Function | Response Shape | Used By |
|----------|--------|----------|----------------|---------|
| `/api/quarantine` | GET | `getQuarantineItems()` | `QuarantineItem[]` | QuarantinePage |
| `/api/quarantine/health` | GET | `getQuarantineHealth()` | `QuarantineHealth` | QuarantinePage |
| `/api/quarantine/:id/resolve` | POST | `resolveQuarantineItem()` | `{ success, deal_id }` | QuarantinePage |
| `/api/quarantine/:id/delete` | POST | `deleteQuarantineItem()` | `{ hidden, quarantine_id }` | QuarantinePage |
| `/api/quarantine/bulk-delete` | POST | `bulkDeleteQuarantineItems()` | `{ hidden[], missing[], already_hidden[] }` | QuarantinePage |
| `/api/actions/quarantine` | GET | `getQuarantineQueue()` | `QuarantineItem[]` | QuarantinePage |
| `/api/actions/quarantine/:id/preview` | GET | `getQuarantinePreview()` | `QuarantinePreview` | QuarantinePage |
| `/api/actions/quarantine/:id/reject` | POST | `rejectQuarantineItem()` | `{ ok, reject_action_id }` | QuarantinePage |

### Chat Endpoints

| Endpoint | Method | Function | Response Shape | Used By |
|----------|--------|----------|----------------|---------|
| `/api/chat` | POST | `streamChatMessage()` | SSE stream | ChatPanel |
| `/api/chat/complete` | POST | `sendChatMessage()` | `ChatResponse` | ChatPanel |
| `/api/chat/execute-proposal` | POST | `executeChatProposal()` | `{ success, result, proposal }` | ChatPanel |
| `/api/chat/session/:id` | GET | `getChatSession()` | Session with messages | ChatPanel |

### Pipeline/Dashboard Endpoints

| Endpoint | Method | Function | Response Shape | Used By |
|----------|--------|----------|----------------|---------|
| `/api/pipeline` | GET | `getPipeline()` | `{ total_active, stages }` | HQ page |
| `/api/alerts` | GET | `getAlerts()` | `Alert[]` | Dashboard |
| `/api/metrics/classification` | GET | `getClassificationMetrics()` | `ClassificationMetrics` | Dashboard |
| `/api/checkpoints` | GET | `getCheckpoints()` | `Checkpoint[]` | Dashboard |

### Legacy Deferred Actions (Fallback)

| Endpoint | Method | Function | Response Shape | Notes |
|----------|--------|----------|----------------|-------|
| `/api/deferred-actions` | GET | `getActions()` | `Action[]` | Fallback if Kinetic unavailable |
| `/api/deferred-actions/due` | GET | `getDueActions()` | `Action[]` | Legacy |

---

## Response Schemas (Zod Validated)

### DealSchema

```typescript
{
  deal_id: string,
  canonical_name: string | null,
  display_name?: string | null,
  stage: string,
  status: string,
  broker?: string | null,
  priority?: string | null,
  updated_at?: string | null,
  created_at?: string | null,
  days_since_update?: number,
  folder_path?: string | null,
}
```

### KineticActionSchema

```typescript
{
  action_id: string,
  deal_id: string,          // "GLOBAL" for non-deal actions
  action_type: string,
  capability_id?: string,
  title: string,
  summary?: string,
  status: 'PENDING_APPROVAL' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
  inputs: Record<string, unknown>,
  outputs?: Record<string, unknown>,
  artifacts: KineticArtifact[],
  error?: { message, code?, category?, retryable?, details? },
  created_at: string,
  updated_at: string,
  approved_at?: string,
  approved_by?: string,
  started_at?: string,
  completed_at?: string,
  retry_count: number,
  max_retries: number,
  created_by?: string,
  progress?: number,
  progress_message?: string,
}
```

### QuarantineItemSchema

```typescript
{
  id?: string,
  quarantine_id?: string,
  action_id?: string,
  email_subject?: string,
  subject?: string,
  sender?: string,
  from?: string,
  received_at?: string,
  timestamp?: string,
  quarantine_reason?: string,
  reason?: string,
  status?: string,
  classification?: string,
  urgency?: string,
  company?: string | null,
  links?: unknown[],
  attachments?: unknown[],
  quarantine_dir?: string | null,
  capability_id?: string | null,
}
```

---

## WebSocket/SSE Connections

| Connection | URL | Method | Used By | Purpose |
|------------|-----|--------|---------|---------|
| Chat SSE | `/api/chat` | POST | ChatPanel | Streaming chat responses |

**SSE Event Types**:
- `token` - Incremental response text
- `evidence` - Evidence summary
- `done` - Stream complete
- `error` - Error occurred
- `progress` - Progress update

---

## Next.js API Routes (Proxies)

The dashboard has local API routes that proxy to the backend:

| Route | File | Purpose |
|-------|------|---------|
| `/api/chat` | `src/app/api/chat/route.ts` | Proxy to backend chat |
| `/api/file-upload` | `src/app/api/file-upload/route.ts` | File upload handling |
| `/api/triage-upload` | `src/app/api/triage-upload/route.ts` | Triage file uploads |
| `/api/chat/ollama` | `src/app/api/chat/ollama/route.ts` | Ollama proxy |
| `/api/chat/reasoning` | `src/app/api/chat/reasoning/route.ts` | Reasoning endpoint |

---

## Migration Impact Assessment

### High Impact (Active Use)

| Endpoint | UI Impact | Migration Notes |
|----------|-----------|-----------------|
| `/api/deals` | Breaks Dashboard, Deals page | Must preserve response shape |
| `/api/actions` | Breaks Actions page | Must preserve response shape |
| `/api/quarantine` | Breaks Quarantine page | Must preserve response shape |
| `/api/chat` | Breaks Chat feature | SSE streaming must work |

### Medium Impact (Used but with Fallbacks)

| Endpoint | UI Impact | Migration Notes |
|----------|-----------|-----------------|
| `/api/pipeline` | HQ shows empty | Has null/error handling |
| `/api/alerts` | Dashboard shows no alerts | Has empty array fallback |
| `/api/metrics/classification` | Dashboard shows no metrics | Has null handling |

### Low Impact (Optional/Enhancement)

| Endpoint | UI Impact | Migration Notes |
|----------|-----------|-----------------|
| `/api/checkpoints` | No visible impact | Returns empty array |
| `/api/actions/capabilities` | Falls back to mock | Mock data available |

---

## Compatibility Rules

To maintain frontend compatibility during migration:

1. **Response shapes must not change** - Only add new fields
2. **Array responses must stay arrays** - Don't change to objects
3. **Null handling preserved** - Frontend expects null for optional fields
4. **Status codes preserved** - 404 for not found, 200 for success
5. **SSE format preserved** - Chat streaming must work

---

## Recommendations

1. **Add trace_id to responses** - Safe addition, frontend ignores unknown fields
2. **Add correlation_id to responses** - Safe addition
3. **Keep response normalization** - Frontend handles both wrapped/unwrapped
4. **Test SSE after changes** - Chat is sensitive to streaming format
5. **Monitor API errors** - Frontend logs validation failures
