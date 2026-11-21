# Umami — visitor analytics runbook

KHEM counts visitors with **Umami v3.5.0, self-hosted** on the Hostinger VPS
(the same box as the shop, `src/docs/hostinger-vps.md`). No analytics data
leaves the server, and no third party is involved.

What it records: page views, referrers, countries, devices, browsers, entry and
exit pages. It sets **no cookies** and stores **no raw IP addresses**: sessions
are hashed with a salt that rotates monthly.

```
visitor ─TLS─▶ nginx :443 khemperfumes.com
                 ├─ /hk.js   ──▶ 127.0.0.1:3001/script.js   ┐
                 ├─ /api/hk  ──▶ 127.0.0.1:3001/api/send    ├─ umami (docker) ──▶ db (postgres 16, docker network only)
                 └─ /*       ──▶ 127.0.0.1:3000 next (PM2)  │
owner  ─TLS─▶ nginx :443 analytics.khemperfumes.com ────────┘  (dashboard, login + 2FA)
```

Design decisions and their reasons: `prompts/umami-analytics.md`.

## Where things are

| What | Where |
| :--- | :--- |
| Dashboard | `https://analytics.khemperfumes.com`, also linked from the admin rail under **Visitors → Umami** |
| Compose project | `/srv/umami/docker-compose.yml` (root), source `deploy/umami/docker-compose.yml` |
| Secrets (only copy) | `/srv/umami/.env`, 600 root: `POSTGRES_PASSWORD`, `APP_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY` |
| Database | Docker volume `umami_umami-db-data`, never published on a port |
| Backups | `/srv/umami/backups/umami-<UTC stamp>.sql.gz`, nightly 02:30 UTC, 14 days kept. Log `backup.log` |
| nginx | `/etc/nginx/sites-available/analytics.khemperfumes.conf`, `/etc/nginx/snippets/khem-umami-proxy.inc`, two `location =` blocks in `khemperfumes.conf`. Access log `/var/log/nginx/umami.access.log` |
| TLS | `/etc/letsencrypt/live/analytics.khemperfumes.com/`, renewed by `certbot.timer` |
| App side | `src/lib/analytics/umami.ts` (config, excluded paths, `trackEvent`), `src/components/analytics/UmamiAnalytics.tsx` (loads the tracker; not consent-gated), mounted in `app/[locale]/layout.tsx` outside `<ConsentProvider>`. Tests: `scripts/umami-analytics.test.ts` |
| Env (shop) | `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in `/srv/khem/shared/.env.production`. Inlined at build, so a change needs a redeploy |

Everything Umami-side is run as **root**. The `khem` user has no Docker access,
on purpose.

## What is and is not counted

- **Every visitor, whatever the cookie banner says.** The tracker loads on every
  page view: before the banner is answered, after **Decline** and after
  **Accept** alike (`prompts/umami-count-every-visitor.md`, 2026-11-21). Umami
  is cookieless, so the banner has nothing to govern. The banner no longer shows
  an Analytics toggle, and the Cookie Policy says Umami is not affected by the
  banner choice. `scripts/umami-analytics.test.ts` fails if the component ever
  reads consent again.
- **Why that is acceptable.** The v3.5.0 tracker never writes a cookie,
  localStorage, sessionStorage or IndexedDB (checked in its source). Its one
  storage access is *reading* `localStorage['umami.disabled']`, the opt-out
  switch below. No raw IP is stored: sessions are a salted hash that rotates
  monthly, and the country comes from a GeoIP lookup at collection time. What
  changed is *who* is counted, not *what* is collected.
- **The trade-off now runs the other way.** Counts are close to real traffic.
  The exceptions are Do-Not-Track browsers (deliberately not counted) and ad
  blockers that guess the renamed `/hk.js` anyway. A future tool that **does**
  set cookies (a marketing pixel, session replay) must not follow this
  precedent. It goes behind `useConsent()` with an Analytics toggle restored in
  `BANNER_CATEGORIES` and `CONSENT_VERSION` bumped, and the Cookie Policy
  changes first.
- **Opting yourself out** (staff testing on the live site): in DevTools on
  `khemperfumes.com`, run `localStorage.setItem('umami.disabled', '1')`. That
  browser then stops sending. This is Umami's own switch, and nothing on the
  site writes it.
- **Only on `khemperfumes.com`.** Localhost, the bare IP and preview hosts never
  record (`data-domains`).
- **Never** `/admin`, `/account`, `/sign-in`, `/sign-up`, `/unsubscribe` (either
  locale). Never query strings or URL hashes, never an excluded page as a
  referrer, and no `identify()`. Do-Not-Track browsers are not counted.
- **UTM tags are not recorded**, because query strings are dropped wholesale. If
  campaign attribution is wanted later, replace `data-exclude-search` with an
  allowlist in `beforeSend` that keeps only `utm_*`.
- The `/prelaunch` cover is not tracked. It is a separate root layout, and `<UmamiAnalytics>` is not mounted there.

## First-time setup

1. **DNS** (Hostinger hPanel → Domains → `khemperfumes.com` → DNS): `A` record,
   name `analytics`, target `179.67.202.31`, TTL 3600. Wait for
   `dig +short analytics.khemperfumes.com` to print the IP.
2. **Install Umami** (root):
   ```bash
   scp deploy/umami/* root@179.67.202.31:/root/umami/
   ssh root@179.67.202.31 bash /root/umami/provision-umami.sh
   ```
   It ends with "Umami is up." and a port check showing `127.0.0.1:3001` only.
3. **Certificate** (root). The ACME challenge is answered by the shop's port-80
   `default_server`, so this works before the analytics site exists:
   ```bash
   certbot certonly --webroot -w /var/www/certbot -d analytics.khemperfumes.com \
     --deploy-hook "systemctl reload nginx" --agree-tos -m <owner email> --no-eff-email
   ```
4. **nginx** (root, from a checkout of the merged commit):
   ```bash
   cp deploy/nginx/khem-umami-proxy.inc /etc/nginx/snippets/
   cp deploy/nginx/analytics.khemperfumes.conf deploy/nginx/khemperfumes.conf /etc/nginx/sites-available/
   ln -sfn /etc/nginx/sites-available/analytics.khemperfumes.conf /etc/nginx/sites-enabled/analytics.khemperfumes.conf
   nginx -t && systemctl reload nginx
   ```
   The release on the box already has these files at
   `/srv/khem/current/deploy/nginx/` after the next `deploy.sh`.
5. **First login.** Follow the [login policy](#login-policy) below.
6. **Add the website**: Settings → Websites → **Add website**, name `KHEM`,
   domain `khemperfumes.com`. Open it and copy the **Website ID**.
7. **Wire the shop** (as `khem`): add `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<id>` to
   `/srv/khem/shared/.env.production`, push any commit, then run
   `/srv/khem/current/deploy/deploy.sh`. It must be a rebuild, because the value
   is compiled in.
8. **Verify**: see [Health checks](#health-checks).
9. **Cookie Policy.** Apply
   `supabase/sql/0080_cookie_policy_cookieless_analytics.sql` (SQL editor or
   `psql`, single transaction) **before** the deploy in step 7, because the
   rebuild is what re-prerenders `/cookie-policy`. It prints one `NOTICE`:
   - "updated": done.
   - "already applied": nothing to do.
   - "edited since seeding — NOT changed": the policy was edited in `/admin`,
     so make the same three edits there, in EN **and** AR:
     1. "How We Use Them" lists two categories, Essential and Preferences.
     2. A new section, "Visitor Statistics, Without Cookies", names Umami as a
        cookieless, privacy-friendly tool that collects anonymous visit
        statistics without cookies or personal data and is not affected by the
        banner choice.
     3. "Managing Cookies" no longer mentions analytics cookies.

     The exact wording is in the migration.

## Login policy

Umami has its own accounts. It is deliberately **not** behind Clerk: open-source
Umami has no SSO, and putting a second auth proxy in front of a dashboard with
one or two users would cost more than it protects.

1. **The default account does not survive day one.** Sign in once as
   `admin` / `umami`. Umami 3.5 forces a password change on that first login.
   Then go to **Settings → Users → Create user**: your own username, role
   **Admin**, a long unique password from your password manager. Sign out, sign
   in as yourself, and **delete `admin`**.
2. **2FA for everyone.** Settings → Security → **Two-factor authentication**.
   Scan with an authenticator app and **store the recovery codes in the password
   manager**. Then make it compulsory for every account, current and future.
   Umami reads the `twoFactorRequiredGlobal` row of `app_setting` at each login
   (`src/lib/two-factor/policy.ts` in Umami 3.5.0):
   ```bash
   cd /srv/umami && docker compose exec -T db psql -U umami -d umami -c \
     "insert into app_setting (key, value) values ('twoFactorRequiredGlobal', 'true')
      on conflict (key) do update set value = excluded.value;"
   ```
   From then on, a user without 2FA can do nothing after login except set it up.
   It can also be required per user (Settings → Users → user → two-factor).
3. **One person, one account.** Never share a login. For someone who only reads
   numbers, create a user with role **View only** and give them access to the
   KHEM website. Remove the account when they leave.
4. **What protects the door**, besides the password and 2FA:
   - The dashboard has its own origin, so its session token is unreachable from
     any storefront script.
   - nginx allows 5 login (and 5 2FA) attempts a minute per address and answers
     `429` after that.
   - The host is `noindex`.
   - Umami and its database are bound to loopback (Docker ports bypass ufw, so
     this is checked by `provision-umami.sh`).

### Locked out

Run as root. `<name>` is the Umami username.

- **Forgot the password.** Hash a new one with bcrypt (Umami uses bcryptjs, cost
  10) and write it to the `"user"` table:
  ```bash
  apt-get install -y apache2-utils   # once, for htpasswd
  HASH=$(htpasswd -bnBC 10 "" 'NEW-LONG-PASSWORD' | tr -d ':\n' | sed 's/^\$2y\$/$2b$/')
  cd /srv/umami && docker compose exec -T db psql -U umami -d umami -v ON_ERROR_STOP=1 \
    -v h="$HASH" -v u='<name>' <<'SQL'
  update "user" set password = :'h' where username = :'u';
  SQL
  ```
  It must print `UPDATE 1`. `UPDATE 0` means the username was wrong.
  `$2y$` and `$2b$` are the same algorithm; the prefix is rewritten only to the
  one bcryptjs emits itself. Sign in with the new password and change it again
  from the UI. Any session that is still open is invalidated, because tokens are
  bound to the password hash.
- **Lost the 2FA device and the recovery codes.** Remove that user's 2FA so
  they can enrol again. With the global requirement on, they are made to set it
  up at the next login:
  ```bash
  cd /srv/umami && docker compose exec -T db psql -U umami -d umami -v ON_ERROR_STOP=1 \
    -v u='<name>' <<'SQL'
  delete from two_factor_backup_code where user_id = (select user_id from "user" where username = :'u');
  delete from two_factor_auth        where user_id = (select user_id from "user" where username = :'u');
  SQL
  ```
- **Sign everyone out.** Change `APP_SECRET` in `/srv/umami/.env`, then
  `docker compose up -d`. This also breaks every existing session hash, so it is
  for a suspected compromise, not routine.

## Backups

The nightly `backup-umami.sh` writes a gzip'd `pg_dump`. Run it by hand to check:
`/srv/umami/backup-umami.sh`.

Restore into a fresh instance:

```bash
cd /srv/umami
docker compose stop umami
gunzip -c backups/umami-<stamp>.sql.gz | docker compose exec -T db psql -U umami -d umami
docker compose start umami
```

To restore over existing data, drop and recreate the database first
(`dropdb`/`createdb` inside the `db` container). The dump is plain SQL without
`DROP` statements. The backups stay on the same disk as the data, so copy one
off the box now and then (`scp root@…:/srv/umami/backups/<file> .`). Analytics
is replaceable, so off-site copies are not automated.

## Upgrades

1. Read the release notes (`github.com/umami-software/umami/releases`).
2. `/srv/umami/backup-umami.sh`
3. Change the image tag in `deploy/umami/docker-compose.yml`, commit, copy it to
   `/srv/umami/`, then `cd /srv/umami && docker compose pull && docker compose up -d`.
   Umami applies its own migrations on start. Re-running `provision-umami.sh` does
   the copy and the restart in one go.
4. Check that `/hk.js` still returns JavaScript. The collect path is rewritten
   into the script on container start, from `COLLECT_API_ENDPOINT`.

## Health checks

```bash
cd /srv/umami && docker compose ps                   # umami + db: running (healthy)
curl -fsS http://127.0.0.1:3001/api/heartbeat        # 200
curl -sI https://khemperfumes.com/hk.js | head -3    # 200, javascript, Cache-Control 1h
curl -s https://khemperfumes.com/hk.js | grep -o '/api/hk' | head -1   # the script posts first-party
ss -ltn 'sport = :3001'                              # 127.0.0.1 only
ls -lh /srv/umami/backups | tail -3
```

From another machine, `curl -m 5 http://179.67.202.31:3001` must **fail**.

In a private window on the live site, with DevTools → Network filtered to `hk`
and **Preserve log** on:

1. Load `/` **without touching the cookie banner**. `hk.js` loads, then
   `POST /api/hk` (the page view). Every client navigation adds one more `POST`.
2. Click **Decline** and reload. `hk.js` and the `POST` appear again.
3. Cookie Settings → **Accept All** and reload. Same as before, with no
   difference in what is sent.
4. Cookie Settings shows **Essential** and **Preferences** only, with no
   Analytics toggle.
5. Visit `/admin`, `/account` or `/unsubscribe?token=x`: `hk.js` may load, but
   **no `POST`**. `/checkout` does post.
6. Open a `POST` and look at its payload. `url` has no query string, and a
   referrer from an excluded page is empty.
7. Application tab: **Cookies**, **Local Storage** and **Session Storage** for
   `khemperfumes.com` hold no Umami entry (nothing named `umami*`, and no new
   cookie).

The visit appears in the dashboard's Realtime view within seconds, with your
country. If every visit shows the server's own country, the IP header chain is
broken: check `khem-umami-proxy.inc` and `CLIENT_IP_HEADER`.

## Adding a custom event

1. Add the name to `AnalyticsEvent` in `src/lib/analytics/umami.ts`.
2. Call `trackEvent("add-to-cart", { slug })` from a client component. It is a
   no-op when the tracker is not loaded (unconfigured, or blocked by the
   browser).

Never send an email address, name, Clerk ID, order number or anything typed by
the visitor.

## Removing Umami

Unset `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and redeploy, which stops all loading.
Then remove the two `location =` blocks and the analytics site from nginx, and
run `cd /srv/umami && docker compose down -v` (the `-v` deletes the data).
