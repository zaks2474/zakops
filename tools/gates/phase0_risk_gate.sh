#!/bin/bash
# Phase 0 Risk Gate
# Validates risk register passes all checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=============================================="
echo "Phase 0 Risk Gate"
echo "=============================================="

# Run risk validation
echo "Running risk register validation..."
python3 "$REPO_ROOT/tools/quality/risk_validate.py"
RISK_EXIT=$?

# Check artifact exists and passed
ARTIFACT="$REPO_ROOT/artifacts/quality/risk_validation.json"

if [ ! -f "$ARTIFACT" ]; then
    echo "❌ Risk validation artifact not found"
    exit 1
fi

PASSED=$(python3 -c "import json; print(json.load(open('$ARTIFACT'))['passed'])")

if [ "$PASSED" != "True" ]; then
    echo "❌ Risk validation failed"
    exit 1
fi

echo ""
echo "✅ Phase 0 Risk Gate PASSED"
exit 0
