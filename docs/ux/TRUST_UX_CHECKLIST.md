# Trust UX Checklist

## Overview

This checklist tracks the implementation of trust-building UX features for the ZakOps agent interface. These features ensure users have visibility into and control over agent actions.

## Approval Workflow Components

### ApprovalCard Component

**File**: `apps/dashboard/src/components/approvals/ApprovalCard.tsx`

| Feature | Status | Description |
|---------|--------|-------------|
| WHAT action display | ✅ Complete | Shows tool name and generates preview text |
| DEAL context | ✅ Complete | Shows deal name when available |
| WHY approval needed | ✅ Complete | Risk level badge and warning for high-risk |
| CHANGES preview (diff) | ✅ Complete | Expandable input parameters view |
| Approve button | ✅ Complete | With loading state |
| Reject button | ✅ Complete | With loading state |
| Modify option | ✅ Complete | Optional callback for modification |
| Risk level indicator | ✅ Complete | Color-coded by risk level |
| External impact badge | ✅ Complete | Shows when action has external effects |
| Time since requested | ✅ Complete | Relative time display |
| Compact variant | ✅ Complete | For list views |
| Expanded variant | ✅ Complete | For detailed view |

### ApprovalQueue Component

**File**: `apps/dashboard/src/components/approvals/ApprovalQueue.tsx`

| Feature | Status | Description |
|---------|--------|-------------|
| Queue list view | ✅ Complete | Shows pending approvals |
| Filtering | ✅ Complete | By deal, tool, risk level |
| Sorting | ✅ Complete | By time, risk level |
| Batch actions | ✅ Complete | Approve/reject multiple |

## Audit Trail Components

### AuditLogViewer Component

**File**: `apps/dashboard/src/components/audit/AuditLogViewer.tsx`

| Feature | Status | Description |
|---------|--------|-------------|
| Timeline view | ✅ Complete | Chronological event display |
| Actor filter | ✅ Complete | Filter by user/agent/system |
| Action filter | ✅ Complete | Filter by action type |
| Request ID visible | ✅ Complete | Shown in expanded details |
| Request ID copyable | ✅ Complete | Click to copy functionality |
| Export JSON | ✅ Complete | Download as JSON file |
| Export CSV | ✅ Complete | Download as CSV file |
| Search | ✅ Complete | Search across fields |
| Expandable entries | ✅ Complete | Show full details |
| Outcome badges | ✅ Complete | Success/failure/pending |
| Timestamp display | ✅ Complete | Relative + absolute |
| Metadata display | ✅ Complete | IP, duration, etc. |

## Trust Principles Implemented

### Transparency

- [x] All agent actions are logged and visible
- [x] Request IDs enable end-to-end tracing
- [x] Users can see WHAT the agent wants to do
- [x] Users can see WHY approval is needed
- [x] Full input parameters are available for inspection

### Control

- [x] High-risk actions require explicit approval
- [x] Users can approve or reject any pending action
- [x] Users can modify actions before approval (optional)
- [x] Batch operations for efficiency

### Accountability

- [x] All actions are attributed to actors (user/agent/system)
- [x] Timestamps record when actions occurred
- [x] Outcomes are tracked (success/failure/pending)
- [x] Export functionality for audit requirements

## Verification Commands

Run these commands to verify Trust UX implementation:

```bash
# Verify ApprovalCard exists and has required features
grep -l "ApprovalCard" apps/dashboard/src/components/approvals/*.tsx
grep "Approve" apps/dashboard/src/components/approvals/ApprovalCard.tsx
grep "Reject" apps/dashboard/src/components/approvals/ApprovalCard.tsx

# Verify AuditLogViewer exists and has required features
grep -l "AuditLogViewer" apps/dashboard/src/components/audit/*.tsx
grep "exportAsJson" apps/dashboard/src/components/audit/AuditLogViewer.tsx
grep "exportAsCsv" apps/dashboard/src/components/audit/AuditLogViewer.tsx
grep "CopyableRequestId" apps/dashboard/src/components/audit/AuditLogViewer.tsx
```

## Related Documentation

- [SLO Definitions](/docs/slos/SLO_DEFINITIONS.md)
- [Risk Register](/docs/risk/RISK_REGISTER.md)
- [Golden Trace Guide](/docs/agent/GOLDEN_TRACE_GUIDE.md)
