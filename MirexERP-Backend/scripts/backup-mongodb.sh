#!/usr/bin/env bash
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI in the environment}"
command -v mongodump >/dev/null 2>&1 || { echo "mongodump is required (MongoDB Database Tools)." >&2; exit 1; }
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/mirexerp-$STAMP.archive.gz"
mongodump --uri="$MONGODB_URI" --archive="$OUT" --gzip
chmod 600 "$OUT"
echo "Backup created: $OUT"
