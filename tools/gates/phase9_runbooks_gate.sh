#!/bin/bash
# Phase 9 Runbooks Gate
# Validates runbook documentation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/ops"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Phase 9: Runbooks Gate"
echo "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

# Run linter
log_info "Running runbook linter..."
python3 "${REPO_ROOT}/tools/quality/runbook_lint.py"
EXIT_CODE=$?

# Check artifact
if [[ -f "${ARTIFACTS_DIR}/runbook_lint.json" ]]; then
    log_info "Artifact created: ${ARTIFACTS_DIR}/runbook_lint.json"

    # Check passed status
    if python3 -c "import json; r=json.load(open('${ARTIFACTS_DIR}/runbook_lint.json')); exit(0 if r['passed'] else 1)"; then
        log_info "Runbook validation PASSED"
    else
        log_error "Runbook validation FAILED"
        EXIT_CODE=1
    fi
else
    log_error "Artifact not created"
    EXIT_CODE=1
fi

exit ${EXIT_CODE}
