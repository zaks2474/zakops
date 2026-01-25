# Approvals in ZakOps

This guide explains the approval system in ZakOps.

## Overview

ZakOps uses a human-in-the-loop approval system to ensure critical actions are reviewed before execution. This provides safety guarantees while maintaining automation efficiency.

### Why Approvals?

- **Safety**: Prevent unintended consequences
- **Compliance**: Meet regulatory requirements
- **Accountability**: Clear audit trail of decisions
- **Control**: Human oversight of AI actions

## Approval Flow

### Standard Flow

1. **Trigger**: Agent encounters an action requiring approval
2. **Pause**: Execution pauses, approval request created
3. **Notify**: Approvers receive notification
4. **Review**: Approver examines context and proposed action
5. **Decide**: Approver approves or rejects
6. **Record**: Decision logged in audit trail
7. **Continue**: Agent proceeds based on decision

### Approval States

| State | Description |
|-------|-------------|
| `pending` | Awaiting approver action |
| `approved` | Approver granted permission |
| `rejected` | Approver denied permission |
| `expired` | Timeout reached without decision |
| `escalated` | Escalated to higher authority |

## Using the Approval Interface

### Viewing Pending Approvals

1. Navigate to the Approvals dashboard
2. View list of pending approvals
3. Filter by:
   - Priority
   - Age
   - Type
   - Requester

### Reviewing an Approval

Each approval shows:
- **Context**: What triggered the approval
- **Proposed Action**: What the agent wants to do
- **Risk Assessment**: Automated risk evaluation
- **History**: Related past approvals

### Making a Decision

1. Click on a pending approval
2. Review all context information
3. Click **Approve** or **Reject**
4. Optionally add a comment
5. Confirm your decision

### Bulk Actions

For multiple similar approvals:
1. Select approvals using checkboxes
2. Click "Bulk Approve" or "Bulk Reject"
3. Confirm the bulk action

## Approval Rules

### Default Rules

- External API calls require approval
- Data deletion requires approval
- Financial transactions require approval
- User permission changes require approval

### Custom Rules

Administrators can configure custom rules:
- Action patterns to match
- Risk thresholds
- Approver assignments
- Timeout values

## Notifications

### Channels

Approvers are notified via:
- In-app notifications
- Email (configurable)
- Slack (if integrated)

### Urgency Levels

| Level | Response Time | Escalation |
|-------|---------------|------------|
| Low | 24 hours | After 48 hours |
| Medium | 4 hours | After 8 hours |
| High | 1 hour | After 2 hours |
| Critical | 15 minutes | After 30 minutes |

## Best Practices

1. **Respond promptly**: Don't let approvals expire
2. **Review carefully**: Read all context before deciding
3. **Document decisions**: Add comments explaining rationale
4. **Escalate when unsure**: Better to escalate than guess
5. **Monitor metrics**: Track approval times and outcomes
