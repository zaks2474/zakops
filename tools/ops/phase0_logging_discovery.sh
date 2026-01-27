#!/usr/bin/env bash
# Phase 0: Logging Infrastructure Discovery
# Understand what exists before changing anything

set -euo pipefail

echo "========================================================================"
echo "           PHASE 0: LOGGING INFRASTRUCTURE DISCOVERY"
echo "========================================================================"

OUTPUT_DIR="artifacts/logging/discovery"
mkdir -p "$OUTPUT_DIR"

echo ""
echo "=== Checking existing logging infrastructure ==="

# Check for existing Loki
LOKI_EXISTS="false"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi loki; then
    LOKI_EXISTS="true"
    echo "[OK] Loki container found"
elif [ -f "ops/observability/loki/loki-config.yml" ]; then
    LOKI_EXISTS="config_only"
    echo "[WARN] Loki config exists but container not running"
else
    echo "[MISSING] No Loki found"
fi

# Check for existing Promtail/Vector
PROMTAIL_EXISTS="false"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi promtail; then
    PROMTAIL_EXISTS="true"
    echo "[OK] Promtail container found"
elif [ -f "ops/observability/promtail/promtail-config.yml" ]; then
    PROMTAIL_EXISTS="config_only"
    echo "[WARN] Promtail config exists but container not running"
else
    echo "[MISSING] No Promtail found"
fi

# Check for existing Grafana
GRAFANA_EXISTS="false"
GRAFANA_URL=""
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi grafana; then
    GRAFANA_EXISTS="true"
    GRAFANA_URL="http://localhost:3001"
    echo "[OK] Grafana container found"
else
    echo "[MISSING] No Grafana running"
fi

# Check for Loki datasource in Grafana
LOKI_DATASOURCE_EXISTS="false"
if [ -f "ops/observability/grafana/provisioning/datasources/datasources.yml" ]; then
    if grep -qi "loki" "ops/observability/grafana/provisioning/datasources/datasources.yml" 2>/dev/null; then
        LOKI_DATASOURCE_EXISTS="true"
        echo "[OK] Loki datasource provisioning found"
    else
        echo "[MISSING] No Loki datasource in provisioning"
    fi
else
    echo "[MISSING] No datasource provisioning file"
fi

# Check for request_id middleware in Python services
echo ""
echo "=== Checking request correlation middleware ==="

REQUEST_ID_BACKEND="false"
if grep -r "request_id\|X-Request-ID\|correlation" apps/backend/src/ 2>/dev/null | grep -qi "middleware\|header"; then
    REQUEST_ID_BACKEND="true"
    echo "[OK] Backend has request_id handling"
else
    echo "[MISSING] Backend missing request_id middleware"
fi

REQUEST_ID_AGENT="false"
if grep -r "request_id\|X-Request-ID\|correlation" apps/agent-api/ 2>/dev/null | grep -qi "middleware\|header"; then
    REQUEST_ID_AGENT="true"
    echo "[OK] Agent API has request_id handling"
else
    echo "[MISSING] Agent API missing request_id middleware"
fi

REQUEST_ID_DASHBOARD="false"
if grep -r "request_id\|X-Request-ID\|requestId" apps/dashboard/src/ 2>/dev/null | head -1 >/dev/null 2>&1; then
    REQUEST_ID_DASHBOARD="true"
    echo "[OK] Dashboard has request_id propagation"
else
    echo "[MISSING] Dashboard missing request_id propagation"
fi

# Check docker-compose for logging config
echo ""
echo "=== Checking docker-compose logging configuration ==="

COMPOSE_HAS_LOGGING="false"
if grep -q "loki\|promtail" deployments/docker/docker-compose*.yml 2>/dev/null; then
    COMPOSE_HAS_LOGGING="true"
    echo "[OK] Docker compose has logging configuration"
else
    echo "[MISSING] Docker compose missing logging configuration"
fi

# Check for existing volumes
echo ""
echo "=== Checking existing data volumes ==="

VOLUMES=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -E "zakops|postgres|redis|rag|loki" | tr '\n' ' ' || echo "none")
echo "Found volumes: $VOLUMES"

# Check running containers
echo ""
echo "=== Currently running containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -20 || echo "Cannot list containers"

# Generate discovery report
cat > "$OUTPUT_DIR/discovery_report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "phase": "0_discovery",
    "logging_infrastructure": {
        "loki": "$LOKI_EXISTS",
        "promtail": "$PROMTAIL_EXISTS",
        "grafana": "$GRAFANA_EXISTS",
        "grafana_url": "$GRAFANA_URL",
        "loki_datasource": "$LOKI_DATASOURCE_EXISTS"
    },
    "request_correlation": {
        "backend": "$REQUEST_ID_BACKEND",
        "agent_api": "$REQUEST_ID_AGENT",
        "dashboard": "$REQUEST_ID_DASHBOARD"
    },
    "docker_compose": {
        "has_logging_config": "$COMPOSE_HAS_LOGGING"
    },
    "volumes": "$VOLUMES",
    "recommendations": {
        "need_loki": $([ "$LOKI_EXISTS" = "true" ] && echo "false" || echo "true"),
        "need_promtail": $([ "$PROMTAIL_EXISTS" = "true" ] && echo "false" || echo "true"),
        "need_grafana": $([ "$GRAFANA_EXISTS" = "true" ] && echo "false" || echo "true"),
        "need_request_id_middleware": $([ "$REQUEST_ID_BACKEND" = "true" ] && [ "$REQUEST_ID_AGENT" = "true" ] && echo "false" || echo "true")
    }
}
EOF

echo ""
echo "========================================================================"
echo "[OK] PHASE 0 DISCOVERY: COMPLETE"
echo "   Report: $OUTPUT_DIR/discovery_report.json"
echo ""
cat "$OUTPUT_DIR/discovery_report.json" | python3 -m json.tool 2>/dev/null || cat "$OUTPUT_DIR/discovery_report.json"
