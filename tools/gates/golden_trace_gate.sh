#!/bin/bash
# Golden Trace Gate
# Runs golden trace evaluations and requires 100% pass rate

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=============================================="
echo "Golden Trace Gate"
echo "=============================================="

# Always run in CI mode for gates
export CI=true

cd "$REPO_ROOT"

# Run golden trace runner
echo "Running golden trace evaluation (CI mode)..."
python3 apps/agent-api/evals/golden_trace_runner.py

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ Golden Trace Gate PASSED"
    exit 0
else
    echo ""
    echo "❌ Golden Trace Gate FAILED"
    exit 1
fi
