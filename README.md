# ZakOps

Enterprise-grade agentic workflow platform with human-in-the-loop (HITL) approvals.

## Architecture

```
zakops/
├── apps/
│   ├── agent-api/      # LangGraph orchestration + HITL approvals (:8095)
│   ├── backend/        # Deal lifecycle + orchestration APIs (:8090, :8091)
│   └── dashboard/      # Next.js admin interface (:3003)
├── packages/
│   └── contracts/      # Shared OpenAPI specs
├── ops/
│   ├── observability/  # Grafana, Prometheus, Langfuse configs
│   └── runbooks/       # Operational procedures
├── tools/
│   ├── gates/          # CI gate scripts
│   └── evals/          # Evaluation scripts
└── deployments/
    └── docker/         # Docker Compose files
```

## Quick Start

```bash
# Install all dependencies
make install

# Run all tests
make test

# Start development servers
make dev-agent-api    # http://localhost:8095
make dev-backend      # http://localhost:8090
make dev-dashboard    # http://localhost:3003

# Run gate checks
make gates
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Agent API | 8095 | LangGraph orchestration with HITL |
| Deal Lifecycle | 8090 | Deal management API |
| Orchestration | 8091 | Workflow orchestration |
| Dashboard | 3003 | Admin UI |
| RAG REST | 8052 | Retrieval-augmented generation |
| MCP Server | 9100 | Model Context Protocol |

## Development

### Prerequisites

- Python 3.12+ with `uv`
- Node.js 20+ with `npm`
- PostgreSQL 16+
- Redis 7+

### Per-App Setup

**Agent API:**
```bash
cd apps/agent-api
uv sync
uv run uvicorn app.main:app --reload --port 8095
```

**Backend:**
```bash
cd apps/backend
pip install -r requirements.txt
python -m uvicorn src.api.deal_lifecycle.main:app --reload --port 8090
```

**Dashboard:**
```bash
cd apps/dashboard
npm install
npm run dev
```

## Docker

```bash
# Start all services
docker compose -f deployments/docker/docker-compose.yml up -d

# View logs
docker compose -f deployments/docker/docker-compose.yml logs -f

# Stop
docker compose -f deployments/docker/docker-compose.yml down
```

## Testing

```bash
# All tests
make test

# Individual apps
make test-agent-api
make test-backend
make test-dashboard

# Gate checks (CI simulation)
make gates
```

## Documentation

- [Port Standards](docs/standards/PORTS.md)
- [Security Guidelines](docs/standards/SECURITY.md)
- [Runbooks](ops/runbooks/)

## License

Proprietary - See [LICENSE](LICENSE) file
