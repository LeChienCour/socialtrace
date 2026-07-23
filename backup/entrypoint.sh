#!/bin/sh
set -eu

# Phase 0 stub: reserves the compose topology slot (own volume, no coupling
# to backend/db healthchecks) ahead of the real cron + pg_dump logic landing
# in phase 5. See docs/adr/0004-backup-sidecar-stub-in-phase-0.md.
echo "backup sidecar stub — real pg_dump/cron logic lands in phase 5"

trap 'exit 0' TERM INT

while true; do
    sleep 3600 &
    wait $!
done
