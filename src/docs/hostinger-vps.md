# KHEM on the Hostinger VPS — operator runbook

Production runs on a **Hostinger KVM 2 VPS (Germany, Ubuntu 24.04)**:
2 vCPU, 8 GB RAM, 100 GB NVMe, plus 2 GB of swap. The database is **Supabase
Frankfurt (`eu-central-1`)**. Nothing runs on Vercel.

```
visitor ──TLS──▶ nginx :443 ──▶ next start 127.0.0.1:3000 (PM2, 1 process, user khem)
                  │                     │
                  │                     ├─▶ Supabase Frankfurt (PostgREST + Storage)
                  │                     ├─▶ Clerk · Stripe · Resend · OpenAI
cron (khem) ──────┴── loopback ────────▶ /api/cron/*  (Bearer CRON_SECRET)
```

Every server file lives in `deploy/`, and the reasoning is in the comments of
each file. The migration that set this up: `prompts/hostinger-vps-migration.md`.

## Where things are

| What | Where |
| :--- | :--- |
| Live release | `/srv/khem/current` → `/srv/khem/releases/<sha12>` |
| Secrets (only copy) | `/srv/khem/shared/.env.production` (600, khem). Names: `deploy/env.production.example` |
| Cron secret | `/srv/khem/shared/.cron.env` (600, khem). Holds `CRON_SECRET=` with the **same** value |
| Umami (analytics) | `/srv/umami/` (root): `docker-compose.yml`, `.env` secrets (600), `backups/`. Dashboard `https://analytics.khemperfumes.com`; runbook `src/docs/umami-analytics.md` |
| App logs | `pm2 logs khem`, or `/srv/khem/logs/app.{out,err}.log` |
| Cron log | `/srv/khem/logs/cron.log` (idle campaign ticks are not logged) |
| nginx | `/etc/nginx/sites-available/khemperfumes.conf`, `/etc/nginx/snippets/khem-*.inc`; access log `/var/log/nginx/khem.access.log` (no query strings) |
| TLS | `/etc/letsencrypt/live/khemperfumes.com/`, renewed by `certbot.timer` |

SSH as `khem` for everything below unless it says root.

## Deploy a change

```bash
git push origin main
ssh khem@179.67.202.31 /srv/khem/current/deploy/deploy.sh
```

`deploy.sh` builds the commit in a fresh `releases/<sha>` directory while the
current release keeps serving. It switches over only once the build is complete,
then health-checks the new process and **rolls back automatically** if it does
not answer 200 within 90 s. Each deploy takes a few minutes, mostly `next build`.
Expect a few seconds of 502 while the single process restarts.

## Roll back

```bash
ssh khem@179.67.202.31 /srv/khem/current/deploy/rollback.sh          # previous release
ssh khem@179.67.202.31 /srv/khem/current/deploy/rollback.sh <sha12>  # a specific one
```

The last five releases are kept fully built, so a rollback takes seconds.

## Change an environment variable

1. `nano /srv/khem/shared/.env.production`
2. If it is a **`NEXT_PUBLIC_*`** value, it is compiled into the bundle, so
   rebuild by re-running `deploy.sh`. It skips a commit that is already live, so
   push any commit first, or delete the live release's `.next` directory and
   accept a short outage. For anything else, run `pm2 reload khem`.
3. **`CRON_SECRET`**: change it in `.env.production` **and** `.cron.env`, then
   `pm2 reload khem`. If only one changes, every cron returns 401 and scheduled
   campaigns stop silently.

## Cron

`deploy/cron/khem.crontab` (UTC): `send-campaigns` every minute,
`sweep-unpaid-orders` 03:00, `expire-credits` 03:30, `purge-search-events` 04:00
(the 90-day retention of search tracking), `order-feedback` 09:00, and
`promotion-boundaries` every 5 minutes (revalidates the shop when a scheduled
sale or offer starts or ends). **After pulling this job, re-run the `crontab`
command below once** — the server keeps its installed copy until then.
Install or update it with `crontab /srv/khem/current/deploy/cron/khem.crontab`.

Run a job by hand with `/srv/khem/current/deploy/cron/khem-cron.sh order-feedback`.
It prints `… order-feedback 200 {…}` on success; `401` means the two secrets
differ, and `000` means the app is down.

## TLS

The first certificate is issued once DNS points at the box (root):

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d khemperfumes.com -d www.khemperfumes.com \
  --deploy-hook "systemctl reload nginx" --agree-tos -m <owner email> --no-eff-email
ln -sfn /etc/nginx/sites-available/khemperfumes.conf /etc/nginx/sites-enabled/khemperfumes.conf
nginx -t && systemctl reload nginx
```

After that, renewal is automatic (`systemctl list-timers certbot.timer`), and
`certbot renew --dry-run` proves it works.

## Health checks

```bash
pm2 status                       # khem: online, restarts not climbing
curl -sI https://khemperfumes.com | head -5
tail -n 20 /srv/khem/logs/cron.log
df -h / && free -h
sudo -n true 2>/dev/null || echo "(khem has no sudo — use root for nginx/certbot/ufw)"
```

## Reboot behaviour

PM2 is registered with systemd (`pm2-khem.service`) and restores the saved
process list on boot. nginx, fail2ban and cron start on their own.

## Security posture

- SSH: keys only, root by key only, fail2ban on sshd. Firewall allows 22, 80
  and 443.
- Next listens on 127.0.0.1 only. nginx **overwrites** `X-Forwarded-For` and
  `x-khem-country`, so a client cannot spoof either (the rate limits and the
  currency detection depend on this).
- HSTS (1 year, `includeSubDomains`, no `preload`) is sent by nginx on HTTPS
  responses only. The CSP and the other security headers come from
  `next.config.ts`.
- Unattended security upgrades are on. Node major upgrades are deliberate: bump
  `NODE_MAJOR` in `deploy/provision.sh` and `engines` together.

## Visitor country (optional GeoIP)

Today `x-khem-country` is always empty, so the display currency comes from the
visitor's device timezone (`detectCurrencyFromBrowser()`), and the checkout's
country starts unselected. To detect the country from the IP instead:

1. Create a free MaxMind account and generate a licence key.
2. As root, install `geoipupdate` and `libnginx-mod-http-geoip2`, put the
   account ID and key in `/etc/GeoIP.conf` (`EditionIDs GeoLite2-Country`), and
   run `geoipupdate`. A weekly timer keeps it fresh.
3. Add `geoip2 /var/lib/GeoIP/GeoLite2-Country.mmdb { $geoip2_country_code country iso_code; }`
   to `/etc/nginx/conf.d/geoip2.conf`.
4. In `deploy/nginx/khem-proxy.inc`, replace `""` with `$geoip2_country_code`,
   then copy it to `/etc/nginx/snippets/`, run `nginx -t` and reload.

No application change is needed: `src/lib/geo.ts` already reads the header.
