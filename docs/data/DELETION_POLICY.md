# Data Deletion Policy

This document defines the data deletion procedures for ZakOps.

## Overview

Data deletion is a critical component of data governance. This policy ensures data is properly disposed of when no longer needed, in compliance with retention policies and regulatory requirements.

## Deletion Methods

### Standard Deletion

Used for Internal and Public data:
- Database records removed via DELETE statements
- File system files removed via standard OS deletion
- Backup copies aged out per backup retention

### Secure Deletion

Used for Confidential and Restricted data:
- Database records overwritten before deletion
- File system files securely wiped (multi-pass overwrite)
- Backup copies explicitly purged
- Deletion verified and logged

## Automated Deletion

The following data types are automatically deleted based on retention policy:

| Data Type | Retention | Deletion Method | Schedule |
|-----------|-----------|-----------------|----------|
| User Sessions | 30 days | Standard | Daily |
| Agent Runs | 90 days | Standard | Weekly |
| Archived Deals | 7 years | Secure | Monthly |
| Approval Logs | 7 years | Secure | Monthly |

## Manual Deletion Requests

### Data Subject Requests (DSR)

1. Request received and verified
2. Data located across all systems
3. Deletion executed (within 30 days SLA)
4. Confirmation sent to requestor
5. Deletion logged for audit

### Business-Initiated Deletion

1. Deletion request submitted with justification
2. Approval from data owner
3. Deletion executed
4. Verification performed
5. Audit log updated

## Deletion Verification

All secure deletions must be verified:

1. **Pre-deletion snapshot**: Record what will be deleted
2. **Execute deletion**: Perform the deletion operation
3. **Post-deletion check**: Verify data is not retrievable
4. **Audit entry**: Log the deletion with details

## Exceptions

Some data may be exempt from deletion:
- Active legal holds
- Ongoing investigations
- Regulatory requirements
- Contractual obligations

Exemptions must be documented and periodically reviewed.

## Audit Trail

All deletions are logged with:
- Timestamp
- Data type and scope
- Deletion method used
- Operator/system identifier
- Verification status
