#!/bin/sh
# Creates a consistent snapshot of the SQLite database.
# Usage: sh scripts/backup-db.sh [db-path] [backup-dir]

set -e

DB_PATH="${1:-prisma/prisma/dev.db}"
BACKUP_DIR="${2:-backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/db-$STAMP.sqlite"

if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: database not found: $DB_PATH"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$OUT'"
else
    cp "$DB_PATH" "$OUT"
fi

echo "backup written: $OUT"
