# Tenant Isolation

This document describes tenant isolation in ZakOps.

## Overview

ZakOps currently operates in **single-tenant mode**, where each deployment serves a single organization. This simplifies data isolation while allowing future multi-tenant capabilities.

## Single-Tenant Mode

### Current Architecture

In single-tenant mode:
- One database instance per deployment
- One application instance per deployment
- Complete data isolation by infrastructure
- No tenant ID filtering required

### Benefits
- Simplified security model
- Complete data isolation
- Independent scaling
- Customizable per-tenant

### Configuration

Single-tenant mode requires no special configuration. Each deployment is isolated at the infrastructure level:

```yaml
# Environment configuration
TENANT_MODE: single
DATABASE_URL: postgresql://localhost/zakops
```

## Future Multi-Tenant Considerations

When multi-tenant mode is implemented, the following patterns will be used:

### Database-Level Isolation

Option 1: Separate Databases
- Each tenant gets a dedicated database
- Connection routing based on tenant ID
- Complete isolation, higher resource usage

Option 2: Schema-Level Separation
- Shared database, separate schemas
- Tenant ID in connection context
- Good isolation, moderate resources

Option 3: Row-Level Security
- Shared tables with tenant_id column
- PostgreSQL RLS policies enforce isolation
- Efficient resources, requires careful implementation

### API-Level Isolation

- Tenant ID extracted from authentication token
- All queries scoped to tenant
- Cross-tenant access blocked by middleware

### Recommended Pattern

For ZakOps, the recommended pattern when moving to multi-tenant is:
1. Schema-level separation for primary isolation
2. Row-level security as defense-in-depth
3. Tenant context propagated in request lifecycle

## Testing Isolation

Even in single-tenant mode, isolation tests verify:
1. Database connections are scoped correctly
2. No hardcoded cross-environment access
3. Configuration properly isolates instances

Run isolation tests:
```bash
pytest apps/backend/tests/security/test_tenant_isolation.py
```

## Configuration Reference

| Setting | Description | Default |
|---------|-------------|---------|
| `TENANT_MODE` | Operating mode (single/multi) | single |
| `TENANT_ID` | Current tenant identifier | default |
| `ENFORCE_TENANT_ISOLATION` | Enable isolation checks | true |
