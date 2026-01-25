# UI Interaction Inventory

**Date**: 2025-12-29
**Method**: Frontend-first source code extraction

## Extraction Summary

| Category | Count |
|----------|-------|
| onClick handlers | 68 |
| Link components | 21 |
| Button components | 80+ |
| Form submissions | 6 |

---

## Hollow Interactions (No-op / TODO / console.log)

### CRITICAL: Global Search
**File**: `src/components/search-input.tsx:11`
**Element**: Button (Search... with ⌘K)
**Code**: `onClick={() => {/* TODO: implement search */}}`
**Location**: Header - visible on ALL pages
**Impact**: HIGH - users will click this expecting search

### UserNav Settings
**File**: `src/components/layout/user-nav.tsx:44`
**Element**: DropdownMenuItem "Settings"
**Code**: No onClick handler
**Location**: Header dropdown
**Impact**: MEDIUM - dead menu item

---

## Template Leftover Interactions (Not Used by ZakOps)

### GitHub Auth Button
**File**: `src/features/auth/components/github-auth-button.tsx:16`
**Code**: `onClick={() => console.log('continue with github clicked')}`
**Route**: /auth/sign-in, /auth/sign-up
**Impact**: LOW - not in main nav

### Org Switcher
**File**: `src/components/org-switcher.tsx`
**Code**: Uses `@clerk/nextjs` (removed dependency)
**Routes**: Links to `/dashboard/workspaces`
**Impact**: LOW - component likely throws if rendered

### Products Feature
**Directory**: `src/features/products/`
**Files**: cell-action.tsx, product-form.tsx, etc.
**Routes**: `/dashboard/product`, `/dashboard/product/[id]`
**Impact**: LOW - not in main nav

### Kanban Feature
**Directory**: `src/features/kanban/`
**Route**: `/dashboard/kanban`
**Impact**: LOW - not in main nav

### Profile Feature
**Directory**: `src/features/profile/`
**Route**: `/dashboard/profile`
**Impact**: LOW - not in main nav

### Bar Graph (Mock Data)
**File**: `src/features/overview/components/bar-graph.tsx`
**Data**: Hardcoded `chartData` array (April-June 2024)
**Route**: `/dashboard/overview/@bar_stats/` (parallel route)
**Impact**: LOW - not visible in main dashboard

---

## Template Routes (Should Hide/Remove)

| Route | Purpose | Nav Visible | Recommendation |
|-------|---------|-------------|----------------|
| /dashboard/billing | Billing page | No | REMOVE |
| /dashboard/exclusive | Exclusive content | No | REMOVE |
| /dashboard/kanban | Kanban board | No | REMOVE |
| /dashboard/overview | Template overview | No | REMOVE |
| /dashboard/product | Product CRUD | No | REMOVE |
| /dashboard/product/[id] | Product detail | No | REMOVE |
| /dashboard/profile | User profile | No | REMOVE |
| /dashboard/workspaces | Clerk workspaces | No | REMOVE |
| /dashboard/workspaces/team | Clerk team | No | REMOVE |
| /auth/sign-in | Auth page | No | KEEP (future) |
| /auth/sign-up | Auth page | No | KEEP (future) |

---

## Wired Interactions (Working)

### Dashboard (/dashboard)
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Refresh button | page.tsx:116 | `onClick={fetchData}` | WIRED |
| Stage filter chips | page.tsx:184 | `onClick={() => setSelectedStage(...)}` | WIRED |
| Clear filter | page.tsx:159 | `onClick={() => setSelectedStage(null)}` | WIRED |
| "View all" deals | page.tsx:215 | `<Link href='/deals'>` | WIRED |
| Deal row | page.tsx:239 | `<Link href='/deals/${id}'>` | WIRED |
| "View all" actions | page.tsx:290 | `<Link href='/actions'>` | WIRED |
| Action row | page.tsx:313 | `<Link href='/deals/${id}'>` | WIRED |
| "View all" quarantine | page.tsx:336 | `<Link href='/quarantine'>` | WIRED |

