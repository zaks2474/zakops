# ZakOps API Overview

This document provides an overview of the ZakOps API.

## Introduction

The ZakOps API provides programmatic access to all ZakOps functionality. It follows RESTful conventions and returns JSON responses.

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:8090/api/v1` |
| Staging | `https://api.staging.zakops.example.com/api/v1` |
| Production | `https://api.zakops.example.com/api/v1` |

### API Versioning

The API is versioned using URL path versioning:
- Current version: `v1`
- Version included in URL: `/api/v1/...`

### Response Format

All responses are JSON with consistent structure:

**Success Response**:
```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-25T10:00:00Z"
  }
}
```

**Error Response**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [ ... ]
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-25T10:00:00Z"
  }
}
```

## Authentication

### Overview

The API uses Bearer token authentication. All requests must include an `Authorization` header.

### Getting a Token

Obtain tokens via the authentication endpoint:

```bash
POST /api/v1/auth/token
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

Response:
```json
{
  "data": {
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

### Using a Token

Include the token in all subsequent requests:

```bash
GET /api/v1/deals
Authorization: Bearer eyJ...
```

### Token Expiration

- Tokens expire after 1 hour
- Refresh tokens before expiration
- Invalid tokens return 401 Unauthorized

See [Authentication Guide](AUTH.md) for detailed information.

## Rate Limiting

| Tier | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Standard | 100 | 10,000 |
| Premium | 500 | 50,000 |

Rate limit headers included in responses:
- `X-RateLimit-Limit`: Max requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: When limit resets (Unix timestamp)

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

## Pagination

List endpoints support pagination:

```bash
GET /api/v1/deals?page=1&per_page=20
```

Response includes pagination metadata:
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

## Next Steps

- [Authentication](AUTH.md) - Detailed auth guide
- [Endpoints](ENDPOINTS.md) - API endpoint reference
