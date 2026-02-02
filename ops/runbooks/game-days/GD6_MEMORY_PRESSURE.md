# GD6: Memory Pressure

## Symptoms

- Containers killed with OOM (Out of Memory)
- Slow responses due to swapping
- Container restarts in logs

## Impact

- **Severity**: High
- **Affected Services**: Any memory-constrained container
- **User Impact**: Service interruptions during OOM and restart

## Diagnosis

1. Check container memory usage:
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
   ```

2. Check for OOM kills:
   ```bash
   dmesg | grep -i "oom\|killed process"
   docker events --since 1h | grep -i "oom\|die"
   ```

3. Check container limits:
   ```bash
   docker inspect zakops-api --format '{{.HostConfig.Memory}}'
   ```

## Immediate Actions

1. **Identify memory hog**:
   ```bash
   docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}" | sort -k2 -h
   ```

2. **Increase memory limit** (temporary):
   ```bash
   docker update --memory 2g zakops-api
   ```

3. **Restart affected container**:
   ```bash
   docker restart zakops-api
   ```

4. **Clear caches if applicable**:
   ```bash
   docker exec zakops-redis redis-cli FLUSHALL
   ```

## Rollback

1. Remove memory limits:
   ```bash
   docker update --memory 0 zakops-api  # 0 = unlimited
   ```

2. Restart container:
   ```bash
   docker restart zakops-api
   ```

## Verification

1. Container running and healthy:
   ```bash
   docker ps | grep zakops-api
   curl -sf http://localhost:8091/health
   ```

2. Memory usage reasonable:
   ```bash
   docker stats zakops-api --no-stream
   ```

3. No recent OOM events:
   ```bash
   docker events --since 5m | grep -c oom
   ```

## Escalation

- **L1**: Restart container, increase memory limit
- **L2**: Profile application for memory leaks
- **L3**: Development team for code fixes

## Postmortem Template

- **Detection time**: How long until OOM was detected?
- **Recovery time**: How quickly did container restart?
- **Root cause**: Memory leak? Insufficient allocation?
- **Action items**: Increase limits? Fix leak? Add monitoring?

## Related

- Memory configuration: `deployments/docker/docker-compose.yml`
- Memory dashboard: Grafana → ZakOps → Resources
