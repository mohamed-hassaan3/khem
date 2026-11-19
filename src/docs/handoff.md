# KHEM — Session Handoff

_Written 2026-11-19. Read this first in a new session, then `AGENTS.md` and
`src/docs/hostinger-vps.md`._

## 1. Production right now

| Item | State |
| :--- | :--- |
| Host | Hostinger KVM 2 VPS, Germany — `179.67.202.31`, Ubuntu 24.04 |
| Domain | `khemperfumes.com` A record → `179.67.202.31` (moved off Vercel) |
| Stack | nginx 1.24 → one `next start` under PM2 (`khem`, user `khem`), Node 24, Let's Encrypt |
| Live release | `/srv/khem/current` → `releases/864624631ea0` = commit `8646246` on `main` |
| Rollback targets | `048aa2a`, `69d3cd5`, `64d7bf6`, `17bc59b` in `/srv/khem/releases/` (`deploy/rollback.sh`) |
| Env file | `/srv/khem/shared/.env.production` (mode 600, owner `khem`) |
| Cron | System crontab for `khem`, 5 jobs via `deploy/cron/khem-cron.sh` → `/srv/khem/logs/cron.log`: send-campaigns (every min), sweep-unpaid-orders 03:00, expire-credits 03:30, purge-search-events 04:00, order-feedback 09:00 |
| Database | Supabase **Frankfurt** (eu-central-1), Postgres 17, pgvector + pg_trgm, Realtime off |
| Old database | Supabase **Tokyo** — still running, untouched, kept as fallback (see to-dos) |
| Embeddings | Vercel AI Gateway with `AI_GATEWAY_API_KEY`, model `cohere/embed-v4.0` @ 1536 dims (`src/lib/search/config.ts`) |
| Clerk | Production instance (`pk_live` / `sk_live`) on the server |

### Migrations applied by hand (not via `npm run db:migrate`)

Applied directly with `psql` on Frankfurt: `0072a` (not recorded in the
migrations table), `0073`, `0074`, `0075`, `0076`.
**`0072b` is deliberately NOT applied — do not run `npm run db:migrate`**, it
would apply it. Details: `supabase/README.md` → "Migrations applied out of order".

### Recently shipped and verified

- **Routing 404s fixed** (`048aa2a`, `69d3cd5`):
  - `NEXT_DEPLOYMENT_ID` per build, with static files carried forward between releases.
  - `experimental.optimisticRouting: false` in `next.config.ts`.
  - Verified in real Chrome: 0 RSC 404s across 780 requests, 221 of them signed in.
- **Search tracking** (`64d7bf6`): the `search_events` table, the `/admin/search` report, and 90-day purge by cron. No user ID or IP is stored.
- **Product embedding trigger fix** (`17bc59b`, migration 0073).
- **Arabic search fix and AI search redesign — both already built and deployed** (`8646246`).
  - Plans: `prompts/arabic-search-fix.md` and `prompts/ai-search-redesign.md`.
  - Mockup: https://claude.ai/artifact/EwnECY5asohgCp6WWBm4jF
  - The owner approved the mockup ("for search go ahead") before the build. These plans are **not waiting for review**. Remaining work is only feedback after seeing it live.
  - Verified in Chrome in EN and AR: AI badge, "Ranked by meaning", "Matches" lines, refine chips, RTL. Without an AI key, no AI claims are rendered.

### Fixed on 2026-11-18 (~22:08 UTC): `[SENSITIVE]` placeholders

`vercel env pull` writes the literal text `[SENSITIVE]` for variables Vercel
marks sensitive. Five such lines reached the server's `.env.production`:
`ADMIN_EMAILS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_INBOX_EMAIL` and
`ORDER_NOTIFICATION_EMAIL`. As a result:
- the admin link and `/admin` were hidden in production;
- outgoing email was most likely failing from the move until the fix.

The owner replaced them from `.env.local` and restarted PM2. Now 0 placeholders
remain, and the app restarted at 22:08:32 UTC.

**Confirmed by the owner on 2026-11-19:**
- The admin link shows on khemperfumes.com.
- Email is working.

Any new value pulled from Vercel must still be checked for `[SENSITIVE]`.

## 2. Temporary items still on the server

| Item | State | Action |
| :--- | :--- | :--- |
| nginx RSC diagnostic log (`conf.d/khem-rscdebug.conf`, its log) | **Already removed** 2026-11-18. `conf.d/` is empty, `khem-proxy.inc` is restored, and nothing about RSC or debug is left in the nginx config or `/var/log/nginx/`. | None |
| Watchers or `tail -f` processes | **None running** (checked 2026-11-19). | None |
| `/srv/khem/shared/.env.production.bak` (from 2026-11-18 13:22) | **Deleted** 2026-11-19, confirmed gone. `shared/` now holds only `.cron.env` and `.env.production`. | None |
| Temporary `/root/fix.env`, `/root/env.new` | Not present. | None |

## 3. Owner to-dos

- [x] **Confirm the production admin.** Done 2026-11-19: the admin link shows on khemperfumes.com.
- [x] **Confirm email.** Done 2026-11-19: email works.
- [ ] **cron-job.org:** switch off the old jobs. The VPS crontab now runs all five; leaving both on would run each twice.
- [ ] **GitHub Actions secrets** for `.github/workflows/keep_alive.yml`: set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the **Frankfurt** values. Otherwise it keeps pinging Tokyo, and Frankfurt can be paused for inactivity.
- [ ] **Delete the Vercel project around 2026-11-25**, after 7 clean days on the VPS. Check first that nothing still needs a Vercel-only value. (Sensitive values cannot be pulled anyway; their source of truth is now `.env.local` plus the server file.)
- [ ] **Pause the Tokyo Supabase project after 2026-12-02**, then remove the `TOKYO_*` lines from `.env.local`.
- [ ] **AI Gateway free tier (decision pending):** Cohere on the free tier allows 5 embedding calls per minute for the whole team. Above that, searches fall back to keyword search, honestly unlabelled. Options:
  - (1) buy a little Gateway credit (recommended; it ends the free tier);
  - (2) use meaning-based search only on committed searches on `/search`;
  - (3) accept the fallback.
- [x] Delete `.env.production.bak` on the server. Done 2026-11-19 (see §2).

## 4. Local machine notes

- `.env.local` holds both Clerk key pairs; only one pair may be active at a time.
  - Next.js uses the **last** value of a repeated variable.
  - A `pk_test` key with an `sk_live` key signs the browser in but leaves the server seeing no user, so there is no admin link and `/admin` returns 404.
  - Currently the owner has the **production** pair active, so local sign-in only works on khemperfumes.com.
- The development Clerk instance has its own users. Admin there needs `khem.official@outlook.com` with a **verified** email.
- `.gitignore` now ignores `/.clerk/` (commit `4cacb70`), because Clerk tooling can write keys there.

## 5. Known issues (not urgent)

- Leaving `/sign-in` triggers a full page load. This predates the routing fix and is likely Clerk's behaviour.
- `npm run db:verify` reports 2 pre-existing data gaps.
- `npm run db:test:sales` stops at its Discovery Credit scenario.
