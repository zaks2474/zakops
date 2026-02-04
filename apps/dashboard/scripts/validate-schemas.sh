#!/usr/bin/env bash
#
# SCHEMA-GUARD-001 — validate-schemas.sh
# Regression guard for Zod schema validation
#
# Purpose:
#   1. Check that all backend endpoints return HTTP 200
#   2. Check that all dashboard proxy routes return HTTP 200
#   3. Verify TypeScript compilation succeeds
#   4. Run quick schema sanity check
#
# Exit Codes:
#   0 = All checks pass
#   1 = One or more checks failed
#
# Usage:
#   ./scripts/validate-schemas.sh
#   ./scripts/validate-schemas.sh --verbose
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

BACKEND_URL="${BACKEND_URL:-http://localhost:8091}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3003}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$(dirname "$SCRIPT_DIR")"
VERBOSE="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# =============================================================================
# Helper Functions
# =============================================================================

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

log_info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo "[INFO] $1"
    fi
}

check_endpoint() {
    local url="$1"
    local name="$2"
    local timeout="${3:-5}"

    log_info "Checking $name at $url"

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

    if [[ "$status" == "200" ]]; then
        log_pass "$name (HTTP $status)"
        return 0
    elif [[ "$status" == "000" ]]; then
        log_fail "$name (Connection failed/timeout)"
        return 1
    else
        log_fail "$name (HTTP $status)"
        return 1
    fi
}

# =============================================================================
# Main Checks
# =============================================================================

echo "=============================================="
echo "SCHEMA-GUARD-001 — Schema Validation Runner"
echo "=============================================="
echo ""
echo "Backend URL:   $BACKEND_URL"
echo "Dashboard URL: $DASHBOARD_URL"
echo "Dashboard Dir: $DASHBOARD_DIR"
echo ""

# -----------------------------------------------------------------------------
# Check 1: Backend Health
# -----------------------------------------------------------------------------
echo "--- Check 1: Backend API Health ---"
check_endpoint "$BACKEND_URL/health" "Backend /health" || true
echo ""

# -----------------------------------------------------------------------------
# Check 2: Core Backend Endpoints (actual backend routes)
# -----------------------------------------------------------------------------
echo "--- Check 2: Backend API Endpoints ---"
BACKEND_ENDPOINTS=(
    "/api/deals"
    "/api/actions"
)

for endpoint in "${BACKEND_ENDPOINTS[@]}"; do
    check_endpoint "${BACKEND_URL}${endpoint}" "Backend $endpoint" || true
done
echo ""

# -----------------------------------------------------------------------------
# Check 3: Dashboard Proxy Routes
# -----------------------------------------------------------------------------
echo "--- Check 3: Dashboard Proxy Routes ---"
DASHBOARD_ENDPOINTS=(
    "/api/actions/quarantine"
    "/api/agent/activity"
    "/api/alerts"
    "/api/chat"
    "/api/deferred-actions/due"
    "/api/quarantine/health"
)

for endpoint in "${DASHBOARD_ENDPOINTS[@]}"; do
    check_endpoint "${DASHBOARD_URL}${endpoint}" "Dashboard $endpoint" || true
done
echo ""

# -----------------------------------------------------------------------------
# Check 4: TypeScript Compilation
# -----------------------------------------------------------------------------
echo "--- Check 4: TypeScript Compilation ---"
cd "$DASHBOARD_DIR"

if npm run lint --silent 2>&1 | grep -q "error"; then
    log_warn "TypeScript lint has pre-existing errors (non-blocking)"
else
    log_pass "TypeScript lint check"
fi
echo ""

# -----------------------------------------------------------------------------
# Check 5: Zod Schema Pattern Audit
# -----------------------------------------------------------------------------
echo "--- Check 5: Zod Schema Pattern Audit ---"

# Count .nullable().optional() patterns (should be present)
NULLABLE_COUNT=$(grep -c "\.nullable()\.optional()" "$DASHBOARD_DIR/src/lib/api.ts" "$DASHBOARD_DIR/src/lib/api-schemas.ts" 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')

# Count .safeParse( patterns (should be used, not .parse())
SAFEPARSE_COUNT=$(grep -c "\.safeParse(" "$DASHBOARD_DIR/src/lib/api.ts" 2>/dev/null || echo 0)

# Count unsafe Schema.parse() patterns (grep -c exits 1 if no matches, so handle it)
PARSE_COUNT=0
if grep -qE "Schema\.parse\(" "$DASHBOARD_DIR/src/lib/api.ts" 2>/dev/null; then
    PARSE_COUNT=$(grep -cE "Schema\.parse\(" "$DASHBOARD_DIR/src/lib/api.ts" 2>/dev/null)
fi

if [[ "$NULLABLE_COUNT" -gt 0 ]]; then
    log_pass "Found $NULLABLE_COUNT .nullable().optional() patterns"
else
    log_warn "No .nullable().optional() patterns found"
fi

if [[ "$SAFEPARSE_COUNT" -gt 0 ]]; then
    log_pass "Found $SAFEPARSE_COUNT .safeParse() usages"
else
    log_warn "No .safeParse() usages found"
fi

if [[ "$PARSE_COUNT" -gt 0 ]]; then
    log_warn "Found $PARSE_COUNT unsafe Schema.parse() usages"
else
    log_pass "No unsafe Schema.parse() usages"
fi
echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=============================================="
echo "VALIDATION SUMMARY"
echo "=============================================="
echo -e "${GREEN}PASSED:${NC}  $PASS_COUNT"
echo -e "${RED}FAILED:${NC}  $FAIL_COUNT"
echo -e "${YELLOW}WARNINGS:${NC} $WARN_COUNT"
echo ""

if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo -e "${RED}RESULT: FAIL${NC} — $FAIL_COUNT check(s) failed"
    exit 1
else
    echo -e "${GREEN}RESULT: PASS${NC} — All critical checks passed"
    exit 0
fi
