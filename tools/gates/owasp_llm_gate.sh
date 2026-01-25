#!/bin/bash
# OWASP LLM Security Gate
# Runs OWASP LLM Top 10 security tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=============================================="
echo "OWASP LLM Security Gate"
echo "=============================================="

cd "$REPO_ROOT"

# Run OWASP LLM security tests
echo "Running OWASP LLM Top 10 security tests..."

# Ensure uv is in PATH
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# Use uv if available, otherwise create a temp venv
if command -v uv &> /dev/null; then
    cd apps/agent-api
    uv run pytest tests/security/test_owasp_llm_top10.py -v --tb=short
    RESULT=$?
else
    echo "uv not found, using temp venv..."
    VENV_DIR="$REPO_ROOT/.test_venv"

    # Create venv if it doesn't exist
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
        "$VENV_DIR/bin/pip" install --quiet pytest
    fi

    cd apps/agent-api
    PYTHONPATH="$REPO_ROOT/apps/agent-api" "$VENV_DIR/bin/pytest" tests/security/test_owasp_llm_top10.py -v --tb=short
    RESULT=$?
fi

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ OWASP LLM Gate PASSED"
    exit 0
else
    echo ""
    echo "❌ OWASP LLM Gate FAILED"
    exit 1
fi
