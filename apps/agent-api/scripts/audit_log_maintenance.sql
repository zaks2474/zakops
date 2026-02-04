-- audit_log Retention Maintenance Script
-- Purpose: Archive audit_log entries older than retention period
-- Usage: Run manually by DBA/admin on a scheduled basis
-- Retention: 90 days (configurable)
--
-- IMPORTANT: The audit_log has a DELETE prevention trigger (trg_prevent_audit_log_delete).
-- This script temporarily disables the trigger, archives old data, and re-enables it.
-- This is intentional — only admin maintenance should be able to remove audit entries.
--
-- Created as part of AGENT-REMEDIATION-005 (F-007 fix).

-- Step 1: Create archive table (if not exists)
CREATE TABLE IF NOT EXISTS audit_log_archive (
  LIKE audit_log INCLUDING ALL
);

-- Step 2: Temporarily disable the DELETE trigger
-- REQUIRES: superuser or trigger owner privileges
ALTER TABLE audit_log DISABLE TRIGGER trg_prevent_audit_log_delete;

-- Step 3: Archive old entries (older than 90 days)
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days'
ON CONFLICT DO NOTHING;

-- Step 4: Delete archived entries from main table
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Step 5: Re-enable the DELETE trigger IMMEDIATELY
ALTER TABLE audit_log ENABLE TRIGGER trg_prevent_audit_log_delete;

-- Step 6: Vacuum to reclaim space
VACUUM ANALYZE audit_log;
