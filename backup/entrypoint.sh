#!/bin/sh
set -eu

# Real backup logic (phase 5) — replaces the phase-0 no-op stub. See
# docs/adr/0004 for why this service's compose topology existed from
# commit 1, and docs/adr/0006 for why this container runs as root (needs
# reliable write access to a volume of unpredictable host-side ownership
# under rootless Podman — unlike backend/frontend, which only ever write
# inside their own build-time-created directories).

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
DAILY_KEEP="${BACKUP_DAILY_KEEP:-7}"
WEEKLY_KEEP="${BACKUP_WEEKLY_KEEP:-4}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

export PGPASSWORD="$POSTGRES_PASSWORD"

prune() {
    dir="$1"
    keep="$2"
    count=$(find "$dir" -maxdepth 1 -type f | wc -l)
    if [ "$count" -gt "$keep" ]; then
        ls -1t "$dir" | tail -n "+$((keep + 1))" | while read -r old; do
            rm -f "$dir/$old"
        done
    fi
}

run_backup() {
    timestamp=$(date +%Y%m%d-%H%M%S)
    dump_file="$DAILY_DIR/socialtrace-$timestamp.sql.gz"
    echo "[$(date -Iseconds)] starting backup -> $dump_file"

    if pg_dump -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" | gzip > "$dump_file.tmp"; then
        mv "$dump_file.tmp" "$dump_file"
        echo "[$(date -Iseconds)] backup complete: $(du -h "$dump_file" | cut -f1)"
    else
        echo "[$(date -Iseconds)] backup FAILED" >&2
        rm -f "$dump_file.tmp"
        return 1
    fi

    prune "$DAILY_DIR" "$DAILY_KEEP"

    # ISO day 7 = Sunday: also keep a weekly copy, retained separately from
    # the daily rotation (7 daily / 4 weekly per spec).
    if [ "$(date +%u)" = "7" ]; then
        cp "$dump_file" "$WEEKLY_DIR/"
        prune "$WEEKLY_DIR" "$WEEKLY_KEEP"
    fi
}

if [ "${BACKUP_RUN_ONCE:-false}" = "true" ]; then
    run_backup
    exit 0
fi

trap 'echo "backup sidecar stopping"; exit 0' TERM INT

while true; do
    run_backup || echo "backup run failed, will retry next cycle" >&2
    sleep "$INTERVAL_SECONDS" &
    wait $!
done
