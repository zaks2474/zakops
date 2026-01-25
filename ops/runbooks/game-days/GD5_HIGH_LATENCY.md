# GD5: High Latency

## Symptoms

- API responses take >5 seconds
- Timeouts across services
- Circuit breakers may activate
- Users experience slow page loads

## Impact

- **Severity**: High
- **Affected Services**: All networked services
- **User Impact**: Very slow experience, possible timeouts

## Diagnosis

1. Measure current latency:
   ```bash
   time curl -sf http://localhost:8090/health
   ```

2. Check for network delay (tc netem):
   ```bash
   tc qdisc show dev docker0
   ```

3. Check container resource usage:
   ```bash
   docker stats --no-stream
   ```

4. Check for slow queries:
   ```bash
   docker exec zakops-postgres psql -U zakops -c \
     "SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

## Immediate Actions

1. **Remove artificial delay** (if tc netem was used):
   ```bash
   sudo tc qdisc del dev docker0 root 2>/dev/null
   sudo tc qdisc del dev eth0 root 2>/dev/null
   ```

2. **Check and kill slow queries**:
   ```bash
   docker exec zakops-postgres psql -U zakops -c \
     "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE duration > interval '30 seconds' AND state = 'active';"
   ```

3. **Verify timeouts are configured**:
   - API should timeout after reasonable period
   - Clients should see proper timeout responses

## Rollback

1. Remove traffic control rules:
   ```bash
   sudo tc qdisc del dev docker0 root
   ```

2. Restart affected services:
   ```bash
   docker restart zakops-api
   ```

## Verification

1. Latency back to normal (<1s):
   ```bash
   time curl -sf http://localhost:8090/health
   ```

2. No pending slow queries:
   ```bash
   docker exec zakops-postgres psql -U zakops -c \
     "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```

3. API responses are timely:
   ```bash
   for i in {1..5}; do
     time curl -sf http://localhost:8090/api/deals > /dev/null
   done
   ```

## Escalation

- **L1**: Remove tc netem, restart services
- **L2**: Check database performance, network infrastructure
- **L3**: Performance team for optimization

## Postmortem Template

- **Detection time**: How long before slow responses were noticed?
- **Timeout handling**: Did timeouts fire appropriately?
- **Root cause**: Network? Database? Resource exhaustion?
- **Action items**: Better timeout configs? Circuit breakers?

## Related

- Timeout configuration: `config/timeouts.yml`
- Performance dashboard: Grafana → ZakOps → Performance
