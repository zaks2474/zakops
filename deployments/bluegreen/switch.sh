#!/bin/bash
# Blue/Green Traffic Switching Script
# Usage: ./switch.sh [blue|green]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTING_FILE="${SCRIPT_DIR}/traefik-dynamic/routing.yml"
BACKUP_FILE="${SCRIPT_DIR}/traefik-dynamic/routing.yml.bak"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 [blue|green]"
    echo ""
    echo "Switches traffic to the specified deployment color."
    echo ""
    echo "Options:"
    echo "  blue   Switch all traffic to blue stack"
    echo "  green  Switch all traffic to green stack"
    exit 1
}

get_current_color() {
    if grep -q "zakops-api-blue" "$ROUTING_FILE" 2>/dev/null; then
        echo "blue"
    elif grep -q "zakops-api-green" "$ROUTING_FILE" 2>/dev/null; then
        echo "green"
    else
        echo "unknown"
    fi
}

switch_to_blue() {
    log_info "Switching traffic to BLUE deployment..."

    cat > "$ROUTING_FILE" << 'EOF'
# Dynamic routing configuration for blue/green deployment
# Active: BLUE

http:
  routers:
    api-router:
      rule: "Host(`api.zakops.local`) || PathPrefix(`/api`)"
      service: api-service
      entryPoints:
        - web
        - websecure

    mcp-router:
      rule: "Host(`mcp.zakops.local`) || PathPrefix(`/mcp`)"
      service: mcp-service
      entryPoints:
        - web
        - websecure

    dashboard-router:
      rule: "Host(`dashboard.zakops.local`) || PathPrefix(`/`)"
      service: dashboard-service
      entryPoints:
        - web
        - websecure
      priority: 1

  services:
    api-service:
      loadBalancer:
        servers:
          - url: "http://zakops-api-blue:8091"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    mcp-service:
      loadBalancer:
        servers:
          - url: "http://zakops-mcp-blue:9100"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    dashboard-service:
      loadBalancer:
        servers:
          - url: "http://zakops-dashboard-blue:3000"
        healthCheck:
          path: /
          interval: "10s"
          timeout: "3s"
EOF
}

switch_to_green() {
    log_info "Switching traffic to GREEN deployment..."

    cat > "$ROUTING_FILE" << 'EOF'
# Dynamic routing configuration for blue/green deployment
# Active: GREEN

http:
  routers:
    api-router:
      rule: "Host(`api.zakops.local`) || PathPrefix(`/api`)"
      service: api-service
      entryPoints:
        - web
        - websecure

    mcp-router:
      rule: "Host(`mcp.zakops.local`) || PathPrefix(`/mcp`)"
      service: mcp-service
      entryPoints:
        - web
        - websecure

    dashboard-router:
      rule: "Host(`dashboard.zakops.local`) || PathPrefix(`/`)"
      service: dashboard-service
      entryPoints:
        - web
        - websecure
      priority: 1

  services:
    api-service:
      loadBalancer:
        servers:
          - url: "http://zakops-api-green:8091"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    mcp-service:
      loadBalancer:
        servers:
          - url: "http://zakops-mcp-green:9100"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    dashboard-service:
      loadBalancer:
        servers:
          - url: "http://zakops-dashboard-green:3000"
        healthCheck:
          path: /
          interval: "10s"
          timeout: "3s"
EOF
}

main() {
    if [[ $# -ne 1 ]]; then
        usage
    fi

    local target_color="$1"
    local current_color
    current_color=$(get_current_color)

    log_info "Current deployment: ${current_color}"
    log_info "Target deployment: ${target_color}"

    if [[ "$current_color" == "$target_color" ]]; then
        log_warn "Already on ${target_color} deployment, no action needed"
        exit 0
    fi

    # Backup current routing
    cp "$ROUTING_FILE" "$BACKUP_FILE" 2>/dev/null || true

    case "$target_color" in
        blue)
            switch_to_blue
            ;;
        green)
            switch_to_green
            ;;
        *)
            log_error "Invalid color: $target_color"
            usage
            ;;
    esac

    log_info "Traffic switched to ${target_color}"
    log_info "Traefik will reload automatically (watching routing.yml)"
    log_info "Run './verify.sh production' to confirm switch"
}

main "$@"
