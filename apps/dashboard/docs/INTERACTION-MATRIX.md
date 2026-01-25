# Interaction Matrix

**Date**: 2025-12-29
**Status**: ALL FIXES COMPLETE

## Summary

All hollow clicks, template leftovers, and mocked elements have been addressed.

| Classification | Before | After |
|----------------|--------|-------|
| WIRED | 50+ | 51+ |
| HOLLOW | 2 | 0 |
| TEMPLATE-LEFTOVER | 15+ | 0 |
| MOCKED | 1 | 0 |
| BROKEN | 0 | 0 |

---

## Issues Fixed

| # | UI Element | Classification | Status | Fix Applied |
|---|------------|----------------|--------|-------------|
| 1 | Global Search (⌘K) | **WIRED** | ✅ | Command Palette with deal search (`src/components/global-search.tsx`) |
| 2 | Settings menu | REMOVED | ✅ | Removed - no settings page exists |
| 3 | /dashboard/overview | REMOVED | ✅ | Route and features deleted |
| 4 | /dashboard/billing | REMOVED | ✅ | Route deleted |
| 5 | /dashboard/exclusive | REMOVED | ✅ | Route deleted |
| 6 | /dashboard/kanban | REMOVED | ✅ | Route and features deleted |
| 7 | /dashboard/product | REMOVED | ✅ | Route and features deleted |
| 8 | /dashboard/profile | REMOVED | ✅ | Route and features deleted |
| 9 | /dashboard/workspaces | REMOVED | ✅ | Route deleted (Clerk deps) |
| 10 | /auth/* | REMOVED | ✅ | Route and features deleted (Clerk deps) |

---

## Global Search Implementation

**Source**: `src/components/global-search.tsx`

**Features**:
- ⌘K keyboard shortcut to open
- Command Palette UI (shadcn/cmdk)
- Searches deals by: canonical_name, deal_id, broker_name, stage, status
- 150ms debounce for smooth typing
- 30-second in-memory cache for deal list
- Stage badges with color coding
- Click result to navigate to `/deals/{deal_id}`
- Works from any page

**Test IDs**:
- `data-testid="global-search-trigger"` - Button in header
- `data-testid="global-search-input"` - Search input in dialog
- `data-testid="global-search-results"` - Results list
- `data-testid="search-result-{deal_id}"` - Individual result items

---

## Verification Checklist

All verified ✅:

- [x] Header search button is WIRED and functional
- [x] UserNav has no dead menu items
- [x] Navigate to /dashboard/billing returns 404
- [x] Navigate to /dashboard/kanban returns 404
- [x] No console errors on page load
- [x] Smoke tests pass (35+)
- [x] Click-sweep test passes (search verification)
- [x] Build completes without errors

---

## Files Changed

**New Files**:
- `src/components/global-search.tsx` - Command Palette search component
- `docs/SCROLL-MODEL.md` - Scroll architecture documentation

**Modified Files**:
- `src/components/layout/header.tsx` - Uses GlobalSearch component
- `src/components/layout/user-nav.tsx` - Settings menu removed
- `src/components/ui/sidebar.tsx` - Scroll model fixes (h-screen, overflow-hidden)
- `src/app/chat/page.tsx` - min-h-0 fix for scroll
- `click-sweep-test.sh` - Updated to verify GlobalSearch is wired

**Deleted Routes**:
- `src/app/dashboard/billing/`
- `src/app/dashboard/exclusive/`
- `src/app/dashboard/kanban/`
- `src/app/dashboard/overview/`
- `src/app/dashboard/product/`
- `src/app/dashboard/profile/`
- `src/app/dashboard/workspaces/`
- `src/app/auth/`

**Deleted Features**:
- `src/features/auth/`
- `src/features/kanban/`
- `src/features/overview/`
- `src/features/products/`
- `src/features/profile/`
