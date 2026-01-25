# Data Classification Guide

This guide provides detailed information on how to classify data in ZakOps.

## Classification Levels

### Level 1: Public

Data that can be shared without restrictions.

**Characteristics:**
- No business impact if disclosed
- Intended for public consumption
- No access controls required

**Examples:**
- Public API documentation
- Marketing materials
- Open source code

### Level 2: Internal

Business data for internal use only.

**Characteristics:**
- Minor business impact if disclosed
- Should not be shared externally
- Basic access controls

**Examples:**
- Internal metrics
- Development documentation
- Non-sensitive configuration

### Level 3: Confidential

Sensitive business data requiring protection.

**Characteristics:**
- Significant business impact if disclosed
- Limited access on need-to-know basis
- Encryption required at rest and in transit

**Examples:**
- Deal information
- Financial reports
- Audit logs
- Customer business data

### Level 4: Restricted

Highly sensitive data with strict controls.

**Characteristics:**
- Severe impact if disclosed
- Strictly limited access
- Enhanced encryption and monitoring
- Special handling procedures

**Examples:**
- Personally Identifiable Information (PII)
- Authentication credentials
- API keys and secrets
- Payment information

## Handling Requirements

| Requirement | Public | Internal | Confidential | Restricted |
|-------------|--------|----------|--------------|------------|
| Encryption at Rest | Optional | Recommended | Required | Required |
| Encryption in Transit | Recommended | Required | Required | Required |
| Access Logging | Optional | Recommended | Required | Required |
| Access Review | Annual | Semi-annual | Quarterly | Monthly |
| Backup | Standard | Standard | Enhanced | Enhanced |
| Deletion Verification | No | No | Yes | Yes |

## PII Inventory

The following PII types are handled by ZakOps and classified as **Restricted**:

| PII Type | Location | Purpose | Retention |
|----------|----------|---------|-----------|
| Email Address | User profiles | Authentication, notifications | Account lifetime |
| Name | User profiles | Display | Account lifetime |
| IP Address | Logs | Security, debugging | 30 days |
| Session Tokens | Auth service | Authentication | Session duration |

## Classification Process

1. **Identify**: Determine the data type and contents
2. **Classify**: Apply the appropriate classification level
3. **Label**: Ensure systems and documentation reflect the classification
4. **Protect**: Apply required security controls
5. **Review**: Periodically review classifications
