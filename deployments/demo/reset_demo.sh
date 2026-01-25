#!/bin/bash
# Reset Demo Environment
# Nukes all demo data and reseeds with sample data

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.demo.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Reset Demo Environment"
echo "=========================================="

# Confirm reset
if [[ "${FORCE:-0}" != "1" ]]; then
    echo ""
    log_warn "This will DELETE all demo data!"
    echo ""
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted"
        exit 0
    fi
fi

# Step 1: Stop services
log_info "Step 1: Stopping demo services..."
docker compose -f "${COMPOSE_FILE}" down 2>/dev/null || true

# Step 2: Remove volumes
log_info "Step 2: Removing demo volumes..."
docker volume rm zakops_demo_postgres zakops_demo_redis 2>/dev/null || true

# Step 3: Start fresh
log_info "Step 3: Starting fresh demo environment..."
docker compose -f "${COMPOSE_FILE}" up -d --wait

# Step 4: Wait for database
log_info "Step 4: Waiting for database..."
sleep 5

# Step 5: Seed demo data
log_info "Step 5: Seeding demo data..."

# Create sample tables and data
docker exec -i zakops-postgres-demo psql -U zakops -d zakops_demo << 'EOF'
-- Create tables if not exist
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    value DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES agent_runs(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample deals
INSERT INTO deals (name, status, value) VALUES
    ('Demo Deal - Acme Corp', 'active', 50000.00),
    ('Demo Deal - TechStart Inc', 'draft', 25000.00),
    ('Demo Deal - GlobalMSP', 'pending_approval', 100000.00)
ON CONFLICT DO NOTHING;

-- Insert sample agent run
INSERT INTO agent_runs (workflow_type, status) VALUES
    ('deal_analysis', 'completed')
ON CONFLICT DO NOTHING;

SELECT 'Demo data seeded successfully' as status;
EOF

# Step 6: Verify
log_info "Step 6: Verifying demo environment..."

if curl -sf http://localhost:18090/health > /dev/null 2>&1; then
    log_info "API healthy at http://localhost:18090"
else
    log_warn "API not responding yet (may still be starting)"
fi

echo ""
log_info "=========================================="
log_info "Demo environment reset complete!"
log_info "=========================================="
echo ""
echo "Access points:"
echo "  API:       http://localhost:18090"
echo "  MCP:       http://localhost:19100"
echo "  Dashboard: http://localhost:13003"
echo ""
echo "To stop: docker compose -f ${COMPOSE_FILE} down"
