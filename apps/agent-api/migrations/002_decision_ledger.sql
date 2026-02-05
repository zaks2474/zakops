-- ZakOps Agent API - Decision Ledger Migration
-- R3 REMEDIATION [P2.6]: Decision ledger for agent reasoning traceability
-- Date: 2026-02-05
-- Version: 1.0

-- Decision ledger table for reasoning traceability
CREATE TABLE IF NOT EXISTS decision_ledger (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    correlation_id VARCHAR(255),
    thread_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    deal_id VARCHAR(255),

    -- Trigger context
    trigger_type VARCHAR(50) NOT NULL,
    trigger_content TEXT,  -- Truncated to 500 chars
    prompt_version VARCHAR(50),

    -- Tool selection
    tools_considered TEXT[],  -- Array of tool names
    tool_selected VARCHAR(255),
    selection_reason TEXT,

    -- Execution details
    tool_name VARCHAR(255),
    tool_args TEXT,  -- JSON serialized
    tool_result_preview TEXT,  -- Truncated to 500 chars

    -- HITL tracking
    hitl_required BOOLEAN NOT NULL DEFAULT FALSE,
    approval_id VARCHAR(36),
    approval_status VARCHAR(20),

    -- Outcome
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    response_preview TEXT,  -- Truncated to 500 chars

    -- Metrics
    latency_ms INTEGER,
    token_count INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT decision_ledger_trigger_type_check CHECK (
        trigger_type IN ('user_message', 'tool_result', 'system_prompt', 'hitl_resume')
    )
);

-- Indexes for decision_ledger
CREATE INDEX IF NOT EXISTS idx_decision_ledger_correlation_id ON decision_ledger(correlation_id);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_thread_id ON decision_ledger(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_user_id ON decision_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_deal_id ON decision_ledger(deal_id);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_tool_selected ON decision_ledger(tool_selected);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_tool_name ON decision_ledger(tool_name);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_approval_id ON decision_ledger(approval_id);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_created_at ON decision_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_ledger_success ON decision_ledger(success) WHERE NOT success;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_decision_ledger_thread_created
    ON decision_ledger(thread_id, created_at DESC);

-- Comment on table
COMMENT ON TABLE decision_ledger IS 'R3 REMEDIATION [P2.6]: Agent reasoning and tool selection ledger for explainability';

-- Grant necessary permissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent') THEN
        GRANT ALL PRIVILEGES ON TABLE decision_ledger TO agent;
    END IF;
END
$$;
