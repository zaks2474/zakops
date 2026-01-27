#!/usr/bin/env bash
# Phase C Gate: E2E Smoke Test

set -euo pipefail

echo "========================================================================"
echo "           PHASE C GATE: E2E SMOKE TEST"
echo "========================================================================"

OUTPUT_DIR="artifacts/tests"
mkdir -p "$OUTPUT_DIR"

# Run the smoke test
python3 tools/tests/e2e/system_smoke.py
EXIT_CODE=$?

# Verify report exists
if [ -f "$OUTPUT_DIR/system_smoke.json" ]; then
    echo ""
    echo "=== Report Summary ==="
    python3 -c "
import json
with open('$OUTPUT_DIR/system_smoke.json') as f:
    r = json.load(f)
print(f\"Session: {r['session_id']}\")
print(f\"Passed: {r['summary']['passed']}/{r['summary']['total_tests']}\")
print(f\"Grafana: {r['grafana_url']}\")
print('')
print('Sample Grafana Query:')
print(f\"  {r['sample_queries']['all_session_logs']}\")
"
fi

exit $EXIT_CODE