### Deals List (/deals)
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Refresh | page.tsx:203 | `onClick={fetchData}` | WIRED |
| Clear search | page.tsx:228 | `onClick={() => updateFilter('q', '')}` | WIRED |
| Clear filters | page.tsx:271 | `onClick={() => {...}}` | WIRED |
| Sort columns | page.tsx:310-346 | `onClick={() => toggleSort(...)}` | WIRED |
| Deal row | page.tsx:360 | `onClick={() => router.push(...)}` | WIRED |
| Stage filter | Select | `onValueChange` | WIRED |
| Status filter | Select | `onValueChange` | WIRED |

### Deal Workspace (/deals/[id])
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Back button | page.tsx:225 | `onClick={() => router.push('/deals')}` | WIRED |
| Back (error) | page.tsx:204 | `onClick={() => router.push('/deals')}` | WIRED |
| Retry (error) | page.tsx:208 | `onClick={fetchData}` | WIRED |
| Add Note | page.tsx:252 | `onClick={() => setShowNoteDialog(true)}` | WIRED |
| Chat link | page.tsx:255 | `<Link href='/chat?deal_id=${id}'>` | WIRED |
| Refresh | page.tsx:261 | `onClick={fetchData}` | WIRED |
| Stage transition | page.tsx:605 | `onClick={() => {...}}` | WIRED |
| Confirm transition | page.tsx:714 | `onClick={handleTransition}` | WIRED |
| Cancel transition | page.tsx:710 | `onClick={() => setShowTransitionDialog(false)}` | WIRED |
| Submit note | page.tsx:745 | `onClick={handleAddNote}` | WIRED |
| Cancel note | page.tsx:741 | `onClick={() => setShowNoteDialog(false)}` | WIRED |
| View All Actions | page.tsx:671 | `<Link href='/actions?deal_id=${id}'>` | WIRED |

### Actions (/actions)
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Refresh | page.tsx:82, 142 | `onClick={fetchData}` | WIRED |
| Action row | page.tsx:100 | `<Link href='/deals/${id}'>` | WIRED |
| Tab buttons | TabsTrigger | Built-in | WIRED |

### Quarantine (/quarantine)
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Retry (error) | page.tsx:114 | `onClick={fetchData}` | WIRED |
| Refresh | page.tsx:132 | `onClick={fetchData}` | WIRED |
| Resolve button | page.tsx:236 | `onClick={() => openResolveDialog(item)}` | WIRED |
| Cancel resolve | page.tsx:331 | `onClick={() => setShowResolveDialog(false)}` | WIRED |
| Confirm resolve | page.tsx:335 | `onClick={handleResolve}` | WIRED |
| Radio buttons | RadioGroup | `onValueChange` | WIRED |

### Chat (/chat)
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| New Chat | page.tsx:833 | `onClick={handleNewChat}` | WIRED |
| Toggle Evidence | page.tsx:841 | `onClick={() => setShowEvidence(!showEvidence)}` | WIRED |
| Toggle Debug | page.tsx:851 | `onClick={() => setShowDebug(!showDebug)}` | WIRED |
| Dismiss error | page.tsx:926 | `onClick={() => setError(null)}` | WIRED |
| Send message | page.tsx:953 | `onClick={sendMessage}` | WIRED |
| Approve proposal | page.tsx:1175 | `onClick={() => onExecuteProposal(proposal, 'approve')}` | WIRED |
| Reject proposal | page.tsx:1194 | `onClick={() => onExecuteProposal(proposal, 'reject')}` | WIRED |
| Scope selector | Select | `onValueChange` | WIRED |
| Deal selector | Select | `onValueChange` | WIRED |

### Global Layout
| Element | File:Line | Trigger Code | Classification |
|---------|-----------|--------------|----------------|
| Sidebar toggle | sidebar.tsx:290 | `onClick={toggleSidebar}` | WIRED |
| Nav links | app-sidebar.tsx:85,98 | `<Link href={...}>` | WIRED |
| Theme toggle | theme-toggle.tsx:40 | `onClick={handleThemeToggle}` | WIRED |
| **Search** | search-input.tsx:11 | `onClick={() => {/* TODO */})` | **HOLLOW** |
| **Settings** | user-nav.tsx:44 | No handler | **HOLLOW** |

---

## Summary

| Classification | Count | Impact |
|----------------|-------|--------|
| WIRED | 50+ | Working |
| HOLLOW | 2 | HIGH (visible in header) |
| TEMPLATE-LEFTOVER | 15+ | LOW (not in nav) |
| MOCKED | 1 | LOW (not used) |
| BROKEN | 0 | N/A |
