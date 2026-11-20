#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_DIR="${PROJECT_DIR:-/root/xabit}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/xabit}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
BACKUP_NAME="habit-${STAMP}.dump"
CONTAINER_TMP="/tmp/${BACKUP_NAME}.$$"
TMP_FILE=""

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

exec 9>/run/lock/xabit-db-backup.lock
if ! flock -n 9; then
	printf '%s backup skipped: another backup is running\n' "$(date -u +'%FT%TZ')"
	exit 0
fi

TMP_FILE="$(mktemp "$BACKUP_DIR/.${BACKUP_NAME}.XXXXXX")"

cleanup() {
	if [[ -n "$TMP_FILE" ]]; then
		rm -f -- "$TMP_FILE"
	fi
	(
		cd "$PROJECT_DIR"
		docker compose exec -T db rm -f "$CONTAINER_TMP" >/dev/null 2>&1 || true
	)
}
trap cleanup EXIT

cd "$PROJECT_DIR"
docker compose exec -T db sh -ec '
	archive="$1"
	trap '\''rm -f "$archive"'\'' EXIT
	pg_dump -U habit -d habit -Fc > "$archive"
	test -s "$archive"
	pg_restore --list "$archive" >/dev/null
	cat "$archive"
' sh "$CONTAINER_TMP" > "$TMP_FILE"

if [[ ! -s "$TMP_FILE" || "$(head -c 5 "$TMP_FILE")" != "PGDMP" ]]; then
	printf '%s backup validation failed\n' "$(date -u +'%FT%TZ')" >&2
	exit 1
fi

chmod 600 "$TMP_FILE"
mv -f -- "$TMP_FILE" "$BACKUP_DIR/$BACKUP_NAME"
TMP_FILE=""

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'habit-*.dump' \
	-mmin "+$((RETENTION_DAYS * 24 * 60))" -print -delete

printf '%s backup created: %s (%s)\n' \
	"$(date -u +'%FT%TZ')" "$BACKUP_DIR/$BACKUP_NAME" "$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)"
