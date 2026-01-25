#!/bin/bash
# Phase 9 Blue/Green Deployment Gate
# Validates blue/green deployment infrastructure

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
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Phase 9: Blue/Green Deployment Gate"
echo "=========================================="

# Ensure artifacts directory exists
mkdir -p "${ARTIFACTS_DIR}"

# Run verification
log_info "Running blue/green verification..."
python3 "${REPO_ROOT}/tools/ops/bluegreen_verify.py"
EXIT_CODE=$?

# Check artifact was created
if [[ -f "${ARTIFACTS_DIR}/bluegreen_verify.json" ]]; then
    log_info "Artifact created: ${ARTIFACTS_DIR}/bluegreen_verify.json"

    # Check if passed
    if python3 -c "import json; r=json.load(open('${ARTIFACTS_DIR}/bluegreen_verify.json')); exit(0 if r['passed'] else 1)"; then
        log_info "Blue/green verification PASSED"
    else
        log_error "Blue/green verification FAILED"
        EXIT_CODE=1
    fi
else
    log_error "Artifact not created"
    EXIT_CODE=1
fi

exit ${EXIT_CODE}
