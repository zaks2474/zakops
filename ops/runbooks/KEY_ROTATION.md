# Key Rotation Runbook

**Version:** 1.0.0
**Status:** P1-ENC-001 / P1-KEY-001 Implementation

## Purpose

This runbook describes the procedure for rotating the checkpoint encryption key
(`CHECKPOINT_ENCRYPTION_KEY`) used for at-rest encryption of checkpoint data.

## When to Rotate

Rotate the encryption key:
- Every 90 days (recommended)
- After any suspected key compromise
- When personnel with key access leave the organization
- Before production deployment of new key handling code

## Pre-Rotation Checklist

- [ ] Schedule rotation during low-traffic window
- [ ] Ensure backup of current encryption key
- [ ] Verify rollback procedure
- [ ] Notify relevant stakeholders

## Rotation Procedure

### Step 1: Generate New Key

```bash
# Generate new base64-encoded 32-byte key
NEW_KEY=$(python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())")
echo "New key generated (do not log in production!)"
```

### Step 2: Re-encrypt Existing Data

Before switching to the new key, re-encrypt existing checkpoint data:

```python
# Run this migration script
from app.core.encryption import CheckpointEncryption
import os
import base64

# Load current and new keys
old_key = base64.b64decode(os.environ["CHECKPOINT_ENCRYPTION_KEY"])
new_key = base64.b64decode(os.environ["NEW_CHECKPOINT_ENCRYPTION_KEY"])

old_crypto = CheckpointEncryption(old_key)
new_crypto = CheckpointEncryption(new_key)

# Re-encrypt checkpoint_blobs
# (Run via database migration or one-time script)
# SELECT id, blob FROM checkpoint_blobs;
# For each row:
#   plaintext = old_crypto.decrypt(blob)
#   new_ciphertext = new_crypto.encrypt(plaintext)
#   UPDATE checkpoint_blobs SET blob = new_ciphertext WHERE id = ...
```

### Step 3: Update Environment

```bash
# Update CHECKPOINT_ENCRYPTION_KEY to the new value
export CHECKPOINT_ENCRYPTION_KEY="$NEW_KEY"
```

### Step 4: Rolling Restart

Deploy the new key to all instances:

```bash
# For Docker deployments
docker compose down agent-api
# Update .env file with new key
docker compose up -d agent-api
```

### Step 5: Verify

```bash
# Run verification gate
./scripts/bring_up_tests.sh

# Check artifacts
cat gate_artifacts/encryption_verify.log
# Should contain: ENCRYPTION_VERIFY: PASSED
```

### Step 6: Secure Old Key Disposal

After confirming new key works:
1. Remove old key from all configuration
2. Securely delete old key backup (if temporary)
3. Document rotation in change log

## Rollback Procedure

If issues occur during rotation:

1. Stop all instances
2. Restore old `CHECKPOINT_ENCRYPTION_KEY`
3. Restart instances
4. Verify with gate tests

## Troubleshooting

### Decryption Failures

If decryption fails after rotation:
- Verify correct key is set
- Check for mixed encryption (some data with old key)
- Review migration script logs

### Application Refuses to Start

If `PRODUCTION_EXPOSURE=true` and key issues:
- Verify key is base64-encoded
- Verify key is exactly 32 bytes when decoded
- Check for trailing newlines in environment variable

## Audit Trail

Document each rotation:
- Date and time
- Reason for rotation
- Personnel involved
- Verification results

## Emergency Contacts

- Security team: [CONTACT]
- On-call engineer: [CONTACT]
- Platform team: [CONTACT]
