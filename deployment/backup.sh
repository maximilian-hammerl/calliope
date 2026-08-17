#!/usr/bin/env bash
# Dumps the database to local disk. Run by calliope-backup.timer, or by hand with
# `systemctl start calliope-backup.service`.
#
# These dumps live on the same disk as the database, so they protect against mistakes in
# the data rather than against losing the server. Getting them off the machine is a
# separate, still missing, step.
set -euo pipefail

COMPOSE_FILE=/opt/calliope/docker-compose.production.yaml
BACKUP_DIRECTORY=/var/backups/calliope
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIRECTORY"
chmod 700 "$BACKUP_DIRECTORY"

target="$BACKUP_DIRECTORY/calliope-$(date --utc +%Y%m%dT%H%M%SZ).dump"

# Removed on any failure, so a half-written file is never left looking like a backup.
trap 'rm -f "$target.partial"' EXIT

# Dumped inside the container, so pg_dump always matches the server version. The custom
# format is compressed and lets pg_restore pull out single tables.
docker compose -f "$COMPOSE_FILE" exec -T db \
	pg_dump --username calliope --no-password --format custom calliope >"$target.partial"

# Renamed only once the dump has completed successfully.
mv "$target.partial" "$target"
# The dump holds email addresses and password hashes.
chmod 600 "$target"

echo "wrote $target ($(du -h "$target" | cut -f1))"

# Pruned only after the new dump exists, never before.
find "$BACKUP_DIRECTORY" -name 'calliope-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete
