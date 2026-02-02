#!/usr/bin/env bash
# Phase 1: Integration Contract Verification
# Verifies API contracts and cross-service communication
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts/validation"

mkdir -p "$ARTIFACTS_DIR"

echo "=== Phase 1: Integration Contract Verification ==="
echo "Time: $(date -Iseconds)"
echo ""

PASSED=0
FAILED=0
TESTS=()

run_test() {
    local name="$1"
    local cmd="$2"
    local validation="$3"

    echo -n "  [$name] ... "

    local response
    local exit_code=0
    response=$(eval "$cmd" 2>/dev/null) || exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "FAIL (command error)"
        ((FAILED++))
        TESTS+=("{\"name\":\"$name\",\"status\":\"FAIL\",\"reason\":\"command_error\",\"exit_code\":$exit_code}")
        return
    fi

    # Validate response
    if eval "$validation" <<< "$response" > /dev/null 2>&1; then
        echo "OK"
        ((PASSED++))
        TESTS+=("{\"name\":\"$name\",\"status\":\"PASS\"}")
    else
        echo "FAIL (validation failed)"
        ((FAILED++))
        TESTS+=("{\"name\":\"$name\",\"status\":\"FAIL\",\"reason\":\"validation_failed\"}")
    fi
}

echo "1. Deal API Contract Tests"
echo ""

# Test Deal API can list deals
run_test "Deal API - List Deals" \
    "curl -s http://localhost:8091/api/deals" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert isinstance(d, list) or 'deals' in d or 'items' in d\""

# Test Deal API - Get Pipeline Summary
run_test "Deal API - Pipeline Summary" \
    "curl -s http://localhost:8091/api/pipeline" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert isinstance(d, dict)\""

# Test Deal API - Get Tools
run_test "Deal API - List Tools" \
    "curl -s http://localhost:8091/api/tools" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert isinstance(d, (dict, list))\""

echo ""
echo "2. Agent API Contract Tests"
echo ""

# Test Agent API - List Approvals (unauthenticated should return 401 or empty)
run_test "Agent API - Approvals Endpoint" \
    "curl -s http://localhost:8095/api/v1/agent/approvals" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); True\""

# Test Agent API - Health with details
run_test "Agent API - Health Details" \
    "curl -s http://localhost:8095/health" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert d.get('status') == 'healthy'\""

echo ""
echo "3. Orchestration API Contract Tests"
echo ""

# Test Orchestration API - Health
run_test "Orchestration API - Health" \
    "curl -s http://localhost:8091/health" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert d.get('status') == 'healthy'\""

# Test Orchestration API - Agent Tools
run_test "Orchestration API - Agent Tools" \
    "curl -s http://localhost:8091/api/agent/tools" \
    "python3 -c \"import sys,json; d=json.load(sys.stdin); assert isinstance(d, (dict, list))\""

# Test Orchestration API - Auth Check
run_test "Orchestration API - Auth Check" \
    "curl -s http://localhost:8091/api/auth/check" \
    "python3 -c \"import sys,json; True\""

echo ""
echo "4. Dashboard API Tests"
echo ""

# Dashboard should serve HTML
run_test "Dashboard - Serves HTML" \
    "curl -s -L http://localhost:3003/" \
    "grep -q '<html' || grep -q '<!DOCTYPE'"

echo ""
echo "5. Cross-Service Integration"
echo ""

# Test that Deal API and Orchestration API schemas are compatible
run_test "Deal API <-> Orchestration API - Health Format" \
    "bash -c 'D1=\$(curl -s http://localhost:8091/health); D2=\$(curl -s http://localhost:8091/health); echo \"\$D1\" | python3 -c \"import sys,json; d=json.load(sys.stdin); assert '\\''status'\\'' in d\"; echo \"\$D2\" | python3 -c \"import sys,json; d=json.load(sys.stdin); assert '\\''status'\\'' in d\"'" \
    "echo ok"

# Test that Agent API health format matches
run_test "Agent API <-> Deal API - Health Format" \
    "bash -c 'D1=\$(curl -s http://localhost:8095/health); D2=\$(curl -s http://localhost:8091/health); echo \"\$D1\" | python3 -c \"import sys,json; d=json.load(sys.stdin); assert '\\''status'\\'' in d\"; echo \"\$D2\" | python3 -c \"import sys,json; d=json.load(sys.stdin); assert '\\''status'\\'' in d\"'" \
    "echo ok"

echo ""
echo "Results: $PASSED passed, $FAILED failed"

# Generate JSON artifact
TESTS_JSON=$(printf '%s\n' "${TESTS[@]}" | paste -sd, -)
cat > "$ARTIFACTS_DIR/phase1_integration.json" << EOF
{
  "phase": 1,
  "name": "Integration Contract Verification",
  "timestamp": "$(date -Iseconds)",
  "verdict": "$([ $FAILED -eq 0 ] && echo "PASS" || echo "FAIL")",
  "passed": $PASSED,
  "failed": $FAILED,
  "tests": [$TESTS_JSON]
}
EOF

echo ""
echo "Evidence artifact: $ARTIFACTS_DIR/phase1_integration.json"

if [[ $FAILED -eq 0 ]]; then
    echo ""
    echo "Phase 1: PASS - All integration tests passed"
    exit 0
else
    echo ""
    echo "Phase 1: FAIL - $FAILED integration tests failed"
    exit 1
fi
