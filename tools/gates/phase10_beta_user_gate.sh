#!/bin/bash
# Phase 10 Beta User Gate
# Validates beta user signoff (manual gate)

set -euo pipefail

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
echo "Phase 10: Beta User Gate"
echo "=========================================="

mkdir -p "${ARTIFACTS_DIR}"

# Check if signoff is required
if [[ "${REQUIRE_BETA_SIGNOFF:-0}" == "1" ]]; then
    log_info "Beta signoff is REQUIRED"
else
    log_warn "Beta signoff not required (set REQUIRE_BETA_SIGNOFF=1 for release)"
fi

# Run validation
log_info "Running signoff validation..."
python3 "${REPO_ROOT}/tools/quality/manual_signoff_validate.py"
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
    log_info "Beta user gate PASSED"
else
    log_error "Beta user gate FAILED"
fi

exit ${EXIT_CODE}
