-- ZakOps Agent API - Approval Tables Migration
-- HITL (Human-in-the-Loop) Spike Implementation
-- Date: 2026-01-22
-- Version: 1.1 (with audit log and claim-first semantics)

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Approvals table for HITL workflow
CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    thread_id VARCHAR(255) NOT NULL,
    checkpoint_id VARCHAR(255),
    tool_name VARCHAR(255) NOT NULL,
    tool_args TEXT NOT NULL,  -- JSON serialized
    actor_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    rejection_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT approvals_status_check CHECK (
        status IN ('pending', 'claimed', 'approved', 'rejected', 'expired')
    )
);

-- Indexes for approvals
CREATE INDEX IF NOT EXISTS idx_approvals_thread_id ON approvals(thread_id);
CREATE INDEX IF NOT EXISTS idx_approvals_actor_id ON approvals(actor_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_tool_name ON approvals(tool_name);
CREATE INDEX IF NOT EXISTS idx_approvals_idempotency_key ON approvals(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_approvals_expires_at ON approvals(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approvals_claimed_stale ON approvals(claimed_at) WHERE status = 'claimed';

-- Tool executions table for claim-first idempotency
CREATE TABLE IF NOT EXISTS tool_executions (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    approval_id VARCHAR(36) REFERENCES approvals(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    tool_name VARCHAR(255) NOT NULL,
    tool_args TEXT NOT NULL,  -- JSON serialized
    status VARCHAR(20) NOT NULL DEFAULT 'claimed',
    result TEXT,  -- JSON serialized
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT tool_executions_status_check CHECK (
        status IN ('claimed', 'running', 'succeeded', 'failed')
    )
);

-- Indexes for tool_executions
CREATE INDEX IF NOT EXISTS idx_tool_executions_approval_id ON tool_executions(approval_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_idempotency_key ON tool_executions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_success ON tool_executions(success);

-- Audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    thread_id VARCHAR(255),
    approval_id VARCHAR(36),
    tool_execution_id VARCHAR(36),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT audit_log_event_type_check CHECK (
        event_type IN (
            'approval_created',
            'approval_claimed',
            'approval_approved',
            'approval_rejected',
            'approval_expired',
            'tool_execution_started',
            'tool_execution_completed',
            'tool_execution_failed',
            'stale_claim_reclaimed'
        )
    )
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_approval_id ON audit_log(approval_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_thread_id ON audit_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Comment on tables
COMMENT ON TABLE approvals IS 'HITL approval requests for tool executions requiring human review';
COMMENT ON TABLE tool_executions IS 'Claim-first idempotent tool execution log';
COMMENT ON TABLE audit_log IS 'Immutable audit trail for all approval and execution events';

-- Cleanup function for expired approvals
CREATE OR REPLACE FUNCTION cleanup_expired_approvals()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE approvals
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to reclaim stale claimed approvals (for crash recovery)
CREATE OR REPLACE FUNCTION reclaim_stale_claims(stale_threshold_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
    reclaimed_count INTEGER;
BEGIN
    UPDATE approvals
    SET status = 'pending',
        claimed_at = NULL
    WHERE status = 'claimed'
      AND claimed_at < NOW() - (stale_threshold_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS reclaimed_count = ROW_COUNT;
    RETURN reclaimed_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
DO $$
BEGIN
    -- Only grant if role exists
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent') THEN
        GRANT ALL PRIVILEGES ON TABLE approvals TO agent;
        GRANT ALL PRIVILEGES ON TABLE tool_executions TO agent;
        GRANT ALL PRIVILEGES ON TABLE audit_log TO agent;
        GRANT EXECUTE ON FUNCTION cleanup_expired_approvals() TO agent;
        GRANT EXECUTE ON FUNCTION reclaim_stale_claims(INTEGER) TO agent;
    END IF;
END
$$;
