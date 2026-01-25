#!/bin/bash
# Phase 10 Demo Environment Gate
# Validates demo environment isolation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/business"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "=========================================="
echo "Phase 10: Demo Environment Gate"
echo "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

# Run validation
log_info "Running demo isolation validation..."
python3 "${REPO_ROOT}/tools/quality/demo_isolation_validate.py"
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
    log_info "Demo environment gate PASSED"
else
    log_error "Demo environment gate FAILED"
fi

exit ${EXIT_CODE}
