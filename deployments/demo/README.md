# Demo Environment

Isolated demo environment for showcasing ZakOps without affecting production.

## Features

- **Fully Isolated**: Separate network, volumes, and ports
- **Mock LLM**: No real API keys required
- **Pre-seeded Data**: Sample deals and workflows
- **Easy Reset**: One command to start fresh

## Quick Start

```bash
# Start demo environment
docker-compose -f compose.demo.yml up -d --wait

# Access points
# API:       http://localhost:18091
# MCP:       http://localhost:19100
# Dashboard: http://localhost:13003
```

## Port Mapping

| Service   | Demo Port | Production Port |
|-----------|-----------|-----------------|
| API       | 18091     | 8091            |
| MCP       | 19100     | 9100            |
| Dashboard | 13003     | 3003            |
| Postgres  | 15432     | 5432            |
| Redis     | 16379     | 6379            |

## Isolation Guarantees

1. **Network**: Uses `zakops-demo` network, not connected to production
2. **Volumes**: Uses `zakops_demo_*` volumes, separate from production data
3. **Ports**: All ports offset by 10000+ to avoid conflicts
4. **Environment**: `DEMO_MODE=true` set on all services
5. **LLM**: `LLM_MOCK_MODE=true` - no real API calls

## Reset Demo

To nuke all demo data and start fresh:

```bash
# Interactive (will prompt for confirmation)
./reset_demo.sh

# Force (no confirmation)
FORCE=1 ./reset_demo.sh
```

## Configuration

Copy `.env.demo.example` to `.env.demo` to customize:

```bash
cp .env.demo.example .env.demo
# Edit as needed
docker-compose -f compose.demo.yml --env-file .env.demo up -d
```

## Demo Data

After reset, the environment includes:

- 3 sample deals (various statuses)
- 1 sample agent run
- Empty approvals table

## Stopping

```bash
# Stop containers (preserves data)
docker-compose -f compose.demo.yml down

# Stop and remove data
docker-compose -f compose.demo.yml down -v
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f compose.demo.yml logs

# Recreate from scratch
docker-compose -f compose.demo.yml down -v
docker-compose -f compose.demo.yml up -d --build
```

### Port conflicts
If ports 18091, 19100, or 13003 are in use, edit `compose.demo.yml` to use different ports.

### Data not appearing
```bash
# Re-seed data
./reset_demo.sh
```
