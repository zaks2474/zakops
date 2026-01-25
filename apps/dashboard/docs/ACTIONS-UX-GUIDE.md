# Kinetic Actions UI/UX Guide

## Overview

The Kinetic Actions frontend implements the Action Engine v1.2 specification, providing a "Command Center" interface for managing workflow actions in the ZakOps dashboard.

## Architecture

### Components

```
src/
├── lib/api.ts                           # Kinetic Actions API client + types
├── components/actions/
│   ├── action-input-form.tsx            # Schema-driven dynamic forms
│   └── action-card.tsx                  # Action display + controls
└── app/actions/page.tsx                 # Actions Command Center
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | API client with Kinetic Actions types, Zod schemas, and API functions |
| `src/components/actions/action-input-form.tsx` | Dynamic form renderer from JSON Schema |
| `src/components/actions/action-card.tsx` | Action card with status badges, buttons, audit trail |
| `src/app/actions/page.tsx` | Actions Command Center main page |

## Action Status Lifecycle

```
PENDING_APPROVAL → READY → PROCESSING → COMPLETED
                 ↘        ↗
                  CANCELLED
                           ↘
                            FAILED → (RETRY) → PROCESSING
```

### Status Badges

| Status | Color | Description |
|--------|-------|-------------|
| `PENDING_APPROVAL` | Amber | Awaiting human approval |
| `READY` | Blue | Approved, ready to execute |
| `PROCESSING` | Purple (animated) | Currently executing |
| `COMPLETED` | Green | Successfully finished |
| `FAILED` | Red | Failed with error |
| `CANCELLED` | Gray | Cancelled by user |

## Features

### 1. Actions Command Center (`/actions`)

- **Status tabs**: Filter by PENDING_APPROVAL, READY, PROCESSING, COMPLETED, FAILED
- **Search**: Client-side search by title, type, deal ID, action ID
- **Type filter**: Filter by action type dropdown
- **Deal filter**: Filter by deal ID (preserved in URL)
- **Metrics cards**: Queue lengths, success rate, failed count
- **Detail panel**: Selected action shows full card with controls
- **URL persistence**: Filters and selected action preserved in URL for refresh/sharing

### 2. Schema-Driven Forms

The `ActionInputForm` component renders forms dynamically from capability input schemas:

**Supported field types:**
- `string` → Input or Textarea (for context/description fields)
- `number`/`integer` → Number input with min/max
- `boolean` → Checkbox
- `enum` → Select dropdown
- `date`/`date-time` → Date/datetime picker
- `email` → Email input
- `array` → Textarea (one item per line)
- `object` → Nested card with recursive fields

**Features:**
- Required field markers (*)
- Field descriptions
- Validation (minLength, maxLength, min, max, enum)
- Default values from schema

### 3. Action Card

Full-featured action display with:

- Status badge with icon
- Title and action type
- Deal ID link
- Progress indicator (for PROCESSING)
- Error display (for FAILED)
- Artifacts list with download/view (for COMPLETED)
- Collapsible inputs section (editable when PENDING_APPROVAL)
- Collapsible outputs section
- Audit trail (created, approved, started, completed times)
- Action buttons:
  - **Approve**: PENDING_APPROVAL → READY
  - **Run**: READY → PROCESSING
  - **Cancel**: PENDING_APPROVAL/READY → CANCELLED
  - **Retry**: FAILED → PROCESSING (if retryable)

### 4. Deal Integration

- **Actions tab** on deal detail page (`/deals/[id]`)
- Shows all actions for that deal
- Full action cards with approve/run/cancel controls
- Sidebar "Actions" section with quick overview
- Deep links to Actions Command Center filtered by deal

## API Contract

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/actions` | GET | List actions (with filters) |
| `/api/actions` | POST | Create new action |
| `/api/actions/{id}` | GET | Get single action |
| `/api/actions/{id}/approve` | POST | Approve action |
| `/api/actions/{id}/execute` | POST | Execute/run action |
| `/api/actions/{id}/cancel` | POST | Cancel action |
| `/api/actions/{id}/retry` | POST | Retry failed action |
| `/api/actions/{id}/update` | POST | Update inputs (PENDING only) |
| `/api/actions/capabilities` | GET | List available capabilities |
| `/api/actions/metrics` | GET | Queue metrics |
| `/api/actions/{id}/artifact/{artifact_id}` | GET | Download artifact |

### Fallback Mode

If the Kinetic API (`/api/actions/capabilities`) is not available, the frontend falls back to the legacy `/api/deferred-actions` endpoint and converts responses to Kinetic format. This allows the UI to work during backend development.

### Error Handling

- API errors displayed with error codes and categories
- Retryable vs non-retryable errors distinguished
- Error details expandable in Debug panel
- Toast notifications for action results
- Idempotency handling: "already running" shown instead of duplicate actions

## UX Requirements Met

1. **Status badges**: PENDING_APPROVAL → READY → PROCESSING → COMPLETED → FAILED (+ CANCELLED)
2. **Review + Edit inputs**: Editable when PENDING_APPROVAL
3. **Buttons**: Approve / Run / Cancel / Retry all implemented
4. **Live progress indicator**: Animated badge + progress bar when PROCESSING
5. **Artifacts**: Download/View links for completed actions
6. **Filters**: status/type/deal_id + search (client-side)
7. **Deal Actions tab**: Full integration on deal detail page
8. **URL persistence**: Filters preserved after refresh
9. **No double scroll**: Single page scroll container
10. **No UI freezing**: Async operations with loading states

## Testing

### Click-Sweep Tests

Added to `click-sweep-test.sh`:
- Actions page route accessibility
- Actions Command Center title present
- Action cards (data-testid) present
- Status tabs present
- Search input present
- Approve/Run buttons present
- Deal detail Actions tab present
- Kinetic API endpoint check (non-blocking)

### Manual Verification Checklist

1. [ ] Navigate to `/actions` - page loads without error
2. [ ] Click status tabs - list filters correctly
3. [ ] Type in search - results filter in real-time
4. [ ] Click an action - detail panel shows
5. [ ] Click Approve (if PENDING) - status changes to READY
6. [ ] Click Run (if READY) - status changes to PROCESSING
7. [ ] Check artifact download (if COMPLETED)
8. [ ] Navigate to `/deals/{id}` - Actions tab visible
9. [ ] Click Actions tab - shows deal's actions
10. [ ] Refresh page - filters preserved in URL

## Future Enhancements

- SSE/WebSocket for real-time progress updates
- Batch approve/run operations
- Action templates/presets
- Scheduled action creation
- Action dependency chains
