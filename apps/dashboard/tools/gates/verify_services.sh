#!/bin/bash
# Service Health Verification Script
# Phase 1: Verify all required services are responding

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ARTIFACTS_DIR="${DASHBOARD_DIR}/gate_artifacts"

mkdir -p "$ARTIFACTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_http_service() {
    local name="$1"
    local url="$2"
    local expected_codes="$3"  # comma-separated list of acceptable codes
    local description="$4"

    local http_code
    local response

    response=$(curl -s -L -w "\n%{http_code}" "$url" 2>/dev/null) || true
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check if http_code is in expected_codes
    local passed=false
    IFS=',' read -ra codes <<< "$expected_codes"
    for code in "${codes[@]}"; do
        if [[ "$http_code" == "$code" ]]; then
            passed=true
            break
        fi
    done

    local status
    if $passed; then
        log_pass "$name: HTTP $http_code at $url"
        status="pass"
    else
        log_fail "$name: Expected HTTP $expected_codes, got $http_code at $url"
        status="fail"
    fi

    RESULTS+=("{\"service\": \"$name\", \"url\": \"$url\", \"http_code\": \"$http_code\", \"expected\": \"$expected_codes\", \"status\": \"$status\", \"description\": \"$description\"}")
}

check_docker_service() {
    local name="$1"
    local container_pattern="$2"
    local check_cmd="$3"
    local description="$4"

    # Find container
    local container_id
    container_id=$(docker ps -qf "name=$container_pattern" 2>/dev/null | head -1)

    if [[ -z "$container_id" ]]; then
        log_fail "$name: Container not found (pattern: $container_pattern)"
        RESULTS+=("{\"service\": \"$name\", \"container_pattern\": \"$container_pattern\", \"status\": \"fail\", \"error\": \"Container not found\", \"description\": \"$description\"}")
        return
    fi

    local output
    output=$(docker exec "$container_id" $check_cmd 2>&1) || true

    if [[ "$output" == *"accepting connections"* ]] || [[ "$output" == "PONG" ]] || [[ "$output" == *"OK"* ]]; then
        log_pass "$name: $output"
        RESULTS+=("{\"service\": \"$name\", \"container_pattern\": \"$container_pattern\", \"status\": \"pass\", \"output\": \"$output\", \"description\": \"$description\"}")
    else
        log_fail "$name: Check failed - $output"
        RESULTS+=("{\"service\": \"$name\", \"container_pattern\": \"$container_pattern\", \"status\": \"fail\", \"output\": \"$output\", \"description\": \"$description\"}")
    fi
}

echo "========================================"
echo "Service Health Verification - Phase 1"
echo "========================================"
echo ""

# Check HTTP services
echo "--- HTTP Services ---"
check_http_service "Deal API" "http://localhost:8091/health" "200" "Primary backend API"
check_http_service "Deal API /api/deals" "http://localhost:8091/api/deals" "200" "Deals endpoint availability"
check_http_service "RAG API" "http://localhost:8052/" "200" "RAG REST API root (health at /)"
check_http_service "Orchestration API" "http://localhost:9200/health" "200" "Orchestration API health"
check_http_service "Dashboard" "http://localhost:3003/" "200,307" "Frontend dashboard (may redirect)"

echo ""
echo "--- MCP Server ---"
# MCP Server is on port 8051, uses SSE transport (not REST health endpoint)
# Check if port is listening and accepting connections
mcp_port=8051
mcp_listening=$(ss -tlnp 2>/dev/null | grep ":${mcp_port}" | wc -l)
if [[ "$mcp_listening" -gt 0 ]]; then
    log_pass "MCP Server: Port $mcp_port listening"
    RESULTS+=("{\"service\": \"MCP Server\", \"url\": \"http://localhost:${mcp_port}/\", \"port\": \"$mcp_port\", \"status\": \"pass\", \"description\": \"MCP orchestration server (SSE transport)\"}")
else
    log_fail "MCP Server: Port $mcp_port not listening"
    RESULTS+=("{\"service\": \"MCP Server\", \"url\": \"http://localhost:${mcp_port}/\", \"port\": \"$mcp_port\", \"status\": \"fail\", \"description\": \"MCP orchestration server (SSE transport)\"}")
fi

echo ""
echo "--- Docker Services ---"
check_docker_service "Postgres" "zakops-postgres" "pg_isready -U postgres" "PostgreSQL database"
check_docker_service "Redis" "zakops-redis" "redis-cli ping" "Redis cache"

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

# Determine overall status
if [[ $FAIL_COUNT -eq 0 ]]; then
    overall_status="pass"
else
    overall_status="fail"
fi

cat > "$ARTIFACTS_DIR/contract_probe_results.json" <<EOF
{
  "phase": "service_health",
  "timestamp": "$(date -Iseconds)",
  "overall_status": "$overall_status",
  "pass_count": $PASS_COUNT,
  "fail_count": $FAIL_COUNT,
  "services": $RESULTS_JSON
}
EOF

echo ""
echo "Results written to: $ARTIFACTS_DIR/contract_probe_results.json"

if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi
exit 0
