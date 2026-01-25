#!/bin/bash
# Phase 10 Success Metrics Gate
# Validates success metrics documentation and dashboards

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/business"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Phase 10: Success Metrics Gate"
echo "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

FAILURES=0
CHECKS=0

# Check 1: SUCCESS_METRICS.md exists
log_info "Checking documentation..."
CHECKS=$((CHECKS + 1))
if [[ -f "${REPO_ROOT}/docs/business/SUCCESS_METRICS.md" ]]; then
    log_info "  ✓ SUCCESS_METRICS.md exists"
else
    log_error "  ✗ SUCCESS_METRICS.md missing"
    FAILURES=$((FAILURES + 1))
fi

# Check 2: SUCCESS_METRICS.md has required metrics
CHECKS=$((CHECKS + 1))
METRICS_FILE="${REPO_ROOT}/docs/business/SUCCESS_METRICS.md"
if [[ -f "$METRICS_FILE" ]]; then
    REQUIRED_METRICS=("Activation" "Weekly" "Monthly" "Approval" "Agent" "Reliability")
    MISSING=""
    for metric in "${REQUIRED_METRICS[@]}"; do
        if ! grep -qi "$metric" "$METRICS_FILE"; then
            MISSING="${MISSING} ${metric}"
        fi
    done
    if [[ -z "$MISSING" ]]; then
        log_info "  ✓ SUCCESS_METRICS.md has required metrics"
    else
        log_error "  ✗ Missing metrics:${MISSING}"
        FAILURES=$((FAILURES + 1))
    fi
fi

# Check 3: Grafana dashboard exists and is valid JSON
log_info "Checking Grafana dashboard..."
CHECKS=$((CHECKS + 1))
DASHBOARD_FILE="${REPO_ROOT}/ops/observability/grafana/dashboards/zakops_business.json"
if [[ -f "$DASHBOARD_FILE" ]]; then
    if python3 -c "import json; json.load(open('$DASHBOARD_FILE'))" 2>/dev/null; then
        log_info "  ✓ zakops_business.json is valid JSON"
    else
        log_error "  ✗ zakops_business.json is invalid JSON"
        FAILURES=$((FAILURES + 1))
    fi
else
    log_error "  ✗ zakops_business.json missing"
    FAILURES=$((FAILURES + 1))
fi

# Check 4: weekly_summary.py exists
log_info "Checking weekly summary tool..."
CHECKS=$((CHECKS + 1))
if [[ -f "${REPO_ROOT}/tools/business/weekly_summary.py" ]]; then
    log_info "  ✓ weekly_summary.py exists"
else
    log_error "  ✗ weekly_summary.py missing"
    FAILURES=$((FAILURES + 1))
fi

# Check 5: weekly_summary.py syntax
CHECKS=$((CHECKS + 1))
if python3 -m py_compile "${REPO_ROOT}/tools/business/weekly_summary.py" 2>/dev/null; then
    log_info "  ✓ weekly_summary.py syntax OK"
else
    log_error "  ✗ weekly_summary.py syntax error"
    FAILURES=$((FAILURES + 1))
fi

# Generate artifact
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "${ARTIFACTS_DIR}/success_metrics_validation.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "gate": "phase10_success_metrics",
  "passed": $([[ $FAILURES -eq 0 ]] && echo "true" || echo "false"),
  "summary": {
    "total_checks": ${CHECKS},
    "passed": $((CHECKS - FAILURES)),
    "failed": ${FAILURES}
  }
}
EOF

log_info "=========================================="
if [[ $FAILURES -eq 0 ]]; then
    log_info "Success metrics gate PASSED (${CHECKS}/${CHECKS} checks)"
    exit 0
else
    log_error "Success metrics gate FAILED (${FAILURES} failures)"
    exit 1
fi
