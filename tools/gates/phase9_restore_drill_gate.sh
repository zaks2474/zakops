#!/bin/bash
# Phase 9 Restore Drill Gate
# Validates restore drill infrastructure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/restore"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Phase 9: Restore Drill Gate"
echo "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

FAILURES=0
CHECKS=0

# Check 1: Scripts exist
log_info "Checking restore scripts..."

SCRIPTS=(
    "tools/ops/backup_restore/backup.sh"
    "tools/ops/backup_restore/restore.sh"
    "tools/ops/backup_restore/verify.sh"
    "tools/ops/backup_restore/restore_drill_runner.py"
)

for script in "${SCRIPTS[@]}"; do
    ((CHECKS++))
    if [[ -f "${REPO_ROOT}/${script}" ]]; then
        log_info "  ✓ ${script}"
    else
        log_error "  ✗ ${script} missing"
        ((FAILURES++))
    fi
done

# Check 2: Scripts are executable
log_info "Checking executability..."

EXECUTABLE_SCRIPTS=(
    "tools/ops/backup_restore/backup.sh"
    "tools/ops/backup_restore/restore.sh"
    "tools/ops/backup_restore/verify.sh"
)

for script in "${EXECUTABLE_SCRIPTS[@]}"; do
    ((CHECKS++))
    if [[ -x "${REPO_ROOT}/${script}" ]]; then
        log_info "  ✓ ${script} is executable"
    else
        log_error "  ✗ ${script} not executable"
        ((FAILURES++))
    fi
done

# Check 3: Shell syntax
log_info "Checking shell syntax..."

for script in "${EXECUTABLE_SCRIPTS[@]}"; do
    ((CHECKS++))
    if bash -n "${REPO_ROOT}/${script}" 2>/dev/null; then
        log_info "  ✓ ${script} syntax OK"
    else
        log_error "  ✗ ${script} syntax error"
        ((FAILURES++))
    fi
done

# Check 4: Python syntax
log_info "Checking Python syntax..."
((CHECKS++))
if python3 -m py_compile "${REPO_ROOT}/tools/ops/backup_restore/restore_drill_runner.py" 2>/dev/null; then
    log_info "  ✓ restore_drill_runner.py syntax OK"
else
    log_error "  ✗ restore_drill_runner.py syntax error"
    ((FAILURES++))
fi

# Check 5: Compose file exists
log_info "Checking restore compose file..."
((CHECKS++))
COMPOSE_FILE="${REPO_ROOT}/deployments/docker/compose.restore.yml"
if [[ -f "${COMPOSE_FILE}" ]]; then
    log_info "  ✓ compose.restore.yml exists"
else
    log_error "  ✗ compose.restore.yml missing"
    ((FAILURES++))
fi

# Check 6: Runbook exists
log_info "Checking runbooks..."
((CHECKS++))
RUNBOOK="${REPO_ROOT}/ops/runbooks/restore-drills/RESTORE_DRILL_OVERVIEW.md"
if [[ -f "${RUNBOOK}" ]]; then
    log_info "  ✓ RESTORE_DRILL_OVERVIEW.md exists"
else
    log_error "  ✗ RESTORE_DRILL_OVERVIEW.md missing"
    ((FAILURES++))
fi

# Generate artifact
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "${ARTIFACTS_DIR}/restore_drill_validation.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "gate": "phase9_restore_drill",
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
    log_info "Restore drill gate PASSED (${CHECKS}/${CHECKS} checks)"
    exit 0
else
    log_error "Restore drill gate FAILED (${FAILURES} failures)"
    exit 1
fi
