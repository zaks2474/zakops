# Frontend UI Freeze Notice

**Date**: 2025-12-29
**Commit**: da593b15b7f8

## Purpose

The visual layer of the ZakOps Dashboard is **frozen**. No UI/UX changes will be made during the current remediation phase.

## Scope

The following are NOT to be modified:
- Component styling (CSS, Tailwind classes for appearance)
- Layout structure and spacing
- Color scheme and theming
- Typography and fonts
- Icon selection
- Animation and transitions

## What IS Allowed

Functional fixes that don't change appearance:
- Wiring buttons to API calls
- Fixing broken navigation
- Adding missing event handlers
- Correcting data loading/rendering
- Fixing scroll behavior (overflow properties only)
- Adding/fixing error states (using existing UI patterns)

## Rationale

The UI is considered "perfect" as designed. The problem is functionality - many UI elements are hollow, broken, or unwired. This freeze ensures we focus on making everything work without scope creep into redesign.

## Version Verification

The backend exposes `/api/version` which returns the current git commit. This can be verified at:
- Backend: http://localhost:8090/api/version
- Frontend proxy: http://localhost:3003/api/version

```json
{
  "git_commit": "da593b15b7f8",
  "server_pid": 1354107,
  "server_start_time": "2025-12-29T00:42:11.760787Z"
}
```

## End of Freeze

This freeze will be lifted only after:
1. All items in WIRING-MATRIX.md are marked "Working"
2. QA-CHECKLIST.md shows all tests passing
3. Smoke tests: 45/45 passing
