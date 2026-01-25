#!/bin/bash
# Phase 0 SLO Gate
# Validates SLO configuration passes all checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=============================================="
echo "Phase 0 SLO Gate"
echo "=============================================="

# Run SLO validation
echo "Running SLO validation..."
python3 "$REPO_ROOT/tools/quality/slo_validate.py"
SLO_EXIT=$?

# Check artifact exists and passed
ARTIFACT="$REPO_ROOT/artifacts/quality/slo_validation.json"

if [ ! -f "$ARTIFACT" ]; then
    echo "❌ SLO validation artifact not found"
    exit 1
fi

PASSED=$(python3 -c "import json; print(json.load(open('$ARTIFACT'))['passed'])")

if [ "$PASSED" != "True" ]; then
    echo "❌ SLO validation failed"
    exit 1
fi

echo ""
echo "✅ Phase 0 SLO Gate PASSED"
exit 0
