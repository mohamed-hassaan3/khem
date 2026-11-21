# Umami Analytics — self-hosted on the Hostinger VPS, consent-gated, first-party

## Goal

Give KHEM visitor analytics (page views, referrers, countries, devices, entry and
exit pages, later custom events) with **Umami v3, self-hosted on the existing
Hostinger KVM 2 VPS**, and a secure, low-friction way for the house to log in to
the dashboard.

Constraints that shape everything below:

- The data stays on our own server in Germany. No third-party analytics processor.
- The storefront's CSP stays exactly as it is. The tracker is served **first-party
  from `khemperfumes.com`**, so no new origin is added to `script-src` or
  `connect-src`. This also keeps ad blockers from silently dropping the data.
- It must respect the visitor's existing **Analytics** cookie choice
  (`src/lib/consent.ts`). The banner already offers that toggle, and the published
  Cookie Policy already promises "anonymous analytics". Today nothing reads that
  toggle; this task is the first consumer of it.
- It costs the shop nothing in performance. The script is ~2 KB, loads
  `afterInteractive`, only after consent, and is never in the critical path.
- No Vercel features (AGENTS.md §6).

## Skills read

- `AGENTS.md` (§2 workflow, §6 hosting row, §8 caching, §10 auth, §12 checklist).
- None of `.agents/skills/{clerk,supabase,ai-sdk}` apply. Umami has its own
  Postgres (not Supabase), its own login (not Clerk) and no AI. The Vercel-plugin
  skills that the prompt hook auto-suggested (`bootstrap`, `auth`,
  `investigation-mode`, `agent-browser-verify`) are Vercel-platform guidance and
  were skipped on purpose. The site does not run on Vercel.
