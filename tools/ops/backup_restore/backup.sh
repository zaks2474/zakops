#!/bin/bash
# Database Backup Script
# Creates a PostgreSQL backup with checksums and manifest

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="zakops_backup_${TIMESTAMP}"

# Database connection (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-zakops}"
DB_NAME="${DB_NAME:-zakops}"
DB_PASSWORD="${DB_PASSWORD:-zakops}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -o, --output DIR   Output directory (default: ${BACKUP_DIR})"
    echo "  -n, --name NAME    Backup name prefix (default: zakops_backup)"
    echo "  -h, --help         Show this help"
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -n|--name)
            BACKUP_NAME="$2_${TIMESTAMP}"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Create backup directory
mkdir -p "${BACKUP_DIR}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "${BACKUP_PATH}"

log_info "=========================================="
log_info "ZakOps Database Backup"
log_info "=========================================="
log_info "Output: ${BACKUP_PATH}"
log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Step 1: Create pg_dump
log_info "Step 1: Creating database dump..."
DUMP_FILE="${BACKUP_PATH}/database.sql"

export PGPASSWORD="${DB_PASSWORD}"

if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    > "${DUMP_FILE}" 2>/dev/null; then
    log_info "Database dump created: $(du -h "${DUMP_FILE}" | cut -f1)"
else
    # Try via docker if direct connection fails
    log_warn "Direct connection failed, trying via Docker..."
    if docker exec zakops-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" \
        --format=plain --no-owner --no-privileges > "${DUMP_FILE}" 2>/dev/null; then
        log_info "Database dump created via Docker: $(du -h "${DUMP_FILE}" | cut -f1)"
    else
        log_error "Failed to create database dump"
        exit 1
    fi
fi

# Step 2: Create compressed version
log_info "Step 2: Compressing backup..."
COMPRESSED_FILE="${BACKUP_PATH}/database.sql.gz"
gzip -c "${DUMP_FILE}" > "${COMPRESSED_FILE}"
log_info "Compressed: $(du -h "${COMPRESSED_FILE}" | cut -f1)"

# Step 3: Generate checksums
log_info "Step 3: Generating checksums..."
CHECKSUM_FILE="${BACKUP_PATH}/checksums.sha256"
(
    cd "${BACKUP_PATH}"
    sha256sum database.sql database.sql.gz > checksums.sha256
)
log_info "Checksums generated"

# Step 4: Create manifest
log_info "Step 4: Creating manifest..."
MANIFEST_FILE="${BACKUP_PATH}/manifest.json"

# Get table counts
TABLE_COUNTS=""
if command -v psql &> /dev/null; then
    TABLE_COUNTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "
        SELECT json_object_agg(table_name, row_count) FROM (
            SELECT table_name, n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY table_name
        ) t;
    " 2>/dev/null || echo "{}")
else
    TABLE_COUNTS=$(docker exec zakops-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "
        SELECT json_object_agg(table_name, row_count) FROM (
            SELECT table_name, n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY table_name
        ) t;
    " 2>/dev/null || echo "{}")
fi

cat > "${MANIFEST_FILE}" << EOF
{
  "backup_name": "${BACKUP_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": {
    "host": "${DB_HOST}",
    "port": ${DB_PORT},
    "name": "${DB_NAME}",
    "user": "${DB_USER}"
  },
  "files": {
    "dump": "database.sql",
    "compressed": "database.sql.gz",
    "checksums": "checksums.sha256"
  },
  "sizes": {
    "dump_bytes": $(stat -f%z "${DUMP_FILE}" 2>/dev/null || stat -c%s "${DUMP_FILE}"),
    "compressed_bytes": $(stat -f%z "${COMPRESSED_FILE}" 2>/dev/null || stat -c%s "${COMPRESSED_FILE}")
  },
  "table_counts": ${TABLE_COUNTS:-"{}"},
  "version": "1.0"
}
EOF

log_info "Manifest created"

# Step 5: Verify backup
log_info "Step 5: Verifying backup..."
(
    cd "${BACKUP_PATH}"
    if sha256sum -c checksums.sha256 > /dev/null 2>&1; then
        log_info "Checksum verification passed"
    else
        log_error "Checksum verification failed!"
        exit 1
    fi
)

# Summary
log_info "=========================================="
log_info "Backup Complete"
log_info "=========================================="
log_info "Location: ${BACKUP_PATH}"
log_info "Files:"
ls -lh "${BACKUP_PATH}"

echo ""
echo "To restore this backup:"
echo "  ./restore.sh --input ${BACKUP_PATH}"
