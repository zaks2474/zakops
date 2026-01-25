# Data Governance Overview

This document provides an overview of data governance practices for ZakOps.

## Purpose

Data governance ensures that data is managed consistently, securely, and in compliance with regulations. This framework covers data classification, retention, deletion, and access controls.

## Data Classification

ZakOps uses a four-tier classification system:

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| 1 | **Public** | Non-sensitive data that can be shared freely | API documentation, public product info |
| 2 | **Internal** | Business data for internal use only | Internal metrics, non-sensitive configs |
| 3 | **Confidential** | Sensitive business data requiring protection | Deal data, financial reports, audit logs |
| 4 | **Restricted** | Highly sensitive data with strict access controls | PII, credentials, API keys |

## Data Domains

| Domain | Owner | Classification | Retention |
|--------|-------|----------------|-----------|
| **Deals** | Backend Service | Confidential | 7 years |
| **Agent Runs** | Agent API | Internal | 90 days |
| **Approval Logs** | Backend Service | Confidential | 7 years |
| **User Sessions** | Auth Service | Internal | 30 days |
| **RAG Documents** | RAG Service | Varies | Per policy |
| **Audit Logs** | All Services | Confidential | 7 years |

## Key Policies

1. **Classification**: All data must be classified according to the tier system
2. **Retention**: Data must be retained and deleted per the retention policy
3. **Access Control**: Access must be based on least-privilege principle
4. **Encryption**: Confidential and Restricted data must be encrypted at rest
5. **PII Protection**: PII must be redacted from logs and traces

## Related Documents

- [Data Classification Guide](DATA_CLASSIFICATION.md)
- [Retention Policy](RETENTION_POLICY.yaml)
- [Deletion Policy](DELETION_POLICY.md)
- [Backup & Restore Policy](BACKUP_RESTORE_POLICY.md)
- [Tenant Isolation](TENANT_ISOLATION.md)
