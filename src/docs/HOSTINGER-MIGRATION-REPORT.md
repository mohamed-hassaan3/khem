# KHEM — Hostinger Migration: Readiness Report

Companion to `HOSTINGER-MIGRATION.md`, answering its Required Final Report
against the codebase as it stands. Audited 5 Sep 2026.

---

## STATUS — PAUSED, 5 Sep 2026

**The migration is on hold by the owner's decision. Production stays on Vercel.**
Nothing was changed on Vercel, in DNS, in Clerk, or on the Hostinger box.

### Why

The Hostinger account behind `82.25.107.80` is **PHP shared hosting** and cannot
run this application. Established over SSH, not inferred:

| Check | Finding |
| :--- | :--- |
| Platform | CloudLinux + LiteSpeed, CageFS jail, hPanel |
| Node binaries present | `alt-nodejs18/20/22/24` — v24.6.0, npm 11.5.1 |
| Node.js Selector for this account | **Not provisioned** — `~/.cl.selector` holds only `alt_php83.cfg`; no `~/nodevenv`, no `selectorctl` |
| Passenger | Absent |
| Docroot | `~/domains/khemperfumes.com/public_html/default.php` — a PHP parking page |
| `crontab` CLI | Absent (hPanel Cron Jobs only) |

Node exists on the machine because CloudLinux ships it for every tenant; the
account is not provisioned to run it. With no Node.js Selector and no Passenger
there is no way to bind a persistent `next start` to the LiteSpeed vhost, and a
process started by hand has nothing routing to it and no supervisor on a host
that reaps stray processes. KHEM needs a live Node server — SSR, Server Actions,
the `src/proxy.ts` auth middleware, the Stripe and Clerk webhooks, ISR — so
`output: "export"` is not an escape hatch.

**Resume condition: a Hostinger VPS (KVM) with root, or any host that runs a
supervised Node 24 process behind a reverse proxy.** Everything below this
section was written against the code as it stands and remains accurate; start at
§11 with the new box's IP.

### Two useful facts that survive the pause

- **The server timezone is UTC**, so Decision 3 (§3) is already settled: the
  three daily cron expressions transfer unchanged.
- **Outbound HTTPS works** from the shared box, so Supabase, Stripe, Resend and
  Clerk are reachable from Hostinger's network in general.

### What was completed and still holds

- Migrations applied through `0057` and verified against the live Supabase
  project (§0). This is done and does not need repeating.
- `npm run db:migrate` was repaired (§0) — it had been failing at `0024` and
  applying nothing from there on.
- The production build passes on Node 24.
- The Vercel dependency audit (§2), env inventory (§4), caching analysis (§7)
  and DNS record capture (§9) are host-agnostic and stay valid.

### Live-store safety of the current state

The database now carries `0056` and `0057` while Vercel still serves the older
code. That combination is safe and was checked, not assumed:

- `0056` makes `begin_campaign_dispatch()` refuse an empty claim. The deployed
  code already handles an `ok: false` result by reporting the reason, so the
  effect on production today is that a campaign which would reach nobody is
  refused instead of being silently filed as SENT. Strictly better.
- `0057` only adds two columns and two functions. Nothing deployed calls them.
- The `0024` fix drops and re-creates `customer_directory` identically; `0055`
  re-appends `locale` later in the same run. Verified present afterwards.

---

## 0. What was done during the attempt

| Step | State |
| :--- | :--- |
| Database migrations applied (through `0057`) | **Done** — verified against the pooler, not assumed |
| Production build on Node 24 | **Done** — `npm run build` exits 0 |
| Vercel dependency audit | **Done** — §2 |
| DNS recorded before any change | **Done** — §9 |
| Hostinger deployment | **Not done — no access from here** |
| Hostinger cron configured | **Not done — needs hPanel/SSH** |
| Live test campaign | **Not done — needs the deployment** |
| DNS switch | **Not done — deliberately last** |

### The migration run was silently failing

`npm run db:migrate` was dying at `0024_customers.sql` with *"cannot drop
columns from view"*, and everything from 0024 onward — **including 0056 and
0057** — was never applied. `0055` appends `locale` to `customer_directory`, and
`create or replace view` cannot remove a column, so replaying 0024 on a database
that had reached 0055 asked Postgres to drop it.

