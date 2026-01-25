# GD4: Network Partition

## Symptoms

- External API calls fail (webhooks, external LLM, etc.)
- Internal services continue to function
- Logs show connection timeouts to external hosts

## Impact

- **Severity**: High
- **Affected Services**: External integrations, cloud LLM, webhooks
- **User Impact**: Core functionality works, integrations fail

## Diagnosis

1. Test external connectivity:
   ```bash
   curl -sf --max-time 5 https://api.anthropic.com/health
   docker exec zakops-api curl -sf --max-time 5 https://google.com
   ```

2. Test internal connectivity:
   ```bash
   curl -sf http://localhost:8090/health
   docker exec zakops-api curl -sf http://zakops-postgres:5432
   ```

3. Check network configuration:
   ```bash
   docker network ls
   docker network inspect zakops-network
   ```

## Immediate Actions

1. **Verify internal operations work**:
   ```bash
   # These should succeed
   curl -sf http://localhost:8090/health
   curl -sf http://localhost:8090/api/deals
   ```

2. **Check DNS resolution**:
   ```bash
   docker exec zakops-api nslookup google.com
   ```

3. **Check firewall/iptables** (if applicable):
   ```bash
   sudo iptables -L -n | head -20
   ```

## Rollback

If intentionally partitioned (via iptables):
```bash
sudo iptables -F OUTPUT
sudo iptables -F INPUT
```

If network issue:
1. Restart Docker networking:
   ```bash
   docker network disconnect zakops-network zakops-api
   docker network connect zakops-network zakops-api
   ```

2. Full Docker restart (last resort):
   ```bash
   sudo systemctl restart docker
   ```

## Verification

1. External connectivity restored:
   ```bash
   curl -sf --max-time 5 https://google.com
   ```

2. Internal services still healthy:
   ```bash
   curl -sf http://localhost:8090/health
   ```

3. Integrations working:
   ```bash
   # Test webhook endpoint
   curl -X POST http://localhost:8090/api/webhooks/test
   ```

## Escalation

- **L1**: Check basic connectivity, restart networking
- **L2**: Network team for infrastructure issues
- **L3**: Cloud provider for datacenter issues

## Postmortem Template

- **Detection time**: How quickly did we notice external failures?
- **Internal resilience**: Did internal operations continue?
- **Root cause**: Network issue? Firewall? DNS?
- **Action items**: Better circuit breakers? Fallback endpoints?

## Related

- Network configuration: `deployments/docker/docker-compose.yml`
- Monitoring: Grafana → ZakOps → Network
