#!/bin/sh
# Creates a consistent snapshot of the SQLite database.
# Requires the sqlite3 CLI so that WAL contents are included in the backup.
# Usage: sh scripts/backup-db.sh [db-path] [backup-dir]

set -e

DB_PATH="${1:-${DATABASE_URL#file:}}"
DB_PATH="${DB_PATH:-prisma/prisma/dev.db}"
BACKUP_DIR="${2:-backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/db-$STAMP.sqlite"

if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: database not found: $DB_PATH"
    exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "ERROR: sqlite3 CLI is required for a consistent WAL-safe backup."
    echo "       Install it (apt install sqlite3 / apk add sqlite) and retry."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# .backup takes a consistent snapshot including WAL frames.
sqlite3 "$DB_PATH" ".backup '$OUT'"

# Verify the snapshot is readable and not corrupt.
INTEGRITY=$(sqlite3 "$OUT" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
    echo "ERROR: backup integrity check failed: $INTEGRITY"
    rm -f "$OUT"
    exit 1
fi

gzip -f "$OUT"
OUT="$OUT.gz"

echo "backup written: $OUT"
echo "retention: keep at least one offsite copy — this script does not prune."
