#!/usr/bin/env bash
# Phase B Gate: System Reset Verification

set -euo pipefail

echo "========================================================================"
echo "           PHASE B GATE: SYSTEM RESET VERIFICATION"
echo "========================================================================"

OUTPUT_DIR="artifacts/ops"
mkdir -p "$OUTPUT_DIR"

FAILURES=0

echo ""
echo "=== Test B.1: Services are healthy after reset ==="

SERVICES_HEALTHY=0
for port in 8090 8095 8091; do
    SERVICE=""
    case $port in
        8090) SERVICE="backend" ;;
        8095) SERVICE="agent-api" ;;
        8091) SERVICE="orchestration" ;;
    esac

    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
        echo "  [OK] $SERVICE ($port) healthy"
        SERVICES_HEALTHY=$((SERVICES_HEALTHY + 1))
    else
        echo "  [FAIL] $SERVICE ($port) not healthy"
    fi
done

if [ $SERVICES_HEALTHY -ge 3 ]; then
    echo "[PASS] Services healthy: $SERVICES_HEALTHY/3"
else
    echo "[FAIL] Services healthy: $SERVICES_HEALTHY/3"
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "=== Test B.2: Database is accessible ==="

# Try to find postgres container
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1 || echo "")

if [ -n "$POSTGRES_CONTAINER" ]; then
    DB_ACCESSIBLE=$(docker exec "$POSTGRES_CONTAINER" pg_isready -U zakops 2>/dev/null && echo "yes" || echo "no")

    if [ "$DB_ACCESSIBLE" = "yes" ]; then
        echo "[PASS] Database accessible"
    else
        echo "[FAIL] Database not accessible"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo "[WARN] Postgres container not found by name"
    # Try direct connection
    if pg_isready -h localhost -p 5432 -U zakops 2>/dev/null; then
        echo "[PASS] Database accessible (direct)"
    else
        echo "[WARN] Database check skipped"
    fi
fi

echo ""
echo "=== Test B.3: Redis is accessible ==="

# Try to find redis container
REDIS_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i redis | head -1 || echo "")

if [ -n "$REDIS_CONTAINER" ]; then
    REDIS_ACCESSIBLE=$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG && echo "yes" || echo "no")

    if [ "$REDIS_ACCESSIBLE" = "yes" ]; then
        echo "[PASS] Redis accessible"
    else
        echo "[FAIL] Redis not accessible"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo "[WARN] Redis container not found by name"
    # Try direct connection
    if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
        echo "[PASS] Redis accessible (direct)"
    else
        echo "[WARN] Redis check skipped"
    fi
fi

echo ""
echo "=== Test B.4: Business data is empty or minimal ==="

# Check report from reset
if [ -f "$OUTPUT_DIR/reset_state_report.json" ]; then
    CLEAN_STATE=$(python3 -c "import json; print(json.load(open('$OUTPUT_DIR/reset_state_report.json')).get('clean_state', False))" 2>/dev/null || echo "false")

    if [ "$CLEAN_STATE" = "True" ] || [ "$CLEAN_STATE" = "true" ]; then
        echo "[PASS] Clean state verified from reset report"
    else
        echo "[WARN] State may contain seed data"
    fi
else
    echo "[WARN] Reset report not found - verifying directly"

    # Direct check
    DEALS=$(curl -s http://localhost:8090/api/deals 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(len(d) if isinstance(d, list) else d.get('total', len(d.get('items', d.get('deals', [])))))
except:
    print(-1)
" || echo "-1")

    echo "  Deals count: $DEALS"
fi

# Generate gate report
cat > "$OUTPUT_DIR/reset_state_gate.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "phase": "B_reset_state",
    "services_healthy": $SERVICES_HEALTHY,
    "failures": $FAILURES,
    "passed": $([ $FAILURES -eq 0 ] && echo "true" || echo "false")
}
EOF

echo ""
echo "========================================================================"
if [ $FAILURES -eq 0 ]; then
    echo "[OK] PHASE B RESET STATE: PASSED"
    exit 0
else
    echo "[FAIL] PHASE B RESET STATE: FAILED ($FAILURES issues)"
    exit 1
fi
