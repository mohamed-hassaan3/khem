# Stage 7 — Admin logic audit & performance ("make the desk light")

Follows Stage 6 (`prompts/admin-redesign-stage-6.md`). Two goals, one stage,
because both are checked by walking the same screens and actions.

## Goals (user, 2026-11-22 and 2026-11-24)

1. **Logic audit.** Every admin feature works, is connected to the features it
   should touch, and its rules hold. Act as the team's staff engineer: fix what
   is broken; bring anything about money, payments, auth or data rules to the
   user before changing it.
2. **Lightness.** "The admin feels a little heavy." Make every screen answer
   fast and feel instant, without removing anything the desk uses.

## Skills read

`AGENTS.md` (§8 revalidate rule — `src/lib/admin/revalidate.ts`; §8.1; §10.1
`requireAdmin()` in the layout and first in every admin action; 404 on
failure), `supabase` skill (RPCs, service role, PostgREST cache), Next docs in
`node_modules/next/dist/docs/` (caching, loading, prefetching).

## What was measured before writing this (dev server, signed in, warm)

| Screen | Server starts answering | Page loaded |
|---|---|---|
| **Today `/admin`** | **5.5 s** | 6.7 s |
| Orders | 0.56 s | 1.65 s |
| Products | 0.43 s | 1.53 s |
| Customers | 0.67 s | 1.59 s |
| Finance | 0.59 s | 1.60 s |
| Sales & profit | 0.73 s | 1.69 s |
| Campaigns | 0.53 s | 1.44 s |

JavaScript per navigation is small (7–8 KB once cached), so the weight is on
the server. Today is ~10× slower than any other screen: it runs 10 reads on
every load (`listAdminCollections`, `listAdminProducts`, `listAdminArticles`,
`countProductsMissingEmbedding`, `countCustomers`, `getCreditTotals`,
`getSalesTotals`, `getSalesSeries`, `listInventoryRows`, `listAdminOrders`),
several of which fetch whole tables to print one number. The admin layout adds
two more on **every** admin page (`admin_notification_feed`, `listLowStock`)
for the bell.

Dev mode exaggerates every number; part A measures a production build too.

## Part A — Performance

1. **Measure properly.** `next build && next start` locally against the same
   database; record time-to-first-byte and load for every admin route (table
   in the outcome). Time each of Today's 10 reads individually to find the
   slow one(s).
2. **Today first.** Replace whole-table reads that only produce a count
   (products, articles, collections, customers) with count queries; drop
   anything Today no longer shows since the 6b redesign; keep the rest in one
   `Promise.all`. Target: Today within 2× of the other screens.
3. **The layout's bell reads** run on every admin navigation. Options, cheapest
   first: (a) keep them but make sure they are one round trip each and indexed;
   (b) stream the bell (Suspense) so the page never waits for it. No caching of
   private data across requests.
4. **Slow queries.** For any read over ~150 ms in production, check the plan
   (`explain analyze`) and its indexes. An index or query change on the live
   database is a migration → proposed to the user first, applied only on OK.
5. **Navigation feel.** Rail and tab links prefetch the route shell; the
   in-panel skeleton (`admin/loading.tsx`) shows at once; the search pending
   state stays. Check nothing waits on Clerk client-side before showing the
   page.
6. **Client weight.** Charts (`lightweight-charts`) load only on screens that
   draw them, lazily, below the fold where possible; no admin-only code in the
   storefront bundle and vice versa (spot-check with the build output).

Acceptance: every admin route answers in under ~0.5 s (production build,
same machine), Today included; no screen regresses; the full-screen loader
never appears.

## Part B — Logic audit

For every admin Server Action (`src/actions/admin/*.ts`, ~23 files) and admin
route handler:

- `requireAdmin()` (or `getAdminActor()` in a route handler) is the **first**
  statement; input is parsed with Zod before any read or write.
- Writes revalidate the public pages that quote the data (`revalidate.ts`
  lists, AGENTS §8) — a change the shop does not show is a bug.
- Errors return a sentence the desk can act on; nothing fails silently.

Then the connections, walked end to end on screen and in the code:

