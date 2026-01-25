#!/bin/bash
# Database Restore Script
# Restores a PostgreSQL backup with verification

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

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
    echo "Usage: $0 --input BACKUP_DIR [options]"
    echo ""
    echo "Options:"
    echo "  -i, --input DIR    Backup directory to restore from (required)"
    echo "  --target-db NAME   Target database name (default: ${DB_NAME})"
    echo "  --drop-existing    Drop existing database before restore"
    echo "  --dry-run          Show what would be done without executing"
    echo "  -h, --help         Show this help"
    exit 0
}

BACKUP_PATH=""
DROP_EXISTING=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            BACKUP_PATH="$2"
            shift 2
            ;;
        --target-db)
            DB_NAME="$2"
            shift 2
            ;;
        --drop-existing)
            DROP_EXISTING=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
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

if [[ -z "${BACKUP_PATH}" ]]; then
    log_error "Backup path is required"
    usage
fi

if [[ ! -d "${BACKUP_PATH}" ]]; then
    log_error "Backup directory not found: ${BACKUP_PATH}"
    exit 1
fi

log_info "=========================================="
log_info "ZakOps Database Restore"
log_info "=========================================="
log_info "Source: ${BACKUP_PATH}"
log_info "Target: ${DB_NAME}@${DB_HOST}:${DB_PORT}"

# Step 1: Verify backup integrity
log_info "Step 1: Verifying backup integrity..."
CHECKSUM_FILE="${BACKUP_PATH}/checksums.sha256"
if [[ -f "${CHECKSUM_FILE}" ]]; then
    (
        cd "${BACKUP_PATH}"
        if sha256sum -c checksums.sha256 > /dev/null 2>&1; then
            log_info "Checksum verification passed"
        else
            log_error "Checksum verification failed!"
            exit 1
        fi
    )
else
    log_warn "No checksum file found, skipping verification"
fi

# Step 2: Read manifest
log_info "Step 2: Reading manifest..."
MANIFEST_FILE="${BACKUP_PATH}/manifest.json"
if [[ -f "${MANIFEST_FILE}" ]]; then
    BACKUP_NAME=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['backup_name'])" 2>/dev/null || echo "unknown")
    BACKUP_TIME=$(python3 -c "import json; print(json.load(open('${MANIFEST_FILE}'))['timestamp'])" 2>/dev/null || echo "unknown")
    log_info "Backup: ${BACKUP_NAME} from ${BACKUP_TIME}"
else
    log_warn "No manifest found"
fi

# Determine dump file
DUMP_FILE="${BACKUP_PATH}/database.sql"
COMPRESSED_FILE="${BACKUP_PATH}/database.sql.gz"

if [[ ! -f "${DUMP_FILE}" ]] && [[ -f "${COMPRESSED_FILE}" ]]; then
    log_info "Decompressing backup..."
    gunzip -k "${COMPRESSED_FILE}"
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
    log_error "No database dump found"
    exit 1
fi

# Dry run check
if [[ "${DRY_RUN}" == "true" ]]; then
    log_info "DRY RUN - would restore ${DUMP_FILE} to ${DB_NAME}"
    log_info "Dump file size: $(du -h "${DUMP_FILE}" | cut -f1)"
    exit 0
fi

export PGPASSWORD="${DB_PASSWORD}"

# Step 3: Drop existing database (if requested)
if [[ "${DROP_EXISTING}" == "true" ]]; then
    log_warn "Step 3: Dropping existing database..."
    if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
        "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null; then
        log_info "Database dropped"
    else
        docker exec zakops-postgres psql -U "${DB_USER}" -d postgres -c \
            "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
    fi

    # Recreate database
    log_info "Creating fresh database..."
    if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c \
        "CREATE DATABASE ${DB_NAME};" 2>/dev/null; then
        log_info "Database created"
    else
        docker exec zakops-postgres psql -U "${DB_USER}" -d postgres -c \
            "CREATE DATABASE ${DB_NAME};" 2>/dev/null || true
    fi
fi

# Step 4: Restore database
log_info "Step 4: Restoring database..."
RESTORE_START=$(date +%s)

if psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    < "${DUMP_FILE}" > /dev/null 2>&1; then
    log_info "Direct restore completed"
else
    log_warn "Direct connection failed, trying via Docker..."
    if docker exec -i zakops-postgres psql -U "${DB_USER}" -d "${DB_NAME}" \
        < "${DUMP_FILE}" > /dev/null 2>&1; then
        log_info "Docker restore completed"
    else
        log_error "Failed to restore database"
        exit 1
    fi
fi

RESTORE_DURATION=$(($(date +%s) - RESTORE_START))
log_info "Restore completed in ${RESTORE_DURATION}s"

# Step 5: Verify restore
log_info "Step 5: Running verification..."
"${SCRIPT_DIR}/verify.sh" --quick

log_info "=========================================="
log_info "Restore Complete"
log_info "=========================================="
log_info "Database ${DB_NAME} restored from ${BACKUP_PATH}"
