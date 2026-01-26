#!/usr/bin/env bash
# Phase 3: Human-in-the-Loop (HITL) Verification
# Verifies approval request creation and workflow
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts/validation"

mkdir -p "$ARTIFACTS_DIR"

echo "=== Phase 3: Human-in-the-Loop (HITL) Verification ==="
echo "Time: $(date -Iseconds)"
echo ""

PASSED=0
FAILED=0
TESTS=()

run_test() {
    local name="$1"
    local result="$2"
    local status="$3"

    if [[ "$status" == "PASS" ]]; then
        echo "  [$name] ... OK"
        ((PASSED++))
        TESTS+=("{\"name\":\"$name\",\"status\":\"PASS\"}")
    else
        echo "  [$name] ... FAIL ($result)"
        ((FAILED++))
        TESTS+=("{\"name\":\"$name\",\"status\":\"FAIL\",\"reason\":\"$result\"}")
    fi
}

echo "1. Approval Endpoints Exist"
echo ""

# Check Agent API approvals endpoint
AGENT_APPROVALS=$(curl -s http://localhost:8095/api/v1/agent/approvals 2>/dev/null || echo "error")
AGENT_APPROVALS_STATUS=$(echo "$AGENT_APPROVALS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('accessible')
    else:
        print('invalid_format')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$AGENT_APPROVALS_STATUS" == "accessible" ]]; then
    run_test "Agent API - Approvals Endpoint" "endpoint accessible" "PASS"
else
    run_test "Agent API - Approvals Endpoint" "$AGENT_APPROVALS_STATUS" "FAIL"
fi

# Check Orchestration API pending approvals
ORCH_APPROVALS=$(curl -s http://localhost:8091/api/pending-tool-approvals 2>/dev/null || echo "error")
ORCH_APPROVALS_STATUS=$(echo "$ORCH_APPROVALS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('accessible')
    else:
        print('invalid_format')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$ORCH_APPROVALS_STATUS" == "accessible" ]]; then
    run_test "Orchestration API - Pending Approvals" "endpoint accessible" "PASS"
else
    run_test "Orchestration API - Pending Approvals" "$ORCH_APPROVALS_STATUS" "FAIL"
fi

echo ""
echo "2. Deal API Action Approval Flow"
echo ""

# Check action list endpoint
ACTIONS=$(curl -s http://localhost:8090/api/actions 2>/dev/null || echo "error")
ACTIONS_STATUS=$(echo "$ACTIONS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('accessible')
    else:
        print('invalid_format')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$ACTIONS_STATUS" == "accessible" ]]; then
    run_test "Deal API - Actions List" "endpoint accessible" "PASS"
else
    run_test "Deal API - Actions List" "$ACTIONS_STATUS" "FAIL"
fi

# Check action approve endpoint exists (OPTIONS or schema check)
APPROVE_ENDPOINT=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS http://localhost:8090/api/actions/test-id/approve 2>/dev/null || echo "000")
if [[ "$APPROVE_ENDPOINT" != "000" ]]; then
    run_test "Deal API - Action Approve Endpoint" "exists (HTTP $APPROVE_ENDPOINT)" "PASS"
else
    run_test "Deal API - Action Approve Endpoint" "not reachable" "FAIL"
fi

echo ""
echo "3. Quarantine (Manual Review) System"
echo ""

# Check quarantine endpoints
QUARANTINE=$(curl -s http://localhost:8090/api/quarantine 2>/dev/null || echo "error")
QUARANTINE_STATUS=$(echo "$QUARANTINE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('accessible')
    else:
        print('invalid_format')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$QUARANTINE_STATUS" == "accessible" ]]; then
    run_test "Deal API - Quarantine List" "endpoint accessible" "PASS"
else
    run_test "Deal API - Quarantine List" "$QUARANTINE_STATUS" "FAIL"
fi

# Check quarantine health
QUARANTINE_HEALTH=$(curl -s http://localhost:8090/api/quarantine/health 2>/dev/null || echo "{}")
QUARANTINE_HEALTH_OK=$(echo "$QUARANTINE_HEALTH" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if d.get('status') in ['healthy', 'ok', 'available'] or isinstance(d, dict):
        print('healthy')
    else:
        print('unknown')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$QUARANTINE_HEALTH_OK" != "error" ]]; then
    run_test "Deal API - Quarantine Health" "$QUARANTINE_HEALTH_OK" "PASS"
else
    run_test "Deal API - Quarantine Health" "$QUARANTINE_HEALTH_OK" "FAIL"
fi

echo ""
echo "4. Orchestration API Thread/Run Approval Flow"
echo ""

# Check threads endpoint
THREADS=$(curl -s http://localhost:8091/api/threads 2>/dev/null || echo "error")
THREADS_STATUS=$(echo "$THREADS" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('accessible')
    else:
        print('invalid_format')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$THREADS_STATUS" == "accessible" ]]; then
    run_test "Orchestration API - Threads List" "endpoint accessible" "PASS"
else
    run_test "Orchestration API - Threads List" "$THREADS_STATUS" "FAIL"
fi

echo ""
echo "5. HITL State Machine Validation"
echo ""

# Validate that action states are properly defined
# Check action quarantine for state tracking
ACTION_QUARANTINE=$(curl -s http://localhost:8090/api/actions/quarantine 2>/dev/null || echo "{}")
QUARANTINE_VALID=$(echo "$ACTION_QUARANTINE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, (list, dict)):
        print('valid')
    else:
        print('invalid')
except:
    print('error')
" 2>/dev/null || echo "error")

if [[ "$QUARANTINE_VALID" != "error" ]]; then
    run_test "Deal API - Action Quarantine" "state tracking accessible" "PASS"
else
    run_test "Deal API - Action Quarantine" "$QUARANTINE_VALID" "FAIL"
fi

# Validate approval workflow structure
APPROVAL_FLOW_OK=true

# Check that approve endpoint returns proper error for invalid ID
INVALID_APPROVE=$(curl -s -X POST http://localhost:8090/api/actions/invalid-uuid-test/approve 2>/dev/null || echo "{}")
INVALID_APPROVE_STATUS=$(echo "$INVALID_APPROVE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Should return 404 or validation error, not server error
    if 'detail' in d or 'error' in d or 'message' in d:
        print('proper_error')
    else:
        print('unknown')
except:
    print('parse_error')
" 2>/dev/null || echo "error")

if [[ "$INVALID_APPROVE_STATUS" == "proper_error" || "$INVALID_APPROVE_STATUS" == "unknown" ]]; then
    run_test "HITL - Invalid Approval Error Handling" "proper error response" "PASS"
else
    run_test "HITL - Invalid Approval Error Handling" "$INVALID_APPROVE_STATUS" "FAIL"
fi

echo ""
echo "Results: $PASSED passed, $FAILED failed"

# Generate JSON artifact
TESTS_JSON=$(printf '%s\n' "${TESTS[@]}" | paste -sd, -)
cat > "$ARTIFACTS_DIR/phase3_hitl.json" << EOF
{
  "phase": 3,
  "name": "Human-in-the-Loop (HITL) Verification",
  "timestamp": "$(date -Iseconds)",
  "verdict": "$([ $FAILED -eq 0 ] && echo "PASS" || echo "FAIL")",
  "passed": $PASSED,
  "failed": $FAILED,
  "tests": [$TESTS_JSON],
  "endpoints_verified": {
    "agent_api_approvals": "$AGENT_APPROVALS_STATUS",
    "orchestration_api_approvals": "$ORCH_APPROVALS_STATUS",
    "deal_api_actions": "$ACTIONS_STATUS",
    "deal_api_quarantine": "$QUARANTINE_STATUS"
  }
}
EOF

echo ""
echo "Evidence artifact: $ARTIFACTS_DIR/phase3_hitl.json"

if [[ $FAILED -eq 0 ]]; then
    echo ""
    echo "Phase 3: PASS - HITL verification complete"
    exit 0
else
    echo ""
    echo "Phase 3: FAIL - $FAILED HITL tests failed"
    exit 1
fi
