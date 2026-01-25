# Startup/Shutdown Runbook

**Version:** 1.0.0
**Status:** P7-OPS-001 Implementation

## Purpose

Procedures for starting and stopping the ZakOps Agent API service.

## Startup Procedure

### Step 1: Pre-flight Checks

```bash
# Check Docker is running
docker info > /dev/null 2>&1 || { echo "Docker not running"; exit 1; }

# Check required environment variables
[ -n "$JWT_SECRET_KEY" ] || echo "WARNING: JWT_SECRET_KEY not set"
[ -n "$CHECKPOINT_ENCRYPTION_KEY" ] || echo "WARNING: No encryption key (dev mode)"
```

### Step 2: Start Services

```bash
cd /home/zaks/zakops-agent-api

# Start database first
docker compose up -d db

# Wait for database
sleep 5

# Start agent API
docker compose up -d agent-api
```

### Step 3: Verify Health

```bash
# Wait for health endpoint
for i in $(seq 1 30); do
    if curl -s http://localhost:8095/health | grep -q "healthy"; then
        echo "Service is healthy"
        break
    fi
    sleep 2
done
```

## Shutdown Procedure

### Graceful Shutdown

```bash
cd /home/zaks/zakops-agent-api

# Stop accepting new requests (drain period)
# Note: Agent API handles in-flight requests gracefully

# Stop services
docker compose down

# Verify stopped
docker compose ps
```

### Emergency Shutdown

```bash
# Force stop all containers
docker compose kill

# Remove containers
docker compose down --remove-orphans
```

## Troubleshooting

### Service Won't Start

1. Check Docker logs: `docker compose logs agent-api`
2. Check database connectivity
3. Verify environment variables

### Health Check Failing

1. Check `/health` response for degraded components
2. Review logs for errors
3. Check database connection
