#!/bin/bash
# Double Check Script - Phase 5
# Secondary verification using curl-based checks to confirm primary verification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ARTIFACTS_DIR="${DASHBOARD_DIR}/gate_artifacts"

mkdir -p "$ARTIFACTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

add_result() {
    local endpoint="$1"
    local method="$2"
    local expected="$3"
    local actual="$4"
    local status="$5"

    RESULTS+=("{\"endpoint\": \"$endpoint\", \"method\": \"$method\", \"expected\": \"$expected\", \"actual\": \"$actual\", \"status\": \"$status\"}")
}

check_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local expected_codes="$4"  # comma-separated

    local http_code
    local body

    if [[ "$method" == "GET" ]]; then
        response=$(curl -s -L -w "\n%{http_code}" "$url" 2>/dev/null) || true
    else
        response=$(curl -s -L -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "{}" "$url" 2>/dev/null) || true
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if code is acceptable
    local passed=false
    IFS=',' read -ra codes <<< "$expected_codes"
    for code in "${codes[@]}"; do
        if [[ "$http_code" == "$code" ]]; then
            passed=true
            break
        fi
    done

    if $passed; then
        log_pass "$name: $method $url -> HTTP $http_code"
        add_result "$url" "$method" "$expected_codes" "$http_code" "pass"
    else
        log_fail "$name: $method $url -> HTTP $http_code (expected $expected_codes)"
        add_result "$url" "$method" "$expected_codes" "$http_code" "fail"
    fi
}

echo "========================================"
echo "Double Check Verification - Phase 5"
echo "========================================"
echo ""
echo "This is a secondary curl-based verification pass"
echo "to confirm the primary Python-based verification."
echo ""

# Service Health Double Check
echo "--- Service Health Double Check ---"
check_endpoint "Deal API Health" "GET" "http://localhost:8090/health" "200"
check_endpoint "RAG API Root" "GET" "http://localhost:8052/" "200"
check_endpoint "Orchestration Health" "GET" "http://localhost:9200/health" "200"
check_endpoint "Dashboard" "GET" "http://localhost:3003/" "200,307"

echo ""
echo "--- Core API Endpoints Double Check ---"

# Deals endpoints
check_endpoint "GET /api/deals" "GET" "http://localhost:8090/api/deals" "200"
check_endpoint "GET /api/deals/:id" "GET" "http://localhost:8090/api/deals/test-id-123" "200,404"

# Actions endpoints (corrected from kinetic)
check_endpoint "GET /api/actions" "GET" "http://localhost:8090/api/actions" "200"
check_endpoint "GET /api/actions/:id" "GET" "http://localhost:8090/api/actions/test-id-123" "200,404"
check_endpoint "GET /api/actions/metrics" "GET" "http://localhost:8090/api/actions/metrics" "200"
check_endpoint "GET /api/actions/capabilities" "GET" "http://localhost:8090/api/actions/capabilities" "200"

# Quarantine endpoints (corrected path)
check_endpoint "GET /api/quarantine" "GET" "http://localhost:8090/api/quarantine" "200"

# Chat endpoints
check_endpoint "GET /api/chat/llm-health" "GET" "http://localhost:8090/api/chat/llm-health" "200"

# Tools endpoints
check_endpoint "GET /api/tools" "GET" "http://localhost:8090/api/tools" "200"

echo ""
echo "--- POST Endpoint Structure Check ---"
# POST endpoints - check they exist (will return 400/422 for invalid data)
check_endpoint "POST /api/chat" "POST" "http://localhost:8090/api/chat" "200,201,400,422,500"

echo ""
echo "========================================"
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "========================================"

# Generate JSON report
RESULTS_JSON="["
for i in "${!RESULTS[@]}"; do
    if [[ $i -gt 0 ]]; then
        RESULTS_JSON+=","
    fi
    RESULTS_JSON+="${RESULTS[$i]}"
done
RESULTS_JSON+="]"

if [[ $FAIL_COUNT -eq 0 ]]; then
    overall_status="pass"
else
    overall_status="fail"
fi

cat > "$ARTIFACTS_DIR/double_check_results.json" <<EOF
{
  "phase": "double_check",
  "timestamp": "$(date -Iseconds)",
  "overall_status": "$overall_status",
  "pass_count": $PASS_COUNT,
  "fail_count": $FAIL_COUNT,
  "note": "Secondary curl-based verification to confirm primary verification",
  "checks": $RESULTS_JSON
}
EOF

echo ""
echo "Results written to: $ARTIFACTS_DIR/double_check_results.json"

if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi
exit 0
