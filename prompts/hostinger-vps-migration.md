# Hostinger VPS migration: remove Vercel, move the database, deploy

## Goal

Move KHEM off Vercel completely and run it on the owner's **Hostinger KVM 2 VPS
(Germany)**, with the database moved to **Supabase Frankfurt (`eu-central-1`)**.
The store is currently paused on Vercel, so there is no live traffic to protect
and no write freeze to arrange.

Three outcomes:

1. **The repository no longer depends on Vercel.** No `vercel.json`, no
   `@vercel/*` package, no `x-vercel-*` header, no `VERCEL_OIDC_TOKEN`. No
   comment describes Vercel as the thing that sets a header, sends a secret or
   issues HSTS.
2. **The database lives in Frankfurt**, losslessly, per
   `prompts/supabase-region-migration.md` as amended.
3. **`https://khemperfumes.com` is served from the VPS.** The setup is
   nginx → a single `next start` process under PM2, Let's Encrypt TLS, the four
   crons in the system crontab, a repeatable deploy script, and a one-command
   rollback to the previous release.

This document supersedes `src/docs/HOSTINGER-MIGRATION-REPORT.md` §1–§3 and
§11. That report was written for shared hosting with Supabase in Tokyo. Its DNS
(§9), test checklist (§12) and campaign test still apply.

## Skills and docs read