| Flow | Checks |
|---|---|
| Order → stock | manual order takes stock; cancel/refund returns it once; Stock and Today agree |
| Order → payment → delivery | rules (delivery needs payment, COD one-step), emails per status |
| Order → customer | the order appears on the customer; lifetime spend excludes cancelled/refunded |
| Order → credits & points | Discovery Credit earned on paid set, activates on delivery, cancelled on refund; points earn/redeem; ledgers balance |
| Discount codes | limits, dates, invitation-only grants, welcome offer + signup benefit, checkout honours exactly what the admin says |
| Sale prices & welcome offers | price shown on the shop = price charged = price in the ledger |
| Campaigns | audience = preview = send; exclusions; unsubscribe one-click + footer; send log |
| Invitations | create, list, withdraw, send again; accepted → Registered customer → welcome letter |
| Catalogue | product/collection/category edits reach the shop (revalidate), archive hides everywhere, scent families |
| Finance | expenses (pending counts, void doesn't, future-dated waits), recurring, targets, reports = Sales & profit = ledger |
| Website content | home page bands, story pages, menu & footer, stockists, announcement bar → shop |
| Settings | delivery fees reach checkout; contact channels and socials reach footer and emails |

Each finding is recorded with severity, the file and line, a concrete
failing case, and the fix. UI-only and clear bugs are fixed in this stage;
anything touching money, payments, auth or data rules is listed for the user
with a recommendation and fixed only after OK.

## Rules for this stage

- Never write to the live database to test. Reads only; writes that a test
  needs are asked for first (as with the cost backfill).
- No new features; no schema change without approval.
- Pricing, payments, checkout validation, auth: report, do not change.

## Files likely to change

`src/app/[locale]/admin/page.tsx`, `admin/layout.tsx`,
`src/services/admin/*` (count reads), `src/components/admin/AdminShell.tsx` /
`NotificationBell.tsx` (streaming), chart components (lazy load), any action
missing a guard or a revalidation, this prompt's outcome section.

## Checks

`npx tsc --noEmit`; ESLint on changed files; production build timings before
and after (table); live walk of each flow at 390 and 1440 with the admin
account; read-only SQL to confirm ledgers and totals agree.

## Manual test steps (after implementation)

1. Open Today from another admin screen — it appears about as fast as Orders.
2. Click through Orders → Customers → Finance → Campaigns: no screen hangs;
   the skeleton shows only briefly.
3. Read the outcome's findings table; approve or decline each money/auth/data
   item listed there.

---

## Outcome — part 1 (2026-11-24)

### Measured (production build, `next start`, same machine, signed in)

What the 5.5 s in the plan was: **dev mode**. On a production build, before any
change, every admin screen — Today included — answered in 310–400 ms on a good
network. With these changes, Today on the user's dev server went from 5.5 s to
0.5–1.8 s.

Where the time goes, measured server-side with temporary timers (removed):

| Step | Cost | Runs on |
|---|---|---|
| `requireAdmin()` → Clerk `currentUser()` (a call to Clerk's API) | 310–1600 ms | every **full** load |
| Bell reads (feed + low stock), *after* the gate | 150–360 ms | every full load (now streamed) |
| Today's reads (`Promise.all`) | ≈ one round trip | Today |
| Database-side execution of every admin read (`EXPLAIN ANALYZE`) | **< 3 ms** | — |

So nothing is slow in the database (largest table: 141 rows); no index or
migration is needed. The cost is round trips from the server to Supabase and to
Clerk. Clicking between admin screens (client navigation) measured 320–575 ms
per screen, and the layout does not re-run on a click.

Occasional 4–5 s stalls were seen on single loads (≈1 in 40) and never
reproduced in 14 paced reloads; they fit packet loss on this connection (a lost
TCP handshake costs 1–3 s), not the app.

### Changed

- **Today reads only what it prints.** Collections and articles are counts;
  products are four stock columns instead of every field; the 500-row
  `product_sales()` call (only used for a "sold recently" figure Today never
  shows) is gone; `getSalesSeries` is `cache()`d so the curve and the tiles
  share one `daily_sales()` call. 13 requests / 185 KB → 10 requests / 6 KB.
- **The bell is streamed** (`src/components/admin/AdminBell.tsx`): the layout
  no longer waits for the feed before painting. It is still created *after*
  `requireAdmin()`, so a refused request never runs either read. A same-size
  placeholder holds its place, so nothing shifts.
- **Charts load their library on first draw** (`SalesChart`, `FinanceChart`):
  the page hydrates without waiting for ~45 kB of charting code.
- **Ten one-click admin actions now parse their arguments with Zod**
  (`setDiscoveryCreditEnabled`, `setExpenseStatus`, `deleteExpense`,
  `setExpenseRuleActive`, `deleteExpenseRule`, `deleteFinancialTarget`,
  `setExpenseCategoryArchived`, `deleteExpenseCategory`, `setOfferActive`,
  `deleteOffer`). All were already admin-gated; their parameters were only
  TypeScript types, unchecked at runtime.

Not changed, deliberately: on a *full* load the storefront's full-screen loader
shows while the Clerk gate answers. An admin-styled placeholder there would be
shown to a signed-in customer too, and would confirm `/admin` exists (§10.1).
It shrinks to nothing once the gate is fast — see F1.

### Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| **F1** | **High — auth** | Admin **pages** are protected only by `requireAdmin()` in `admin/layout.tsx`. Next does not re-run a layout on client navigation, and a layout does not stop its child segment from rendering (Next docs, *Authentication → Layouts and auth checks*). Verified locally: with the session demoted (server restarted with a different `ADMIN_EMAILS`), a hard load of `/admin/customers` 404s, but a client navigation to it rendered the full customer list. Any signed-in customer who sends that request (an `RSC: 1` fetch with a router-state header) can read admin pages; an admin removed from the allowlist keeps access in an open tab. Server **actions** are not affected — each calls `requireAdmin()`. | **Fixed** (approved 2026-11-24) — see below |
| F2 | Low | 10 admin actions took unchecked arguments | Fixed (above) |
| F3 | Info | Test-instance sign-in logs `ensureUserRowId sync failed: duplicate key … user_email_live_idx` on `/account`: the test Clerk user shares an email with a production user row. Local-setup artefact, not a production bug. | No change |

Verified sound (read-only SQL against the live database, in a `READ ONLY`
transaction): online + offline = total for every product; no negative stock;
every counter equals its last movement; the movement chain never breaks; every
cancelled/refunded order returned its stock exactly once and every live order
took it exactly once; every order's total = subtotal + delivery − discount −
credit − points − offer, and subtotal = Σ items; `daily_sales(90)` counts
exactly the 27 non-cancelled orders; customer lifetime spend excludes
cancelled/refunded orders for all 20 customers. Every admin Server Action calls
`requireAdmin()` first; every write that a public page quotes revalidates it
(the remainder — finance, credits, grants, payment status — have no public
surface, by design and documented).

### F1 — the fix, for the user's decision

Gate every admin page itself, not only the layout — `await requireAdmin()` at
the top of each of the 70 `page.tsx` files (and keep the layout's). The data
layer cannot hold the check: `src/services/admin/*` is also used by storefront
services and a cron route.

Done naively, that adds Clerk's API call (310–1600 ms) to **every click**. So
the gate itself should become fast:

- **Recommended:** `getAdminActor()` reads `auth()` (the session JWT, verified
  locally — no network), then looks the user up with `currentUser()` at most
  once per 60 s per user id (in-process cache, wrapped in React `cache()` per
  request). The allowlist is still read per call, so removing an address takes
  effect at the next restart, as today; a changed or unverified primary email
  takes effect within 60 s. Every admin click then costs ~0 ms for the gate,
  and the full-load loader shrinks to almost nothing.
- Alternative: no cache — correct, but every admin click pays the Clerk call.

### F1 — fixed (approved by the user, 2026-11-24)

- `src/lib/admin/auth.ts`: `getAdminActor()` now verifies the session with
  `auth()` (local JWT check, no network) and fetches Clerk's user record at
  most once per 60 s per user id (in-process, bounded at 200 entries, failures
  never cached); `cache()`d per request so layout and page share one check.
  The allowlist is still read per call.
- Every one of the 70 `admin/**/page.tsx` files calls `await requireAdmin()` as
  its first statement. (No admin page has `generateMetadata`; the export route
  already calls `getAdminActor()`.)
- Verified on a production build: with the session demoted, a client
  navigation to `/admin/customers` now renders the 404 with no rows (before:
  the full list). As an admin, clicks between screens still measure
  320–640 ms — the gate adds nothing noticeable.
