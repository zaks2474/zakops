# ZakOps Dashboard Wiring Matrix

**Date**: 2025-12-29
**Commit**: da593b15b7f8
**Smoke Tests**: 45/45 passing

## Legend

| Status | Meaning |
|--------|---------|
| Working | Feature fully functional, tested |
| Partial | Feature works but has minor issues |
| Broken | Feature fails or errors |
| Hollow | UI exists but not wired to backend |
| Missing | No UI for this backend capability |

---

## Dashboard (/dashboard)

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getDeals, getDueActions, getQuarantineHealth, getQuarantineItems, getAlerts | Working | HTTP 200, data loads |
| Refresh button | Button | Click | All above | Working | Tested manually |
| Pipeline stage filter | Button array | Click | N/A (client) | Working | Filters deal list |
| Clear filter | Button | Click | N/A | Working | Resets filter |
| Deal row click | Link | Click | N/A | Working | Navigates to /deals/{id} |
| "View all" deals | Button | Click | N/A | Working | Navigates to /deals |
| "View all" actions | Button | Click | N/A | Working | Navigates to /actions |
| "View all" quarantine | Button | Click | N/A | Working | Navigates to /quarantine |
| Action item click | Link | Click | N/A | Working | Navigates to deal |
| Auto-refresh | useEffect | 60s interval | All above | Working | setInterval verified |
| Scroll | SidebarInset | N/A | N/A | Working | min-h-0 overflow-auto applied |

---

## Deals List (/deals)

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getDeals | Working | 91 deals load |
| Search input | Input | Type | N/A (client filter) | Working | Filters by name/id/broker |
| Clear search | X button | Click | N/A | Working | Clears query |
| Stage filter | Select | Change | getDeals({ stage }) | Working | API call confirmed |
| Status filter | Select | Change | getDeals({ status }) | Working | API call confirmed |
| Clear filters | Button | Click | N/A | Working | Resets URL params |
| Refresh button | Button | Click | getDeals | Working | Reloads data |
| Sort columns | TableHead | Click | N/A (client sort) | Working | Sorts in memory |
| Deal row click | TableRow | Click | N/A | Working | Navigates to /deals/{id} |
| Scroll | ScrollArea | N/A | N/A | Working | Scroll area present |

---

## Deal Workspace (/deals/[id])

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getDeal, getDealEvents, getDealCaseFile, getDealEnrichment, getActions | Working | All data loads |
| Back button | Button | Click | N/A | Working | Navigates to /deals |
| Add Note button | Button | Click | N/A | Working | Opens dialog |
| Chat button | Link | Click | N/A | Working | Navigates to /chat?deal_id={id} |
| Refresh button | Button | Click | All above | Working | Reloads data |
| Overview tab | Tab | Click | N/A | Working | Shows content |
| Materials tab | Tab | Click | N/A | Working | Shows materials |
| Case File tab | Tab | Click | N/A | Working | Shows JSON |
| Events tab | Tab | Click | N/A | Working | Shows timeline |
| Stage transition buttons | Button array | Click | N/A | Working | Opens dialog |
| Transition dialog submit | Button | Click | transitionDeal() | Working | API tested |
| Note dialog submit | Button | Click | addDealNote() | Working | API tested |
| View All Actions link | Button | Click | N/A | Working | Navigates to /actions?deal_id={id} |
| Material links | Anchor | Click | N/A | Working | Opens external |

---

## Actions (/actions)

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getActions, getDueActions | Working | Data loads |
| Refresh button | Button | Click | All above | Working | Reloads data |
| Summary cards | Cards | N/A | N/A | Working | Counts display |
| Due Now tab | Tab | Click | N/A | Working | Filters list |
| Overdue tab | Tab | Click | N/A | Working | Filters by date |
| Today tab | Tab | Click | N/A | Working | Filters by date |
| This Week tab | Tab | Click | N/A | Working | Filters by date |
| Upcoming tab | Tab | Click | N/A | Working | Filters by date |
| Completed tab | Tab | Click | N/A | Working | Filters by status |
| Action row click | Link | Click | N/A | Working | Navigates to deal |
| Auto-refresh | useEffect | 60s | All above | Working | Interval verified |

---

## Quarantine (/quarantine)

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getQuarantineItems, getQuarantineHealth | Working | Data loads |
| Refresh button | Button | Click | All above | Working | Reloads data |
| Health status cards | Cards | N/A | N/A | Working | Status displays |
| Resolve button | Button | Click | N/A | Working | Opens dialog |
| Link to Deal radio | Radio | Select | N/A | Working | Selects option |
| Create New Deal radio | Radio | Select | N/A | Working | Selects option |
| Discard radio | Radio | Select | N/A | Working | Selects option |
| Deal ID input | Input | Type | N/A | Working | Captures input |
| Confirm Resolution | Button | Click | resolveQuarantineItem() | Working | API tested |
| Cancel button | Button | Click | N/A | Working | Closes dialog |

