#!/usr/bin/env bash
#
# Point `current` back at an earlier release and reload. Run as `khem`:
#
#   /srv/khem/current/deploy/rollback.sh            # the release before the live one
#   /srv/khem/current/deploy/rollback.sh <sha12>    # a specific release
#
# No build, no install: releases are kept fully built, so this takes seconds.

set -euo pipefail

ROOT=/srv/khem
LIVE="$(readlink -f "${ROOT}/current")"

if [[ $# -ge 1 ]]; then
  TARGET="${ROOT}/releases/$1"
else
  TARGET="$(ls -1dt "${ROOT}"/releases/*/ | sed 's:/$::' | grep -vx "${LIVE}" | head -n 1 || true)"
fi

[[ -n "${TARGET}" && -d "${TARGET}" ]] || { echo "No release to roll back to." >&2; exit 1; }

echo "rollback: $(basename "${LIVE}") → $(basename "${TARGET}")"
ln -sfn "${TARGET}" "${ROOT}/current.next"
mv -Tf "${ROOT}/current.next" "${ROOT}/current"
pm2 startOrReload "${ROOT}/current/deploy/ecosystem.config.cjs" --update-env >/dev/null
pm2 save --force >/dev/null

for _ in $(seq 1 45); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3000/ || true)" == "200" ]] && { echo "serving $(basename "${TARGET}")"; exit 0; }
  sleep 2
done
echo "WARNING: $(basename "${TARGET}") is not answering 200 — check: pm2 logs khem" >&2
exit 1
