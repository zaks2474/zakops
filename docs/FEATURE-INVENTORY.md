# ZakOps Dashboard Feature Inventory

**Date**: 2025-12-29
**Commit**: da593b15b7f8

## Navigation Structure

Primary nav items from `src/config/nav-config.ts`:

| Route | Title | Icon | Shortcut | Status |
|-------|-------|------|----------|--------|
| /dashboard | Dashboard | dashboard | d+d | Core |
| /deals | Deals | product | g+d | Core |
| /actions | Actions | kanban | g+a | Core |
| /quarantine | Quarantine | warning | g+q | Core |
| /chat | Chat | chat | g+c | Core |

---

## Route: /dashboard

**File**: `src/app/dashboard/page.tsx`
**Description**: Main dashboard with pipeline overview and activity summary

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Refresh button | Button | Click | Reload all dashboard data | Multiple: getDeals, getDueActions, getQuarantineHealth, getQuarantineItems, getAlerts |
| Pipeline stage filter | Button array | Click on stage | Filter deals table to selected stage | N/A (client filter) |
| Clear filter button | Button | Click | Reset stage filter | N/A (client state) |
| Deal row click | Table row | Click | Navigate to /deals/{id} | N/A (navigation) |
| "View all" deals | Button | Click | Navigate to /deals | N/A (navigation) |
| "View all" actions | Button | Click | Navigate to /actions | N/A (navigation) |
| "View all" quarantine | Button | Click | Navigate to /quarantine | N/A (navigation) |
| Action item click | List item | Click | Navigate to /deals/{deal_id} | N/A (navigation) |

### Data Display

| Section | Data Source | Auto-refresh |
|---------|-------------|--------------|
| Pipeline funnel | getDeals({ status: 'active' }) | 60s |
| Deals table | getDeals({ status: 'active' }) | 60s |
| Due actions | getDueActions() | 60s |
| Quarantine status | getQuarantineHealth() | 60s |
| Quarantine items | getQuarantineItems() | 60s |
| Alerts | getAlerts() | 60s |

---

## Route: /deals

**File**: `src/app/deals/page.tsx`
**Description**: Deal list with search, filtering, and sorting

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Search input | Input | Type | Filter deals by name/id/broker | N/A (client filter) |
| Clear search | X button | Click | Clear search query | N/A (client state) |
| Stage filter | Select | Select value | Filter by stage | getDeals({ stage }) |
| Status filter | Select | Select value | Filter by status | getDeals({ status }) |
| Clear filters | Button | Click | Reset all filters | N/A (navigation) |
| Refresh button | Button | Click | Reload deals | getDeals() |
| Sort by column | Table header | Click | Sort deals by column | N/A (client sort) |
| Deal row click | Table row | Click | Navigate to /deals/{id} | N/A (navigation) |

---

## Route: /deals/[id]

**File**: `src/app/deals/[id]/page.tsx`
**Description**: Deal workspace with full detail view, materials, case file, events

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Back to deals | Button | Click | Navigate to /deals | N/A (navigation) |
| Add Note button | Button | Click | Open note dialog | N/A (opens dialog) |
| Chat button | Button | Click | Navigate to /chat?deal_id={id} | N/A (navigation) |
| Refresh button | Button | Click | Reload deal data | getDeal, getDealEvents, getDealCaseFile, getDealEnrichment, getActions |
| Overview tab | Tab | Click | Show overview content | N/A (client state) |
| Materials tab | Tab | Click | Show materials content | N/A (client state) |
| Case File tab | Tab | Click | Show case file JSON | N/A (client state) |
| Events tab | Tab | Click | Show event history | N/A (client state) |
| Stage transition button | Button | Click | Open transition dialog | N/A (opens dialog) |
| Confirm transition | Dialog button | Click | Execute transition | transitionDeal() |
| Submit note | Dialog button | Click | Add note to deal | addDealNote() |
| View All Actions link | Button | Click | Navigate to /actions?deal_id={id} | N/A (navigation) |
| Material link click | Anchor | Click | Open external link | N/A (external) |