---

## Chat (/chat)

| Feature | UI Component | Trigger | API Call | Status | Evidence |
|---------|--------------|---------|----------|--------|----------|
| Page load | page.tsx | Mount | getDeals (for selector) | Working | Deals load |
| Scope selector | Select | Change | N/A | Working | Updates state |
| Deal selector | Select | Change | N/A | Working | Updates state |
| Message input | Input | Type | N/A | Working | Captures text |
| Send button | Button | Click | streamChatMessage() | Working | SSE streams |
| Enter to send | Input | Enter key | streamChatMessage() | Working | Keyboard tested |
| Clear chat | Button | Click | N/A | Working | Clears messages |
| Approve proposal | Button | Click | executeChatProposal() | Working | API tested |
| Reject proposal | Button | Click | executeChatProposal() | Working | API tested |
| Debug panel toggle | Collapsible | Click | N/A | Working | Expands/collapses |
| New session | Button | Click | N/A | Working | Resets state |
| Session persistence | localStorage | Auto | N/A | Working | Survives refresh |
| Progress indicator | Dots | Auto | N/A | Working | Shows phases |
| Gemini Pro routing | Auto | Email query | N/A | Working | gemini-pro used |

---

## Global/Layout

| Feature | UI Component | Trigger | Status | Evidence |
|---------|--------------|---------|--------|----------|
| Sidebar navigation | NavLink | Click | Working | All routes navigate |
| Sidebar collapse | Toggle | Click | Working | Collapses/expands |
| Dark mode toggle | Button | Click | Working | Theme switches |
| Global scroll | SidebarInset | N/A | Working | min-h-0 overflow-auto |
| Page scroll | Content area | N/A | Working | Each page scrolls |
| Breadcrumbs | Header | N/A | Working | Path shown |

---

## Missing Features (Backend exists, no UI)

| Backend Endpoint | Current State | Priority | Recommendation |
|------------------|---------------|----------|----------------|
| POST /api/actions/{id}/execute | Missing UI | Medium | Add execute button to action items |
| POST /api/actions/{id}/cancel | Missing UI | Low | Add cancel option |
| GET /api/metrics/classification | Not displayed | Low | Add to dashboard as card |
| GET /api/checkpoints | Not displayed | Low | Admin-only feature |

---

## Template Features (UI exists, not needed)

| Route | Current State | Recommendation |
|-------|---------------|----------------|
| /dashboard/billing | Template | Hide from nav or remove |
| /dashboard/exclusive | Template | Hide from nav or remove |
| /dashboard/kanban | Template | Hide from nav or remove |
| /dashboard/product | Template | Hide from nav or remove |
| /dashboard/workspaces | Template | Hide from nav or remove |
| /dashboard/profile | Template | Keep for future user settings |

---

## Summary

| Category | Working | Partial | Broken | Hollow | Missing |
|----------|---------|---------|--------|--------|---------|
| Dashboard | 11 | 0 | 0 | 0 | 0 |
| Deals List | 10 | 0 | 0 | 0 | 0 |
| Deal Workspace | 15 | 0 | 0 | 0 | 0 |
| Actions | 11 | 0 | 0 | 0 | 2 |
| Quarantine | 10 | 0 | 0 | 0 | 0 |
| Chat | 13 | 0 | 0 | 0 | 0 |
| Global | 6 | 0 | 0 | 0 | 0 |
| **TOTAL** | **76** | **0** | **0** | **0** | **2** |

### Key Findings

1. **All core features are working** - No broken or hollow features detected
2. **Scroll fixed** - SidebarInset now has proper overflow handling
3. **Search works** - Client-side filtering on 91 deals
4. **Chat fully functional** - SSE, proposals, Gemini Pro routing all working
5. **Missing features are low priority** - Action execute/cancel buttons

### Fixes Applied This Session

| Issue | Root Cause | Fix Applied |
|-------|-----------|-------------|
| Gemini API key | Root user path | Symlink /root/.gemini_api |
| Gemini models 404 | Deprecated names | Updated to 2.5 versions |
| Email draft fails | Thinking tokens | max_tokens 600 → 2000 |
| JSON parsing fails | Markdown fences | Regex stripping added |
| Global scroll broken | Missing overflow | min-h-0 overflow-auto |
