# GD3: Redis Failure

## Symptoms

- Increased API latency (cache misses)
- Session/rate limiting may not work
- Logs show Redis connection errors

## Impact

- **Severity**: Medium
- **Affected Services**: Caching, sessions, rate limiting
- **User Impact**: Slower responses, possible rate limit bypass

## Diagnosis

1. Check Redis container:
   ```bash
   docker ps | grep redis
   docker logs zakops-redis --tail 50
   ```

2. Test Redis connectivity:
   ```bash
   docker exec zakops-redis redis-cli ping
   ```

3. Check API logs:
   ```bash
   docker logs zakops-api --tail 100 | grep -i redis
   ```

## Immediate Actions

1. **Restart Redis**:
   ```bash
   docker start zakops-redis
   ```

2. **Verify API still functions** (should work without cache):
   ```bash
   curl -sf http://localhost:8090/health
   ```

3. **Monitor cache reconnection**:
   ```bash
   docker exec zakops-redis redis-cli info clients
   ```

## Rollback

Redis failure typically doesn't require rollback - application should function without cache.

If Redis data is corrupted:
```bash
# Flush all (loses cache data, not persistent data)
docker exec zakops-redis redis-cli FLUSHALL

# Or recreate container
docker rm -f zakops-redis
docker compose up -d redis
```

## Verification

1. Redis responds to ping:
   ```bash
   docker exec zakops-redis redis-cli ping
   ```

2. API health check passes:
   ```bash
   curl -sf http://localhost:8090/health
   ```

3. Test caching is working:
   ```bash
   # First request (cache miss)
   time curl -sf http://localhost:8090/api/deals
   # Second request (should be faster - cache hit)
   time curl -sf http://localhost:8090/api/deals
   ```

## Escalation

- **L1**: Restart Redis
- **L2**: Check memory limits, persistence settings
- **L3**: Data team for cache architecture issues

## Postmortem Template

- **Detection time**: How long until slowness was noticed?
- **Graceful degradation**: Did API continue without cache?
- **Root cause**: Why did Redis fail?
- **Action items**: Better monitoring? Redis Sentinel?

## Related

- Redis configuration: `config/redis.conf`
- Monitoring dashboard: Grafana → ZakOps → Cache
