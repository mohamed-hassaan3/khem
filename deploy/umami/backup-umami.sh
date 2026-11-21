#!/usr/bin/env bash
#
# Nightly logical backup of the Umami database. Run as root by
# /etc/cron.d/khem-umami-backup (deploy/umami/umami.cron).
#
#   /srv/umami/backup-umami.sh          # by hand; prints the file it wrote
#
# Restore (see src/docs/umami-analytics.md, "Backups"):
#   gunzip -c /srv/umami/backups/umami-<date>.sql.gz \
#     | docker compose -f /srv/umami/docker-compose.yml exec -T db psql -U umami -d umami
#
# The dump goes to a temporary name first and is renamed only once pg_dump and
# gzip have both succeeded, so a failed night never leaves a truncated file that
# looks like a good one.

set -euo pipefail

UMAMI_ROOT=/srv/umami
BACKUP_DIR="${UMAMI_ROOT}/backups"
KEEP_DAYS=14

[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

umask 077
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
TARGET="${BACKUP_DIR}/umami-${STAMP}.sql.gz"
PARTIAL="${TARGET}.partial"

cd "${UMAMI_ROOT}"
docker compose exec -T db pg_dump -U umami -d umami --no-owner | gzip -9 > "${PARTIAL}"
mv "${PARTIAL}" "${TARGET}"

find "${BACKUP_DIR}" -maxdepth 1 -name 'umami-*.sql.gz' -mtime +"${KEEP_DAYS}" -delete
find "${BACKUP_DIR}" -maxdepth 1 -name '*.partial' -mmin +60 -delete

echo "$(date -u +%FT%TZ) umami backup $(du -h "${TARGET}" | cut -f1) ${TARGET}"
