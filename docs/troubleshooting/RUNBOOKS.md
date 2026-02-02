# Operational Runbooks

This document contains runbooks for common operational tasks.

## Service Restart

### Restart All Services

```bash
# Docker deployment
docker compose down
docker compose up -d

# Systemd deployment
sudo systemctl restart zakops-backend
sudo systemctl restart zakops-agent
sudo systemctl restart zakops-dashboard
```

### Restart Individual Service

```bash
# Backend
sudo systemctl restart zakops-backend
# or
docker compose restart backend

# Agent API
sudo systemctl restart zakops-agent
# or
docker compose restart agent-api

# Dashboard
sudo systemctl restart zakops-dashboard
# or
docker compose restart dashboard
```

### Graceful Restart

For zero-downtime restarts:

```bash
# Send SIGUSR1 for graceful reload
sudo kill -SIGUSR1 $(cat /var/run/zakops-backend.pid)

# Wait for connections to drain
sleep 30

# Verify service is responding
curl http://localhost:8091/health
```

## Health Checks

### Quick Health Check

```bash
#!/bin/bash
# health_check.sh

echo "=== ZakOps Health Check ==="

# Backend
echo -n "Backend: "
curl -s http://localhost:8091/health | jq -r '.status' || echo "DOWN"

# Agent API
echo -n "Agent API: "
curl -s http://localhost:8095/health | jq -r '.status' || echo "DOWN"

# Dashboard
echo -n "Dashboard: "
curl -s http://localhost:3003/health | jq -r '.status' || echo "DOWN"

# Database
echo -n "Database: "
pg_isready -h localhost -p 5432 && echo "UP" || echo "DOWN"
```

### Detailed Health Check

```bash
#!/bin/bash
# detailed_health.sh

echo "=== Detailed Health Check ==="

# System resources
echo ""
echo "--- System Resources ---"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% used"
echo "Memory: $(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2}')"
echo "Disk: $(df -h / | awk 'NR==2{print $5}')"

# Service status
echo ""
echo "--- Service Status ---"
systemctl is-active zakops-backend && echo "Backend: ACTIVE" || echo "Backend: INACTIVE"
systemctl is-active zakops-agent && echo "Agent: ACTIVE" || echo "Agent: INACTIVE"

# Database connections
echo ""
echo "--- Database ---"
psql -c "SELECT count(*) as connections FROM pg_stat_activity;" 2>/dev/null || echo "Cannot connect"

# Recent errors
echo ""
echo "--- Recent Errors (last 10 min) ---"
journalctl -u zakops-backend --since "10 minutes ago" -p err --no-pager | tail -5
```

### Endpoint Validation

```bash
#!/bin/bash
# validate_endpoints.sh

ENDPOINTS=(
  "http://localhost:8091/health"
  "http://localhost:8091/api/v1/deals"
  "http://localhost:8095/health"
  "http://localhost:8095/api/v1/agent/actions"
)

for endpoint in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint")
  if [ "$status" -eq 200 ]; then
    echo "✓ $endpoint"
  else
    echo "✗ $endpoint (HTTP $status)"
  fi
done
```

## Incident Response

### High Error Rate

1. Check error logs: `journalctl -u zakops-backend -p err --since "5 minutes ago"`
2. Check monitoring dashboards
3. Identify error pattern (specific endpoint, user, etc.)
4. Check recent deployments
5. Consider rollback if deployment-related

### Service Down

1. Check service status: `systemctl status zakops-backend`
2. Check logs: `journalctl -u zakops-backend --since "10 minutes ago"`
3. Check resources (disk, memory, CPU)
4. Attempt restart: `systemctl restart zakops-backend`
5. If restart fails, check for port conflicts
6. Escalate if unresolved

### Database Issues

1. Check database status: `pg_isready`
2. Check connections: `SELECT count(*) FROM pg_stat_activity;`
3. Check disk space
4. Check for long-running queries
5. Consider connection pool reset
6. Check replication status if applicable

## Maintenance Tasks

### Log Rotation

```bash
# Force log rotation
logrotate -f /etc/logrotate.d/zakops

# Verify rotation
ls -la /var/log/zakops/
```

### Database Maintenance

```bash
# Vacuum analyze
psql -c "VACUUM ANALYZE;"

# Check table sizes
psql -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
         FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

### Backup Verification

```bash
# List recent backups
ls -la /var/backups/zakops/

# Verify backup integrity
pg_restore --list /var/backups/zakops/latest.dump

# Test restore to temp database
createdb zakops_test_restore
pg_restore -d zakops_test_restore /var/backups/zakops/latest.dump
dropdb zakops_test_restore
```