- `AGENTS.md`, `.agents/skills/supabase/SKILL.md`, `.agents/skills/ai-sdk` (to be
  re-read at implementation for the provider swap).
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`. It requires:
  - a reverse proxy in front of Next;
  - **nginx must not buffer responses**, or streaming breaks (`X-Accel-Buffering: no`);
  - `sharp` on glibc may need the memory-allocator fix;
  - a **graceful shutdown** (SIGTERM plus a 10–30 s drain) so pending `after()`
    callbacks finish, which matters for `src/actions/checkout.ts`;
  - a single instance needs no shared cache handler.
- Supabase "migrating within Supabase" and "backup-restore" (see the DB prompt).
- Hostinger VPS plan page (KVM 2: 2 vCPU, 8 GB RAM, 100 GB NVMe).

## Vercel audit: everything found

| # | Coupling | Where | Action |
| :--- | :--- | :--- | :--- |
| V1 | Cron schedule | `vercel.json` (4 jobs, UTC) | **Delete file.** Recreate in the VPS crontab (phase 5) |
| V2 | Cron auth injected by the platform | `src/app/api/cron/*/route.ts` doc comments | Code unchanged (it already checks `Authorization: Bearer $CRON_SECRET`); comments now say the VPS cron wrapper sends it |
| V3 | `@vercel/analytics` | `package.json`, `src/app/[locale]/layout.tsx:6,569` | **Remove** the dependency and `<Analytics />`. Off Vercel it collects nothing and requests a script that 404s. No replacement in this task |
| V4 | `x-vercel-ip-country` geo header | `src/proxy.ts:143`, `src/app/[locale]/checkout/page.tsx:178`; comments in `src/actions/checkout.ts`, `src/lib/shipping.ts`, `src/providers/currency-provider.tsx` | New `src/lib/geo.ts` → `visitorCountry(headers)` reads **`x-khem-country`**, a header **only nginx sets** (Decision B). An empty or missing value returns `null`, which is the existing "unknown" path, so the browser-timezone fallback in `currency-provider.tsx` still works. Both call sites use the helper |
| V5 | `VERCEL_OIDC_TOKEN` and the Vercel AI Gateway | `src/lib/search/embed.ts:30`, `src/lib/search/semantic.ts:64`, `src/lib/search/config.ts`, `scripts/embed-catalog.ts:220` | Decision A |
| V6 | HSTS "issued by Vercel" | `next.config.ts` `headers()` comment | HSTS moves to nginx (`max-age=31536000; includeSubDomains`, **no `preload`**). Comment updated |
| V7 | `outputFileTracingIncludes` (for Vercel's lambda bundles) | `next.config.ts` | **Remove.** On the VPS `process.cwd()` is the release directory and `public/email/khem-logo.png` is on disk; verified by sending a test email |
| V8 | `.vercel/` project link | repo root (gitignored) | **Delete** locally |
| V9 | Docs that name Vercel as the host | `AGENTS.md` §6 (Hosting row), §8 note on Vercel ISR writes, `src/lib/admin/revalidate.ts` header, `src/docs/HOSTINGER-MIGRATION-REPORT.md` STATUS, `supabase/README.md` | Update to the VPS. Revalidate windows **stay as they are**: on-demand `revalidatePath` is still what keeps pages fresh |
| V10 | `x-forwarded-for` used as the rate-limit key | `src/app/api/search/route.ts:84`, `src/lib/email/rate-limit.ts:74` | Code unchanged. nginx **overwrites** the header with `$remote_addr`, so a client cannot spoof it |
| — | Not Vercel, kept | `.github/workflows/keep_alive.yml` (pings Supabase) | Kept. **Owner updates** the two GitHub secrets to the Frankfurt values |
| — | Historic comments that explain *why* a revalidate window or image setting was chosen | page files, `next.config.ts` images block | Left alone. They are rationale, not setup |

Not affected: `after()` works on a long-running Node process. `src/proxy.ts`
runs in Node. The `redirects()` and CSP come from `next.config.ts` and are
served by Next. Metadata and the sitemap hard-code `https://khemperfumes.com`.

## Decisions (owner to confirm; recommendation first)

- **A. Embeddings provider.** *Amended 2026-11-18 by the owner:* stay on the
  **AI Gateway** with `AI_GATEWAY_API_KEY` (no OIDC), switching to the free-tier
  **`cohere/embed-v4.0`** at 1536 d, which was verified through the gateway first.
  `openai/text-embedding-3-small` is not on the free tier. This means
  `EMBEDDING_VERSION` 2 and `npm run embed -- --reembed` on Frankfurt after
  phase 2. The original options follow for the record.
  - **(Recommended) Direct OpenAI** via `@ai-sdk/openai` with an `OPENAI_API_KEY`.
    It is the same `text-embedding-3-small` at 1536 dimensions, so stored vectors
    stay valid: **no re-embed, `EMBEDDING_VERSION` unchanged**. This removes the
    last Vercel account dependency.
  - The alternative is to keep the AI Gateway with `AI_GATEWAY_API_KEY`. It
    works off Vercel, but billing stays on the Vercel account.
- **B. Visitor-country detection** (sets the starting currency and pre-fills the
  checkout country; never a security decision, since `checkoutSchema` checks the
  submitted country).
  - **(Recommended) nginx GeoIP2** using MaxMind GeoLite2. The owner creates a free
    MaxMind account and gives the licence key. `geoipupdate` refreshes the
    database weekly.
  - Without it, the header is always empty and the browser-timezone fallback
    applies. It's correct for Egypt and the Gulf, and the visitor can always
    switch currency.
- **C. VPS OS**: **Ubuntu 24.04 LTS**, plain, without a control panel. If the
  owner picked another template, reinstall it from hPanel before phase 3. The
  box is empty.
- **D. Production secrets.** Stripe has **no keys in `.env.local`**, and several
  production-only values exist only in Vercel's environment
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PAYMENT_ENABLED`,
  `RESEND_HOUSE_FROM_EMAIL`, `RESEND_ORDER_FROM_EMAIL`, `EMAIL_ASSET_BASE_URL`).
  - **(Recommended)** Claude runs `vercel env pull --environment=production` into
    the scratchpad (owner signs in to the Vercel CLI), checks variable names only,
    copies the file to the VPS over `scp`, and deletes the local copy.
  - The alternative is that the owner fills `/srv/khem/shared/.env.production` on
    the VPS by hand from a template Claude writes.

## Owner prerequisites (Claude cannot do these)

1. **VPS access.** From hPanel, provide the VPS IPv4, set OS = Ubuntu 24.04, and
   add this Mac's SSH public key (`~/.ssh/id_ed25519.pub`; Claude can generate
   one) to root. Done when `ssh root@<IP>` works from this Mac without a
   password.
2. **Supabase Frankfurt project** plus the extensions plus the 4 `TARGET_*` values
   in `.env.local` (DB prompt, "Owner actions").
3. **Postgres.app 17** installed on this Mac.
4. **GitHub deploy key.** Claude generates a read-only key on the VPS and prints
   the *public* half. The owner adds it under repo → Settings → Deploy keys (read
   access only).
5. Per Decision A: an OpenAI API key. Per Decision B: a MaxMind licence key.
6. **DNS access in hPanel** for the switch in phase 6. Claude gives the exact
   records.

## Phases (in order; each ends with its own check)

### Phase 1: Vercel decoupling (local code)

Apply V1 and V3–V9. Then:
`npm install` (lockfile updated), `npx tsc --noEmit`, `npm run lint`,
`npm run build`. Grep must return nothing for
`x-vercel|@vercel/|VERCEL_OIDC|vercel\.json` outside `src/docs/` and
`prompts/`.

`src/lib/geo.ts` contract:

```ts
export const VISITOR_COUNTRY_HEADER = "x-khem-country";
/** ISO-3166 alpha-2 upper-case, or null when absent/empty/malformed. */
export function visitorCountry(headers: Pick<Headers, "get">): string | null;
```

It validates `/^[A-Z]{2}$/` after upper-casing. Anything else is `null`, so the
existing `resolveCurrencyForCountry` / `detectedCountryCode` never see junk.

### Phase 2: Database → Frankfurt

Run `prompts/supabase-region-migration.md` as amended. Gate: its section C
passes in full (schema diff empty, 73 row counts equal, sequences equal,
`db:verify`, `db:test:sales`, `db:test:finance`, `embed -- --check`, storage 3/3,
realtime 0 tables). Then `.env.local` is switched to Frankfurt.

### Phase 3: Provision the VPS (over SSH from this Mac)

Idempotent script `deploy/provision.sh`, committed and run as root:

- `timedatectl set-timezone UTC`, so cron times match the old Vercel UTC
  schedule. Enable `unattended-upgrades`.
- A 2 GB swapfile, as headroom for `next build` next to the running app.
- User **`khem`** (no sudo, no password, SSH key only) owns `/srv/khem`.
- Firewall: `ufw` allows only 22, 80 and 443. `fail2ban` for sshd.
- SSH: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`.
- **Node 24** (NodeSource; matches `engines` and `.nvmrc`). PM2 installed
  globally, with `pm2 startup systemd -u khem` so it survives reboots and
  `pm2-logrotate`.
