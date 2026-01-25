# Double Execution Triage Runbook

**Version:** 1.0.0
**Status:** P7-OPS-001 Implementation

## Purpose

Procedures for diagnosing and resolving suspected double execution of tool calls.

## Symptoms

- Tool executed more than once for same approval
- Duplicate side effects (e.g., deal transitioned twice)
- Multiple audit log entries for same idempotency key

## Diagnosis Steps

### Step 1: Check Tool Executions

```bash
APPROVAL_ID="your-approval-id"

# Check executions for this approval
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT id, tool_name, idempotency_key, status, created_at, completed_at FROM tool_executions WHERE approval_id = '$APPROVAL_ID';"
```

### Step 2: Check Idempotency Key

```bash
IDEMPOTENCY_KEY="your-key"

# Check for duplicates
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT COUNT(*) as duplicate_count FROM tool_executions WHERE idempotency_key = '$IDEMPOTENCY_KEY';"
```

### Step 3: Review Audit Log Timeline

```bash
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT event_type, actor_id, details, created_at FROM audit_log WHERE approval_id = '$APPROVAL_ID' ORDER BY created_at;"
```

## Resolution Steps

### If Double Execution Confirmed

1. **Document the incident**
2. **Assess impact** - What was the effect of duplicate execution?
3. **Manual correction** - Revert duplicate side effects if possible
4. **Root cause analysis** - Why did idempotency check fail?

### Prevention Verification

```bash
# Verify idempotency constraint exists
docker exec zakops-agent-db psql -U agent -d zakops_agent -c \
  "SELECT conname FROM pg_constraint WHERE conrelid = 'tool_executions'::regclass AND contype = 'u';"
```

## Escalation

Double execution is a CRITICAL issue:
1. Page on-call engineer immediately
2. Create incident ticket
3. Post-mortem required
