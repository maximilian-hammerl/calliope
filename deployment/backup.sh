#!/usr/bin/env bash
# Dumps the database and archives the uploads. Run by calliope-backup.timer, or by hand with
# `systemctl start calliope-backup.service`. Same disk, so this covers mistakes, not a lost server.
set -euo pipefail

COMPOSE_FILE=/opt/calliope/docker-compose.deploy.yaml
BACKUP_DIRECTORY=/var/backups/calliope
RETENTION_DAYS=14
# The compose project name is pinned in the deploy file, so the volume's full name is fixed.
FILE_VOLUME=calliope_file-data

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

# After the dump, deliberately: the rows are frozen first, so the archive is a superset of what
# they reference. A file with no row is swept; a row with no file is a broken picture.
files="${target%.dump}-files.tar.gz"
trap 'rm -f "$target.partial" "$files.partial"' EXIT

# Straight off the host, which this unit already has as root. The path comes from Docker so a moved
# data-root cannot silently archive nothing, and a missing volume means no uploads, not a failure.
if volume_path="$(docker volume inspect --format '{{.Mountpoint}}' "$FILE_VOLUME" 2>/dev/null)"; then
	tar -cz -C "$volume_path" . >"$files.partial"

	mv "$files.partial" "$files"
	chmod 600 "$files"

	echo "wrote $files ($(du -h "$files" | cut -f1))"
else
	echo "no $FILE_VOLUME volume yet; skipped the file archive"
fi

# Pruned only after the new backup exists, never before.
find "$BACKUP_DIRECTORY" -name 'calliope-*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete
find "$BACKUP_DIRECTORY" -name 'calliope-*-files.tar.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete
