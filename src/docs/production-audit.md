# KHEM — Production audit (2026-11-19)

Scope: everything from `2192d53` (Sep 5) to `4ae6f6f` (live), the Hostinger VPS,
the Frankfurt database, and the live site in English and Arabic on desktop and
mobile. No order was placed, no email was sent, `npm run db:migrate` and `0072b`
were not run, and no secret was printed.

**Verdict: ready for production — yes, as a cash-on-delivery store.** Nothing
critical was found: the site is up, protected, backed by a clean build, and
selling works end to end up to "Place order". Four high items should be closed
this week (§3); three of them are one decision each.

---

## 1. What I fixed

| # | Sev. | Fix | Verified |
| :-- | :-- | :-- | :-- |
| F1 | Medium | **Admin rewards search was string-built into a PostgREST `.or()` filter** (`src/services/admin/rewards.ts`). A comma or bracket in the search box became filter syntax and broke the query. It now matches in memory with `matchesTerm()`, the rule `src/lib/admin/filter.ts` already sets for every other admin list. Admin-only, so no privilege escalation was possible. | tsc, lint, build |
| F2 | Low | **`interest-cohort` removed from `Permissions-Policy`** (`next.config.ts`). FLoC is withdrawn; Chrome logs an error for the token. | Built header reads `camera=(), microphone=(), geolocation=()`. **Goes live on the next deploy.** |
| F3 | Low | **Duplicate `Cache-Control` on `/_next/static/`** — nginx `add_header` appended a second copy of Next's header. `proxy_hide_header Cache-Control` added (`deploy/nginx/khemperfumes.conf`), installed on the server. | `nginx -t`, reload, one header on a live chunk |
| F4 | Low | **SSH `X11Forwarding` was on.** Turned off in `/etc/ssh/sshd_config.d/10-khem.conf` and in `deploy/provision.sh`. | `sshd -t`, reload, `sshd -T` shows `no`, both logins still work |
| F5 | Low | **`.tmp-v3.mts` removed from the repo.** A committed scratch script that set stock on production with the service key. The product it targeted no longer exists, so it left nothing behind. | `git rm`; nothing referenced it |
| F6 | — | **Prepared, not applied: `supabase/sql/0078_catalog_rpc_projection.sql`** (see H4). | Rolled-back test on production: 48 calls identical, 460 → 13 ms |

### Removed from the server (step 0)

The RSC diagnostic log, the 404 watch, `.env.production.bak`, `/root/fix.env` and
`/root/env.new` were **already gone** (handoff §2), and I confirmed it: `conf.d/`
is empty, the live nginx config is byte-identical to `deploy/nginx/`, and no
`tail`/`watch`/`tcpdump`/`inotify` process, tmux/screen session, extra crontab,
root crontab or custom timer exists. Removed today:

- `/tmp/ngt` — a saved `nginx -t` result.
- `/root/khemperfumes.conf`, `/root/khemperfumes.bootstrap.conf`,
  `/root/khem-{hsts,proxy,tls}.inc`, `/root/provision.sh` — upload copies from
  provisioning, byte-identical to `deploy/`.
- 13 npm debug logs in `/root/.npm/_logs/` and `/home/khem/.npm/_logs/`.

