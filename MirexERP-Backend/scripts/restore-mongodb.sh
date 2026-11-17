#!/usr/bin/env bash
set -euo pipefail
: "${MONGODB_URI:?Set MONGODB_URI in the environment}"
ARCHIVE="${1:?Usage: restore-mongodb.sh <backup.archive.gz> --confirm-destructive-restore}"
CONFIRM="${2:-}"
if [[ "$CONFIRM" != "--confirm-destructive-restore" ]]; then
  echo "Restore can overwrite existing collections. Re-run with --confirm-destructive-restore." >&2
  exit 2
fi
command -v mongorestore >/dev/null 2>&1 || { echo "mongorestore is required (MongoDB Database Tools)." >&2; exit 1; }
[[ -f "$ARCHIVE" ]] || { echo "Backup archive not found: $ARCHIVE" >&2; exit 1; }
mongorestore --uri="$MONGODB_URI" --archive="$ARCHIVE" --gzip --drop
echo "Restore command completed. Verify indexes, counts and application workflows before reopening traffic."