- `nginx`, `certbot` + `python3-certbot-nginx`, and per Decision B
  `libnginx-mod-http-geoip2` + `geoipupdate` (with a weekly timer).
- `libjemalloc2`, set as `LD_PRELOAD` for the Next process (self-hosting guide,
  sharp on glibc).

Layout:

```
/srv/khem/
  repo/                   bare clone, fetched with the deploy key
  releases/<git-sha>/     one checkout + build per deploy (keep last 5)
  current -> releases/<sha>
  shared/.env.production  chmod 600, owner khem — the only copy of secrets
  shared/.cron.env        chmod 600 — CRON_SECRET only
  logs/
```

### Phase 4: Deploy the app

Repo files:

- **`deploy/ecosystem.config.cjs`**: one app `khem`, `cwd: /srv/khem/current`,
  `next start -p 3000 -H 127.0.0.1` (never public), **`instances: 1`, fork
  mode** (single process, so the on-demand ISR invalidation stays coherent),
  `kill_timeout: 30000` (drains `after()`), `max_memory_restart: 1500M`, and env
  from `shared/.env.production`.
- **`deploy/deploy.sh`** (run as `khem`):
  1. fetch the `main` HEAD
  2. check it out into `releases/<sha>`
  3. symlink `.env.production`
  4. `npm ci`, then `npm run build` (the `NEXT_PUBLIC_*` values are inlined
     here, so the env file must be present)
  5. atomically re-point `current`
  6. `pm2 reload khem`, then health-check `GET http://127.0.0.1:3000/` for a
     200 within 60 s. **On failure, re-point `current` at the previous release
     and reload.**
  7. prune old releases.
- **`deploy/rollback.sh`**: re-points `current` at the previous release and
  reloads.
- **`deploy/nginx/khemperfumes.conf`**:
  - `server_name khemperfumes.com www.khemperfumes.com`; `www` → 301 to the apex.
  - `proxy_pass http://127.0.0.1:3000` with `proxy_http_version 1.1`, the
    `Host` header kept, and
    **`X-Forwarded-For $remote_addr` (overwrite, not append)**,
    `X-Forwarded-Proto $scheme`.
  - **`proxy_set_header x-khem-country $geoip2_country_code`**, or `""` without
    GeoIP. Either way a client-sent value is never passed through.
  - `proxy_buffering off` (streaming).
  - `client_max_body_size 25m` (comment photos).
  - `Strict-Transport-Security` on HTTPS only.
  - `/_next/static/` gets `expires max`.
  - gzip on for text types.
  - The access log omits query strings on `/api/webhooks/*`.