---

## Route: /actions

**File**: `src/app/actions/page.tsx`
**Description**: Action management with categorized tabs

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Refresh button | Button | Click | Reload actions | getActions(), getDueActions() |
| Due Now tab | Tab | Click | Show due actions | N/A (client filter) |
| Overdue tab | Tab | Click | Show overdue actions | N/A (client filter) |
| Today tab | Tab | Click | Show today's actions | N/A (client filter) |
| This Week tab | Tab | Click | Show week's actions | N/A (client filter) |
| Upcoming tab | Tab | Click | Show future actions | N/A (client filter) |
| Completed tab | Tab | Click | Show completed actions | N/A (client filter) |
| Action row click | List item | Click | Navigate to /deals/{deal_id} | N/A (navigation) |

---

## Route: /quarantine

**File**: `src/app/quarantine/page.tsx`
**Description**: Quarantine item review and resolution

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Refresh button | Button | Click | Reload quarantine data | getQuarantineItems(), getQuarantineHealth() |
| Resolve button | Button (per item) | Click | Open resolve dialog | N/A (opens dialog) |
| Link to Deal radio | Radio | Select | Select resolution type | N/A (client state) |
| Create New Deal radio | Radio | Select | Select resolution type | N/A (client state) |
| Discard radio | Radio | Select | Select resolution type | N/A (client state) |
| Deal ID input | Input | Type | Enter deal ID for linking | N/A (client state) |
| Confirm Resolution | Dialog button | Click | Execute resolution | resolveQuarantineItem() |
| Cancel | Dialog button | Click | Close dialog | N/A (client state) |

---

## Route: /chat

**File**: `src/app/chat/page.tsx`
**Description**: AI chat with deal context, proposals, and debug info

### Interactive Features

| Feature | Element | Trigger | Expected Behavior | API Call |
|---------|---------|---------|-------------------|----------|
| Scope selector | Select | Select value | Change chat scope | N/A (client state) |
| Deal selector | Select | Select value | Select deal for context | N/A (client state) |
| Message input | Input | Type + Enter | Send message | streamChatMessage() |
| Send button | Button | Click | Send message | streamChatMessage() |
| Clear chat | Button | Click | Clear messages | N/A (client state) |
| Approve proposal | Button | Click | Execute proposal | executeChatProposal() |
| Reject proposal | Button | Click | Reject proposal | executeChatProposal() |
| Debug panel toggle | Collapsible | Click | Show/hide debug info | N/A (client state) |
| New session | Button | Click | Start new session | N/A (clears state) |

---

## Template Pages (Not Used)

The following routes exist from the template but are NOT part of ZakOps functionality:

| Route | Status | Recommendation |
|-------|--------|----------------|
| /dashboard/billing | Template | Remove or hide nav |
| /dashboard/exclusive | Template | Remove or hide nav |
| /dashboard/kanban | Template | Remove or hide nav |
| /dashboard/product | Template | Remove or hide nav |
| /dashboard/product/[productId] | Template | Remove or hide nav |
| /dashboard/profile | Template | Remove or hide nav |
| /dashboard/workspaces | Template | Remove or hide nav |
| /dashboard/workspaces/team | Template | Remove or hide nav |
| /dashboard/overview/* (parallel routes) | Template | Not used |
| /auth/sign-in | Template | Keep for future auth |
| /auth/sign-up | Template | Keep for future auth |

---

## Global UI Elements

### Sidebar (all pages)

| Feature | Element | Trigger | Expected Behavior |
|---------|---------|---------|-------------------|
| Nav item click | NavLink | Click | Navigate to route |
| Sidebar collapse | Toggle | Click | Collapse/expand sidebar |
| Dark mode toggle | Button | Click | Toggle theme |

### Layout

| Feature | Status | Notes |
|---------|--------|-------|
| Global scroll | FIXED | SidebarInset now has min-h-0 overflow-auto |
| Page scroll | Depends | Each page should enable scroll in content area |
