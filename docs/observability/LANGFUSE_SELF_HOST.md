# Self-Hosted Langfuse Configuration

**Version:** 1.0.0
**Status:** P1-LANGFUSE-001 Implementation

## Overview

Per Decision Lock §5, the Agent API uses self-hosted Langfuse for tracing
instead of cloud LangSmith. This ensures:

- No raw prompts/responses leave the infrastructure
- 100% trace coverage for all workflows
- Full control over retention policies

## Deployment

Langfuse runs on port 3001 per the Decision Lock.

### Docker Deployment

```yaml
# In docker-compose.yml (monitoring profile)
langfuse:
  image: langfuse/langfuse:latest
  container_name: zakops-langfuse
  ports:
    - "3001:3000"
  environment:
    - DATABASE_URL=postgresql://langfuse:password@langfuse-db:5432/langfuse
    - NEXTAUTH_SECRET=${LANGFUSE_NEXTAUTH_SECRET}
    - SALT=${LANGFUSE_SALT}
  networks:
    - agent-network
```

## Configuration

### Environment Variables

```bash
# Langfuse connection (in Agent API)
LANGFUSE_HOST=http://localhost:3001
LANGFUSE_PUBLIC_KEY=<your-public-key>
LANGFUSE_SECRET_KEY=<your-secret-key>
```

### LangGraph Integration

The Agent API uses the Langfuse callback handler:

```python
from langfuse.langchain import CallbackHandler

config = {
    "callbacks": [CallbackHandler()],
    # ...
}
```

## Security Requirements

### No Raw Content Logging

Per Decision Lock §5, raw prompts and responses are **never** logged:

- Only hash + length for content
- Tool arguments may be logged (but sanitized)
- PII must be filtered before tracing

### Verification

Run the gate tests to verify:

```bash
./scripts/bring_up_tests.sh
```

Check artifacts:
- `gate_artifacts/langfuse_selfhost_gate.log` - `LANGFUSE_SELFHOST: PASSED`
- `gate_artifacts/raw_content_scan.log` - `RAW_CONTENT_SCAN: PASSED`

## Health Check

```bash
curl http://localhost:3001/api/public/health
```

Expected response: `{"status":"OK"}`

## Trace Verification

To verify traces are being captured:

1. Access Langfuse UI at http://localhost:3001
2. Navigate to Traces
3. Confirm traces exist for agent workflows
4. Verify no raw content appears in trace spans

## Retention Policy

Default retention: 30 days per Decision Lock §5.

Configure via Langfuse admin settings.

## Troubleshooting

### No Traces Appearing

1. Check `LANGFUSE_HOST` is accessible from container
2. Verify `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set
3. Check Agent API logs for Langfuse connection errors

### Connection Refused

1. Ensure Langfuse container is running
2. Check network configuration (agent-network)
3. Verify port 3001 is exposed

### Raw Content in Traces

If raw content appears in traces:
1. Check `sanitize_content_for_log` is being used
2. Verify CallbackHandler configuration
3. Review trace span configurations