- **Umami official docs**, read 2026-11-21 (docs.umami.is): install,
  environment-variables, tracker-configuration, tracker-functions, login,
  bypass-ad-blockers, plus the official `docker-compose.yml` on GitHub `master`.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/docs/hostinger-vps.md` | VPS layout (`/srv/khem`), IP `179.67.202.31`, the `khem` user has no sudo, root owns nginx/certbot/ufw, the TLS issuance procedure |
| `deploy/provision.sh` | Idempotent root provisioning style: `log()` steps, check-before-act, ufw allows only 22/80/443 |
| `deploy/nginx/khemperfumes.conf`, `khem-proxy.inc`, `khem-hsts.inc`, `khem-tls.inc` | Server blocks, the `khem_noquery` log format (no query strings), the XFF **overwrite** rule, HSTS re-included per location |
| `deploy/ecosystem.config.cjs` | Next runs on `localhost:3000` under PM2. **Port 3000 is taken**, so Umami gets 3001 |
| `deploy/env.production.example` | Names-only env template. `NEXT_PUBLIC_*` values are inlined at build, so a change needs a redeploy |
| `next.config.ts` → `contentSecurityPolicy()` | `script-src 'self' 'unsafe-inline' …`, `connect-src 'self' …`. A same-origin tracker needs **no change** |
| `src/lib/consent.ts`, `src/providers/consent-provider.tsx` | `useConsent()` gives `{ record, isHydrated }`, and `record.analytics: boolean`. The provider's comment names itself "the gate that a future [analytics tag] must pass through" |
| `src/app/[locale]/layout.tsx` | `<ConsentProvider>` wraps the tree (L462–555), and `<DeferredOverlays>` mounts the banner. The layout is prerendered (`generateStaticParams`), so nothing added may use a dynamic API |
| `src/app/prelaunch/` | Sibling root layout with **no** ConsentProvider. Out of scope (see Decisions §7) |
| `src/components/admin/AdminShell.tsx` L170–181 | The "Sales & Analytics" nav group, where the dashboard link goes |
| `src/app/api/*` | `cart, checkout, cron, search, webhooks`. The collect path chosen below does not collide |
| Dynamic public routes | `perfume/[slug]`, `set/[slug]`, `ritual/[slug]`, `collections/[slug]`, `journal/[slug]` hold catalogue slugs only (safe). Personal identifiers appear only under `/admin/*` (order numbers, customer IDs), `/account/*` and query strings (`/unsubscribe?token=`, the checkout return) |

## Decisions

### 1. Topology: Docker Compose on the same VPS, bound to loopback

```
visitor ─TLS─▶ nginx :443 khemperfumes.com
                 ├─ /hk.js, /api/hk ─────────────▶ 127.0.0.1:3001 umami (docker)
                 └─ everything else ─────────────▶ 127.0.0.1:3000 next (PM2)
owner ──TLS─▶ nginx :443 analytics.khemperfumes.com ─▶ 127.0.0.1:3001 umami (dashboard)
                                                         └─▶ umami-db (postgres, docker network only)
```

- **Docker Compose** with the official image is Umami's documented install, and it
  keeps Umami's Node version and Postgres separate from the shop's.
- **Its own Postgres 16 container, not Supabase.** Analytics writes one row per
  page view. That would eat into the Supabase quota, and it must never share a
  failure domain or credentials with orders.
- The port is published as **`127.0.0.1:3001:3000`, never `3001:3000`**. Docker
  writes iptables rules that **bypass ufw**, so a bare `3001:3000` would expose
  Umami to the internet despite the firewall. Postgres publishes no port at all.
- Memory caps: `umami` 768 MB and `db` 512 MB (`mem_limit`), so `next build`
  keeps its headroom on the 8 GB box.
- The image is **pinned to an exact v3 release tag**. Look up the latest with
  `gh api repos/umami-software/umami/releases/latest --jq .tag_name` at
  implementation time and record it in the compose file. `latest` is not used.
  Upgrades are deliberate, like the Node major.

### 2. First-party tracker with neutral names (no CSP change)

- `TRACKER_SCRIPT_NAME=hk` serves the script at `/hk.js`, and
  `COLLECT_API_ENDPOINT=/api/hk` receives the events. These neutral names keep
  ad-block lists from matching them.
- nginx on `khemperfumes.com` serves exactly two `location =` blocks to Umami.
  Exact-match locations win before the Next catch-all, so `src/proxy.ts` never sees
  them.
- The script tag carries no `data-host-url`, so the tracker posts to its own
  origin (`khemperfumes.com`). The CSP stays `'self'`.

### 3. The real visitor IP reaches Umami (for country stats and dedupe)

- nginx sets `X-Real-IP $remote_addr` and **overwrites** `X-Forwarded-For
  $remote_addr`, the same rule as `khem-proxy.inc`.
- Umami env: `CLIENT_IP_HEADER=x-real-ip` and `TRUSTED_PROXIES=loopback,private`.
  nginx reaches the container through the docker bridge, which is a private
  address.
- Umami does not store raw IPs. It hashes sessions with a salt that rotates
  monthly by default, and derives the country from its bundled GeoIP database.

### 4. Consent gate (honours the visitor's choice)

> **Superseded 2026-11-21** by `prompts/umami-count-every-visitor.md`: Umami
> now counts every visit regardless of the banner, and the Analytics toggle was
> removed.

- The tracker `<Script>` is rendered **only when** `isHydrated &&
  record?.analytics === true`. A first-time visitor sends nothing until they
  accept, and a visitor who declined never loads the script.
- **Withdrawal is immediate and needs no reload.** A loaded script cannot be
  unloaded, so `data-before-send` points at `window.khemUmamiBeforeSend`, which
  reads a module-level `consentGranted` flag kept in sync by an effect. When the
  flag is false it returns `null`, which cancels the event.
- *Why gate a cookieless tool?* Umami sets no cookies (per its docs), so many EU
  readings would allow it without consent. KHEM's banner, however, explicitly
  offers an "Analytics" toggle. Tracking someone who switched it off would make
  the UI dishonest. The trade-off is lower counts (decliners and undecided
  visitors are invisible). It is accepted, and it is documented in the runbook.
  If the house later decides to count without consent, that is a one-line change
  in the component plus a Cookie Policy update.

### 5. What is never sent

The `beforeSend` handler returns `null` when the payload's `url` path (locale
prefix stripped) starts with any of `/admin`, `/account`, `/sign-in`, `/sign-up`
or `/unsubscribe`.

Plus these script attributes:

- `data-exclude-search="true"` drops every query string (unsubscribe tokens,
  checkout session IDs, search terms).
- `data-exclude-hash="true"`.
- `data-domains="khemperfumes.com"` means localhost, IP access and preview hosts
  never record. The value is derived from `SITE_URL`'s hostname, not hard-coded
  twice.
- `data-do-not-track="true"`.

`umami.identify()` is **never** called. No Clerk ID, email or order number goes
to Umami.

### 6. How to log in to Umami (the "best approach" requested)

**Recommendation: Umami's own login on a dedicated subdomain, with mandatory 2FA,
rate limiting and named personal accounts.**

| Layer | What |
| :--- | :--- |
| Separate origin | Dashboard at `https://analytics.khemperfumes.com` only. Umami keeps its auth token in the browser, so on its own origin no storefront script can read it |
| Named accounts | First login with `admin` / `umami`. Umami v3.5+ **forces a password change** on first login. Then create a personal admin user for the owner, sign in as that user, and **delete the default `admin` user**. Every other person gets their own account, scoped to the KHEM website. Shared passwords are not used |
| 2FA | `TWO_FACTOR_ENCRYPTION_KEY` (64-hex, generated at provision) enables 2FA in v3.3+. **Every user enables it** under Settings → Security on their first login, and stores the recovery codes in the password manager |
| Brute-force limit | nginx `limit_req` on `/api/auth/login`: 5 req/min per IP, burst 5, returns 429 |
| Not indexed | `X-Robots-Tag: noindex, nofollow` on the analytics host |
| One click from KHEM admin | A "Visitors" link in the admin sidebar's Sales & Analytics group opens the dashboard in a new tab. It only *links*; authentication stays in Umami |
| Secrets | Passwords live in a password manager. `APP_SECRET` and the 2FA key live only in `/srv/umami/.env` (600, root). Rotating `APP_SECRET` signs everyone out |

Alternatives considered and rejected:

- **Clerk SSO in front of Umami.** OSS Umami has no SSO, so this would need a
  separate auth proxy (oauth2-proxy and the like). That is a second auth system to
  run for a dashboard with one or two users.
- **SSH tunnel only** (no public dashboard). This is the most locked-down option,
  but it rules out phone access and non-technical staff. 2FA plus rate limiting
  gets close to the same safety while keeping the dashboard usable.
- **Public share link.** This is an unauthenticated URL. It could be offered later
  for read-only staff views if the house wants one, but it is not a login.
- **Embedding Umami stats in `/admin` through its API.** This is a good later
  step. It would put the Clerk `requireAdmin()` gate in front of the numbers. It
  is out of scope here; noted as a follow-up.

### 7. Scope limits

- **No custom events** in this task. A typed `trackEvent()` helper ships so the
  follow-up (add-to-cart, begin-checkout, newsletter signup) is one call per site.
- **The `/prelaunch` cover is not tracked.** It has no ConsentProvider or banner,
  and adding a consent surface there is its own change.
- **No database change in KHEM.** The Cookie Policy text is a CMS row. The
  operator updates it to name Umami (self-hosted, Germany, no cookies, no third
  party) through the admin legal editor. That step is listed under manual steps.

## Files likely to change

**New: server (`deploy/umami/`)**

- `deploy/umami/docker-compose.yml`: `umami` (pinned tag, `127.0.0.1:3001:3000`,
  `env_file: /srv/umami/.env`, heartbeat healthcheck, `init: true`,
  `restart: unless-stopped`, `mem_limit`) and `db` (`postgres:16-alpine`, named
  volume, `pg_isready` healthcheck, no ports). Header comment explaining the
  loopback bind and ufw.
- `deploy/umami/env.example`: names only, for `DATABASE_URL`, `APP_SECRET`,
  `TWO_FACTOR_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `TRACKER_SCRIPT_NAME=hk`,
  `COLLECT_API_ENDPOINT=/api/hk`, `CLIENT_IP_HEADER=x-real-ip`,
  `TRUSTED_PROXIES=loopback,private`, `DISABLE_TELEMETRY=1`,
  `DISABLE_UPDATES=1`.
- `deploy/umami/provision-umami.sh` (root, idempotent, same style as
  `provision.sh`):
  1. Install Docker Engine and the compose plugin from Docker's signed apt repo.
  2. `install -d -m 700 /srv/umami /srv/umami/backups`.
  3. Write `/srv/umami/.env` **only if absent**, generating `APP_SECRET`,
     `TWO_FACTOR_ENCRYPTION_KEY` (`openssl rand -hex 32`) and the Postgres
     password. It never overwrites, because regenerating would log everyone out
     and orphan the database.
  4. Copy the compose file, then `docker compose up -d`.
  5. Wait for `curl -fsS http://127.0.0.1:3001/api/heartbeat`.
  6. Install the backup cron.
  7. Print the next manual steps.
- `deploy/umami/backup-umami.sh`: nightly
  `docker compose exec -T db pg_dump -U umami umami | gzip` to
  `/srv/umami/backups/umami-<date>.sql.gz`, keeping 14 days.
- `deploy/umami/umami.cron`: root crontab line, 02:30 UTC.

**New: nginx**

- `deploy/nginx/khem-umami-proxy.inc`: `proxy_pass http://127.0.0.1:3001;`, HTTP/1.1,
  `Host`, `X-Real-IP`, an **overwritten** `X-Forwarded-For`, `X-Forwarded-Proto`,
  `server_tokens off`.
- `deploy/nginx/analytics.khemperfumes.conf`: the HTTP→HTTPS + ACME block, the
  HTTPS server for `analytics.khemperfumes.com` (its own cert), the login
  `limit_req` location, `X-Robots-Tag`, HSTS include, and its own access log
  `/var/log/nginx/umami.access.log` with `khem_noquery`.
  - The `limit_req_zone` goes at http level (top of this file, outside `server`).
  - Do not redefine `khem_noquery` or `upstream khem_next`; both are defined in
    `khemperfumes.conf` and would clash on reload.

**Modified**

- `deploy/nginx/khemperfumes.conf`: in the HTTPS apex server, add
  `location = /hk.js` (include the umami proxy inc and HSTS inc; cache 1 h) and
  `location = /api/hk` (umami inc and HSTS; `client_max_body_size 64k`; no cache).
  Comment why these are exact matches.
- `src/lib/analytics/umami.ts` (**new**): `UMAMI_WEBSITE_ID` and `UMAMI_SCRIPT_SRC`
  read from `NEXT_PUBLIC_UMAMI_WEBSITE_ID` / `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
  (default `/hk.js`). `isUmamiConfigured()`. `UMAMI_DASHBOARD_URL =
  "https://analytics.khemperfumes.com"`. `EXCLUDED_PATH_PREFIXES`.
  `shouldSendPath(url)`, a pure function that strips the locale prefix with the
  existing i18n helpers. A typed `trackEvent(name: AnalyticsEvent, data?)` that
  no-ops when `window.umami` is absent. The `Window` augmentation for
  `umami` / `khemUmamiBeforeSend` is typed, with zero `any`.
- `src/components/analytics/UmamiAnalytics.tsx` (**new**, `"use client"`):
  `useConsent()` gate, registers `window.khemUmamiBeforeSend` once, a `useEffect`
  syncs `consentGranted`, and it renders `next/script` `strategy="afterInteractive"`
  with the attributes from Decision §5. It renders `null` when unconfigured,
  before hydration, or without consent.
- `src/app/[locale]/layout.tsx`: mount `<UmamiAnalytics />` inside
  `<ConsentProvider>`, with a short comment. No other change.
- `src/components/admin/AdminShell.tsx`: add a "Visitors" external link
  (`target="_blank" rel="noopener noreferrer"`, Lucide `ExternalLink` /
  `Activity`, `strokeWidth={1.25}`) to Sales & Analytics. If the nav item type only
  supports internal `path`s, extend it minimally with an `href` + `external`
  variant. The existing nav item markup and styling are reused.
- `.env.example` and `deploy/env.production.example`: add both
  `NEXT_PUBLIC_UMAMI_*` names with one-line comments (redeploy needed).
- `src/docs/umami-analytics.md` (**new runbook**): architecture, where things are,
  first-time setup, login policy (Decision §6), adding a user, lockout or lost-2FA
  recovery, backups and restore, upgrades (bump the tag, `pull`, `up -d`; Umami
  migrates its own DB), and the consent trade-off.
  - For recovery, the implementer verifies the exact v3 password-reset procedure
    from Umami's docs or source before writing it. It is not guessed.
- `src/docs/hostinger-vps.md`: add rows to "Where things are" and a link to the
  runbook.
- `AGENTS.md` §6: one row, `Analytics | Umami v3 (self-hosted, Docker on the VPS)
  | consent-gated, first-party /hk.js; runbook src/docs/umami-analytics.md`.
  - The file already has uncommitted edits. Add only this row.

## Implementation requirements

- TypeScript strict, zero `any`. The `window` additions go through a `declare
  global` augmentation in `umami.ts`.
- `UmamiAnalytics` uses no dynamic API (`headers()`, `cookies()`). The `[locale]`
  layout must stay prerenderable. Confirm `next build` still reports the locale
  pages as static/SSG.
- Server Component by default. Only `UmamiAnalytics.tsx` is a client component.
- `beforeSend` must be assigned to `window` **before** the `<Script>` element is
  rendered. Assign it at module evaluation of the client component, guarded by
  `typeof window !== "undefined"`, or in the same render pass before the script
  mounts. It must tolerate a missing or invalid `payload.url` by returning `null`.
- `shouldSendPath()` handles `/ar/admin/...` as well as `/admin/...`.
- No new npm dependency.
- Shell scripts: `set -euo pipefail`, root check, idempotent, and secrets never
  echoed to the terminal.
- Comments explain the *why*, matching the house style in `deploy/` and
  `next.config.ts`.

## Security requirements

- Umami and Postgres are never reachable from the internet except through nginx.
  Ports are bound to 127.0.0.1, and Postgres is not published.
- The XFF header sent to Umami is overwritten with `$remote_addr`, never appended.
- `/srv/umami/.env` is mode 600, owner root, and appears in no repo file.
  `env.example` holds names only.
- The default `admin` account does not survive setup. Every account has 2FA.
- Login is rate-limited at nginx.
- No personal data in analytics: admin, account and auth paths, query strings and
  hashes are excluded, and there are no `identify()` calls.
- Telemetry and the update check are disabled (`DISABLE_TELEMETRY`,
  `DISABLE_UPDATES`).
- The CSP is unchanged. Any temptation to add `analytics.khemperfumes.com` to
  `script-src` means the first-party proxy is broken; fix the proxy instead.

## Acceptance criteria

1. `https://analytics.khemperfumes.com` serves the Umami login over valid TLS.
   `curl -sI http://179.67.202.31:3001` from outside fails, and so does an
   external probe of port 5432.
2. `https://khemperfumes.com/hk.js` returns JavaScript (200), and a `POST` to
   `/api/hk` reaches Umami rather than Next.
3. A fresh browser: before choosing a cookie option, no `/hk.js` request. Decline,
   still none. Accept, then `/hk.js` loads and one `/api/hk` page-view fires per
   client navigation.
4. After accepting, re-opening Cookie Settings and switching Analytics off stops
   `/api/hk` requests immediately, without a reload.
5. Visiting `/admin`, `/ar/admin/orders/...`, `/account` or `/unsubscribe?token=x`
   sends nothing. A page with a query string records a URL without it.
6. On localhost the script is not loaded unless the env var is set, and even then
   `data-domains` keeps it from recording.
7. The Umami dashboard shows the visit with the correct country (proving the IP
   header chain).
8. `npm run lint`, `npx tsc --noEmit` and `npm run build` pass, and the locale
   pages are still prerendered.
9. The nightly backup produces a non-empty `.sql.gz`.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build            # confirm [locale] routes still ● (SSG)
bash -n deploy/umami/provision-umami.sh deploy/umami/backup-umami.sh
docker compose -f deploy/umami/docker-compose.yml config -q   # if docker is available locally
```

If unit tests exist for `src/lib`, add a small test for `shouldSendPath()` that
covers the locale prefix, the excluded prefixes and a malformed URL.

## Exact manual steps (operator, after the code is merged)

1. **DNS** (Hostinger hPanel → Domains → DNS): add an `A` record,
   `analytics` → `179.67.202.31`, TTL 3600. Wait until
   `dig +short analytics.khemperfumes.com` returns the IP.
2. **Provision Umami** (root):
   `scp deploy/umami/* root@179.67.202.31:/root/umami/ && ssh root@179.67.202.31 bash /root/umami/provision-umami.sh`
3. **nginx and TLS** (root): copy `khem-umami-proxy.inc` to
   `/etc/nginx/snippets/` and `analytics.khemperfumes.conf` to `sites-available`.
   Issue the cert with
   `certbot certonly --webroot -w /var/www/certbot -d analytics.khemperfumes.com --deploy-hook "systemctl reload nginx"`.
   Then symlink into `sites-enabled`, copy the updated `khemperfumes.conf`, and run
   `nginx -t && systemctl reload nginx`.
4. **First login**: open `https://analytics.khemperfumes.com` and sign in as
   `admin` / `umami`. Set a strong password when forced. Create your personal
   admin user, log out, log in as that user, enable 2FA (save the recovery codes),
   and delete `admin`.
5. **Add the website**: Settings → Websites → Add, name `KHEM`, domain
   `khemperfumes.com`. Copy the Website ID.
6. **Wire the shop** (as `khem`): add `NEXT_PUBLIC_UMAMI_WEBSITE_ID=<id>` to
   `/srv/khem/shared/.env.production`, then push a commit and run `deploy.sh`.
   This is a `NEXT_PUBLIC_*` value, so it needs a rebuild.
7. **Verify** acceptance criteria 1–7 in a private window with DevTools → Network
   filtered to `hk`.
8. **Cookie Policy**: in `/admin` → legal pages, update the Analytics paragraph
   (EN + AR). It should name Umami, self-hosted in Germany, with no cookies, no
   cross-site tracking and no third party, and say it runs only with Analytics
   consent.
9. **Backups**: next morning, `ls -lh /srv/umami/backups` shows a dated file.
