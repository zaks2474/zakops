# Troubleshooting Guide

This guide helps resolve common issues with ZakOps.

## Quick Diagnostics

Run these commands to quickly diagnose issues:

```bash
# Check service health
make doctor

# Check all services
curl http://localhost:8090/health
curl http://localhost:8095/health
curl http://localhost:3003/health

# Check logs
docker compose logs --tail=100

# Check disk space
df -h

# Check memory
free -m
```

## Common Issues

### Authentication Failures

**Symptom**: 401 Unauthorized errors

**Causes and Solutions**:

1. **Expired token**
   - Request a new token
   - Implement token refresh in your client

2. **Invalid credentials**
   - Verify username and password
   - Check for password expiration

3. **Missing Authorization header**
   - Ensure header is present: `Authorization: Bearer <token>`
   - Check for typos in header name

4. **Wrong token format**
   - Ensure "Bearer " prefix (note the space)
   - Token should not be quoted

**Debug**:
```bash
# Test authentication
curl -v -X POST http://localhost:8090/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'
```

### Agent Not Responding

**Symptom**: Agent invocations hang or timeout

**Causes and Solutions**:

1. **Agent service down**
   - Check service status: `systemctl status zakops-agent`
   - Restart if needed: `systemctl restart zakops-agent`

2. **LLM provider issues**
   - Check API key validity
   - Verify provider status page
   - Check rate limits

3. **Resource exhaustion**
   - Check CPU/memory usage
   - Review recent load patterns
   - Scale resources if needed

4. **Network issues**
   - Verify connectivity to LLM provider
   - Check firewall rules
   - Test DNS resolution

**Debug**:
```bash
# Check agent health
curl http://localhost:8095/health

# Check agent logs
journalctl -u zakops-agent --since "1 hour ago"

# Test agent invoke
curl -X POST http://localhost:8095/api/v1/agent/health-check
```

### Database Connection Issues

**Symptom**: Database errors in logs

**Solutions**:

1. Check database is running
2. Verify connection string in environment
3. Check database logs for errors
4. Verify network connectivity
5. Check connection pool exhaustion

### Slow Performance

**Symptom**: High latency or timeouts

**Solutions**:

1. Check resource utilization
2. Review database query performance
3. Check for resource contention
4. Review recent deployments
5. Analyze request patterns

### Dashboard Not Loading

**Symptom**: Dashboard shows blank page or errors

**Solutions**:

1. Clear browser cache
2. Check browser console for errors
3. Verify backend API is reachable
4. Check CORS configuration
5. Review dashboard logs

## Getting Help

### Before Contacting Support

1. Check this troubleshooting guide
2. Review logs for error messages
3. Note the exact error and steps to reproduce
4. Gather system information (versions, config)

### Support Channels

- **Documentation**: Check `/docs` for guides
- **GitHub Issues**: Report bugs with reproduction steps
- **Emergency**: Contact on-call via PagerDuty

### Information to Provide

When reporting issues, include:
- ZakOps version
- Error messages (exact text)
- Steps to reproduce
- Recent changes
- Environment (dev/staging/prod)
- Relevant logs

## Log Locations

| Service | Log Location |
|---------|--------------|
| Backend | `/var/log/zakops/backend.log` |
| Agent API | `/var/log/zakops/agent-api.log` |
| Dashboard | Browser console |
| Docker | `docker compose logs` |
