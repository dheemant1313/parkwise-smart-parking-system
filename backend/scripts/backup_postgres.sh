#!/usr/bin/env bash
# ==============================================================================
# PARKWISE POSTGRESQL AUTOMATED BACKUP & RETENTION SCRIPT
# Automated transactional backup with gzip compression and 30-day retention
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-parkwise}"
POSTGRES_DB="${POSTGRES_DB:-parkwise_db}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="${POSTGRES_DB}_backup_${TIMESTAMP}.sql.gz"
TARGET_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting automated backup of ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}..."

# Execute pg_dump with gzip compression and custom schema integrity
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=custom \
    --no-owner \
    --no-privileges \
    | gzip -9 > "${TARGET_PATH}"

BACKUP_SIZE=$(du -h "${TARGET_PATH}" | cut -f1)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup successful! File: ${TARGET_PATH} (Size: ${BACKUP_SIZE})"

# Prune archives older than retention threshold
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "${POSTGRES_DB}_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -vf {} \;

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup cycle completed successfully."
