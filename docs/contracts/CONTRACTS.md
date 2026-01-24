# Agent API Contract Specification

**Version:** 1.0.0
**Status:** Locked per DECISION-LOCK-FILE.md

## Canonical Endpoints

### Agent Endpoints (`/agent/*`)

| Method | Path                              | Description                      |
|--------|-----------------------------------|----------------------------------|
| POST   | `/agent/invoke`                   | Invoke agent with message        |
| POST   | `/agent/invoke/stream`            | Invoke agent with SSE streaming  |
| POST   | `/agent/approvals/{id}:approve`   | Approve pending action           |
| POST   | `/agent/approvals/{id}:reject`    | Reject pending action            |
| GET    | `/agent/approvals`                | List pending approvals           |
| GET    | `/agent/approvals/{id}`           | Get approval details             |
| GET    | `/agent/threads/{id}/state`       | Get thread state                 |

### Health Endpoint

| Method | Path       | Description          |
|--------|------------|----------------------|
| GET    | `/health`  | Service health check |

## Locked Status Strings

The following status strings are locked for the `AgentInvokeResponse.status` field:

| Status              | Description                            |
|---------------------|----------------------------------------|
| `awaiting_approval` | HITL triggered, pending human approval |
| `completed`         | Request completed successfully         |
| `error`             | Request failed with error              |

## Request/Response Schemas

### AgentInvokeRequest

```json
{
  "actor_id": "string (required)",
  "message": "string (required, 1-10000 chars)",
  "thread_id": "string (optional, UUID)",
  "metadata": "object (optional)"
}
```

### AgentInvokeResponse

```json
{
  "thread_id": "string (required, UUID)",
  "status": "awaiting_approval | completed | error",
  "content": "string (optional, agent response)",
  "pending_approval": {
    "approval_id": "string (UUID)",
    "tool": "string (tool name)",
    "args": "object (tool arguments)",
    "permission_tier": "READ | WRITE | CRITICAL",
    "requested_by": "string (actor_id)",
    "requested_at": "datetime (ISO 8601)"
  },
  "actions_taken": [
    {
      "tool": "string",
      "result": "object"
    }
  ],
  "error": "string (optional, error message)"
}
```

### ApprovalActionRequest

```json
{
  "actor_id": "string (required)",
  "reason": "string (optional, required for rejection)"
}
```

## HITL Tools (Approval Required)

Per spike scope, only the following tools require HITL approval:

| Tool             | Permission Tier | Description            |
|------------------|-----------------|------------------------|
| `transition_deal`| CRITICAL        | Transition deal stage  |

## SSE Streaming Events

For `/agent/invoke/stream`:

| Event              | Description                    |
|--------------------|--------------------------------|
| `event: start`     | Stream started                 |
| `event: content`   | Content chunk                  |
| `event: awaiting_approval` | HITL triggered         |
| `event: end`       | Stream completed               |
| `event: error`     | Error occurred                 |

## Authentication

Per Decision Lock §7:

- JWT validation with HS256 algorithm
- Required claims: `sub`, `role`, `exp`, `iss`, `aud`
- Issuer: `zakops-auth`
- Audience: `zakops-agent`
- Roles: VIEWER, OPERATOR, APPROVER, ADMIN
- APPROVER role required for approve/reject endpoints
