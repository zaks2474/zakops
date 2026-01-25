# OpenTelemetry Conventions for ZakOps

This document defines the OpenTelemetry semantic conventions used across all ZakOps services.

## Overview

ZakOps uses OpenTelemetry for distributed tracing and metrics collection. All services must follow these conventions to ensure consistent observability.

## Span Naming

### HTTP Spans
Format: `HTTP {METHOD} {ROUTE}`

Examples:
- `HTTP GET /api/v1/deals`
- `HTTP POST /api/v1/agent/invoke`

### Database Spans
Format: `DB {OPERATION} {TABLE}`

Examples:
- `DB SELECT deals`
- `DB INSERT audit_logs`

### Agent Spans
Format: `Agent {ACTION}`

Examples:
- `Agent invoke`
- `Agent tool_call`
- `Agent approval_request`

### LLM Spans
Format: `LLM {MODEL} {OPERATION}`

Examples:
- `LLM gpt-4 completion`
- `LLM claude-3 chat`

### Tool Spans
Format: `Tool {TOOL_NAME}`

Examples:
- `Tool calculate_price`
- `Tool send_email`

## Attributes

### HTTP Attributes
| Attribute | Type | Description |
|-----------|------|-------------|
| `http.method` | string | HTTP method (GET, POST, etc.) |
| `http.url` | string | Full request URL |
| `http.status_code` | int | HTTP response status code |
| `http.route` | string | Route template |
| `http.user_agent` | string | User agent string |

### Database Attributes
| Attribute | Type | Description |
|-----------|------|-------------|
| `db.system` | string | Database system (postgresql, sqlite) |
| `db.operation` | string | Database operation (SELECT, INSERT) |
| `db.statement` | string | SQL statement (sanitized) |
| `db.sql.table` | string | Target table name |

### LLM Attributes
| Attribute | Type | Description |
|-----------|------|-------------|
| `llm.model` | string | Model identifier |
| `llm.provider` | string | Provider (openai, anthropic, local) |
| `llm.prompt_tokens` | int | Input token count |
| `llm.completion_tokens` | int | Output token count |
| `llm.total_tokens` | int | Total token count |
| `llm.temperature` | float | Temperature setting |

### Agent Attributes
| Attribute | Type | Description |
|-----------|------|-------------|
| `agent.id` | string | Agent instance identifier |
| `agent.action` | string | Action being performed |
| `agent.tool_name` | string | Tool being invoked |
| `agent.requires_approval` | bool | Whether approval is required |
| `agent.approved_by` | string | Approver identifier |

## PII Protection

The following patterns are considered PII and must NOT be logged in traces:

- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- IP addresses

Use the `PII_PATTERNS` list in `packages/observability/otel_conventions.py` for validation.

## Usage Example

```python
from packages.observability.otel_conventions import (
    SpanNames,
    build_http_attributes,
    build_llm_attributes,
)

# Create a span name
span_name = SpanNames.http("GET", "/api/v1/deals")

# Build attributes
http_attrs = build_http_attributes(
    method="GET",
    url="/api/v1/deals",
    status_code=200,
    route="/api/v1/deals",
)
```
