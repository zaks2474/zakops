# API Authentication

This guide covers authentication for the ZakOps API.

## Getting Tokens

### Password Authentication

Exchange credentials for an access token:

```bash
curl -X POST https://api.zakops.example.com/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

Response:
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "dGhpcyBpcyBhIHJlZnJ..."
  }
}
```

### API Key Authentication

For service-to-service communication, use API keys:

```bash
curl -X GET https://api.zakops.example.com/api/v1/deals \
  -H "X-API-Key: your_api_key"
```

### Refresh Tokens

Refresh expired tokens without re-authenticating:

```bash
curl -X POST https://api.zakops.example.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "dGhpcyBpcyBhIHJlZnJ..."
  }'
```

## Using Tokens

### Bearer Token Format

Include the access token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Example Request

```bash
curl -X GET https://api.zakops.example.com/api/v1/deals \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json"
```

### Token Validation

Tokens are validated on every request:
- Signature verification
- Expiration check
- Permission verification

### Error Responses

**Invalid Token**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**Missing Token**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authorization header required"
  }
}
```

## Token Security

### Best Practices

1. **Never share tokens**: Tokens are sensitive credentials
2. **Use HTTPS**: Always use encrypted connections
3. **Short expiration**: Use short-lived tokens
4. **Secure storage**: Store tokens securely on client side
5. **Rotate regularly**: Refresh tokens periodically

### Token Contents

Access tokens contain (do not rely on internal structure):
- User identifier
- Permissions/roles
- Expiration time
- Issuer information

### Revoking Tokens

Revoke a token if compromised:

```bash
curl -X POST https://api.zakops.example.com/api/v1/auth/revoke \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

## Permissions

### Role-Based Access

Tokens carry role information:
- `viewer`: Read-only access
- `operator`: Standard operations
- `admin`: Full access

### Permission Errors

Insufficient permissions return 403:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this operation",
    "details": {
      "required": "admin",
      "current": "operator"
    }
  }
}
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 on valid token | Check token expiration |
| 403 on valid token | Verify permissions/roles |
| Token not accepted | Ensure "Bearer " prefix |
| Refresh fails | Request new token |