The run reported a failure, but the *effect* was invisible: the database looked
healthy, the app kept working, and the two new campaign migrations simply were
not there. Fixed in `0024_customers.sql` by dropping the view before creating it
(safe: only functions depend on it, and Postgres does not track function bodies
as dependencies). The full directory now replays clean, 56 files, ending with
`Schema applied. PostgREST schema cache reload signalled.`

Verified present afterwards: `0056`'s empty-claim guard inside
`begin_campaign_dispatch`, and `0057`'s two lease columns and two lease
functions.

**This is the single most important finding in this report.** A migration
directory that cannot be replayed is one that will fail again on the Hostinger
box, where nothing has been applied at all.

---

## 1. Migration readiness

**Not ready — blocked on hosting, not on the application.** The codebase is
ready to deploy and test; the plan that was to receive it is not capable of
running it (see STATUS). Re-evaluate on a VPS.

Two of the three open decisions in §3 are now answered: the timezone is UTC, and
the process model is whatever the new box allows. Decision 1 — a persistent Node
process — is the one that stopped this attempt.

---

## 2. Vercel dependencies

| Dependency | Location | Risk | Required action |
| :--- | :--- | :--- | :--- |
| Cron scheduling | `vercel.json` | **High** — four scheduled jobs stop existing the moment traffic leaves Vercel: unpaid-order sweep, order feedback, credit expiry, campaign dispatch | Recreate as Hostinger cron (§10). Keep `vercel.json` until the rollback window closes |
| `CRON_SECRET` auto-header | all four `src/app/api/cron/*` | **High** — Vercel injects `Authorization: Bearer $CRON_SECRET`; nothing else does | The cron command must send the header itself |
| `VERCEL_OIDC_TOKEN` | `src/lib/search/embed.ts:30` | **Medium** — how the AI Gateway is authenticated on Vercel with no explicit key. Absent on Hostinger, so semantic search silently degrades to lexical (no crash, one `console.warn`) | Set `AI_GATEWAY_API_KEY` on Hostinger |
| `x-vercel-ip-country` | `src/proxy.ts:131`, `src/app/[locale]/checkout/page.tsx:144`, `src/providers/currency-provider.tsx` | **Medium** — geo currency selection. The header is absent off Vercel, so every visitor falls back to the default currency | Accept the fallback, or map an equivalent header (Cloudflare's `cf-ipcountry`) if a proxy is put in front |
| `x-forwarded-for` trust | `src/app/api/search/route.ts:79` | **Low** — the search rate limit keys on it; on Vercel the platform sets it, behind another proxy it is client-spoofable | Ensure the reverse proxy overwrites rather than appends |
| `@vercel/*` packages | — | **None** | None found. No Blob, no KV, no Analytics, no Speed Insights |
| Edge runtime | — | **None** | Every route is `runtime = "nodejs"` |

`outputFileTracingIncludes` in `next.config.ts` is Vercel-shaped but harmless
elsewhere; it only matters for traced/standalone output.

---

## 3. Hostinger compatibility

**Compatible**, with three decisions to make.

**Compatible as-is:** Next 16.2.12, React 19.2.4, Node 24 (`engines`, `.nvmrc`),
SSR, Server Components, Server Actions, Route Handlers, dynamic routes, the
`redirects()` in `next.config.ts` (they run in the Node server, not on the
platform), `src/proxy.ts` (Next 16's middleware — no Edge dependency), and image
optimization (`sharp@0.34.5` is installed).

### Decision 1 — the plan must run a persistent Node process

This is `next start`, not static export. Shared hosting will not do; it needs a
VPS/Cloud plan with a long-lived process (PM2 or systemd) behind Nginx/OpenLiteSpeed.
Confirm before anything else — every other step assumes it.

### Decision 2 — ISR across multiple processes (**the real caching risk**)

The app has 20 `revalidate` exports (11 × 1h, 4 × 24h, 4 × 5m, 1 × 10m) and 7
modules calling `revalidatePath`/`revalidateTag`. Self-hosted, that cache is a
directory on disk (`.next/cache`) belonging to **one process**.

Run PM2 in cluster mode with 2+ instances and the admin dashboard quietly
half-breaks: an editor saves a product, `revalidatePath` clears the cache of the
one worker that served the action, and every other worker keeps serving the old
page until its own timer lapses. Nothing errors; the change just doesn't appear
for some visitors.

Two options, and one of them must be chosen deliberately:
- **Single instance** (`pm2 start … -i 1`). Simple, correct, and fine for this
  traffic. Recommended for the switch.
- **Shared cache handler** (`cacheHandler` in `next.config.ts` backed by Redis)
  if more than one instance is ever wanted. Do this later, not during the move.

### Decision 3 — cron timezone

Vercel cron expressions are UTC. Hostinger cron runs in the server's timezone.
`order-feedback` at `0 9 * * *` means 09:00 UTC today and 09:00 *server local*
tomorrow. Check `timedatectl` and either set the box to UTC or shift the three
daily expressions. The per-minute campaign job is unaffected.

**Not verified from here:** actual plan limits, memory ceiling, and whether the
image cache directory survives redeploys. All need the box.

---

## 4. Environment variables

Same values as Vercel production unless noted. Never printed here.

**Server-only (must never reach the browser):** `SUPABASE_SECRET_KEY`,
`CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`,
`AI_GATEWAY_API_KEY`, `CONTACT_INBOX_EMAIL`, `ORDER_NOTIFICATION_EMAIL`,
`RESEND_FROM_EMAIL`, `RESEND_HOUSE_FROM_EMAIL`, `RESEND_ORDER_FROM_EMAIL`,
`EMAIL_ASSET_BASE_URL`, `STRIPE_PAYMENT_ENABLED`.

**Client-safe (inlined at build time — must be present when `npm run build`
runs, not only at runtime):** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

**Needs a new value on Hostinger:** `AI_GATEWAY_API_KEY` — previously supplied
implicitly by `VERCEL_OIDC_TOKEN`. Without it semantic search degrades to
lexical.

**Build-time only:** `DATABASE_URL` / `DIRECT_URL` are used by the migration and
seed scripts, not by the running app (it reads through PostgREST). They do not
need to live on the web server.

There is no `SITE_URL` variable: `src/lib/i18n/metadata.ts:14` hard-codes
`https://khemperfumes.com`. That is a **feature** for this migration — a
temporary Hostinger URL cannot become canonical, and sitemap, metadata and every
email link keep pointing at production while you test.

---

## 5. Clerk checklist

- **Authentication:** `src/proxy.ts` guards `/account` and `/admin`; admin
  authority is `ADMIN_EMAILS`, not JWT claims. Nothing platform-specific.
- **Webhooks:** one endpoint, `/api/webhooks/clerk`, Svix-verified against
  `CLERK_WEBHOOK_SIGNING_SECRET`. Handlers are idempotent (upsert on `clerkId`),
  so a period of double delivery during the move creates no duplicate users.
- **Redirect URLs / production domain:** the public domain does not change, so
  **no Clerk configuration change is needed**. Do not edit it.
- **For testing on a temporary URL:** add it as a *second* Clerk development
  instance or accept that sign-in will not work there — do not repoint the
  production instance at a temporary host.
- **Status:** ready, no changes required.

---

## 6. Supabase checklist

- **Database:** stays where it is. Nothing to migrate. Connection is over
  HTTPS/PostgREST from the app, so no IP allowlisting is involved.
- **Migrations:** applied through `0057`, verified (§0).
- **RLS:** on, with no policy on the campaign tables; every dispatch function is
  `security definer` and revoked from `public`/`anon`/`authenticated`.
- **Server access:** `SUPABASE_SECRET_KEY`, server-only, never in a
  `NEXT_PUBLIC_` name.
- **Client access:** publishable key only.
- **Status:** ready.

Reminder from AGENTS.md §9: any future migration applied outside
`npm run db:migrate` must signal `notify pgrst, 'reload schema';` or the app
degrades silently rather than erroring.

---

## 7. Caching and ISR

**Current strategy.** Public editorial and catalogue pages are ISR (1h mostly,
24h for legal, 5m for fast-moving), invalidated on demand by `revalidatePath`
from the admin actions. `/account`, `/cart`, `/checkout` and all of `/admin` are
`force-dynamic`. No `unstable_cache`, no `use cache`, no Cache Components.

**Problem found.** None in the code. The risk is entirely operational and is
Decision 2 above: on-demand revalidation is per-process once self-hosted.

**Changes required.** None to the code. One to the process model: single
instance, or a shared cache handler.

**Hostinger behaviour to watch.** `.next/cache` must be writable and must
survive restarts, or every deploy starts cold and the first visitor to each page
pays for the regeneration. Do not put the app on a read-only filesystem.

Private data is not at risk: no user-specific page is cached, and nothing sets
`s-maxage` on an authenticated response.

---

## 8. SEO

- `robots.txt` and `sitemap.xml` are generated routes (`src/app/robots.ts`,
  `src/app/sitemap.ts`) and build as static — they will exist on Hostinger.
- Canonicals, OpenGraph and every email link are built from the hard-coded
  `SITE_URL`, so a temporary host cannot leak into them.
- The four permanent category redirects live in `next.config.ts` and are served
  by the Node server, not by Vercel. They keep working. **Verify anyway after
  the switch** — a reverse proxy that answers before Next does can swallow them.
- No `noindex` anywhere outside the intended routes; metadata and structured
  data are untouched by this migration.
- Bilingual routing (`as-needed` prefixing, English unprefixed) is done in
  `src/proxy.ts` — Node-side, no platform dependency.

Post-switch: re-fetch `/robots.txt` and `/sitemap.xml`, spot-check a product
canonical in both locales, and confirm HTTPS→HTTPS with no chain.

---

## 9. DNS — recorded before touching anything

Nameservers are already Hostinger's (`athena/apollo.dns-parking.com`), so every
change is in hPanel and no registrar transfer is involved.

### Must change (website only)

| Record | Current | Becomes |
| :--- | :--- | :--- |
| `khemperfumes.com` A | `216.198.79.1` (Vercel) | Hostinger server IP |
| `www` CNAME | `khemperfumes.vercel.app.` | Hostinger host (or A to the same IP) |

### Must NOT change — email and deliverability

| Record | Value | Why |
| :--- | :--- | :--- |
| `MX` | `5 mx1.hostinger.com`, `10 mx2.hostinger.com` | The house mailbox |
| `TXT` apex | `v=spf1 include:_spf.mail.hostinger.com ~all` | SPF |
| `TXT _dmarc` | `v=DMARC1; p=none` | DMARC |
| `TXT resend._domainkey` | RSA public key | **Resend DKIM — every customer email signs with this** |
| `TXT send.khemperfumes.com` | `v=spf1 include:amazonses.com ~all` | Resend's sending subdomain SPF |

Deleting either of the last two silently sends every order confirmation,
campaign and receipt to spam. They have nothing to do with hosting.

Lower the A/CNAME TTL to 300s a day before the switch; restore it afterwards.

---

## 10. Cron on Hostinger

Vercel injected the bearer token; a Hostinger crontab must send it. Put the
secret in a root-readable env file rather than in the crontab line, so it is not
visible in the panel's job list.

`/home/khem/bin/khem-cron.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
set -a; . /home/khem/.cron.env; set +a   # holds CRON_SECRET=…  (chmod 600)

curl -fsS -m 110 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://khemperfumes.com/api/cron/$1"
```

crontab:

```cron
# Campaigns — every minute. Safe to overlap by design (0057's run lease);
# flock keeps a slow run from queueing more processes behind it anyway.
* * * * * /usr/bin/flock -n /tmp/khem-campaigns.lock /home/khem/bin/khem-cron.sh send-campaigns >> /home/khem/logs/cron.log 2>&1

# The three daily jobs. Times are SERVER LOCAL — see Decision 3.
0 3 * * *  /home/khem/bin/khem-cron.sh sweep-unpaid-orders >> /home/khem/logs/cron.log 2>&1
0 9 * * *  /home/khem/bin/khem-cron.sh order-feedback      >> /home/khem/logs/cron.log 2>&1
30 3 * * * /home/khem/bin/khem-cron.sh expire-credits      >> /home/khem/logs/cron.log 2>&1
```

Per-minute campaign dispatch is only safe because `0057` is applied: without the
run lease, a tick arriving while a large send is still running would put two
senders on the same list. **Confirm `0057` is on the database the Hostinger app
talks to before enabling the minute schedule** — it is the same Supabase project,
so it already is, but confirm rather than assume.

Expected responses: `200 {"dispatched":0,…}` when idle, `401` if the header is
wrong, `500` if `CRON_SECRET` is unset on the server.

Once the minute cron is live, four route doc-comments describing the daily
Vercel cadence become wrong (`send-campaigns`, `sweep-unpaid-orders`,
`order-feedback`, `expire-credits`). Worth a follow-up commit; nothing behaves
differently.

---

## 11. Order of operations

1. Confirm the plan runs a persistent Node process (Decision 1).
2. Create the app dir, Node 24, `npm ci`.
3. Put the full env set in place — including `AI_GATEWAY_API_KEY` and the four
   `NEXT_PUBLIC_*` **before** building.
4. `npm run build`, then `npm run start` under PM2/systemd, **single instance**.
5. Nginx/OpenLiteSpeed → the Node port. HTTPS on the temporary host.
6. Smoke test on the temporary URL (§12).
7. Add the cron jobs; watch `cron.log` for a `200`.
8. Send a campaign to one hand-typed address, scheduled ~3 minutes out.
9. Lower DNS TTL. Write the rollback line down (§13).
10. Switch A and `www` only. Leave every mail record alone.
11. Verify production (§12 again, plus checkout and both webhooks).
12. Update the Stripe and Clerk webhook endpoints only if their URLs contain a
    Vercel host — if they point at `khemperfumes.com`, they follow the DNS and
    need no edit.
13. Keep the Vercel deployment and `vercel.json` for at least a week.
14. Monitor 404/500s, webhook delivery, cron log, Resend dashboard.

---

## 12. Test checklist

**Public:** home, collections, a product in both locales, images (Cloudinary,
Supabase comment images, Clerk avatars), Arabic RTL, mobile, 404 page.
**Auth:** sign up, sign in, sign out, session persistence, `/account`, `/admin`
as an allowlisted email, `/admin` as a customer (must 404, not redirect).
**Data:** products, collections, customers, orders, discounts, credits.
**Money:** a real Stripe test payment end to end, and the webhook that follows.
**Mail:** order confirmation, and the campaign test below.
**Cron:** all four endpoints return 200 to the wrapper and 401 without the header.
**SEO:** `/robots.txt`, `/sitemap.xml`, a canonical tag, one old category URL
returning 308.

### The campaign scheduling test

1. `/admin/campaigns` → new campaign, subject and a line of body.
2. Both audience switches **off**; add one address you own. Save.
3. Schedule it ~3 minutes out. Confirm the field reads back the time you chose,
   in your own zone, and that the list row shows the same moment.
4. Watch `cron.log`. Within a minute of that moment the letter arrives.
5. Confirm exactly **one** copy — that is the lease and the `campaign_sends`
   primary key both doing their job.
6. Try to schedule a campaign with no audience at all: refused, before it is
   queued.

---

## 13. Rollback

The switch is two DNS records, so the rollback is two DNS records.

```
Problem on production
        ↓
hPanel → restore A khemperfumes.com → 216.198.79.1
         restore CNAME www → khemperfumes.vercel.app.
        ↓
Traffic returns to Vercel (still deployed, still has its crons)
        ↓
Investigate on the Hostinger box, which is untouched
```

Preconditions: TTL lowered to 300s beforehand; the Vercel project not deleted,
not disabled, `vercel.json` still in the repo; no Clerk or Stripe production
configuration edited during the move. Nothing in this migration is destructive
to data — the database is the same Supabase project throughout, which is why
the rollback is only ever about where the HTTP requests land.