Env file contents: every variable in the audit's server and client lists, the
Frankfurt Supabase values, the production Clerk, Stripe and Resend values
(Decision D), the `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` (Decision A),
`CRON_SECRET` (a **new** random value; the Vercel one is retired with Vercel),
`KHEM_PRELAUNCH` at the owner's chosen value, and `NODE_ENV=production`.
**Not** included: `DIRECT_CONNECTION_STRING`, `SUPABASE_DB_URL` (scripts only),
`ANTHROPIC_API_KEY` (unused by the app).

Check before DNS:
`curl -H 'Host: khemperfumes.com' http://<IP>/` returns 200 with the KHEM HTML.
Clerk's live key is domain-bound, so full sign-in is only tested after phase 6.

### Phase 5: Cron

`deploy/cron/khem-cron.sh` calls
**`http://127.0.0.1:3000/api/cron/<job>`** directly, so the secret never leaves
the box and DNS is not involved. It reads `CRON_SECRET` from
`shared/.cron.env` and uses `curl -fsS -m 110`.

`deploy/cron/khem.crontab` is installed for user `khem` (box is UTC). The three
daily jobs keep the exact `vercel.json` times. **Amended during
implementation:** `send-campaigns` runs **every minute**, not daily. The route's
own documentation showed the real trigger had been an external cron-job.org call
every few minutes, with `vercel.json` only a backstop. That external trigger
holds the retired `CRON_SECRET` and must be switched off by the owner.

```
* * * * *   send-campaigns
0 3 * * *   sweep-unpaid-orders
30 3 * * *  expire-credits
0 9 * * *   order-feedback
```

Each job uses `flock -n` and appends to `logs/cron.log`. Check by running all
four once by hand: 200 each, and a call without the header answers 401.

### Phase 6: DNS, TLS, webhooks

1. The owner changes **only** these in hPanel → DNS:
   - `A @` → VPS IP
   - `www` CNAME `khemperfumes.vercel.app.` → `CNAME khemperfumes.com.`
   - remove any `AAAA` that points at Vercel.
   **MX, SPF, DMARC, `resend._domainkey`, `send.*` stay untouched.** List in
   `HOSTINGER-MIGRATION-REPORT.md` §9.
2. After propagation:
   `certbot --nginx -d khemperfumes.com -d www.khemperfumes.com --redirect`.
   Check auto-renew with `certbot renew --dry-run`.
3. Webhooks:
   - The owner confirms the **Stripe** endpoint is
     `https://khemperfumes.com/api/webhooks/stripe` and the **Clerk** (Svix)
     endpoint is `https://khemperfumes.com/api/webhooks/clerk`. A
     `*.vercel.app` URL there must be edited.
   - The signing secrets do not change when the URL stays the same.
   - Send a test event from each dashboard: 200.

### Phase 7: Verification

The full `HOSTINGER-MIGRATION-REPORT.md` §12 checklist, plus:

- The response headers carry HSTS, the CSP, and **no** `x-vercel-*`. The CSP
  `connect-src` and `img-src` name the **Frankfurt** Supabase host.
- Comment photos load from the Frankfurt storage.
- Semantic search returns semantic results; the logs show no "No AI Gateway
  credentials" / "no OpenAI key" warning.
- A Stripe payment end to end; the webhook marks the order PAID; the order
  number continues the Tokyo sequence.
- A cash order: both emails arrive, **with the inline logo** (proves V7's
  removal was safe).
- The campaign test from report §12.
- `sudo reboot`, then the site comes back on its own (PM2 systemd) and
  `pm2 logs` is clean.
- `deploy/rollback.sh`, then the previous release serves; deploy again.
- `curl -H 'x-khem-country: FR'` from outside does **not** change the currency
  cookie (the header is overwritten).
- `curl -H 'X-Forwarded-For: 1.2.3.4'` does not change the rate-limit key.

### Phase 8: Decommission Vercel (owner, after 7 clean days)

The owner disconnects the Git integration (so pushes stop building on Vercel),
then deletes the Vercel project; this also deletes its stored env copies.
Once the new DB has run 14 clean days, pause the Tokyo Supabase project, and
delete it a week later. Update the GitHub `keep_alive` secrets to Frankfurt
(phase 2).

