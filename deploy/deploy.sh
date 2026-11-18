#!/usr/bin/env bash
#
# Build and release one commit of KHEM on the VPS. Run as `khem`:
#
#   ssh khem@<ip> /srv/khem/current/deploy/deploy.sh          # main
#   ssh khem@<ip> /srv/khem/current/deploy/deploy.sh <branch>
#
# First deploy (no `current` yet): copy this file to the box and run it from
# anywhere — it only uses absolute paths.
#
# Each commit builds into its own releases/<sha> directory while the previous
# release keeps serving, so a failed install or build never touches the live
# site. Only a finished build is swapped in. If the new process does not answer
# within 90 s, `current` is pointed back at the previous release automatically.

set -euo pipefail

ROOT=/srv/khem
REPO="${ROOT}/repo"
REMOTE=git@github.com:mohamed-hassaan3/khem.git
BRANCH="${1:-main}"
KEEP=5
HEALTH_URL=http://127.0.0.1:3000/

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ "$(id -un)" == "khem" ]] || die "run as the khem user, not $(id -un)"
[[ -s "${ROOT}/shared/.env.production" ]] || die "${ROOT}/shared/.env.production is missing"

if [[ ! -d "${REPO}" ]]; then
  log "cloning ${REMOTE} (bare)"
  git clone --bare --quiet "${REMOTE}" "${REPO}"
fi

log "fetching ${BRANCH}"
git -C "${REPO}" fetch --quiet --prune origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"
SHA="$(git -C "${REPO}" rev-parse "refs/remotes/origin/${BRANCH}")"
SHORT="${SHA:0:12}"
REL="${ROOT}/releases/${SHORT}"
PREV="$(readlink -f "${ROOT}/current" 2>/dev/null || true)"

if [[ "${PREV}" == "${REL}" ]]; then
  log "${SHORT} is already live; nothing to do"
  exit 0
fi

log "preparing release ${SHORT}"
rm -rf "${REL}"
mkdir -p "${REL}"
git -C "${REPO}" archive "${SHA}" | tar -x -C "${REL}"
echo "${SHA}" > "${REL}/.release"
ln -sfn "${ROOT}/shared/.env.production" "${REL}/.env.production"

cd "${REL}"
log "npm ci"
npm ci --no-audit --no-fund --loglevel=error
log "next build (NEXT_PUBLIC_* values are inlined now)"
NODE_OPTIONS=--max-old-space-size=4096 NEXT_TELEMETRY_DISABLED=1 npm run build

switch_to() {
  ln -sfn "$1" "${ROOT}/current.next"
  mv -Tf "${ROOT}/current.next" "${ROOT}/current"
  pm2 startOrReload "${ROOT}/current/deploy/ecosystem.config.cjs" --update-env >/dev/null
}

healthy() {
  for _ in $(seq 1 45); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "${HEALTH_URL}" || true)"
    [[ "${code}" == "200" ]] && return 0
    sleep 2
  done
  return 1
}

log "switching current → ${SHORT}"
switch_to "${REL}"

if ! healthy; then
  log "health check FAILED for ${SHORT}"
  if [[ -n "${PREV}" && -d "${PREV}" ]]; then
    log "rolling back to $(basename "${PREV}")"
    switch_to "${PREV}"
    healthy && log "previous release is serving again" || log "previous release is ALSO unhealthy — check: pm2 logs khem"
  fi
  exit 1
fi

pm2 save --force >/dev/null
log "live: ${SHORT}"

# Keep the newest ${KEEP} releases, never the live one.
LIVE="$(readlink -f "${ROOT}/current")"
ls -1dt "${ROOT}"/releases/*/ 2>/dev/null | sed 's:/$::' | tail -n +$((KEEP + 1)) | while read -r old; do
  [[ "${old}" == "${LIVE}" ]] || rm -rf "${old}"
done
