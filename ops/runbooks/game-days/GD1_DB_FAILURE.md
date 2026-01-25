# GD1: Database Failure

## Symptoms

- API returns 500/503 errors on database-dependent endpoints
- Logs show PostgreSQL connection errors
- Metrics show increased latency and error rates

## Impact

- **Severity**: Critical
- **Affected Services**: All services requiring database access
- **User Impact**: Unable to create/update deals, approvals fail

## Diagnosis

1. Check PostgreSQL container status:
   ```bash
   docker ps | grep postgres
   docker logs zakops-postgres --tail 50
   ```

2. Test database connectivity:
   ```bash
   docker exec zakops-postgres pg_isready -U zakops
   ```

3. Check API logs for connection errors:
   ```bash
   docker logs zakops-api --tail 100 | grep -i postgres
   ```

## Immediate Actions

1. **Restart PostgreSQL** (if container is down):
   ```bash
   docker start zakops-postgres
   ```

2. **Wait for connections to recover**:
   ```bash
   # Monitor API health
   watch -n 2 'curl -sf http://localhost:8090/health | jq .'
   ```

3. **Verify database is accepting connections**:
   ```bash
   docker exec zakops-postgres psql -U zakops -c "SELECT 1;"
   ```

## Rollback

If restart fails:
1. Check disk space on database volume
2. Review PostgreSQL logs for corruption
3. Consider restoring from backup (see RESTORE_DRILL_LOCAL.md)

## Verification

1. Health endpoint returns 200:
   ```bash
   curl -sf http://localhost:8090/health
   ```

2. Create a test record:
   ```bash
   curl -X POST http://localhost:8090/api/deals -d '{"test": true}'
   ```

3. Check no errors in last 5 minutes:
   ```bash
   docker logs zakops-api --since 5m | grep -c ERROR
   ```

## Escalation

- **L1**: Restart PostgreSQL, verify recovery
- **L2**: Check disk/memory, review logs
- **L3**: DBA for corruption/restore scenarios

## Postmortem Template

- **Detection time**: How long until alert fired?
- **Recovery time**: Total incident duration?
- **Root cause**: Why did PostgreSQL fail?
- **Action items**: What prevents recurrence?

## Related

- [RESTORE_DRILL_OVERVIEW.md](../restore-drills/RESTORE_DRILL_OVERVIEW.md)
- Monitoring dashboard: Grafana → ZakOps → Database
