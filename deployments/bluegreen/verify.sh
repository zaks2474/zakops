#!/bin/bash
# Blue/Green Deployment Verification Script
# Usage: ./verify.sh [blue|green|production]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Port mappings
declare -A BLUE_PORTS=(
    [api]=8091
    [mcp]=9100
    [dashboard]=3003
)

declare -A GREEN_PORTS=(
    [api]=8091
    [mcp]=9101
    [dashboard]=3004
)

declare -A PROD_PORTS=(
    [api]=80
    [mcp]=80
    [dashboard]=80
)

usage() {
    echo "Usage: $0 [blue|green|production]"
    echo ""
    echo "Verifies health of the specified deployment."
    echo ""
    echo "Options:"
    echo "  blue       Verify blue stack directly (ports 8091, 9100, 3003)"
    echo "  green      Verify green stack directly (ports 8091, 9101, 3004)"
    echo "  production Verify through Traefik proxy (port 80)"
    exit 1
}

check_health() {
    local name="$1"
    local url="$2"
    local timeout="${3:-5}"

    if curl -sf --max-time "$timeout" "$url" > /dev/null 2>&1; then
        log_pass "$name health check passed"
        return 0
    else
        log_fail "$name health check failed: $url"
        return 1
    fi
}

check_container() {
    local name="$1"

    if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "no healthcheck")
        if [[ "$status" == "healthy" ]]; then
            log_pass "Container $name is healthy"
            return 0
        elif [[ "$status" == "no healthcheck" ]]; then
            log_warn "Container $name running (no healthcheck)"
            return 0
        else
            log_fail "Container $name status: $status"
            return 1
        fi
    else
        log_fail "Container $name not running"
        return 1
    fi
}

smoke_test_api() {
    local api_url="$1"

    log_info "Running API smoke test..."

    # Test health endpoint
    if ! check_health "API /health" "${api_url}/health"; then
        return 1
    fi

    # Test version endpoint (if exists)
    if curl -sf --max-time 5 "${api_url}/version" > /dev/null 2>&1; then
        log_pass "API /version endpoint accessible"
    fi

    return 0
}

verify_blue() {
    log_info "Verifying BLUE deployment..."
    local failures=0

    # Check containers
    check_container "zakops-api-blue" || ((failures++))
    check_container "zakops-mcp-blue" || ((failures++))
    check_container "zakops-dashboard-blue" || ((failures++))
    check_container "zakops-postgres" || ((failures++))
    check_container "zakops-redis" || ((failures++))

    # Check health endpoints
    check_health "API" "http://localhost:${BLUE_PORTS[api]}/health" || ((failures++))
    check_health "MCP" "http://localhost:${BLUE_PORTS[mcp]}/health" || ((failures++))
    check_health "Dashboard" "http://localhost:${BLUE_PORTS[dashboard]}" || ((failures++))

    # Smoke test
    smoke_test_api "http://localhost:${BLUE_PORTS[api]}" || ((failures++))

    return $failures
}

verify_green() {
    log_info "Verifying GREEN deployment..."
    local failures=0

    # Check containers
    check_container "zakops-api-green" || ((failures++))
    check_container "zakops-mcp-green" || ((failures++))
    check_container "zakops-dashboard-green" || ((failures++))
    check_container "zakops-postgres" || ((failures++))
    check_container "zakops-redis" || ((failures++))

    # Check health endpoints
    check_health "API" "http://localhost:${GREEN_PORTS[api]}/health" || ((failures++))
    check_health "MCP" "http://localhost:${GREEN_PORTS[mcp]}/health" || ((failures++))
    check_health "Dashboard" "http://localhost:${GREEN_PORTS[dashboard]}" || ((failures++))

    # Smoke test
    smoke_test_api "http://localhost:${GREEN_PORTS[api]}" || ((failures++))

    return $failures
}

verify_production() {
    log_info "Verifying PRODUCTION (through Traefik)..."
    local failures=0

    # Check Traefik
    check_container "zakops-traefik" || ((failures++))

    # Check through proxy (using Host header)
    if curl -sf --max-time 5 -H "Host: api.zakops.local" "http://localhost/health" > /dev/null 2>&1; then
        log_pass "API accessible through Traefik"
    else
        log_fail "API not accessible through Traefik"
        ((failures++))
    fi

    return $failures
}

main() {
    if [[ $# -ne 1 ]]; then
        usage
    fi

    local target="$1"
    local result=0

    case "$target" in
        blue)
            verify_blue
            result=$?
            ;;
        green)
            verify_green
            result=$?
            ;;
        production)
            verify_production
            result=$?
            ;;
        *)
            log_error "Invalid target: $target"
            usage
            ;;
    esac

    echo ""
    if [[ $result -eq 0 ]]; then
        log_info "All checks passed for ${target} deployment"
    else
        log_error "${result} check(s) failed for ${target} deployment"
    fi

    exit $result
}

main "$@"
