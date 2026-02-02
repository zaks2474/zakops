#!/usr/bin/env bash
# ZakOps Monorepo - Master Gate Runner
# Runs all gate scripts across apps
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "========================================="
echo "ZakOps Monorepo - Gate Runner"
echo "========================================="
echo "Root: $ROOT_DIR"
echo "Time: $(date -Iseconds)"
echo ""

FAILED=0

# Agent API Gates
if [[ -f "$ROOT_DIR/apps/agent-api/pyproject.toml" ]]; then
    echo "[agent-api] Running gates..."
    pushd "$ROOT_DIR/apps/agent-api" > /dev/null
    if [[ -x "$SCRIPT_DIR/bring_up_tests.sh" ]]; then
        if "$SCRIPT_DIR/bring_up_tests.sh"; then
            echo "[agent-api] PASSED"
        else
            echo "[agent-api] FAILED"
            FAILED=1
        fi
    else
        echo "[agent-api] No gate script found"
    fi
    popd > /dev/null
fi

# Dashboard Gates
if [[ -f "$ROOT_DIR/apps/dashboard/package.json" ]]; then
    echo "[dashboard] Running tests..."
    pushd "$ROOT_DIR/apps/dashboard" > /dev/null
    if command -v npm &>/dev/null && [[ -d "node_modules" ]]; then
        if npm test 2>/dev/null; then
            echo "[dashboard] PASSED"
        else
            echo "[dashboard] FAILED"
            FAILED=1
        fi
    else
        echo "[dashboard] npm/node_modules not available, skipping"
    fi
    popd > /dev/null
fi

echo ""
echo "========================================="
if [[ $FAILED -eq 0 ]]; then
    echo "ALL GATES PASSED"
    exit 0
else
    echo "SOME GATES FAILED"
    exit 1
fi
