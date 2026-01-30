# ArtifactStore Abstraction Layer
# Phase 4: Storage Backend Abstraction
#
# Provides pluggable storage backends for artifacts:
# - LocalFilesystemArtifactStore (default)
# - S3ArtifactStore (optional, for cloud deployments)

from .base import ArtifactMetadata, ArtifactStore, StorageBackend
from .factory import get_artifact_store
from .local import LocalFilesystemArtifactStore
from .s3 import S3ArtifactStore

__all__ = [
    "ArtifactStore",
    "ArtifactMetadata",
    "StorageBackend",
    "LocalFilesystemArtifactStore",
    "S3ArtifactStore",
    "get_artifact_store",
]
