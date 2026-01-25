# ZakOps Workflows

This guide explains the key workflows in ZakOps.

## Deal Lifecycle

### Overview

Deals in ZakOps follow a defined lifecycle from creation to completion.

### Deal States

| State | Description |
|-------|-------------|
| `draft` | Initial state, deal being created |
| `pending_review` | Awaiting human review |
| `approved` | Deal approved, ready for processing |
| `in_progress` | Agent actively working on deal |
| `completed` | Deal successfully completed |
| `rejected` | Deal rejected during review |
| `cancelled` | Deal cancelled by user |

### State Transitions

```
draft → pending_review → approved → in_progress → completed
                      ↘ rejected
                      ↘ cancelled (from any state)
```

### Creating a Deal

1. Navigate to Deals > New Deal
2. Enter required information:
   - Deal title
   - Description
   - Priority (low, medium, high)
   - Category
3. Click "Save as Draft" or "Submit for Review"

### Reviewing a Deal

1. Access pending deals from the review queue
2. Review deal details and history
3. Choose action:
   - **Approve**: Move to approved state
   - **Reject**: Reject with reason
   - **Request Changes**: Return to draft

### Processing a Deal

Once approved, deals can be processed by the agent:

1. Select the approved deal
2. Click "Process with Agent"
3. Agent analyzes and executes actions
4. Review results and approve any required steps

## Approvals

### Human-in-the-Loop

ZakOps implements human-in-the-loop for critical operations:

- High-risk actions require explicit approval
- Approval requests pause agent execution
- Approvers receive notifications

### Approval Workflow

1. Agent identifies action requiring approval
2. System creates approval request
3. Designated approvers notified
4. Approver reviews context and decides
5. Decision recorded in audit log
6. Agent continues or halts based on decision

### Approval Types

| Type | Trigger | Approvers |
|------|---------|-----------|
| Deal Approval | New deal submission | Deal Reviewers |
| Action Approval | High-risk agent action | Action Approvers |
| Exception Approval | Policy exception | Admins |

### Configuring Approvals

Approval rules are configured in the admin panel:
- Define which actions require approval
- Assign approver roles
- Set timeout policies
- Configure escalation paths

## Agent Workflows

### Standard Execution

1. User initiates agent action
2. Agent plans execution steps
3. Low-risk steps execute automatically
4. High-risk steps pause for approval
5. Results reported to user

### Error Handling

- Agent retries transient failures
- Persistent failures trigger alerts
- User notified of failures
- Audit log captures all attempts
