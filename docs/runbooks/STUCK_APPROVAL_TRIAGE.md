# Stuck Approval Triage Runbook

**Version:** 1.0.0
**Status:** P7-OPS-001 Implementation

## Purpose

Procedures for diagnosing and resolving stuck approval workflows.

## Symptoms

- Approval remains in "pending" state beyond expected time
- Workflow not progressing after approval action
- User reports approval action had no effect

## Diagnosis Steps

### Step 1: Check Approval Status

```bash
# Get approval details
APPROVAL_ID="your-approval-id"

curl -s "http://localhost:8095/agent/approvals/$APPROVAL_ID" | jq .

# Check database directly
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT id, tool_name, status, created_at, expires_at FROM approvals WHERE id = '$APPROVAL_ID';"
```

### Step 2: Check Thread State

```bash
# Get thread state
THREAD_ID="your-thread-id"

curl -s "http://localhost:8095/agent/threads/$THREAD_ID/state" | jq .

# Check checkpoints
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT thread_id, checkpoint_id, created_at FROM checkpoints WHERE thread_id = '$THREAD_ID' ORDER BY created_at DESC LIMIT 5;"
```

### Step 3: Check Audit Log

```bash
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT id, event_type, actor_id, created_at FROM audit_log WHERE approval_id = '$APPROVAL_ID' ORDER BY created_at;"
```

## Resolution Steps

### Scenario: Approval Expired

```bash
# Mark as expired and notify user
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "UPDATE approvals SET status = 'expired' WHERE id = '$APPROVAL_ID' AND expires_at < NOW();"
```

### Scenario: Double Execution Suspected

See: `DOUBLE_EXECUTION_TRIAGE.md`

### Scenario: Checkpoint Corruption

```bash
# Check for checkpoint issues
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT * FROM checkpoint_blobs WHERE thread_id = '$THREAD_ID';"
```

## Escalation

If unresolved after 30 minutes:
1. Collect all diagnostic output
2. Escalate to platform team
