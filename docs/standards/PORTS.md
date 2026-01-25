# ZakOps Agent API - Port Assignments

**Status:** Decision Locked per DECISION-LOCK-FILE.md

| Service        | Port  | Protocol | Description                          |
|----------------|-------|----------|--------------------------------------|
| Agent API      | 8095  | HTTP     | Agent orchestration, approvals, tools|
| Deal API       | 8090  | HTTP     | Deal CRUD and transitions (existing) |
| vLLM           | 8000  | HTTP     | Local LLM inference (Qwen2.5-32B)    |
| RAG REST       | 8052  | HTTP     | Retrieval frontend                   |
| MCP            | 9100  | HTTP     | External tool server (streamable-http)|
| Langfuse       | 3001  | HTTP     | Self-hosted trace UI                 |
| PostgreSQL     | 5432  | TCP      | Database (internal only)             |
| Prometheus     | 9091  | HTTP     | Metrics collection (monitoring)      |
| Grafana        | 3002  | HTTP     | Dashboards (monitoring)              |

## Notes

- **Agent API (8095)**: External-facing port, routed via Cloudflare per Decision Lock §10
- **PostgreSQL**: Internal Docker network only; no host binding for security
- **Langfuse (3001)**: Reserved for self-hosted tracing; Grafana uses 3002 to avoid conflict
- **vLLM (8000)**: Local inference lane with Qwen2.5-32B-Instruct-AWQ

## Container Networking

When running in Docker containers, services should use `host.docker.internal` to reach
host-bound services, not `localhost`. The docker-compose.yml configures:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## External Service URLs

Default configuration (container mode):
- `DEAL_API_URL=http://host.docker.internal:8090`
- `RAG_REST_URL=http://host.docker.internal:8052`
- `MCP_URL=http://host.docker.internal:9100`
- `VLLM_BASE_URL=http://host.docker.internal:8000/v1`
