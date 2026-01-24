# At-Rest Encryption for Checkpoint Data

**Version:** 1.0.0
**Status:** P1-ENC-001 Implementation

## Overview

The Agent API encrypts checkpoint data stored in PostgreSQL using AES-256-GCM
authenticated encryption. This protects sensitive workflow state including
pending approvals and tool arguments.

## Encrypted Tables

| Table              | Encryption Target      |
|--------------------|------------------------|
| `checkpoint_blobs` | Blob data (serialized) |
| `checkpoint_writes`| Write data (serialized)|

## Encryption Algorithm

- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **Nonce Size:** 96 bits (12 bytes)
- **Authentication:** Built-in GCM authentication tag

## Data Format

Encrypted data format:
```
MAGIC (4 bytes) || NONCE (12 bytes) || CIPHERTEXT+TAG (variable)
```

- **Magic Prefix:** `ENC1` (0x454E4331)
- **Nonce:** Random 12 bytes per encryption
- **Ciphertext:** Variable length encrypted data with 16-byte auth tag

## Configuration

### Environment Variable

```bash
CHECKPOINT_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

### Generating a Key

```bash
# Using Python
python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"

# Using OpenSSL
openssl rand -base64 32
```

### Production Requirements

When `PRODUCTION_EXPOSURE=true`:
- `CHECKPOINT_ENCRYPTION_KEY` **must** be set
- Application **refuses to start** if key is missing or invalid
- This implements fail-closed behavior per P1-KEY-001

## Migration Notes

### Existing Unencrypted Data

The system handles mixed encrypted/unencrypted data:
- Encrypted data is identified by magic prefix `ENC1`
- Unencrypted data is returned as-is (legacy compatibility)
- New writes are always encrypted when key is present

### Key Rotation

See [KEY_ROTATION.md](../runbooks/KEY_ROTATION.md) for key rotation procedures.

## Kill-9 Recovery

Encryption does not affect crash recovery:
- Checkpoints are persisted before encryption
- PostgreSQL transaction guarantees remain
- Recovery reads encrypted data and decrypts on load

## Security Considerations

1. **Key Storage:** Never commit keys to source control
2. **Key Rotation:** Rotate keys periodically (see runbook)
3. **Access Control:** Restrict access to encryption key
4. **Audit:** Key access should be logged in production

## Verification

Run the gate command to verify encryption:
```bash
./scripts/bring_up_tests.sh
```

Check artifacts:
- `gate_artifacts/encryption_verify.log` - `ENCRYPTION_VERIFY: PASSED`
- `gate_artifacts/kill9_encrypted.log` - `KILL9_ENCRYPTED: PASSED`
