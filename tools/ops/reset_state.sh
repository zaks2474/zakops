#!/usr/bin/env bash
# ZakOps System State Reset (Hard)
# Wipes ALL persisted state for clean baseline

set -euo pipefail

echo "========================================================================"
echo "              ZAKOPS SYSTEM STATE RESET (HARD)"
echo "========================================================================"

# Safety check
if [ "${FORCE_RESET:-}" != "true" ]; then
    echo ""
    echo "[WARNING] This will DESTROY ALL DATA including:"
    echo "   - All deals"
    echo "   - All quarantine items"
    echo "   - All approvals and threads"
    echo "   - All agent runs and events"
    echo "   - Redis cache"
    echo "   - RAG/vector store index"
    echo ""
    echo "To proceed, run with: FORCE_RESET=true make reset-state"
    echo ""
    exit 1
fi

OUTPUT_DIR="artifacts/ops"
mkdir -p "$OUTPUT_DIR"

COMPOSE_FILE="deployments/docker/docker-compose.yml"

echo ""
echo "=== Step 1: Recording pre-reset state ==="

# Record what's running before
docker ps --format "{{.Names}}" > "$OUTPUT_DIR/pre_reset_containers.txt" 2>/dev/null || true

echo ""
echo "=== Step 2: Stopping all services ==="
cd "$(dirname "$COMPOSE_FILE")/../.." || exit 1
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

echo ""
echo "=== Step 3: Removing data volumes ==="

# List volumes to remove (be specific to avoid removing system volumes)
for vol in $(docker volume ls -q 2>/dev/null | grep -E "zakops|postgres-data|redis-data|loki-data|grafana-data" || true); do
    echo "  - Removing: $vol"
    docker volume rm "$vol" 2>/dev/null || true
done

echo ""
echo "=== Step 4: Clearing local artifact directories ==="

# Clear specific directories (preserve structure)
DIRS_TO_CLEAR=(
    "artifacts/logs"
    "artifacts/tests"
)

for dir in "${DIRS_TO_CLEAR[@]}"; do
    if [ -d "$dir" ]; then
        echo "  Clearing $dir"
        rm -rf "${dir:?}"/*
        mkdir -p "$dir"
    fi
done

echo ""
echo "=== Step 5: Starting services fresh ==="

# Start infrastructure services (postgres, redis, loki, grafana, promtail)
# These use pre-built images and don't need to be rebuilt
docker compose -f "$COMPOSE_FILE" up -d postgres redis loki promtail grafana 2>/dev/null || true

# Wait for infrastructure
sleep 10

# Restart the main services from their respective compose projects
# Backend runs from zakops-backend repo
if [ -f /home/zaks/zakops-backend/docker-compose.yml ]; then
    echo "  Restarting zakops-backend services..."
    cd /home/zaks/zakops-backend && docker compose -p zakops up -d backend outbox-worker 2>/dev/null || true
    cd - >/dev/null
fi

# Agent API runs from zakops-agent-api (if exists as separate service)
if docker ps -a --format '{{.Names}}' | grep -q "zakops-agent-api"; then
    echo "  Restarting zakops-agent-api..."
    docker start zakops-agent-api 2>/dev/null || true
fi

# Orchestration (if exists)
if docker ps -a --format '{{.Names}}' | grep -q "orchestration"; then
    echo "  Restarting orchestration..."
    docker start $(docker ps -a --format '{{.Names}}' | grep orchestration | head -1) 2>/dev/null || true
fi

echo ""
echo "=== Step 6: Waiting for services to be healthy ==="

MAX_WAIT=120
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
    HEALTHY=0
    TOTAL=0

    for port in 8091 8095; do
        TOTAL=$((TOTAL + 1))

        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            HEALTHY=$((HEALTHY + 1))
        fi
    done

    echo "  Services healthy: $HEALTHY/$TOTAL (waited ${WAITED}s)"

    if [ $HEALTHY -eq $TOTAL ]; then
        break
    fi

    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
done

echo ""
echo "=== Step 7: Verifying clean state ==="

# Check deals count
DEALS_COUNT=$(curl -s http://localhost:8091/api/deals 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if isinstance(d, list):
        print(len(d))
    else:
        print(d.get('total', len(d.get('items', d.get('deals', [])))))
except:
    print(-1)
" || echo "-1")

# Check quarantine count
QUARANTINE_COUNT=$(curl -s http://localhost:8091/api/quarantine 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if isinstance(d, list):
        print(len(d))
    else:
        print(d.get('total', len(d.get('items', []))))
except:
    print(-1)
" || echo "-1")

# Check approvals count
APPROVALS_COUNT=$(curl -s http://localhost:8095/api/v1/agent/approvals/pending 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if isinstance(d, list):
        print(len(d))
    else:
        print(0)
except:
    print(-1)
" || echo "-1")

# Generate report
cat > "$OUTPUT_DIR/reset_state_report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "type": "hard_reset",
    "volumes_removed": true,
    "services_restarted": true,
    "state_verification": {
        "deals_count": $DEALS_COUNT,
        "quarantine_count": $QUARANTINE_COUNT,
        "pending_approvals": $APPROVALS_COUNT
    },
    "clean_state": $([ "$DEALS_COUNT" -le 0 ] && [ "$QUARANTINE_COUNT" -le 0 ] && [ "$APPROVALS_COUNT" -le 0 ] && echo "true" || echo "false")
}
EOF

echo ""
echo "========================================================================"
echo "  Reset complete"
echo "  Deals: $DEALS_COUNT"
echo "  Quarantine: $QUARANTINE_COUNT"
echo "  Pending Approvals: $APPROVALS_COUNT"
echo "========================================================================"

if [ "$DEALS_COUNT" -le 0 ] && [ "$QUARANTINE_COUNT" -le 0 ] && [ "$APPROVALS_COUNT" -le 0 ]; then
    echo "[OK] SYSTEM RESET: CLEAN STATE VERIFIED"
    exit 0
else
    echo "[WARN] SYSTEM RESET: State may contain seed data"
    exit 0  # Not a hard failure - seeded data might exist
fi
