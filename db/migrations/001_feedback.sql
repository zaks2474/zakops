-- Migration: Create feedback table
-- Version: 001
-- Description: Beta feedback collection system

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('bug', 'feature', 'usability', 'performance', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    user_id VARCHAR(255),
    request_id VARCHAR(64),
    trace_id VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'wont_fix')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_severity ON feedback(severity);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feedback_updated_at ON feedback;
CREATE TRIGGER trigger_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- Add comment
COMMENT ON TABLE feedback IS 'Beta user feedback collection for product improvement';
COMMENT ON COLUMN feedback.type IS 'Type of feedback: bug, feature, usability, performance, other';
COMMENT ON COLUMN feedback.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN feedback.metadata IS 'Additional context as JSON (browser info, page URL, etc)';
COMMENT ON COLUMN feedback.request_id IS 'Correlation ID for debugging specific requests';
COMMENT ON COLUMN feedback.trace_id IS 'Distributed trace ID for observability';
