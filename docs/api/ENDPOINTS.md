# API Endpoints Reference

This document lists all available API endpoints.

## Deals

### List Deals

```http
GET /api/v1/deals
```

Query parameters:
- `page` (int): Page number (default: 1)
- `per_page` (int): Items per page (default: 20, max: 100)
- `status` (string): Filter by status
- `sort` (string): Sort field (default: created_at)
- `order` (string): Sort order (asc/desc)

Response:
```json
{
  "data": [
    {
      "id": "deal_001",
      "title": "Q1 Contract",
      "status": "approved",
      "created_at": "2025-01-25T10:00:00Z",
      "updated_at": "2025-01-25T12:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

### Get Deal

```http
GET /api/v1/deals/{deal_id}
```

Response:
```json
{
  "data": {
    "id": "deal_001",
    "title": "Q1 Contract",
    "description": "Quarterly contract renewal",
    "status": "approved",
    "priority": "high",
    "created_by": "user_123",
    "created_at": "2025-01-25T10:00:00Z",
    "updated_at": "2025-01-25T12:00:00Z",
    "metadata": {}
  }
}
```

### Create Deal

```http
POST /api/v1/deals
```

Request body:
```json
{
  "title": "New Deal",
  "description": "Deal description",
  "priority": "medium",
  "metadata": {}
}
```

Response: Created deal object (201)

### Update Deal

```http
PATCH /api/v1/deals/{deal_id}
```

Request body (partial update):
```json
{
  "title": "Updated Title",
  "priority": "high"
}
```

Response: Updated deal object (200)

### Delete Deal

```http
DELETE /api/v1/deals/{deal_id}
```

Response: 204 No Content

## Agent

### Invoke Agent

```http
POST /api/v1/agent/invoke
```

Request body:
```json
{
  "deal_id": "deal_001",
  "action": "analyze",
  "parameters": {
    "depth": "detailed"
  }
}
```

Response:
```json
{
  "data": {
    "invocation_id": "inv_abc123",
    "status": "pending",
    "deal_id": "deal_001",
    "action": "analyze",
    "created_at": "2025-01-25T10:00:00Z"
  }
}
```

### Get Invocation Status

```http
GET /api/v1/agent/invocations/{invocation_id}
```

Response:
```json
{
  "data": {
    "invocation_id": "inv_abc123",
    "status": "completed",
    "result": {
      "analysis": "...",
      "recommendations": []
    },
    "created_at": "2025-01-25T10:00:00Z",
    "completed_at": "2025-01-25T10:05:00Z"
  }
}
```

### List Agent Actions

```http
GET /api/v1/agent/actions
```

Response:
```json
{
  "data": [
    {
      "name": "analyze",
      "description": "Analyze deal details",
      "requires_approval": false
    },
    {
      "name": "execute",
      "description": "Execute deal actions",
      "requires_approval": true
    }
  ]
}
```

## Approvals

### List Pending Approvals

```http
GET /api/v1/approvals?status=pending
```

### Approve Request

```http
POST /api/v1/approvals/{approval_id}/approve
```

Request body:
```json
{
  "comment": "Approved after review"
}
```

### Reject Request

```http
POST /api/v1/approvals/{approval_id}/reject
```

Request body:
```json
{
  "comment": "Rejected due to policy violation",
  "reason_code": "POLICY_VIOLATION"
}
```

## Health

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-25T10:00:00Z"
}
```

### Detailed Health

```http
GET /health/detailed
```

Response:
```json
{
  "status": "healthy",
  "components": {
    "database": "healthy",
    "cache": "healthy",
    "agent": "healthy"
  }
}
```
