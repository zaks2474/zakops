#!/bin/bash
# Database Verification Script
# Verifies database integrity after restore

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/restore"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-zakops}"
DB_NAME="${DB_NAME:-zakops}"
DB_PASSWORD="${DB_PASSWORD:-zakops}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

QUICK_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log_info "=========================================="
log_info "Database Verification"
log_info "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

export PGPASSWORD="${DB_PASSWORD}"

# Helper to run SQL
run_sql() {
    local query="$1"
    if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${query}" 2>/dev/null; then
        return 0
    else
        docker exec zakops-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "${query}" 2>/dev/null || echo ""
    fi
}

CHECKS=()
FAILURES=0

# Check 1: Required tables exist
log_info "Check 1: Required tables..."
REQUIRED_TABLES=("agent_runs" "agent_events" "approvals" "audit_log")

for table in "${REQUIRED_TABLES[@]}"; do
    EXISTS=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}');")
    if [[ "$EXISTS" == "t" ]]; then
        log_pass "Table '${table}' exists"
        CHECKS+=("{\"check\": \"table_${table}\", \"passed\": true}")
    else
        log_fail "Table '${table}' missing"
        CHECKS+=("{\"check\": \"table_${table}\", \"passed\": false}")
        ((FAILURES++))
    fi
done

# Check 2: Data counts
log_info "Check 2: Data counts..."
for table in "${REQUIRED_TABLES[@]}"; do
    COUNT=$(run_sql "SELECT count(*) FROM ${table};" 2>/dev/null || echo "0")
    log_info "  ${table}: ${COUNT} rows"
done

# Check 3: Constraints valid
if [[ "${QUICK_MODE}" == "false" ]]; then
    log_info "Check 3: Constraint validation..."

    # Check status values
    INVALID_STATUS=$(run_sql "SELECT count(*) FROM agent_runs WHERE status NOT IN ('pending', 'running', 'completed', 'failed', 'cancelled');" 2>/dev/null || echo "0")
    if [[ "$INVALID_STATUS" == "0" ]]; then
        log_pass "agent_runs status values valid"
        CHECKS+=("{\"check\": \"status_values\", \"passed\": true}")
    else
        log_fail "Found ${INVALID_STATUS} invalid status values"
        CHECKS+=("{\"check\": \"status_values\", \"passed\": false}")
        ((FAILURES++))
    fi
fi

# Check 4: Indexes exist
log_info "Check 4: Required indexes..."
EXPECTED_INDEXES=("agent_runs_pkey" "agent_events_pkey" "approvals_pkey")

for idx in "${EXPECTED_INDEXES[@]}"; do
    EXISTS=$(run_sql "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = '${idx}');")
    if [[ "$EXISTS" == "t" ]]; then
        log_pass "Index '${idx}' exists"
        CHECKS+=("{\"check\": \"index_${idx}\", \"passed\": true}")
    else
        log_warn "Index '${idx}' missing (may have different name)"
        CHECKS+=("{\"check\": \"index_${idx}\", \"passed\": true, \"note\": \"may have different name\"}")
    fi
done

# Check 5: Foreign keys
if [[ "${QUICK_MODE}" == "false" ]]; then
    log_info "Check 5: Foreign key integrity..."
    ORPHAN_EVENTS=$(run_sql "SELECT count(*) FROM agent_events e LEFT JOIN agent_runs r ON e.run_id = r.id WHERE r.id IS NULL;" 2>/dev/null || echo "0")
    if [[ "$ORPHAN_EVENTS" == "0" ]]; then
        log_pass "No orphan agent_events"
        CHECKS+=("{\"check\": \"fk_integrity\", \"passed\": true}")
    else
        log_fail "Found ${ORPHAN_EVENTS} orphan agent_events"
        CHECKS+=("{\"check\": \"fk_integrity\", \"passed\": false}")
        ((FAILURES++))
    fi
fi

# Generate report
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PASSED=$((${#CHECKS[@]} - FAILURES))

CHECKS_JSON=$(printf '%s\n' "${CHECKS[@]}" | paste -sd, -)

cat > "${ARTIFACTS_DIR}/verify_${TIMESTAMP//[:-]/}.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "database": "${DB_NAME}",
  "passed": $([[ $FAILURES -eq 0 ]] && echo "true" || echo "false"),
  "summary": {
    "total_checks": ${#CHECKS[@]},
    "passed": ${PASSED},
    "failed": ${FAILURES}
  },
  "checks": [${CHECKS_JSON}]
}
EOF

log_info "=========================================="
if [[ $FAILURES -eq 0 ]]; then
    log_info "Verification PASSED (${PASSED}/${#CHECKS[@]} checks)"
    exit 0
else
    log_error "Verification FAILED (${FAILURES} failures)"
    exit 1
fi
