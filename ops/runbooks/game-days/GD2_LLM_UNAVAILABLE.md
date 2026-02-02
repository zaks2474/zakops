# GD2: LLM Unavailable

## Symptoms

- Agent actions fail with 503 errors
- Logs show connection refused to vLLM/Ollama
- LLM-dependent endpoints return error responses

## Impact

- **Severity**: High
- **Affected Services**: Agent intelligence, suggestions, analysis
- **User Impact**: Can still manage deals manually, but no AI assistance

## Diagnosis

1. Check LLM container status:
   ```bash
   docker ps | grep -E "(vllm|ollama)"
   docker logs zakops-vllm --tail 50
   ```

2. Test LLM health:
   ```bash
   curl -sf http://localhost:8000/health
   ```

3. Check API logs for LLM errors:
   ```bash
   docker logs zakops-api --tail 100 | grep -i "llm\|openai\|vllm"
   ```

## Immediate Actions

1. **Restart LLM service**:
   ```bash
   docker start zakops-vllm
   # or
   docker start zakops-ollama
   ```

2. **Verify graceful degradation**:
   ```bash
   # API should return structured errors, not raw 500
   curl -sf http://localhost:8091/api/agents/suggest
   # Expected: {"error": "LLM unavailable", "status": 503}
   ```

3. **Monitor recovery**:
   ```bash
   watch -n 5 'curl -sf http://localhost:8000/health'
   ```

## Rollback

LLM unavailability should not require rollback - system should degrade gracefully.

If LLM consistently fails to start:
1. Check GPU availability: `nvidia-smi`
2. Check memory: `docker stats`
3. Review LLM logs for model loading errors

## Verification

1. LLM health returns 200:
   ```bash
   curl -sf http://localhost:8000/health
   ```

2. Agent suggestion works:
   ```bash
   curl -X POST http://localhost:8091/api/agents/analyze \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   ```

3. No 500 errors in logs (503 is acceptable):
   ```bash
   docker logs zakops-api --since 5m | grep -c "HTTP 500"
   ```

## Escalation

- **L1**: Restart LLM service
- **L2**: Check GPU/memory resources
- **L3**: ML team for model issues

## Postmortem Template

- **Detection time**: When did we notice LLM was down?
- **Graceful degradation**: Did users see proper error messages?
- **Root cause**: Why did LLM fail?
- **Action items**: Better health checks? Fallback LLM?

## Related

- LLM configuration: `config/llm.yml`
- Monitoring dashboard: Grafana → ZakOps → LLM
