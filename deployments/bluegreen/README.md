# Blue/Green Deployment

Zero-downtime deployment using Traefik reverse proxy for atomic traffic switching.

## Architecture

```
                    ┌─────────────┐
    Internet ──────►│   Traefik   │
                    │   (Proxy)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │   Blue   │ │  Green   │ │  Shared  │
        │  Stack   │ │  Stack   │ │ Services │
        └──────────┘ └──────────┘ └──────────┘
```

## Ports

| Service           | Blue Port | Green Port |
|-------------------|-----------|------------|
| Deal Lifecycle API| 8091      | 8092       |
| MCP Server        | 9100      | 9101       |
| Dashboard         | 3003      | 3004       |

## Shared Services

- PostgreSQL: 5432 (single instance, persistent)
- Redis: 6379 (single instance)

## Usage

### Start Blue Stack (Default)
```bash
docker-compose -f compose.blue.yml up -d
./verify.sh blue
```

### Start Green Stack
```bash
docker-compose -f compose.green.yml up -d
./verify.sh green
```

### Switch Traffic
```bash
# Switch to green
./switch.sh green

# Rollback to blue
./switch.sh blue
```

### Full Deployment Flow
```bash
# 1. Blue is running, deploy new version to green
docker-compose -f compose.green.yml up -d --build

# 2. Verify green is healthy
./verify.sh green

# 3. Switch traffic to green
./switch.sh green

# 4. Verify production is healthy
./verify.sh production

# 5. Stop blue (optional, keep for quick rollback)
# docker-compose -f compose.blue.yml down
```

## Rollback

Rollback is instant (< 60 seconds):

```bash
./switch.sh blue
```

## Health Checks

The `verify.sh` script runs:
1. Container health checks
2. API health endpoint checks
3. Approval lifecycle smoke test
4. Dashboard HTTP check

## Files

- `compose.blue.yml` - Blue stack definition
- `compose.green.yml` - Green stack definition
- `proxy.yml` - Traefik reverse proxy
- `switch.sh` - Traffic switching script
- `verify.sh` - Health verification script
- `traefik-dynamic/routing.yml` - Dynamic routing configuration
