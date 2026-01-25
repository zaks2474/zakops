# Audit Logs

This guide explains how to use and interpret audit logs in ZakOps.

## Overview

Audit logs provide a complete record of all actions taken in ZakOps, supporting compliance, troubleshooting, and security investigations.

### What's Logged

- User authentication events
- Deal lifecycle changes
- Agent actions and decisions
- Approval requests and decisions
- Configuration changes
- API access
- Security events

## Viewing Logs

### Access the Audit Log Viewer

1. Navigate to **Admin > Audit Logs**
2. Default view shows recent entries
3. Use filters to narrow results

### Log Entry Structure

Each entry contains:

| Field | Description |
|-------|-------------|
| `timestamp` | When the event occurred (UTC) |
| `actor` | Who performed the action |
| `action` | What action was taken |
| `resource` | What was affected |
| `outcome` | Success or failure |
| `context` | Additional details |

### Filtering Options

- **Date Range**: Specify start and end dates
- **Actor**: Filter by user or system
- **Action Type**: e.g., create, update, delete
- **Resource Type**: e.g., deal, approval, user
- **Outcome**: Success or failure

### Example Entries

**User Login**:
```
2025-01-25T10:00:00Z | user:alice | auth:login | session:abc123 | success
```

**Deal Created**:
```
2025-01-25T10:15:00Z | user:alice | deal:create | deal:deal-001 | success | {"title": "New Deal"}
```

**Agent Action Approved**:
```
2025-01-25T10:20:00Z | user:bob | approval:approve | approval:apr-001 | success | {"agent_action": "send_email"}
```

## Searching Logs

### Basic Search

Enter keywords in the search box to find matching entries.

### Advanced Search

Use structured queries:
```
actor:alice AND action:deal:* AND outcome:success
```

### Saved Searches

Save frequently used searches for quick access:
1. Perform a search
2. Click "Save Search"
3. Give it a name
4. Access from "Saved Searches" menu

## Exporting Logs

### Export Options

- **CSV**: For spreadsheet analysis
- **JSON**: For programmatic processing
- **PDF**: For reporting

### Export Procedure

1. Apply desired filters
2. Click "Export"
3. Select format
4. Download file

### Compliance Exports

For compliance purposes, use the compliance export feature:
1. Navigate to **Admin > Compliance > Export**
2. Select report type
3. Specify date range
4. Generate and download

## Retention

Audit logs are retained according to the data retention policy:
- Standard logs: 90 days online, 7 years archived
- Security events: 7 years online
- Compliance logs: Per regulatory requirement

## Integration

### API Access

Access logs programmatically via the API:
```bash
GET /api/v1/audit-logs?from=2025-01-01&to=2025-01-25
```

### SIEM Integration

Export logs to external SIEM systems:
- Configure SIEM connector in Admin settings
- Logs forwarded in real-time
- Supports common formats (CEF, LEEF, JSON)
