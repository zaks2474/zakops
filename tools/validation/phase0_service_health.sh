#!/usr/bin/env bash
# Phase 0: Baseline Service Health
# Verifies all 8 services respond to health checks
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts/validation"

mkdir -p "$ARTIFACTS_DIR"

echo "=== Phase 0: Baseline Service Health ==="
echo "Time: $(date -Iseconds)"
echo ""

PASSED=0
FAILED=0
RESULTS=()

check_service() {
    local name="$1"
    local port="$2"
    local endpoint="$3"
    local expected_code="${4:-200}"
    local method="${5:-GET}"

    local result
    local status_code
    local response

    echo -n "  [$name] port $port $endpoint ... "

    if [[ "$method" == "DOCKER_PG" ]]; then
        # PostgreSQL check via docker
        if docker exec zakops-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
            status_code="0"
            response="accepting connections"
        else
            status_code="1"
            response="connection refused"
        fi
    elif [[ "$method" == "DOCKER_REDIS" ]]; then
        # Redis check via docker
        response=$(docker exec zakops-redis-1 redis-cli ping 2>/dev/null || echo "FAIL")
        if [[ "$response" == "PONG" ]]; then
            status_code="0"
        else
            status_code="1"
        fi
    else
        # HTTP check
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port$endpoint" 2>/dev/null || echo "000")
        status_code="$response"
    fi

    if [[ "$method" == "DOCKER_PG" || "$method" == "DOCKER_REDIS" ]]; then
        if [[ "$status_code" == "0" ]]; then
            echo "OK ($response)"
            ((PASSED++))
            RESULTS+=("{\"service\":\"$name\",\"port\":$port,\"status\":\"healthy\",\"response\":\"$response\"}")
        else
            echo "FAIL ($response)"
            ((FAILED++))
            RESULTS+=("{\"service\":\"$name\",\"port\":$port,\"status\":\"unhealthy\",\"response\":\"$response\"}")
        fi
    else
        # HTTP check - accept 200 or 307 (redirect) for dashboard
        if [[ "$status_code" == "$expected_code" ]] || [[ "$name" == "Dashboard" && "$status_code" == "307" ]]; then
            echo "OK (HTTP $status_code)"
            ((PASSED++))
            RESULTS+=("{\"service\":\"$name\",\"port\":$port,\"status\":\"healthy\",\"http_code\":$status_code}")
        else
            echo "FAIL (HTTP $status_code, expected $expected_code)"
            ((FAILED++))
            RESULTS+=("{\"service\":\"$name\",\"port\":$port,\"status\":\"unhealthy\",\"http_code\":$status_code,\"expected\":$expected_code}")
        fi
    fi
}

# Check alternate RAG health endpoint
check_rag_service() {
    echo -n "  [RAG REST API] port 8052 /health or /rag/stats ... "
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8052/health" 2>/dev/null || echo "000")

    if [[ "$response" == "200" ]]; then
        echo "OK (HTTP $response on /health)"
        ((PASSED++))
        RESULTS+=("{\"service\":\"RAG REST API\",\"port\":8052,\"status\":\"healthy\",\"http_code\":$response,\"endpoint\":\"/health\"}")
        return 0
    fi

    # Try alternate endpoint
    response=$(curl -s "http://localhost:8052/rag/stats" 2>/dev/null || echo "")
    if [[ -n "$response" ]] && echo "$response" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        echo "OK (via /rag/stats)"
        ((PASSED++))
        RESULTS+=("{\"service\":\"RAG REST API\",\"port\":8052,\"status\":\"healthy\",\"endpoint\":\"/rag/stats\"}")
        return 0
    fi

    echo "FAIL"
    ((FAILED++))
    RESULTS+=("{\"service\":\"RAG REST API\",\"port\":8052,\"status\":\"unhealthy\"}")
}

echo "Checking services..."
echo ""

# Deal API (8091)
check_service "Deal API" 8091 "/health" 200

# Agent API (8095)
check_service "Agent API" 8095 "/health" 200

# Orchestration API (8091)
check_service "Orchestration API" 8091 "/health" 200

# Dashboard (3003)
check_service "Dashboard" 3003 "/" 200

# RAG REST API (8052)
check_rag_service

# vLLM (8000)
check_service "vLLM" 8000 "/health" 200

# Postgres (5432 via Docker)
check_service "Postgres" 5432 "" 0 "DOCKER_PG"

# Redis (6379 via Docker)
check_service "Redis" 6379 "" 0 "DOCKER_REDIS"

echo ""
echo "Results: $PASSED passed, $FAILED failed"

# Generate JSON artifact
RESULTS_JSON=$(printf '%s\n' "${RESULTS[@]}" | paste -sd, -)
cat > "$ARTIFACTS_DIR/phase0_service_health.json" << EOF
{
  "phase": 0,
  "name": "Baseline Service Health",
  "timestamp": "$(date -Iseconds)",
  "verdict": "$([ $FAILED -eq 0 ] && echo "PASS" || echo "FAIL")",
  "passed": $PASSED,
  "failed": $FAILED,
  "services": [$RESULTS_JSON]
}
EOF

echo ""
echo "Evidence artifact: $ARTIFACTS_DIR/phase0_service_health.json"

if [[ $FAILED -eq 0 ]]; then
    echo ""
    echo "Phase 0: PASS - All services healthy"
    exit 0
else
    echo ""
    echo "Phase 0: FAIL - $FAILED services unhealthy"
    exit 1
fi