Kept on purpose: the `flock` lock files in `/tmp` (used by the crontab),
`/home/khem/.pm2/dump.pm2.bak` (PM2's own).

---

## 2. Checks

| Check | Result | vs known gaps |
| :-- | :-- | :-- |
| `tsc --noEmit` | ✅ 0 errors | — |
| `eslint` | ✅ clean | — |
| Unit tests (`scripts/*.test.ts`, 9 files) | ✅ 48/48; `shop-time` also under `TZ=UTC` | — |
| `next build` | ✅ 264 pages (before and after the fixes) | — |
| `npm run db:verify` | 52/54 — **1 product without a primary image; non-fragrances without a format** | Same 2 pre-existing gaps |
| `npm run db:test:sales` | 5 scenarios pass, **stops at Discovery Credit** ("the set did not issue one"). Rolled back. | Same pre-existing stop |

Also noted by `db:verify`: 28/29 products have an embedding; 27/28 live products
have no cost, so profit reporting is incomplete.

---

## 3. Open items

### High

**H1 — One customer's account is split from their history.** ✅ *Closed — see §7.2.*
The `"User"` row for `m_***@outlook.com` still carries the Clerk ID from the old
instance. The production Clerk user has a new ID, so the lazy sync collides on
`user_email_live_idx` (it's the `ensureUserRowId sync failed` line repeating in
`app.err.log`). Result: their **5 orders are invisible in /account**, and saving
an address fails. Guest-order claiming does not help, because it only claims
orders with no owner. The other 7 users are linked correctly.
*Fix (needs your OK, it's data):* in one transaction, set `"User"."clerkId"` and
`"Order"."clerkUserId"` from the old ID to the production ID (the other
Clerk-keyed tables hold nothing for this user).

**H2 — Mobile speed.** Lighthouse mobile Performance is 59–74 and LCP is 6–10 s
(table in §5). On top of that, the intro curtain hides real content until
**~4.4–4.9 s** on a fast desktop connection (once 9.8 s), on the **first page of
every session, on any page**: a visitor arriving on a product page from Google or
an ad sees it too. Ranked fixes are in §6.

**H3 — Backups are not verified.** No database backup exists on the VPS, and I
could not see the Supabase plan from here (no management token). The free plan
has no downloadable backups and no point-in-time recovery. Secrets live only in
`/srv/khem/shared/.env.production` and your `.env.local`.
*To do:* confirm the plan in Supabase → Database → Backups. If it's Free, either
upgrade or add a nightly `pg_dump` from the VPS to off-site storage. Keep a copy
of the env file in a password manager.

**H4 — Search is slow.** Server time per search is 0.65–1.5 s:
- the Cohere embedding through the AI Gateway: **0.7–1.2 s**;
- `hybrid_search_products`: **460 ms of pure Postgres for 29 products**.

The second one is a real bug: `(jsonb_populate_record(…)).*` makes Postgres
rebuild the whole row as JSON, embedding included, once per column (43×).
`related_products` (the product page's related rail) has the same pattern.
✅ *DB half closed — 0078 applied, see §7.1.* `0078_catalog_rpc_projection.sql` moves the projection into
`LATERAL`. I tested it on production in a rolled-back transaction: 48 calls
(EN/AR, with and without a vector, related rails) gave identical ids, order and
rows; `costInCents` is still stripped; execution went **460 → 13 ms**. Needs your
OK to apply with `psql --single-transaction` (same route as 0073–0077). The
free-tier embedding limit (5/min) is still the open decision from the handoff.

### Medium

**M1 — Card payments are off.** ✅ *Intentional (cash-only) — see §7.5.* There are no Stripe keys on the server (or in
`.env.local`), so checkout shows "Card payment is temporarily unavailable" and
offers cash on delivery only. `/api/webhooks/stripe` answers 500
`unconfigured`. If cash-only is the plan, this is fine. If Stripe still has a
webhook endpoint pointing here, it will retry and eventually disable it.

**M2 — The Clerk webhook is unverified since the move.** The nginx log has
**no Svix delivery** since 18 Nov 13:00, while three Clerk users changed after
that. That's harmless if those changes were sign-ins (no event), but the endpoint
may still point at the old deployment. *To do:* Clerk dashboard → Webhooks:
check that the URL is `https://khemperfumes.com/api/webhooks/clerk`, then send a
test event (expect 200 in `/var/log/nginx/khem.access.log`).

**M3 — Soft 404s.** Unknown URLs (`/nope`, `/perfume/does-not-exist`) answer
**HTTP 200** with a `noindex` meta, because the root `app/[locale]/loading.tsx`
starts streaming before `notFound()` runs. Google honours the `noindex`, but
Search Console will report soft 404s. Also, every random product slug becomes a
cached ISR entry on disk. Fixing it means moving that loading boundary (a UX
change), so it is listed rather than done.

**M4 — The cookie banner covers the main button.** On a 1280×577 viewport (a
laptop with browser chrome) it sits over **ADD TO CART**. On a phone it covers
~45% of the screen. Design decision.

**M5 — Test data in production.** ✅ *Removed — see §7.4.*
- 7 `InventoryMovement` rows by `user_verify_harness_0050/0051`. Their orders
  (KHEM-2026-1081…1094) were already deleted, so these are orphans.
- One manual `RECEIPT` with reason `test` (onyx-night, 3 → 4). This may be real
  stock, so I would leave it.
- The campaign "TEST NEW YEAR" (status SENT).

**M6 — The Arabic announcement bar is in English.** All 4 active announcements
have an empty `message_ar`. Content only: fill it in under Admin → Announcements.

### Low

- **L1** — F2 and F3's repo changes are not deployed yet. They take effect with
  the next `deploy.sh`.
- **L2** — Accessibility 91–96: no `<main>` landmark, some colour contrast and
  touch-target sizes, one non-descriptive link.
- **L3** — `/apple-touch-icon.png` returns 404 (iOS home-screen icon).
- **L4** — A Clerk *keyless* dev key (`.clerk/.tmp/keyless.json`) sits in local
  agent-checkpoint refs (`refs/agents/2b14804f…`). It was never pushed and is not
  on `main`. *To do:* delete those refs.
- **L5** — `/_next/static` is served by Node rather than from disk by nginx, and
  there is no brotli (gzip only, from Next). Minor at this traffic; see §6.
- **L6** — `app.err.log` repeats "The destination stream closed early". These are
  client aborts during streaming. Noise, not failures.
- **L7** — Owner to-dos from `handoff.md` are still open: switch off cron-job.org
  (one external hit with a stale secret got a 401), point the GitHub
  `keep_alive` secrets at Frankfurt, delete the Vercel project around 11-25, and
  pause Tokyo after 12-02.
- **L8** — The nginx security update (1.24.0-2ubuntu7.20) is pending.
  Unattended-upgrades will install it on its next run.

---

## 4. What passed

**Code (Sep 5 → now).** No Vercel coupling is left: Vercel appears only in
comments, and the AI Gateway is a hosted API. No `edge` runtime, no
`process.env.VERCEL*`, no `request.geo`/`ip`, no runtime filesystem writes.
`after()` works under `next start`. All 5 cron routes use a constant-time bearer
check. Every admin Server Action calls `requireAdmin()` (`shared.ts` holds
helpers only), and the admin layout does too. Checkout prices, totals and stock
are decided inside `place_order()` under row locks, and the action is rate-limited
and Zod-validated. The search API is rate-limited, has a timeout, an LRU cache
and a keyword fallback. Search tracking stores no user ID or IP, skips
prefetches and bots, and writes in `after()`. JSON-LD goes through `jsonLdHtml()`.
No other string-built PostgREST filters remain.

**Live site.** Home, collections, product page (pyramid, related rail with 4
products), add to bag, cart, and checkout (cash selected, totals correct;
stopped before Place order) all work in EN and AR. AR is `dir="rtl"`. There is no
horizontal overflow on an iPhone 14. AI search in both languages works ("26
results · ranked by meaning · AI"), and so does keyword search. Signed out,
`/account`, `/admin`, `/admin/search` and `/ar/*` all 307 to sign-in, and a
forged Server Action POST is refused. Cron: all five jobs returned 200 today,
including two real campaign sends (7 and 1 recipients); public calls get 401. The
Clerk webhook rejects an unsigned POST (400). There were no console errors on the
pages tested. `robots.txt` and the sitemap (no `vercel.app` URLs) are fine, and
canonical and hreflang are correct. Sign-in/out, `/account` and `/admin` as a
signed-in user, and email were confirmed by you on 11-19 and not re-tested (I
have no credentials, and sending was off-limits).

**Server.** SSH is key-only (`PasswordAuthentication no`, root by key only); the
`khem` user has no password and no sudo. UFW allows 22/80/443 only, and Next
listens on 127.0.0.1:3000 only. fail2ban runs (sshd jail, nftables) and sees
little because password auth is off. Unattended security upgrades are on. The
TLS certificate is valid to 2027-02-16, `certbot.timer` is enabled with a reload
hook, and `certbot renew --dry-run` succeeds. `pm2-khem.service` is enabled and
active, so PM2 restarts on reboot. Logs rotate (nginx daily ×14, pm2-logrotate
20 MB ×10, journald 49 MB). Disk is 10% used (88 GB free), RAM 0.85/7.8 GB, swap
idle. HSTS is set, `server_tokens` is off, `X-Powered-By` is hidden, and the CSP,
nosniff, Referrer-Policy and X-Frame-Options are all present. **No secrets:** the
only tracked env file is `.env.example`; history has no live keys (only test
fixtures plus L4); no secret-shaped strings appear in app, cron, nginx or PM2
logs; the env files are mode 600; no `[SENSITIVE]` placeholders are left.

---

## 5. Speed measurements

**Server.** Through nginx on the box, every page answers in **~20 ms** (ISR
hits). From Cairo-side networks, TTFB is ~350 ms, almost all of it network: RTT
is ~103 ms, and TCP + TLS + the request take about 3 round trips. Supabase REST
from the VPS takes 35 ms (simple select ~120 ms warm); the AI Gateway takes
45 ms to first byte.

**Search.** `/api/search` takes 0.65–1.5 s server-side. Breakdown: Cohere
embedding 0.7–1.2 s, then `hybrid_search_products` 350–730 ms (→ ~13 ms DB with
0078), then promotions and match notes.

**Intro.** First paint is ~0.9–1.1 s; the curtain lifts at **~4.4–4.9 s**
(desktop, fast connection). The timing is set by `MIN_HOLD_MS = 2200` counted
*after hydration*, plus up to 1 s waiting for the hero, plus a 1.1 s exit.

**Lighthouse 13.4 (live, 2026-11-19).** P = Performance, A = Accessibility,
BP = Best Practices, SEO = SEO.

| Page | Device | P | A | BP | SEO | FCP | LCP | CLS | TBT |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| `/` | mobile | 60 | 91 | 100 | 92 | 4.3 s | 7.7 s | 0.000 | 9 ms |
| `/` | desktop | 85 | 92 | 100 | 92 | 0.7 s | 1.9 s | 0.039 | 0 |
| `/ar` | mobile | 59 | 91 | 100 | 100 | 4.7 s | 8.0 s | 0.002 | 37 ms |
| `/ar` | desktop | 85 | 92 | 100 | 100 | 1.0 s | 1.6 s | 0.001 | 0 |
| `/perfume/sunlit-citrine` | mobile | 60 | 95 | 96 | 100 | 4.8 s | 8.7 s | 0.000 | 31 ms |
| `/perfume/sunlit-citrine` | desktop | 94 | 96 | 96 | 100 | 0.7 s | 1.0 s | 0.003 | 0 |
| `/ar/perfume/sunlit-citrine` | mobile | 59 | 95 | 96 | 100 | 4.8 s | 9.9 s | 0.000 | 41 ms |
| `/ar/perfume/sunlit-citrine` | desktop | 94 | 95 | 96 | 100 | 1.0 s | 1.1 s | 0.001 | 0 |
| `/collections` | mobile | 61 | 93 | 100 | 100 | 4.6 s | 6.8 s | 0.000 | 85 ms |
| `/collections` | desktop | 93 | 95 | 100 | 100 | 0.6 s | 1.0 s | 0.008 | 0 |
| `/ar/collections` | mobile | 62 | 93 | 100 | 100 | 4.4 s | 6.7 s | 0.000 | 46 ms |
| `/ar/collections` | desktop | 94 | 93 | 100 | 100 | 0.6 s | 0.9 s | 0.006 | 0 |
| `/search?q=oud` | mobile | 70 | 93 | 100 | 69* | 1.3 s | 8.4 s | 0.000 | 2 ms |
| `/search?q=oud` | desktop | 92 | 95 | 100 | 69* | 0.6 s | 1.5 s | 0.004 | 0 |
| `/ar/search?q=عود` | mobile | 74 | 93 | 100 | 69* | 1.4 s | 6.2 s | 0.002 | 36 ms |
| `/ar/search?q=عود` | desktop | 91 | 93 | 100 | 69* | 0.6 s | 1.6 s | 0.001 | 0 |

\* Search is `noindex` on purpose, so its SEO score is expected to be low. INP
needs real-user data. Lab TBT is 0–85 ms, so INP risk is low.

**Where the mobile bytes go (home):** 1.56 MB of hero video (**two** videos
download, not one); the **Inter variable font is 344 KB** (all scripts and axes,
preloaded); ~216 KB of Clerk JS on every page, even for anonymous visitors;
~300 KB of unused JS. On `/ar`, the Amiri regular and bold fonts add 286 KB.

**nginx.** HTTP/2 is on; gzip comes from Next (no brotli); static assets are
immutable for 1 year (now a single header); images go through `/_next/image`
(AVIF/WebP, 31-day cache); fonts use `display: swap`.

---

## 6. Speed fixes, ranked by impact

1. **Intro curtain** *(design, needs OK)*. Play it on the home page only. Count
   `MIN_HOLD_MS` from navigation start rather than from after hydration, and
   shorten it (e.g. to 1.2 s). **Gain:** real content ~2–3 s sooner on every
   first visit; landing pages lose the curtain entirely.
2. **Subset the fonts.** Inter to Latin + Latin-1 + Latin Ext-A + punctuation and
   currency, keeping the `wght` axis (344 KB → ~70–90 KB); Amiri and IBM Plex
   Arabic to the Arabic block. **Gain:** ~250 KB EN / ~400 KB AR off the critical
   path, worth ~1 s of mobile FCP/LCP on slow 4G.
3. **Hero video.** Load only the active slide's video (`preload="none"` and a
   poster for the rest), and ask Cloudinary for a mobile rendition (`w_640`,
   lower bitrate). **Gain:** ~1.2 MB less on mobile home; LCP is the video.
4. **Apply 0078.** Search DB time 460 → 13 ms per call, and the product page's
   related rail gets the same fix. **Gain:** ~0.35–0.7 s per search.
5. **Search pipeline.** Run the lexical query in parallel with the embedding call
   and fill the results in as each arrives. Keep the typing overlay on keyword
   results and embed only on Enter. Fund the Gateway (Cohere free tier is
   5/min). **Gain:** a perceived 0.7–1.2 s per search, and no silent fallback
   under load.
6. **Load Clerk only where it's needed** (account, checkout, sign-in, admin) or
   after idle. **Gain:** ~216 KB JS and main-thread time on every anonymous
   pageview. A larger change.
7. **Trim unused JS** (~300 KB flagged): check which client components the
   layout pulls into every route.
8. **nginx serves `/_next/static` from disk** (`alias
   /srv/khem/current/.next/static/;` with a proxy fallback) and **brotli**
   (`libnginx-mod-http-brotli-filter`). **Gain:** small for visitors, frees Node.
9. **Optional:** a CDN or proxy (e.g. Cloudflare) for static files and images,
   with a PoP near Cairo. **Gain:** cuts the ~100 ms RTT for repeat assets. The
   rate limits would then have to read `CF-Connecting-IP`.

---

## 7. Decisions (approved by the owner, 2026-11-19)

1. **Done — `0078` applied to Frankfurt** in one transaction; grants unchanged.
   `/api/search` with a cached embedding went from 650–800 ms to ~150–330 ms
   (H4, DB half closed). The embedding half remains: a new query still costs
   ~1 s of Cohere time. Right after the deploy, with the cache empty and the
   free tier's 5/min spent by audit testing, searches took 1.5–5.8 s. That is
   the timeout path a real burst of visitors would hit too, so funding the
   Gateway (handoff §3) is now the main search fix.
2. **Done — stale Clerk ID repointed** (H1 closed). `"User"` 1 row, `"Order"`
   5 rows and `customer_notification_reads` 7 rows moved to the production ID;
   all 8 Clerk users are now linked to their rows.
3. **Done — committed and deployed** (F1, F2, F5, 0078 file, nginx/provision
   files, this report).
4. **Done — test data removed** (M5): the 7 orphan harness movements and the
   "TEST NEW YEAR" campaign (with its 1 recipient and 1 send row). Stock levels
   are unaffected; the manual onyx-night receipt was kept.
5. **Cash-only is intentional** (M1 closed). Stripe stays unconfigured until card
   payments are wanted (`STRIPE-SETUP.md`).
6. **Done — intro, fonts, below-the-fold film, cookie card** (§6 items 1–3,
   M4), built from `prompts/performance-intro-fonts-hero-cookie.md`, one commit
   each (`3515aa7`, `f30ee1a`, `64c677a`, `70febe4`), live as `70febe4`.
   - **Intro:** home only; on every other first page `data-intro="off"` before
     paint. Live: the curtain starts lifting at ~2.6 s and is gone at ~3.7 s
     (was gone at 4.4–4.9 s). The floor counts from first paint, not
     navigation, so the entrance can never be cut short.
   - **Fonts:** EN ~98 KB (was ~392), AR ~275 KB (was ~432). HarfBuzz-verified
     identical; generator in `scripts/subset-fonts.py`.
   - **New Arrival film:** `preload="none"`, plays only near the viewport. It
     was the **411 KB** file (`Hero.mp4`), not 1.15 MB as the prompt and
     commit `64c677a` say; it no longer loads on the mobile home. The
     1.15 MB file is the **hero** film (`KHEM-40.mp4`, `w_828`), which
     autoplays above the fold and is now the largest mobile cost.
   - **Lighthouse after (live, 16 runs; before → after):** fonts EN
     392 → 100 KB, AR 432 → 281 KB; mobile collections 61 → 78, mobile
     search 70 → 82 (AR 74 → 78), product desktop 94 → 99, mobile product
     FCP 4.8 → 3.2 s. **Mobile home (63) and product (62–66) miss the ≥ 75
     target.** What's left on them: the 1.15 MB hero film (home), ~216 KB of
     Clerk JS on every page and ~300 KB of unused JS (§6 items 6–7). Desktop
     home/collections moved ±5–9 between runs, within Lighthouse's
     run-to-run noise on this connection; CLS ≤ 0.004 everywhere.
   - **Next step (needs a decision — it changes the hero asset):** serve the
     hero film to phones as a smaller rendition (e.g. `w_640,q_auto:eco`
     through a `<source media>` or an admin mobile URL), or show its poster
     on phones and play the film from 768 px up.
   - **Cookie card:** 28–30% of a 390×844 phone (was ~45%), equal-width
     buttons; desktop `max-w-sm`. Three things go beyond the prompt's wording,
     because narrowing alone left the card on ADD TO CART at 1280×577:
     (a) on windows ≤ 760 px tall the desktop card uses the existing short
     copy; (b) on product pages it sits in the start corner, over the gallery;
     (c) on phones the "Privacy" eyebrow is hidden (the title says the same).
     Wording, colours, focus handling and consent logic are unchanged.

## 8. Mobile video and the 2-second intro (2026-11-19)

Built from `prompts/mobile-video-hero-loading.md`, live as `e39826e`
(`a2e824c` data · `fc13cad` URL helper · `fd581af` admin · `093737b` hero
loading · `e39826e` intro; the helper went before the admin so the size check
measures what visitors receive). The cookie-card changes in §7.6 are kept, by
the owner's decision.

- **Admin:** "Mobile video address" under the Hero and New Arrival films,
  recommended sizes as hints, warnings (never blocking) for size, resolution,
  orientation and length. Migration `0079` adds `HeroSetting."videoMobileUrl"`;
  New Arrival keeps it in the `featured` section's JSON.
- **Every film** is served with `ac_none`. Phones without a mobile film get
  `f_auto,q_auto:eco,w_720,ac_none` (hero: 931 KB instead of 1.5 MB). A real
  ~720×1280, sub-500 KB mobile film will do better.
- **Hero:** the film's first frame (`so_0`, 720 / 1920 px JPEG, ~3–10 KB) is in
  the HTML and is now the LCP element. The film starts after `load` and fades in
  over 0.5 s. The first frame of the current film is a dark shot with a gold
  line; `so_2` or an editor-chosen offset would give a brighter poster if
  wanted.
- **Intro:** fully gone at **1.98–2.07 s** live (was ~3.7 s), with the hero
  poster already decoded when it lifts.

**Mobile Lighthouse (live, two runs each; the audit → after §7 → now):**

| Page | Performance | LCP | Page weight |
| :-- | :-- | :-- | :-- |
| `/` | 60 → 63 → **78 / 62** | 7.0 → 3.5 / 7.6 s | 2.4 → **1.2 MB** |
| `/ar` | 59 → 59 → **60 / 60** | 7.2 → 8.5 / 9.2 s | 2.9 → **1.5 MB** |
| `/perfume/sunlit-citrine` | 60 → 66 → **65 / 65** | 7.3 → 7.5 / 7.8 s | 1.2 MB (no film) |
| `/ar/perfume/sunlit-citrine` | 59 → 62 → **61 / 67** | 8.5 → 9.0 / 6.1 s | 1.4 MB (no film) |

The film work halved the home page's weight, but the score is now limited by
**JavaScript, not media**: "element render delay" is the largest LCP phase
(1.0–1.7 s observed). 661–736 KB of script ships to every visitor, **347 KB of
it Clerk** on pages where no one is signed in. Next fixes, ranked:

1. **Product LCP image priority** (small, safe): the first gallery image is the
   LCP element and is not `priority` (Lighthouse: "fetchpriority=high should
   be applied"). A one-prop change in the gallery.
2. **Load Clerk only where it's needed** (account, checkout, sign-in, admin, the
   nav's account button on interaction). Removes ~347 KB of JS and its
   main-thread time from every anonymous pageview. The biggest remaining win,
   and a larger change.
3. **Trim unused JS** in the shared layout (~300 KB flagged).

## 9. One film link per section · 1.0 + 0.6 s intro (2026-11-19)

Built from `prompts/single-video-auto-renditions.md` (owner: option 1, cap
revised to 20 s), live as `dbf1d42` (`b500bd1` cuts · `356a856` admin ·
`dbf1d42` intro). It supersedes §8's separate mobile-video input.

- **One link per section.** Cloudinary builds both cuts, replacing whatever was
  pasted after `/upload/`:
  - phone `f_auto,q_auto:eco,w_720,du_20,ac_none`
  - desktop `f_auto,q_auto,w_1920,du_20,ac_none`

  Live and verified: each device requests its own cut, and New Arrival waits
  for the scroll.
- **Sizes today:**

  | Film | Phone | Desktop |
  | :-- | :-- | :-- |
  | Hero (36.4 s source → cut to 20 s) | 487 KB | **3.09 MB, over the 2.5 MB recommendation** (loads after `load`, so it doesn't affect LCP) |
  | New Arrival (5.8 s) | 300 KB | 1.50 MB |

  A shorter source film (≤ 20 s, ideally a clean 10–15 s loop) brings the hero
  under budget.
- **Admin:** one field each. The check shows the size of each cut and warns,
  without blocking, on a source over 20 s, narrower than 1920 px, or a cut over
  budget. `HeroSetting."videoMobileUrl"` (0079) stays in the database, unused
  and empty.
- **Intro:** 1.0 s logo + 0.6 s curtain, gone at **2.38–2.59 s** live (one
  cold-network run 4.6 s, i.e. first paint + 1.6 s), with the poster always
  decoded when it lifts. A tap or key skips it after 0.2 s; this was **not
  verified live**, because the probe can't start before `load`.
- **Owner checks:** (1) the hero loop at the 20 s cut, for a visible jump;
  (2) skipping the intro with a tap.

**Mobile Lighthouse (two runs; `e39826e` → `dbf1d42`):** `/` 78/62 → 61/63;
`/ar` 60/60 → 59/78; product 65/65 → 66/65; AR product 61/67 → 61/68. These
are flat within run-to-run noise, as expected: this change targeted editor
workflow, film bandwidth and the intro's feel, and §8's findings still hold.
The remaining mobile gains are the product LCP image priority, loading Clerk
only where it's needed, and trimming unused JS.

## 10. LCP image priority · a Clerk incident (2026-11-19)

Built from `prompts/lcp-priority-and-clerk-weight.md`; live as `eee60c2`.

**Shipped: explicit image priority (`972075d`).**
- Next 16 deprecated `priority` on `next/image`. It still preloads, but no
  longer sets `fetchpriority="high"`.
- React 19's server renderer also auto-preloads every eager `<img>` unless it
  is `fetchPriority="low"`. So every page's `<head>` preloaded the intro
  artwork, the nav logo and the route loader before its own hero; on the
  product page the photo was 4th.
- Now: 15 LCP images use `loading="eager" fetchPriority="high"`, and the
  decorative ones use `fetchPriority="low"`. Each page preloads only its own
  LCP image (home: none, its poster is in the HTML at high priority). An ESLint
  guard forbids `<Image priority>`.

**Incident: `prefetchUI={false}` (`3e7c57a`), reverted.**
- I read Clerk's "skip prefetching the UI" as "load it on demand". It doesn't:
  with `false`, `@clerk/react` never loads `@clerk/ui`, so the sign-in and
  sign-up forms crashed ("This page couldn't load").
- **Impact:** `/sign-in` and `/sign-up` (EN/AR) were down from **21:19:51 to
  21:21:59 UTC (~2 min)**. The access log shows no visitor other than the
  verification run on those pages. Orders, checkout and the rest of the site
  were unaffected.
- **Response:** found by the post-deploy check, rolled back with
  `deploy/rollback.sh dbf1d4257d9c`, reverted (`eee60c2`), redeployed, and
  re-verified: sign-in and sign-up render in EN and AR.
- **Lesson:** a Clerk change must be verified on khemperfumes.com *before*
  being called safe. The production instance doesn't run on localhost, so the
  local build could not catch it. For any future Clerk change, check the auth
  pages on the live site straight after the deploy (as was done), with the
  rollback command ready.

**Clerk's weight is therefore unchanged:** 84 KB core + 264 KB `@clerk/ui` on
every page. The remaining option is the "islands" refactor described in the
prompt (load Clerk only where it's needed, or only for signed-in visitors). It
needs its own design and a live test plan, and is not started.

**Mobile Lighthouse (two runs; `dbf1d42` → `eee60c2`):**

| Page | Performance | LCP |
| :-- | :-- | :-- |
| `/` | 61 / 63 → **76 / 70** | 7.9 / 7.6 → **5.1 / 5.1 s** |
| `/ar` | 59 / 78 → **72 / 67** | 8.5 / 3.4 → 5.6 / 5.9 s |
| `/perfume/sunlit-citrine` | 66 / 65 → 65 / 73 | 7.0 / 7.9 → 8.0 / 5.1 s |
| `/ar/perfume/sunlit-citrine` | 61 / 68 → 62 / 68 | 9.4 / 5.9 → 9.0 / 6.0 s |

Home improved consistently in both runs (the decorative preloads no longer
compete with its poster). On the product pages the photo is now high priority
(Lighthouse's "fetchpriority=high should be applied" check passes), but the
score is within run-to-run noise: those pages are bound by JavaScript (Clerk
included) and main-thread time.

## 11. Clerk loads only where it's needed (2026-11-19)

Built from `prompts/clerk-load-only-where-needed.md`; live as `d1d91f4`
(`0488183` session context · `d1d91f4` switch-over; the plan's commits 2 and 3
were merged so every commit runs).

**What changed.**
- The root `<ClerkProvider>` is gone. Signed-out visitors load **no Clerk
  JavaScript**.
- Signed-in visitors on public pages get `clerk-js` only (no `@clerk/ui`),
  loaded in the background so their session token stays fresh.
- `/sign-in`, `/sign-up` and `/account` keep the full provider in their own
  layouts.
- Nav, account menu, sign-out and comments read `useKhemSession()`. Auth on
  the server is untouched. See `AGENTS.md` §10.2.

**Verified locally against Clerk's development instance** (disposable test
user, deleted afterwards). Scenarios 1–9 of the plan pass:
- signed-out pages make 0 Clerk requests, and guest checkout works;
- the sign-in and sign-up forms render in EN and AR;
- signed in, the account menu shows on home, product, cart and account, with
  one Clerk script and no `@clerk/ui`;
- **the server still recognises the user after 92 s on a product page and at
  checkout** (handshake-free request → 200; token 4–9 s old);
- signing out from the nav works, and the next page loads no Clerk;
- a sign-in in another tab is picked up when the tab regains focus;
- client-side navigation from account to home keeps the session.

Scenario 10 (the admin link) is owner-only.

**Verified live (signed out).**
- 8 public pages (EN/AR) make **0 Clerk requests** and show the sign-in link.
- Guest checkout renders.
- The sign-in and sign-up forms render in EN and AR. English sign-up missed
  once seconds after the restart, then passed 3 of 3 times (~1 s).
- `/account` and `/admin` still 307 to sign-in.
- No server errors since the deploy.

**Owner to check signed in (production; I have no credentials):**
1. the nav account menu and the admin link;
2. `/account` and `/account/profile`;
3. wait a minute on `/checkout` and confirm your details are prefilled (a real
   order is your call);
4. sign out, then sign in again.

Rollback if anything is off:
`ssh khem@179.67.202.31 /srv/khem/current/deploy/rollback.sh eee60c29dcdf`.

**Two things found while testing:**
- **Test data, removed.** Opening `/account/profile` as the test user created
  a `"User"` row in the production database. Next **prefetches** the sidebar's
  `/account` link, and that page runs `ensureUserRowId()` (and
  `claimGuestOrdersForIdentity()`) on render. I deleted the row (1 row, no
  orders, addresses, points, credits or reads attached). For real customers
  this is harmless (it's their own row), but it means **viewing any account
  page creates the row through prefetch**, not just the overview. Worth knowing
  when testing.
- **The development Clerk instance's webhook points at production.** Its
  `user.created` event reached `/api/webhooks/clerk` and was correctly
  **rejected** (400, signature mismatch). Harmless, but noisy. Point that
  webhook elsewhere, or remove it, in the Clerk dashboard (development
  instance).

**Mobile Lighthouse (two runs; `eee60c2` → `d1d91f4`):**

| Page | Performance | LCP | JavaScript | Page weight |
| :-- | :-- | :-- | :-- | :-- |
| `/` | 76 / 70 → **78 / 72** | 5.1 / 5.1 → 4.0 / 5.1 s | 661 → **262 KB** | 1.42 → **0.80 MB** |
| `/ar` | 72 / 67 → 66 / **90** | 5.6 / 5.9 → 5.9 / 2.2 s | 661 → **262 KB** | 1.65 → **1.04 MB** |
| `/perfume/sunlit-citrine` | 65 / 73 → **95** / 76 | 8.0 / 5.1 → 1.8 / 4.8 s | 736 → **338 KB** | 1.18 → **0.77 MB** |
| `/ar/perfume/sunlit-citrine` | 62 / 68 → 68 / 68 | 9.0 / 6.0 → 5.8 / 5.7 s | 736 → **338 KB** | 1.41 → **0.98 MB** |

Clerk went from ~354 KB to **0 KB** on every page measured. Scores are noisy
on this connection (one run each reached 90 and 95), but the floor moved up
and total blocking time fell on most runs.

### 11.1 Bug and fix: account pages crashed after client-side navigation (2026-11-20)

- **Report (owner):** signed in, the first click to the profile page showed
  "This page couldn't load". A reload worked.
- **Cause:** the background Clerk on public pages was booted with
  `prefetchUI={false}`, so it never loads `@clerk/ui`. Clerk is a page-wide
  singleton, so on a client-side navigation into `/account` the account
  provider *reused* that instance, and `<UserProfile>` threw "Clerk was not
  loaded with Ui components". My local test plan covered account → public, but
  not public → account while signed in.
- **Response:**
  - production was rolled back to `eee60c2` as soon as it was reported;
  - the bug was reproduced locally (development Clerk instance) and the cause
    confirmed from the console;
  - fix `1fdebde` removes `prefetchUI={false}` from the bridge.
- **Cost:** signed-in visitors on public pages download `@clerk/ui` again
  (~264 KB), as before `d1d91f4`. Signed-out visitors still load no Clerk.
- **Testing:** reproducing it once more created a test `"User"` row in
  production (account prefetch). It was removed.
  - The owner asked for a separate test database
    (`prompts/local-test-database.md`), then deferred it.
  - **This fix is therefore deployed without signed-in local verification**;
    the owner tests signed in on production. Rollback target: `eee60c29dcdf`.
- **Open:** the local test database. Until it exists, **no signed-in or
  data-writing local test should run against `.env.local`**, because that is
  production.
