# ZakOps Agent API Threat Model

**Version:** 1.0
**Last Updated:** 2026-01-25
**Author:** Security Team

## Executive Summary

This document describes the threat model for the ZakOps Agent API, a human-in-the-loop (HITL) workflow system that enables AI agents to perform critical business operations with human approval.

## System Overview

### Components

1. **Agent API (FastAPI)** - REST API handling agent invocations and approvals
2. **LangGraph Agent** - AI agent processing user requests
3. **PostgreSQL Database** - Stores approvals, audit logs, tool executions
4. **Cloudflare Tunnel** - External access and DDoS protection
5. **Dashboard (Next.js)** - User interface for approval management

### Data Flow

```
User -> Dashboard -> Agent API -> LangGraph Agent
                          |
                          v
                    PostgreSQL
                          |
                          v
                   Audit Logs
```

## Trust Boundaries

| Boundary | Description | Controls |
|----------|-------------|----------|
| External -> Cloudflare | Internet traffic | WAF, rate limiting, TLS |
| Cloudflare -> Agent API | Authenticated tunnel | Tunnel validation |
| Agent API -> Database | Internal network | Connection pooling, encryption |
| User -> API | Authentication | JWT with iss/aud/role |

## STRIDE Analysis

### Spoofing

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| JWT token theft | High | Short expiration, HTTPS only | Mitigated |
| Actor ID spoofing | High | Bind actor_id to JWT subject | Mitigated |
| Session hijacking | High | Secure token storage | Mitigated |

### Tampering

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| Request modification | High | TLS encryption | Mitigated |
| Database manipulation | Critical | Parameterized queries | Mitigated |
| Audit log tampering | High | Append-only design | Mitigated |

### Repudiation

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| Denial of approval actions | Medium | Comprehensive audit logging | Mitigated |
| Actor attribution | Medium | JWT subject binding | Mitigated |

### Information Disclosure

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| PII exposure in logs | High | Structured logging, no PII | Mitigated |
| LLM output leakage | Medium | Output sanitization | Mitigated |
| Error message disclosure | Low | Generic error responses | Mitigated |

### Denial of Service

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| API flooding | High | Rate limiting (slowapi) | Mitigated |
| Resource exhaustion | Medium | Request size limits | Mitigated |
| LLM abuse | High | Token limits, HITL gates | Mitigated |

### Elevation of Privilege

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| Role escalation | Critical | RBAC enforcement | Mitigated |
| Approval bypass | Critical | Atomic claiming, HITL | Mitigated |
| Admin access theft | Critical | Role hierarchy checks | Mitigated |

## Data Classification

### Sensitive Data

| Data Type | Classification | Storage | Protection |
|-----------|---------------|---------|------------|
| JWT Tokens | Secret | Memory only | Not persisted |
| JWT Secret Key | Secret | Environment variable | Not in code |
| Approval records | Internal | PostgreSQL | Encrypted at rest |
| Audit logs | Internal | PostgreSQL | Append-only |
| User messages | PII potential | Memory, logs (sanitized) | Sanitization |

### PII Handling

1. User messages may contain PII - sanitized before logging
2. Actor IDs stored for audit purposes
3. No passwords stored (JWT-based auth)
4. LLM outputs sanitized before response

## Attack Scenarios

### Scenario 1: Unauthorized Approval

**Attack:** Attacker attempts to approve critical action without authorization

**Mitigations:**
1. JWT required with APPROVER role
2. Actor_id bound to JWT subject
3. Atomic claiming prevents race conditions
4. Audit log records all actions

### Scenario 2: LLM Prompt Injection

**Attack:** Malicious input attempts to manipulate LLM behavior

**Mitigations:**
1. HITL gate for critical operations
2. Output sanitization
3. Tool argument validation
4. Human review required

### Scenario 3: Replay Attack

**Attack:** Attacker captures and replays approval request

**Mitigations:**
1. Idempotency keys per tool execution
2. Approval status transitions are atomic
3. JWT expiration enforced

## Security Controls Summary

| Control | Implementation | Test Coverage |
|---------|---------------|---------------|
| Authentication | JWT with iss/aud/role | test_rbac_coverage.py |
| Authorization | RBAC hierarchy | test_rbac_coverage.py |
| Rate Limiting | slowapi middleware | test_rate_limits.py |
| Input Validation | Pydantic schemas | Schema tests |
| Output Sanitization | security/output_validation.py | test_output_sanitization.py |
| Audit Logging | AuditLog model | Integration tests |
| Supply Chain | pip-audit, trivy | security_scan.sh |

## Residual Risks

1. **LLM Hallucination** - Mitigated by HITL but not eliminated
2. **Zero-day vulnerabilities** - Regular security scans
3. **Insider threats** - Audit logging for detection

## Review Schedule

- Quarterly threat model review
- After significant architecture changes
- Following security incidents
