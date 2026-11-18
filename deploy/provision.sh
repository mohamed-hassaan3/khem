#!/usr/bin/env bash
#
# Provision the KHEM VPS (Ubuntu 24.04, Hostinger KVM 2). Run as root.
#
#   scp deploy/provision.sh root@<ip>:/root/ && ssh root@<ip> bash /root/provision.sh
#
# Idempotent: every step checks before it acts, so a re-run is safe and is how
# a half-finished provision is completed. It installs and configures the box;
# it does not deploy the app (that is `deploy.sh`, run as `khem`) and it does not
# obtain the TLS certificate (that waits for DNS; see src/docs/hostinger-vps.md).
#
# Layout it creates:
#   /srv/khem/repo        bare clone (filled by the first deploy)
#   /srv/khem/releases/   one directory per deployed commit
#   /srv/khem/current  -> releases/<sha>
#   /srv/khem/shared/     .env.production, .cron.env (600, owner khem)
#   /srv/khem/logs/       app + cron logs

set -euo pipefail

[[ ${EUID} -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
APP_USER=khem
APP_ROOT=/srv/khem
NODE_MAJOR=24
PM2_VERSION=7.1.1

log() { printf '\n==> %s\n' "$*"; }

log "Time zone → UTC (cron times are written in UTC)"
timedatectl set-timezone UTC

log "Base packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git ufw fail2ban nginx certbot \
  unattended-upgrades libjemalloc2 logrotate

log "Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

log "Swap (2 GB headroom for next build beside the running app)"
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [[ -f /swapfile ]] || fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Node.js ${NODE_MAJOR} (NodeSource apt repository, signed)"
if ! node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi
node -v

log "PM2 ${PM2_VERSION}"
if [[ "$(pm2 -v 2>/dev/null || true)" != "${PM2_VERSION}" ]]; then
  npm install -g "pm2@${PM2_VERSION}" --no-fund --no-audit
fi

log "App user '${APP_USER}' (no password, no sudo, SSH key only)"
if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${APP_USER}"
fi
install -d -m 0700 -o "${APP_USER}" -g "${APP_USER}" "/home/${APP_USER}/.ssh"
if [[ -s /root/.ssh/authorized_keys ]]; then
  # The operator's key reaches the app user too, so deploys never need root.
  install -m 0600 -o "${APP_USER}" -g "${APP_USER}" /root/.ssh/authorized_keys \
    "/home/${APP_USER}/.ssh/authorized_keys"
fi

log "Directory layout under ${APP_ROOT}"
install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" \
  "${APP_ROOT}" "${APP_ROOT}/releases" "${APP_ROOT}/logs"
install -d -m 0700 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}/shared"
install -d -m 0755 /var/www/certbot

log "GitHub deploy key for ${APP_USER} (read-only; public half printed at the end)"
DEPLOY_KEY="/home/${APP_USER}/.ssh/khem_deploy"
if [[ ! -f "${DEPLOY_KEY}" ]]; then
  sudo -u "${APP_USER}" ssh-keygen -t ed25519 -N "" -C "khem-vps-deploy" -f "${DEPLOY_KEY}" >/dev/null
fi
SSH_CONFIG="/home/${APP_USER}/.ssh/config"
if ! grep -q 'khem_deploy' "${SSH_CONFIG}" 2>/dev/null; then
  cat >> "${SSH_CONFIG}" <<EOF
Host github.com
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
EOF
  chown "${APP_USER}:${APP_USER}" "${SSH_CONFIG}"
  chmod 600 "${SSH_CONFIG}"
fi
# Pin GitHub's published ed25519 host key rather than trusting the first answer.
# Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
KNOWN="/home/${APP_USER}/.ssh/known_hosts"
if ! grep -q '^github.com ssh-ed25519' "${KNOWN}" 2>/dev/null; then
  echo 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' >> "${KNOWN}"
  chown "${APP_USER}:${APP_USER}" "${KNOWN}"
  chmod 644 "${KNOWN}"
fi

log "Firewall: SSH, HTTP, HTTPS only"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ufw status verbose | sed -n '1,12p'

log "fail2ban (sshd jail)"
cat > /etc/fail2ban/jail.d/khem.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

log "SSH hardening (keys only)"
# Applied only when a key is installed for root — otherwise this would lock the
# operator out of a box they can currently reach only by password.
if [[ -s /root/.ssh/authorized_keys ]]; then
  cat > /etc/ssh/sshd_config.d/10-khem.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t
  systemctl reload ssh
else
  echo "!! /root/.ssh/authorized_keys is empty — SSH hardening SKIPPED." >&2
fi

log "PM2 under systemd for ${APP_USER} (survives reboot)"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" >/dev/null
sudo -u "${APP_USER}" -H bash -lc 'pm2 describe pm2-logrotate >/dev/null 2>&1 || pm2 install pm2-logrotate >/dev/null'
sudo -u "${APP_USER}" -H bash -lc 'pm2 set pm2-logrotate:max_size 20M >/dev/null && pm2 set pm2-logrotate:retain 10 >/dev/null'

log "Log rotation for cron.log"
cat > /etc/logrotate.d/khem <<EOF
${APP_ROOT}/logs/cron.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
  su ${APP_USER} ${APP_USER}
}
EOF

log "nginx: HTTP bootstrap site (TLS is added after DNS points here)"
rm -f /etc/nginx/sites-enabled/default
if [[ ! -e /etc/nginx/sites-enabled/khemperfumes.conf ]]; then
  # The bootstrap config is installed by the operator step that copies deploy/
  # nginx/*.conf to /etc/nginx/sites-available; see src/docs/hostinger-vps.md.
  if [[ -f /etc/nginx/sites-available/khemperfumes.bootstrap.conf ]]; then
    ln -sfn /etc/nginx/sites-available/khemperfumes.bootstrap.conf /etc/nginx/sites-enabled/khemperfumes.conf
  fi
fi
nginx -t
systemctl enable --now nginx >/dev/null
systemctl reload nginx

log "Done. Deploy key (add to GitHub → repo → Settings → Deploy keys, READ-ONLY):"
cat "${DEPLOY_KEY}.pub"
