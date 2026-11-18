#!/usr/bin/env bash
#
# Call one KHEM cron route over loopback with the bearer token.
#
#   khem-cron.sh send-campaigns | sweep-unpaid-orders | order-feedback | expire-credits | purge-search-events
#
# Loopback, not https://khemperfumes.com: the secret never leaves the box, and
# the jobs keep running even if DNS or TLS is broken.
#
# The token is read from /srv/khem/shared/.cron.env and handed to curl on stdin
# (`-H @-`), so it never appears in a process listing. It must equal
# CRON_SECRET in .env.production — rotate both or neither.

set -euo pipefail

JOB="${1:-}"
case "${JOB}" in
  send-campaigns|sweep-unpaid-orders|order-feedback|expire-credits|purge-search-events) ;;
  *) echo "usage: $0 <send-campaigns|sweep-unpaid-orders|order-feedback|expire-credits|purge-search-events>" >&2; exit 2 ;;
esac

set -a
# shellcheck disable=SC1091
. /srv/khem/shared/.cron.env
set +a
[[ -n "${CRON_SECRET:-}" ]] || { echo "$(date -u +%FT%TZ) ${JOB} ERROR CRON_SECRET unset" >&2; exit 1; }

BODY="$(mktemp)"
trap 'rm -f "${BODY}"' EXIT

CODE="$(printf 'Authorization: Bearer %s\n' "${CRON_SECRET}" \
  | curl -sS -m 110 -o "${BODY}" -w '%{http_code}' -H @- \
      "http://127.0.0.1:3000/api/cron/${JOB}" || echo "000")"

# One line per run. The idle minute-by-minute campaign tick is the common case,
# so it is logged only when it did something or failed.
if [[ "${JOB}" == "send-campaigns" && "${CODE}" == "200" ]] && grep -q '"dispatched":0' "${BODY}"; then
  exit 0
fi

printf '%s %s %s %s\n' "$(date -u +%FT%TZ)" "${JOB}" "${CODE}" "$(head -c 300 "${BODY}" | tr -d '\n')"
[[ "${CODE}" == "200" ]]
