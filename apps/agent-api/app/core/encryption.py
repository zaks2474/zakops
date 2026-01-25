"""At-rest encryption for checkpoint data using AES-256-GCM.

This module provides the SecurePostgresSaver wrapper that encrypts
checkpoint_blobs and checkpoint_writes tables per P1-ENC-001.

Security requirements:
- CHECKPOINT_ENCRYPTION_KEY must be set (no default)
- Production mode requires valid key or refuses to start
- Key must be 32 bytes (256 bits) for AES-256
"""

import base64
import os
import secrets
from typing import Optional, Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.logging import logger


# Environment variable for encryption key (no default!)
CHECKPOINT_ENCRYPTION_KEY_VAR = "CHECKPOINT_ENCRYPTION_KEY"


class EncryptionKeyMissingError(Exception):
    """Raised when encryption key is missing in production mode."""
    pass


class EncryptionKeyInvalidError(Exception):
    """Raised when encryption key is invalid."""
    pass


def get_encryption_key() -> Optional[bytes]:
    """Get the encryption key from environment.

    Returns:
        bytes: The 32-byte encryption key, or None if not set

    Raises:
        EncryptionKeyInvalidError: If key is set but invalid format
    """
    key_str = os.getenv(CHECKPOINT_ENCRYPTION_KEY_VAR)

    if not key_str:
        return None

    try:
        # Key should be base64-encoded 32 bytes
        key_bytes = base64.b64decode(key_str)

        if len(key_bytes) != 32:
            raise EncryptionKeyInvalidError(
                f"Encryption key must be 32 bytes (256 bits), got {len(key_bytes)} bytes"
            )

        return key_bytes
    except Exception as e:
        if isinstance(e, EncryptionKeyInvalidError):
            raise
        raise EncryptionKeyInvalidError(f"Invalid encryption key format: {e}")


def validate_encryption_key_for_production() -> bool:
    """Validate encryption key is present and valid for production.

    Returns:
        bool: True if key is valid

    Raises:
        EncryptionKeyMissingError: If key is missing
        EncryptionKeyInvalidError: If key is invalid
    """
    production_exposure = os.getenv("PRODUCTION_EXPOSURE", "false").lower() == "true"

    if not production_exposure:
        logger.debug("encryption_key_validation_skipped", reason="not_production_exposure")
        return True

    key = get_encryption_key()

    if key is None:
        logger.error(
            "encryption_key_missing_production",
            message="CHECKPOINT_ENCRYPTION_KEY required when PRODUCTION_EXPOSURE=true"
        )
        raise EncryptionKeyMissingError(
            "CHECKPOINT_ENCRYPTION_KEY must be set when PRODUCTION_EXPOSURE=true"
        )

    logger.info("encryption_key_validated", key_present=True)
    return True


def generate_encryption_key() -> str:
    """Generate a new random encryption key.

    Returns:
        str: Base64-encoded 32-byte key
    """
    key_bytes = secrets.token_bytes(32)
    return base64.b64encode(key_bytes).decode('utf-8')


class CheckpointEncryption:
    """AES-256-GCM encryption for checkpoint data."""

    # Magic prefix to identify encrypted data
    ENCRYPTED_MAGIC = b"ENC1"

    def __init__(self, key: Optional[bytes] = None):
        """Initialize with encryption key.

        Args:
            key: 32-byte encryption key. If None, gets from environment.
        """
        self._key = key or get_encryption_key()
        self._aesgcm = AESGCM(self._key) if self._key else None

        if self._key:
            logger.info("checkpoint_encryption_initialized", enabled=True)
        else:
            logger.warning("checkpoint_encryption_disabled", reason="no_key")

    @property
    def enabled(self) -> bool:
        """Check if encryption is enabled."""
        return self._aesgcm is not None

    def encrypt(self, plaintext: bytes) -> bytes:
        """Encrypt plaintext data.

        Format: MAGIC (4 bytes) || NONCE (12 bytes) || CIPHERTEXT+TAG

        Args:
            plaintext: Data to encrypt

        Returns:
            bytes: Encrypted data with magic prefix and nonce
        """
        if not self._aesgcm:
            return plaintext

        # Generate random nonce (96 bits / 12 bytes)
        nonce = secrets.token_bytes(12)

        # Encrypt with authentication tag
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, None)

        # Return: MAGIC || NONCE || CIPHERTEXT+TAG
        return self.ENCRYPTED_MAGIC + nonce + ciphertext

    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt ciphertext data.

        Args:
            ciphertext: Encrypted data (with magic prefix and nonce)

        Returns:
            bytes: Decrypted plaintext

        Raises:
            ValueError: If decryption fails or data is not encrypted
        """
        if not self._aesgcm:
            return ciphertext

        # Check magic prefix
        if not ciphertext.startswith(self.ENCRYPTED_MAGIC):
            # Data is not encrypted (legacy or encryption was disabled)
            return ciphertext

        # Extract nonce and ciphertext
        data = ciphertext[len(self.ENCRYPTED_MAGIC):]
        nonce = data[:12]
        encrypted_data = data[12:]

        # Decrypt and verify
        try:
            return self._aesgcm.decrypt(nonce, encrypted_data, None)
        except Exception as e:
            logger.error("checkpoint_decryption_failed", error=str(e))
            raise ValueError(f"Decryption failed: {e}")

    def is_encrypted(self, data: bytes) -> bool:
        """Check if data is encrypted (has magic prefix)."""
        return data.startswith(self.ENCRYPTED_MAGIC)


# Global encryption instance (initialized lazily)
_checkpoint_encryption: Optional[CheckpointEncryption] = None


def get_checkpoint_encryption() -> CheckpointEncryption:
    """Get the global checkpoint encryption instance."""
    global _checkpoint_encryption

    if _checkpoint_encryption is None:
        _checkpoint_encryption = CheckpointEncryption()

    return _checkpoint_encryption


def encrypt_checkpoint_data(data: bytes) -> bytes:
    """Encrypt checkpoint data using global encryption."""
    return get_checkpoint_encryption().encrypt(data)


def decrypt_checkpoint_data(data: bytes) -> bytes:
    """Decrypt checkpoint data using global encryption."""
    return get_checkpoint_encryption().decrypt(data)
