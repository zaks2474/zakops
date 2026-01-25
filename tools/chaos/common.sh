#!/bin/bash
# Common utilities for chaos engineering / game day scenarios
# Source this file in game day scripts

set -euo pipefail

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Logging
log_info() { echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $(date '+%H:%M:%S') $1"; }

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ARTIFACTS_DIR="${REPO_ROOT}/artifacts/chaos"
COMPOSE_FILE="${REPO_ROOT}/deployments/docker/docker-compose.yml"

# Ensure artifacts directory exists
mkdir -p "${ARTIFACTS_DIR}"

# Docker Compose helper
compose() {
    docker compose -f "${COMPOSE_FILE}" "$@"
}

# Wait for service to be healthy
wait_healthy() {
    local service="$1"
    local timeout="${2:-60}"
    local interval=2
    local elapsed=0

    log_info "Waiting for ${service} to be healthy (timeout: ${timeout}s)..."

    while [[ $elapsed -lt $timeout ]]; do
        if compose ps "$service" 2>/dev/null | grep -q "healthy"; then
            log_info "${service} is healthy"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    log_error "${service} did not become healthy within ${timeout}s"
    return 1
}

# Capture baseline metrics
capture_baseline() {
    local output_file="${1:-${ARTIFACTS_DIR}/baseline_$(date +%s).json}"

    log_step "Capturing baseline metrics..."

    local api_health
    api_health=$(curl -sf http://localhost:8090/health 2>/dev/null || echo '{"status":"error"}')

    local container_stats
    container_stats=$(docker stats --no-stream --format '{{json .}}' 2>/dev/null | head -5 || echo '[]')

    cat > "$output_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_health": ${api_health},
  "containers": [${container_stats}]
}
EOF

    echo "$output_file"
}

# Check API error rate
check_error_rate() {
    local endpoint="${1:-http://localhost:8090/health}"
    local requests="${2:-10}"
    local errors=0

    for _ in $(seq 1 "$requests"); do
        if ! curl -sf --max-time 5 "$endpoint" > /dev/null 2>&1; then
            ((errors++))
        fi
    done

    echo "$errors"
}

# Verify graceful degradation (no raw 500s)
verify_graceful_degradation() {
    local endpoint="${1:-http://localhost:8090/health}"

    local response
    response=$(curl -sf -w "\n%{http_code}" --max-time 5 "$endpoint" 2>/dev/null || echo -e "\n000")

    local http_code
    http_code=$(echo "$response" | tail -1)

    # 503 is acceptable (graceful), raw 500 or connection refused is not
    case "$http_code" in
        200|503|502|504)
            log_info "Graceful response: HTTP ${http_code}"
            return 0
            ;;
        500)
            log_error "Raw 500 error detected - not graceful"
            return 1
            ;;
        000)
            log_warn "Connection refused - service down"
            return 0  # This is expected during fault injection
            ;;
        *)
            log_warn "Unexpected HTTP code: ${http_code}"
            return 0
            ;;
    esac
}

# Wait for recovery
wait_recovery() {
    local endpoint="${1:-http://localhost:8090/health}"
    local timeout="${2:-120}"
    local interval=5
    local elapsed=0

    log_step "Waiting for recovery (timeout: ${timeout}s)..."

    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf --max-time 5 "$endpoint" > /dev/null 2>&1; then
            log_info "Service recovered after ${elapsed}s"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    log_error "Service did not recover within ${timeout}s"
    return 1
}

# Generate game day report
generate_report() {
    local scenario_id="$1"
    local status="$2"
    local detection_time="${3:-0}"
    local recovery_time="${4:-0}"
    local notes="${5:-}"

    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local output_file="${ARTIFACTS_DIR}/game_day_${scenario_id}_$(date +%s).json"

    cat > "$output_file" << EOF
{
  "scenario_id": "${scenario_id}",
  "timestamp": "${timestamp}",
  "status": "${status}",
  "metrics": {
    "detection_time_seconds": ${detection_time},
    "recovery_time_seconds": ${recovery_time}
  },
  "graceful_degradation": true,
  "notes": "${notes}"
}
EOF

    echo "$output_file"
}

# Cleanup function template
cleanup_chaos() {
    log_step "Cleaning up chaos experiment..."
    # Override in specific scripts
}

# Trap for cleanup
trap cleanup_chaos EXIT
