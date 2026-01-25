# Backup/Restore Runbook

**Version:** 1.0.0
**Status:** P7-OPS-001 Implementation

## Purpose

Procedures for backing up and restoring ZakOps Agent API data.

## What to Backup

1. **PostgreSQL Database**
   - checkpoints
   - approvals
   - audit_log
   - tool_executions
   - task_queue

2. **Configuration**
   - Environment files (redacted)
   - Docker compose files

## Backup Procedure

### Step 1: Database Backup

```bash
BACKUP_DIR="/home/zaks/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/zakops_agent_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Backup database
docker exec zakops-agent-db pg_dump -U agent -d zakops_agent | gzip > "$BACKUP_FILE"

# Verify backup
gunzip -c "$BACKUP_FILE" | head -20
echo "Backup created: $BACKUP_FILE"
```

### Step 2: Backup Verification

```bash
# Check backup file size
ls -lh "$BACKUP_FILE"

# Test backup integrity
gunzip -t "$BACKUP_FILE" && echo "Backup integrity: OK"
```

## Restore Procedure

### Step 1: Stop Services

```bash
docker compose stop agent-api
```

### Step 2: Restore Database

```bash
BACKUP_FILE="/home/zaks/backups/zakops_agent_YYYYMMDD_HHMMSS.sql.gz"

# Drop existing database (CAUTION!)
docker exec zakops-agent-db psql -U agent -d postgres -c "DROP DATABASE IF EXISTS zakops_agent;"
docker exec zakops-agent-db psql -U agent -d postgres -c "CREATE DATABASE zakops_agent;"

# Restore from backup
gunzip -c "$BACKUP_FILE" | docker exec -i zakops-agent-db psql -U agent -d zakops_agent
```

### Step 3: Verify Restore

```bash
# Check table counts
docker exec zakops-agent-db psql -U agent -d zakops_agent -c "SELECT 'checkpoints' AS tbl, COUNT(*) FROM checkpoints UNION ALL SELECT 'approvals', COUNT(*) FROM approvals UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log;"
```

### Step 4: Restart Services

```bash
docker compose up -d agent-api
```

## Rollback Plan

If restore fails:
1. Stop services
2. Restore from previous known-good backup
3. Investigate failure cause before retry