## Files likely to change

| File | Change |
| :--- | :--- |
| `vercel.json`, `.vercel/` | deleted |
| `package.json`, `package-lock.json` | − `@vercel/analytics`; + `@ai-sdk/openai` (Decision A); + `db:copy-storage` script |
| `src/app/[locale]/layout.tsx` | − Analytics import and element |
| `src/lib/geo.ts` (new) | header name and `visitorCountry()` |
| `src/proxy.ts`, `src/app/[locale]/checkout/page.tsx` | use `visitorCountry()` |
| `src/actions/checkout.ts`, `src/lib/shipping.ts`, `src/providers/currency-provider.tsx` | comments only |
| `src/lib/search/{config,embed,semantic}.ts`, `scripts/embed-catalog.ts` | provider and credential check (Decision A) |
| `src/app/api/cron/*/route.ts` | doc comments only |
| `next.config.ts` | − `outputFileTracingIncludes`; HSTS comment |
| `scripts/db-copy-storage.ts` (new) | per DB prompt |
| `deploy/` (new) | `provision.sh`, `deploy.sh`, `rollback.sh`, `ecosystem.config.cjs`, `nginx/khemperfumes.conf`, `cron/khem-cron.sh`, `cron/khem.crontab`, `env.production.example` (names only) |
| `src/docs/hostinger-vps.md` (new) | operator runbook: deploy, rollback, logs, cert renewal, cron, adding an env var (edit `shared/.env.production`, **re-run deploy for `NEXT_PUBLIC_*`**, `pm2 reload` for server-only) |
| `AGENTS.md`, `supabase/README.md`, `src/lib/admin/revalidate.ts`, `src/docs/HOSTINGER-MIGRATION-REPORT.md` | host references → VPS |
| `.env.example` | names updated (`OPENAI_API_KEY`, no `VERCEL_*`) |

## Security requirements

- Secrets are never printed, committed or logged. Claude prints variable
  **names** only. Secrets live in one place, `/srv/khem/shared/.env.production`
  (600, owner `khem`). Local temporary copies go in the scratchpad and are
  deleted.
- Next listens on **127.0.0.1 only**; only nginx is public; `ufw` allows
  22/80/443.
- SSH uses keys only. The app runs as unprivileged `khem`, never root.
- The deploy key is **read-only** and scoped to this one repo.
- nginx overwrites `X-Forwarded-For` and `x-khem-country`, so neither can be
  supplied by a client.
- HSTS without `preload`, so the decision can still be reversed.
- `CRON_SECRET` is newly generated. Cron calls stay on loopback.
- No grant, RLS policy or `SECURITY DEFINER` change in the database (DB prompt).
- The CSP stays enforcing and is derived from the Frankfurt URL at build time.

## Acceptance criteria

- Repo grep clean of Vercel coupling (phase 1). `tsc`, `lint` and `build` pass.
- DB section C passes. The site reads only from Frankfurt.
- `https://khemperfumes.com` and `www` serve from the VPS over valid TLS. HTTP
  and `www` redirect to the apex in one hop.
- The four crons run on schedule with a 200 in `cron.log`.
- Stripe and Clerk webhooks deliver 200s.
- Survives a reboot. Rollback works in one command.
- The phase 7 checklist is fully ticked, and any failure is reported verbatim.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
npm run db:verify && npm run db:test:sales && npm run db:test:finance
npm run embed -- --check
# on the VPS
nginx -t
pm2 status
certbot renew --dry-run
```

## Manual test steps for the owner afterwards

1. Open `https://khemperfumes.com` in a private window: home, a collection, a
   product in EN and `/ar/…`, search.
2. Sign up, sign in, then open `/account`. As an admin email, open `/admin`:
   orders, customers and finance show the history.
3. Place a Stripe test order. It shows PAID in admin and the email arrives with
   the logo.
4. Check that the Stripe dashboard → Webhooks shows recent 200s, and Clerk →
   Webhooks shows the same.
5. The next morning, `ssh khem@<IP> tail /srv/khem/logs/cron.log` shows the
   03:00, 03:30, 09:00 and 10:00 runs.
6. To deploy a change later: push to `main`, then
   `ssh khem@<IP> /srv/khem/current/deploy/deploy.sh`.
