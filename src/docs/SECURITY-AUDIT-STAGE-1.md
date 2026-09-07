# KHEM — Security Audit, Stage 1: Discovery & Findings (Phases 0–15)

> Executed 2026-09-06 against commit `1ac5da6` on branch `security-audit-stage-1`.
> Brief: `src/docs/KHEM_FINAL_SECURITY_QA_AND_DEVELOPER_HANDOFF.md`.
> Prompt: `prompts/security-audit-stage-1-discovery-and-findings.md`.
>
> **Read-only audit.** No application code, SQL or configuration was modified.
> No write was made to Supabase, Clerk, Stripe, Resend or Cloudinary. No email
> was sent. Every database probe ran inside `begin transaction read only`.
>
> **No secret value appears in this document.** Credentials are referred to by
> variable name and category only.

---

## Executive summary

**Security status: MEDIUM** — one exploitable defect, one dependency
vulnerability, and a missing browser-hardening layer. No CRITICAL or HIGH
finding was found in authentication, authorization, RLS, payment integrity,
inventory concurrency, or secret handling.

This is an unusually well-defended codebase. The claims its comments make about
their own security are, with the exceptions listed below, **true and verifiable**
— which is not the normal outcome of an audit like this. Specifically:

- All **71 tables** in `public` have row level security enabled. Verified
  against `pg_catalog`, not inferred from migration text.
- Every private table is **double-locked** — RLS on with no policy *and* no
  grant to `anon`/`authenticated`. Eight of them were probed live with the
  publishable key and returned `401 permission denied`.
- Every `SECURITY DEFINER` function has a **pinned `search_path`**. Zero
  exceptions, confirmed by catalog query.
- Every one of the **21 admin action modules** calls `requireAdmin()` as the
  first statement of every exported action.
- The Stripe webhook does raw-body signature verification, refuses on a missing
  secret, verifies the intent amount *and* currency against the order row, and
  is idempotent in two independent layers.
- Inventory cannot go negative: `check ("inventoryOnline" >= 0)` at the column,
  plus slug-ordered `for update` locks in `place_order()`.

The findings below are what remains.

### Findings by severity

| # | Severity | Finding | Location |
|---|---|---|---|
| F1 | **MEDIUM–HIGH** | Stored XSS — JSON-LD `</script>` breakout, admin-authored content | `src/app/[locale]/journal/[slug]/page.tsx:128` |
| F2 | **HIGH (dependency)** | 4 high-severity `sharp`/libvips CVEs in the `next/image` path that processes user-uploaded images | `package.json` (`next` 16.2.12) |
| F3 | **MEDIUM** | No security headers anywhere — no CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame protection | `next.config.ts`, `vercel.json` |
| F4 | **MEDIUM** | Three views are `security_invoker=false` (bypass RLS). Not reachable today; one `grant` away from exposure | `credit_balances`, `customer_directory`, `reward_balances` |
| F5 | **MEDIUM** | Rate limiting is per-instance process memory; `/api/checkout/intent` has none | `src/lib/email/rate-limit.ts:23` |
| F6 | **LOW–MEDIUM** | `/design-preview` is publicly reachable, unauthenticated, self-described as delete-before-ship | `src/app/design-preview/` |
| F7 | **LOW** | Doc recommends `NEXT_PUBLIC_KHEM_PRELAUNCH`, contradicting the shipped server-only design | `src/docs/Temporary-Pre-Launch-Cover.md:370` |
| F8 | **LOW** | `0006_privileges.sql` claims it is "applied last"; it runs 6th of 63 | `supabase/sql/0006_privileges.sql:3` |
| F9 | **LOW** | `getSupabaseAdmin()` doc says one caller; there are seven | `src/lib/supabase.ts:175` |
| F10 | **LOW** | Five trigger-returning `SECURITY DEFINER` functions keep default `EXECUTE to PUBLIC` | see §3.5 |
| F11 | **LOW** | `slug_is_reserved()` has no pinned `search_path` (INVOKER, so no escalation) | `supabase/sql/0047_reserved_slugs.sql:44` |
| F12 | **INFO** | AGENTS.md §9/§10 describe a Prisma/middleware architecture that does not exist | `AGENTS.md` |

Nothing was fixed. Stage 1 proposes; Stage 2 applies.

---

## Phase 0 — Repository & architecture map

Derived from code. Where AGENTS.md disagrees, the code is recorded as the fact.

### Real request flow

```
Browser
  │
  ├─► src/proxy.ts ─ clerkMiddleware() wrapper
  │     ├ pre-launch cover gate (KHEM_PRELAUNCH)   src/lib/prelaunch.ts
  │     ├ /account + /admin early redirect         (cost optimisation, NOT the boundary)
  │     ├ locale rewrite  /x → /en/x               src/lib/i18n/config.ts
  │     └ currency cookie from x-vercel-ip-country src/lib/currency.ts
  │
  ├─► app/[locale]/**  Server Components
  │     └ authoritative auth: getViewer() / requireAdmin() per route + per action
  │
  ├─► app/api/**  9 route handlers, each self-protecting
  │
  ├─► src/actions/**   Server Actions (12 public + 21 admin)
  │     └─► src/services/**  (22 public + 21 admin)  ── query layer
  │
  └─► src/lib/supabase.ts
        ├ getSupabasePublic()  publishable key — RLS APPLIES  (all storefront reads)
        └ getSupabaseAdmin()   secret key      — RLS BYPASSED (7 modules, §3.4)
              │
              └─► Supabase Postgres ── 63 SQL migrations, 71 tables, 7 views, ~103 functions
```

External edges: **Stripe** (`/api/checkout/intent`, `/api/webhooks/stripe`),
**Clerk** (`/api/webhooks/clerk`), **Resend** (`src/lib/email/`), **Cloudinary**
(delivery only — no upload path), **Supabase Storage** (`comment-images` bucket),
**Vercel AI Gateway** (`src/lib/search/`).

| Item | Status | Evidence |
|---|---|---|
| 0.1 Next.js version | PASS | `package.json` — Next **16.2.12**, React 19.2.4 |
| 0.2 App Router structure | PASS | `src/app/[locale]/` + sibling `src/app/prelaunch/`, `src/app/design-preview/` |
| 0.3 Server/Client boundary | PASS | `src/lib/supabase.ts:37` `import "server-only"` — compile-time guard |
| 0.4 Server Actions | PASS | 33 modules; all admin ones carry `"use server"` (§2.3) |
| 0.5 Route handlers | PASS | 9 (§2.1) |
| 0.6 Middleware | PASS (re-scoped) | `src/proxy.ts` — **not** `middleware.ts` as AGENTS.md §10 states |
| 0.7 Clerk auth | PASS | `src/lib/auth.ts`, `src/lib/admin/auth.ts` |
| 0.8 Supabase clients | PASS | Two, by authority — `src/lib/supabase.ts:155,177` |
| 0.9 Migrations | PASS (re-scoped) | 63 files in `supabase/sql/`, applied by `scripts/db-migrate.ts` in **filename order** (`scripts/db-migrate.ts:35`). **No Prisma.** |
| 0.10 RLS / policies / functions / triggers | PASS | §3 |
| 0.11 Stripe checkout + webhook | PASS | §6 |
| 0.12 Cloudinary | N/A (delivery only) | `next.config.ts` remote pattern; no upload code path exists |
| 0.13 Resend | PASS | §9 |
| 0.14 **Tiptap** | **N/A** | Not a dependency. Rich text is structured JSON, rendered by a component switch — `src/components/journal/ArticleBody.tsx:16` |
| 0.15 Admin architecture | PASS | `app/[locale]/admin/` + `requireAdmin()` (§2.3) |
| 0.16 Cron / scheduled jobs | PASS | 4 in `vercel.json`; all bearer-authenticated (§2.1) |
| 0.17 **Wishlist** | **N/A** | Withdrawn. No table, no route, no residue found. |
| 0.18 AGENTS.md accuracy | **FAIL (F12)** | §9 documents Prisma models that were never migrated; §10 documents a `middleware.ts` with `createRouteMatcher` that does not exist |

**F12 — proposed fix (Stage 4, with the README).** AGENTS.md §9's Prisma block
and §10's middleware block describe an architecture the repository does not
have. `src/proxy.ts:53` already explains why Clerk v7 deprecates the
`createRouteMatcher` pattern §10 prescribes. Replace both sections with a
pointer to the real files. Not urgent — no code reads AGENTS.md — but it is the
document a future developer is told to trust first.

---

## Phase 1 — Secrets & environment leaks

| Item | Status | File / Line | Finding | Fix |
|---|---|---|---|---|
| 1.1 No server secret is `NEXT_PUBLIC_` | **PASS** | `.env.example`, `src/` | Exactly 5 `NEXT_PUBLIC_` names exist: `CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `STRIPE_PUBLISHABLE_KEY`. All four are publishable by design. | — |
| 1.2 Client bundle clean | **PASS** | `.next/static`, `.next/server/app` | 8 secrets present in `.env.local` were grepped **by value** against the built output. All absent. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are not set locally and could not be tested. | — |
| 1.3 Git history | **PASS** | `git log --all` | `git log --all --diff-filter=A -- '.env*'` returns **only** `.env.example`. `git ls-files` shows no tracked env file but the example. No credential was ever committed under an env filename. | — |
| 1.4 Source maps | **PASS** | `.next/static` | Zero `.map` files emitted. `productionBrowserSourceMaps` is not set (default `false`). | — |
| 1.4b Debug endpoints | **FAIL (F6)** | `src/app/design-preview/` | See below. | Delete or gate |
| 1.5 Secret handling in logs | **PASS** | 406 `console.*` sites | Every match on a secret-like word logs the **variable name**, never a value — e.g. `src/app/api/webhooks/stripe/route.ts:113` "SUPABASE_SECRET_KEY is not set". Only `actor.email` is logged, deliberately, as an admin audit trail (`src/actions/admin/credits.ts:89`). | — |

### F6 — `/design-preview` is publicly reachable — LOW–MEDIUM

`src/app/design-preview/page.tsx:15` opens with:

> `⚠️ TEMPORARY — design review surface. Delete before this direction ships.`

It builds into the production route table and has **no authentication**. It does
set `robots: { index: false, follow: false }` (`src/app/design-preview/layout.tsx:32`),
so it will not be indexed — but noindex is not access control, and the page is
not listed in `src/app/robots.ts`'s `DISALLOWED`.

It leaks no data — it renders design specimens and sample products — so this is
surface reduction, not a breach. But the file itself says it should be gone.

**Proposed fix (Stage 2).** Delete `src/app/design-preview/` outright, per its own
instruction. If it must survive, gate its `layout.tsx` on `getAdminActor()` with
`notFound()` — the exact pattern `src/app/prelaunch/` already uses for its
private production preview.

---

## Phase 2 — Clerk authentication & authorization

### 2.1 Route surface — every API route protects itself

`src/proxy.ts:53-62` states plainly that it is **not** the security boundary, and
that the authoritative check is resource-based. Verified for all 9 handlers:

| Route | Self-protection | Evidence |
|---|---|---|
| `/api/webhooks/stripe` | Stripe signature, raw body | `route.ts:368` `constructEvent`; missing secret → 500 at `:352` |
| `/api/webhooks/clerk` | Svix signature via `verifyWebhook` | `route.ts:57,198` — missing secret → 500 |
| `/api/cron/sweep-unpaid-orders` | `CRON_SECRET` bearer, constant-time | `route.ts:78,140-150` |
| `/api/cron/order-feedback` | same | `route.ts:69,72-82` |
| `/api/cron/expire-credits` | same | `route.ts:56,59-68` |
| `/api/cron/send-campaigns` | same | `route.ts:69,72-81` |
| `/api/checkout/intent` | Four state guards + server-read amount | `route.ts:117-123` |
| `/api/search` | Rate limit; public read data only | `route.ts:89` |
| `/api/cart/catalog` | Public catalog only; cached | `route.ts:49` |

All four crons use `timingSafeEqual` with a length pre-check
(`sweep-unpaid-orders/route.ts:70-78`) and **fail closed** when `CRON_SECRET` is
absent. **PASS.**

### 2.2 Server-side identity

| Item | Status | Evidence |
|---|---|---|
| Identity never from an argument | **PASS** | `src/actions/checkout.ts:333` — `getUserId()` immediately before the RPC; the comment at `:331` states the rule |
| Addresses scoped to owner | **PASS** | `src/actions/addresses.ts:71` `getViewer()`; every mutation carries `.eq("userId", userId)` at `:156`, `:191`, `:242` |
| Zero-row result is opaque | **PASS** | `addresses.ts:164-166` — "the reply must not confirm that somebody else's id exists" |
| Notifications | **PASS** | `src/actions/notifications.ts:30` `getUserId()` |
| Preferences | **PASS** | `src/actions/preferences.ts:55` `getViewer()` |
| Comments | **PASS** | `src/actions/comments.ts:188` `getViewer()` |
| `unsafeMetadata` never grants authority | **PASS** | `src/app/api/webhooks/clerk/route.ts:42-48,143-150` — one boolean read and coerced; locale checked against the `LOCALES` allowlist at `:169` |

### 2.3 Admin authorization — every action, not just the layout

The brief calls a missing per-action check CRITICAL. **None was found.**

All 21 modules in `src/actions/admin/` were counted, `export async function`
against `requireAdmin()`. Every module's guard count meets or exceeds its export
count. The two that were exactly equal — where an import line could have masked a
missing guard — were opened and checked by hand:

- `offers.ts` — 4 exports at `:163, :208, :262, :296`; `requireAdmin()` at
  `:164, :212, :266, :297`. First statement of each.
- `rewards.ts` — 1 export at `:34`; `requireAdmin()` at `:35`.
- `shared.ts` — 0 exported actions. Not a `"use server"` module (the grep hit is
  its own doc comment at line 5). Exports helpers only.

`requireAdmin()` answers `notFound()` rather than redirecting
(`src/lib/admin/auth.ts:118`), so `/admin` is indistinguishable from a
non-existent URL for a signed-out visitor, a customer, and a typo alike.
Authority is a **verified** primary email (`:93`) against `ADMIN_EMAILS`
(`:59`), never a cookie, header or route param. **PASS.**

### 2.4 Clerk webhook

| Check | Status | Evidence |
|---|---|---|
| Signature verified | PASS | `route.ts:57` `verifyWebhook`, reads raw body itself |
| Missing secret rejected | PASS | `route.ts:198-200` → 500 |
| Event types allowlisted | PASS | `user.created` / `updated` / `deleted`; others acknowledged and ignored |
| Duplicates tolerated | PASS | `sync_clerk_user()` upserts on `clerkId`; `claim_welcome()` claims once (`0030_welcome.sql`) |
| Payload untrusted | PASS | `route.ts:97-192` — every field narrowed through `text()`; locale allowlisted |

### 2.5 Auth edge cases

**PASS by construction.** Every account page calls `getViewer()` on its own
behalf, so an expired or stale session yields `null` and the page redirects
regardless of what the proxy did. A deleted Clerk user cannot hold a valid
session. Direct API access is covered by §2.1. Because no action accepts a
caller-supplied user id (§2.2), there is no id-mismatch case to test.

*Not verified by live session manipulation — that needs write access to Clerk.*

---

## Phase 3 — Supabase database & RLS

**Method.** Rather than infer from 20,324 lines of migration text, the live
catalog was queried inside `begin transaction read only`, then confirmed with
live probes using the publishable key — exactly what a browser holds.

### 3.1 / 3.2 Table inventory and RLS

**71 tables. RLS enabled on 71 of 71.** Zero exceptions.

| Class | Count | RLS | Policy | Grant to anon/auth | Verdict |
|---|---|---|---|---|---|
| Public catalog & content | 33 | on | 1 SELECT each | `SELECT` only | **PASS** |
| Customer-owned (`Address`, `User`) | 2 | on | **none** | **none** | **PASS** — double-locked |
| Orders & payments (`Order`, `OrderItem`, `OrderStatusEvent`, `StripeWebhookEvent`) | 4 | on | **none** | **none** | **PASS** |
| Credits & rewards (`customer_credits`, `credit_transactions`, `points_transactions`) | 3 | on | **none** | **none** | **PASS** |
| Discounts & offers (grants, redemptions, products, collections) | 8 | on | **none** | **none** | **PASS** |
| Marketing (`campaigns`, `campaign_recipients`, `campaign_sends`, `NewsletterSubscriber`, `email_suppressions`) | 5 | on | **none** | **none** | **PASS** |
| Financial (`expenses`, `expense_categories`, `expense_recurring_rules`, `financial_targets`, `order_item_sales_ledger`) | 5 | on | **none** | **none** | **PASS** |
| Inventory & audit (`InventoryMovement`, notification reads) | 3 | on | **none** | **none** | **PASS** |
| Public offers/promotions (trigger & reward join tables) | 8 | on | 1 SELECT each | `SELECT` only | **PASS** |

The private classes carry **no policy and no grant** — two independent refusals.
The Supabase skill's warning that "`TO authenticated` alone is authentication
without authorization" does not apply here, because no private table grants
anything to `authenticated` at all.

`supabase/sql/0006_privileges.sql:27-38` is the root of this: it revokes the
write grants Supabase hands out by default and narrows `alter default privileges`
so later tables inherit `SELECT` only.

### 3.2b Live confirmation — publishable key, read-only

Each returned `401 permission denied`:

```
Order                 401  permission denied for table Order
User                  401  permission denied for table User
customer_credits      401  permission denied for table customer_credits
discounts             401  permission denied for table discounts
NewsletterSubscriber  401  permission denied for table NewsletterSubscriber
campaigns             401  permission denied for table campaigns
expenses              401  permission denied for table expenses
customer_directory    401  permission denied for view customer_directory
credit_balances       401  permission denied for view credit_balances
```

### 3.3 Policy audit

All 26 policies are `SELECT`-only, `TO anon, authenticated`. **There is not one
INSERT, UPDATE or DELETE policy in the schema** — writes are impossible through
the Data API by design, which is why `src/lib/supabase.ts:24-28` explains that
Clerk identity means `auth.uid()` is always null and every write goes through a
Server Action instead.

No policy uses a client-supplied identity in its predicate. The `USING (true)`
policies are on genuinely public catalog/content tables (created by the
`DO`-loop at `0002_content.sql`), which is correct — the row *is* the public
website. Conditional policies gate on publication state, e.g.:

- `Product` — `USING (("isArchived" = false) AND ("deletedAt" IS NULL))`
- `promotions` — `USING ("isActive" AND (startsAt IS NULL OR startsAt <= now()) AND (endsAt IS NULL OR endsAt > now()))`

**PASS.**

### 3.3b Column-level privilege — verified, and better than documented

`Product` holds no *table*-level grant to `anon`. It grants specific **columns**.
Probing with the publishable key:

```
Product?select=slug,name,priceInCents   → 200  [{"slug":"eva", …}]
Product?select=slug,costInCents         → 401  permission denied
```

**`costInCents` — the house's margin — is withheld from the browser at the
database.** One column, exactly the right one. This is not mentioned in any
document and deserves to be, in Stage 4's README.

### 3.4 Service-role audit — all 7 call sites

`getSupabaseAdmin()` bypasses RLS. Every caller:

| # | Module | Why | Browser-reachable? | Authorization before use |
|---|---|---|---|---|
| 1 | `src/actions/admin/shared.ts` (+ all 21 admin modules through it) | Dashboard writes | Yes, via Server Action | `requireAdmin()` first statement of every action (§2.3) |
| 2 | `src/actions/checkout.ts:296` | `place_order()` RPC — revoked from public roles | Yes | Rate limit `:241`, Zod `:262`, card-rail gate `:291`; **identity from `getUserId()` `:333`, never the body** |
| 3 | `src/app/api/webhooks/stripe/route.ts:111` | Settle payment | Only by Stripe | Signature verified before any use `:368` |
| 4 | `src/services/discounts.ts` | `resolve_discount()` preview | Yes, via `previewDiscount` | Rate-limited; identity from `getUserId()` (`src/actions/discounts.ts:99`) |
| 5 | `src/services/offers.ts` | Cart offer preview | Yes | `clerkUserId: await getUserId()` (`src/actions/offers.ts:79`) |
| 6 | `src/services/rewards.ts` | Points balance/redemption | Yes | Session-derived id; SQL takes `pg_advisory_xact_lock` (`0059_rewards.sql:755`) |
| 7 | `src/services/welcome.ts` | `claim_welcome()` on signup | Only by Clerk webhook | Signature verified |

No service-role query is built from unsanitised user input — all go through
`supabase-js` parameter binding or an RPC whose arguments are Zod-parsed first.
**PASS**, with **F9** on the stale doc comment.

**F9 — LOW.** `src/lib/supabase.ts:175-176` says *"Reach for `getSupabasePublic`
unless the caller is writing — today that is `src/actions/comments.ts` alone."*
There are now seven callers, and `comments.ts` is not among the seven listed by
`grep` for `getSupabaseAdmin`. On the module that owns the RLS-bypassing key,
this is the comment most worth keeping true. **Proposed fix:** replace the
sentence with the table above, or a pointer to it.

### 3.5 SQL functions / RPC

**103 functions. 89 explicitly revoked from `public, anon, authenticated`.**

| Check | Status | Evidence |
|---|---|---|
| `SECURITY DEFINER` with unpinned `search_path` | **PASS — zero** | Catalog query returned 0 rows |
| Dangerous definer callable by a public role | **PASS (1, by design)** | Only `welcome_offer()` — see below |
| Dynamic SQL / injection | PASS | The only `execute format(...)` is the policy-creation loop in `0002`/`0003`, running at migration time on literal table names |
| Money functions revoked | PASS | `place_order`, `settle_order_payment`, `expire_unpaid_orders`, `adjust_credit`, `reverse_credit_redemption`, `sync_clerk_user`, `customer_profile`, `customer_orders`, campaign dispatch — all `revoke all … from public, anon, authenticated` |

`welcome_offer()` is `SECURITY DEFINER`, granted to `anon`, and returns
`TABLE(kind, value)`. Its body selects `kind, value` from `discounts` where
`isWelcome AND isActive` and in date. It exposes the public welcome offer and
nothing else — no code, no id, no customer data. Live probe returned `200 []`.
**Correct by design.**

**F10 — LOW.** Five `SECURITY DEFINER` functions keep Postgres's default
`EXECUTE to PUBLIC`: `category_kind_cascade()`, `collection_kind_from_category()`,
`nav_link_depth_guard()`, `product_type_matches_kind()`,
`slug_unique_across_namespace()`. All five `RETURNS trigger`, so PostgREST does
not expose them as RPC and a direct call raises *"trigger functions can only be
called as triggers"*. **Not exploitable.** Reported only because the other 89 are
revoked, and an inconsistency in a security convention is how the convention
eventually gets dropped from something that matters.
**Proposed fix:** add the five to a `revoke all on function … from public, anon,
authenticated` block in a new migration.

**F11 — LOW.** `slug_is_reserved(v_slug text)` (`0047_reserved_slugs.sql:44`) has
no `set search_path`. It is `SECURITY INVOKER` and `immutable`, so there is no
privilege escalation — this is hygiene, and it is the only function in the schema
without the pin. **Proposed fix:** add `set search_path = ''`.

### 3.5b Views — F4, MEDIUM

The Supabase skill: *"Views bypass RLS by default. In Postgres 15+, use
`CREATE VIEW … WITH (security_invoker = true)`."*

| View | `security_invoker` | Granted to anon/auth | Reachable |
|---|---|---|---|
| `active_product_promotions` | **true** | anon, authenticated | Yes — public promo data, correct |
| `DailySales` | on | — | No |
| `ProductSales` | on | — | No |
| `SalesLedgerRow` | on | — | No |
| **`credit_balances`** | **false** | — | No |
| **`customer_directory`** | **false** | — | No |
| **`reward_balances`** | **false** | — | No |

The three `false` views select customer credit balances, the customer directory
(clerk id, email) and points balances. They are **not exposed today** — no grant,
and both probed views returned `401`. Four of the seven views already set
`security_invoker`, so the convention exists; these three simply missed it.

The risk is specific: because they bypass RLS, a single future
`grant select on customer_directory to authenticated` — a plausible line for a
"let customers see their own profile" feature — would expose **every** customer's
row, not just the caller's, and RLS would not stop it. The grant is currently the
only thing between these views and that outcome.

**Proposed fix (Stage 2), one migration:**

```sql
alter view public.credit_balances    set (security_invoker = on);
alter view public.customer_directory set (security_invoker = on);
alter view public.reward_balances    set (security_invoker = on);
```

Then re-run `npm run db:verify` — note that these views are read by admin code
through the **service role**, which bypasses RLS anyway, so turning on
`security_invoker` should not change any current behaviour. **That must be
confirmed in Stage 2 before the migration is applied**, since `security_invoker`
makes the view run as the caller and the underlying tables have no policies.

**F8 — LOW.** `supabase/sql/0006_privileges.sql:3` states *"Applied last by
`npm run db:migrate`, after every table exists."* It is not — `scripts/db-migrate.ts:35`
sorts filenames, so `0006` runs sixth of sixty-three. The file is still
*effective*, because its `alter default privileges` clause (`:35-41`) covers every
table created afterwards, and the audit above confirms all 57 later tables landed
with `SELECT`-only or nothing. But a future developer reading that line could
reasonably add a table expecting the blanket `revoke` at `:27` to have covered it.
**Proposed fix:** correct the comment, or rename the file so it sorts last.

### 3.6 Direct RLS attacks

Per D1, cross-user *writes* were not attempted against production. Reads were —
and the write paths are argued from the policy set.

| Attack | Verdict | Basis |
|---|---|---|
| User A reads User B's orders | **PASS — verified** | `Order` grants nothing to `anon`/`authenticated`; live probe `401`. No policy exists to permit it |
| A reads B's profile / address | **PASS — verified** | `User`, `Address`: no policy, no grant; live `401` |
| A reads B's credits | **PASS — verified** | `customer_credits`, `credit_balances`: live `401` |
| A reads B's discount grants | **PASS — verified** | `discount_grants`: no grant |
| A updates/deletes **any** row via the Data API | **PASS — structural** | **The schema contains zero INSERT/UPDATE/DELETE policies**, and `0006_privileges.sql:27` revokes the privileges. Two independent refusals; neither depends on the other |
| A modifies B's address via the Server Action | **PASS — code-verified** | `src/actions/addresses.ts:156,191,242` — every mutation carries `.eq("userId", userId)` from `getViewer()` |
| Archived product hidden from public | **PASS — empirically proven** | The catalogue contains **1** archived product. `Product?select=slug,name&isArchived=eq.true` with the publishable key returned **`[]`** |
| A redeems B's credit | **UNVERIFIED — requires staging** | Owner compared to session `clerkUserId` inside `place_order()` under `for update` (`0027_credit_redemption.sql:215`). *Probe:* place an order in staging passing another account's `creditId`; expect the raise at `0042_inventory_channels.sql:530` |

---

## Phase 4 — IDOR / broken access control

| Identifier | Crosses boundary at | Server-side ownership check | Status |
|---|---|---|---|
| `addressId` | `saveAddress`, `deleteAddress`, `setDefaultAddress` | `.eq("userId", userId)` + opaque zero-row reply | **PASS** |
| `creditId` | `placeCustomerOrder` body | Owner compared to session id **inside** `place_order()` under lock — deliberately not pre-checked, `checkout.ts:354-361` | **PASS (by design)** |
| `discountCode` | `placeCustomerOrder`, `previewDiscount` | `resolve_discount()` under `for update` (`0028:286`) | **PASS** |
| `pointsToRedeem` | `placeCustomerOrder` | `resolve_points_redemption()` under `pg_advisory_xact_lock` (`0059:755`) | **PASS** |
| `productId` | cart payload | Resolved to slug + **server price** by `resolveCartToLines` (`services/orders.ts:171`) | **PASS** |
| `unsubscribeToken` | `/unsubscribe?token=` | 64 hex chars from two `gen_random_uuid()`s (`0025:88`), unique index `:109`; matched by token never id `:215` | **PASS** |
| `notificationId` | `markNotificationsRead` | `clerkUserId` passed into the SQL function from `getUserId()` (`actions/notifications.ts:30`) | **PASS** |
| `orderId` | `/api/checkout/intent` POST body | **No ownership check** — see below | **ACCEPTED RISK (documented)** |
| Admin resource ids | all admin actions | `requireAdmin()` first (§2.3) | **PASS** |

### `/api/checkout/intent` — reasoned exposure, not an oversight

`route.ts:14-20` states the position explicitly: the id is a uuid (not
enumerable like an order number), and four guards mean holding one buys nothing —
the order must still be `PROCESSING`, `UNPAID`, `CARD`, and under 30 minutes old
(`:117-121`). *"The worst an attacker with a stolen id can do is create a payment
intent that lets them pay somebody else's bill."*

That reasoning holds. Two residual notes for Stage 2, neither a breach:

1. The returned `clientSecret` lets the holder read the intent's **amount** from
   Stripe with the publishable key — a small disclosure of someone's order total,
   available only to someone who already has their order uuid.
2. The route has **no rate limit** (see F5).

**Proposed fix (optional, Stage 2):** when `getUserId()` is non-null *and* the
order carries a `clerkUserId`, require them to match. Guests must still be
allowed through with the id alone, since a guest order has no session behind it —
so this narrows the surface without changing guest checkout.

---

## Phase 5 — Input validation & injection

| Vector | Status | Evidence |
|---|---|---|
| SQL injection | **PASS** | No string-built SQL in `src/`. All access via `supabase-js` binding or RPC with Zod-parsed args |
| Command injection | **PASS** | No `child_process` in `src/` |
| `eval` / `new Function` / `.innerHTML =` | **PASS — zero** | Grep across 553 files returns nothing |
| `dangerouslySetInnerHTML` | **2 uses** | `layout.tsx:375` — **PASS**, a compile-time constant string, no interpolation. `journal/[slug]/page.tsx:128` — **FAIL, F1** |
| Rich text (Tiptap's replacement) | **PASS** | `ArticleBody.tsx:16` — body is structured JSON rendered by a component switch, never markup |
| Open redirect | **PASS** | `src/lib/auth-redirect.ts:46-73` rejects `//`, `\`, whitespace, control characters, and auth-path loops. Unusually complete |
| Email header injection | **PASS** | `stripHeaderBreaks` (`src/lib/email/escape.ts`) |
| Email HTML injection | **PASS** | `escapeHtml` applied to every interpolated value in `campaign-template.ts:69-87`, `layout.ts:63,77,207` |
| Mass assignment | **PASS** | Admin actions destructure Zod output; no spread of raw input into a row |
| Path traversal | **PASS** | Only `path.join(process.cwd(), …)` on a constant (`src/lib/email/logo.ts`) |
| SSRF | **PASS** | No outbound fetch takes a user-supplied URL |
| Prototype pollution | **PASS** | No recursive merge; Zod `.safeParse` everywhere at the boundary |
| Quantity / negative values | **PASS** | `schemas/checkout.ts:41-45` — `int().min(1).max(MAX_QUANTITY_PER_LINE)`; ≤50 lines, deduped by `productId` (`:139-144`). Restated in SQL at `0042:440` |

### F1 — Stored XSS via JSON-LD script breakout — MEDIUM–HIGH

**Location:** `src/app/[locale]/journal/[slug]/page.tsx:126-129`

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

The comment above it (`:100-104`) claims:

> *"Every value is a stored string serialised by `JSON.stringify`, which escapes
> what needs escaping — nothing an editor can type reaches the page as markup."*

**That claim is false.** `JSON.stringify` escapes quotes and backslashes; it does
not escape `<`. Proven:

```
$ node -e 'console.log(JSON.stringify({headline:"</script><img src=x onerror=alert(1)>"}))'
{"headline":"</script><img src=x onerror=alert(1)>"}
```

The HTML parser terminates a `<script>` element at the first literal `</script>`
regardless of JavaScript string context, so the remainder is parsed as markup.

**Reachable values** — all admin-authored, all rendered on a public page:
`article.title`, `article.excerpt`, `article.image.url`, `article.category`
(`page.tsx:108-113`). No character restriction was found in the journal schema,
and no `<`-escaping exists anywhere in the codebase (grep for `u003c` returns
nothing).

**Severity.** MEDIUM–HIGH rather than CRITICAL: authoring requires admin access,
which `requireAdmin()` protects properly. But Phase 5 of the brief is explicit —
*"Admin-authored content must also be considered untrusted when rendered
publicly"* — and the payload executes for every anonymous reader of that article,
in a session that may belong to another admin.

**Proposed fix (Stage 2).** One line, no behaviour change:

```tsx
dangerouslySetInnerHTML={{
  __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
}}
```

`<` is valid JSON and parses back to `<`, so the structured data is
unchanged for consumers. Better still, extract it to a shared
`src/lib/json-ld.ts` helper — **because Stage 3 (Phase 19.5.6) will add Product,
Offer, Organization, WebSite and BreadcrumbList JSON-LD across the whole site.**
Fixing this before that work multiplies the bug across every product page is the
single most valuable ordering decision in this audit.

---

## Phase 6 — Stripe & payment security

### 6.1 The server determines every figure — PASS

| Figure | Determined by | Evidence |
|---|---|---|
| Product & price | `place_order()` from locked `"Product"` rows | `actions/checkout.ts:20-21` |
| Quantity | Zod, then re-checked in SQL | `schemas/checkout.ts:41`; `0042:440` |
| Stock | `place_order()` under `for update` | `0016_checkout.sql:202` |
| Delivery | `shippingInCents()` from `"DeliverySetting"`, **re-read server-side** | `checkout.ts:314-325` — *"what a browser sends is a claim; `DeliverySetting` is the fact"* |
| Discount | `resolve_discount()` under lock | `0028:286` |
| Credit / points | inside `place_order()` under lock | `0027:215`, `0059:755` |
| Total | `place_order()` | `checkout.ts:25` |
| Identity | `getUserId()` | `checkout.ts:333` |
| Charge amount | `row.totalInCents` read from the order | `intent/route.ts:142` |

The client posts only `{ productId, quantity }`. **No price, total, discount or
payment status is ever accepted from the browser.**

Additionally `checkout.ts:291` treats the card rail as a boundary, not an
affordance — a forged `paymentMethod: "CARD"` while Stripe is off is refused
before an order reserves stock.

### 6.2 Webhook — PASS on every criterion

| Requirement | Status | Evidence |
|---|---|---|
| Raw body | **PASS** | `route.ts:363` `await request.text()` before any parse |
| Signature verified | **PASS** | `:368` `constructEvent(body, signature, secret)` |
| Invalid rejected | **PASS** | `:375` → 400; the body is never logged (`:370`) |
| Missing secret → refuse | **PASS** | `:352-355` → 500, never a bypass |
| Event types validated | **PASS** | `:417-441` switch; default acknowledges and ignores |
| Idempotent | **PASS — two layers** | `record_stripe_event()` inserts-and-reports (`:396`), so two concurrent deliveries cannot both pass; `settle_order_payment()` returns true once per order (`:172`) and gates the email |
| **Amount verified** | **PASS** | `:145` — `intent.amount !== row.totalInCents \|\| currency !== "egp"` → refuse and log both figures |
| Retry correctness | **PASS** | The ledger row is deleted on handler throw (`:466-478`) so the redelivery is not swallowed as a duplicate |

Two details worth recording as exemplary: the ledger is treated as *a gate, not a
dependency* (`:385-391`) — a Supabase wobble degrades to a possible duplicate
email rather than to money moving unrecorded; and `handleFailed`/`handleCanceled`
both carry `.neq("paymentStatus", "PAID")` (`:212`, `:250`) so a late-delivered
failure cannot un-pay a settled order.

### 6.3 Success redirect — PASS

Nothing in `src/app/[locale]/checkout/` writes `paymentStatus`. The only writer
is `settle_order_payment()`, reachable only from the signature-verified webhook,
and revoked from all public roles (`0016_checkout.sql:349`).

### 6.4 State machine

```
Cart ──► placeCustomerOrder ──► place_order() [PROCESSING/UNPAID, stock reserved]
   │                                    │
   │  CASH ──► announceOrder()          │  CARD
   │                                    ▼
   │                        /api/checkout/intent ──► Stripe PaymentIntent
   │                                    │
   │                      payment_intent.succeeded (signed)
   │                                    ▼
   │                  amount+currency verified ──► settle_order_payment() [PAID]
   │                                    └──► announceOrder()
   └── unpaid >30min ──► expire_unpaid_orders() ──► CANCELLED + restock
```

Every transition is server-authored. **PASS.**

### 6.5 Replay — PASS

Duplicate orders, fulfilment, credits, emails and stock decrements are each
blocked: the event ledger stops the same event twice, `settle_order_payment()`
stops two events settling one order, and `restock_order()` is idempotent on
`"stockReleasedAt"` (`route.ts:229-232`) — which is also why `handleCanceled`
deliberately does **not** restock, leaving one owner for that decision.

*Not exercised against a live Stripe rail — no keys on this machine. Deferred to
Stage 3 with test keys.*

---

## Phase 7 — Inventory & concurrency

**Decrement location:** `place_order()` (`0016_checkout.sql`, extended by
`0042_inventory_channels.sql:396+`).

| Requirement | Status | Evidence |
|---|---|---|
| Atomic | **PASS** | One transaction; slug-ordered `for update` locks (`0016:120,202`) so concurrent orders queue rather than interleave — and the ordering also prevents deadlock |
| Stock cannot go negative | **PASS — constraint-enforced** | `check ("inventoryOnline" >= 0)` and `("inventoryOffline" >= 0)` (`0042:64,66`), plus `check (inventory >= 0)` (`0001:116`). Even a logic bug cannot commit a negative |
| Final unit not oversold | **PASS — by lock** | `0042:188` `if v_new < 0 then raise` at `:198`, evaluated while holding the row lock |
| Movement ledger consistent | **PASS** | `check ("previousQuantity" + quantity = "newQuantity")` (`0042:131`) |
| No double decrement | **PASS** | Order creation and stock movement are the same transaction — `actions/checkout.ts:8-12` states the rule |
| Abandoned checkout releases stock | **PASS** | `expire_unpaid_orders(30)` runs opportunistically before every order (`checkout.ts:329`) and daily on cron |
| Webhook retry double-decrement | **PASS** | Webhook never touches stock on success; `restock_order()` idempotent on `"stockReleasedAt"` |

The brief asks for "atomic database operations, constraints or transactions."
This uses all three. **PASS.**

*Two-buyers-race not executed live (needs concurrent writes). **UNVERIFIED —
requires staging.** Probe: two parallel `place_order()` calls for the last unit;
expect exactly one success and one `'% has only % in stock.'` raise.*

---

## Phase 8 — Discounts, promotions & credits

| Attack | Status | Evidence |
|---|---|---|
| All money computed server-side | **PASS** | §6.1 |
| Reuse / duplicate redemption | **PASS** | `select * into v_d from discounts where code = v_code for update` (`0028:286`) — the lock is taken *before* counting |
| Per-customer limit | **PASS** | `0028:354-367` under that lock |
| Expiry | **PASS** | `0028:299-304`, re-checked at `:338` |
| Minimum order | **PASS** | `check ("minimumOrderInCents" >= 0)` `0028:90`; enforced in `resolve_discount` |
| Negative amounts | **PASS** | `check ("amountInCents" >= 0)` `0028:194`; `check ("discountInCents" >= 0)` `0028:715` |
| Negative quantity | **PASS** | Zod `.min(1)` + SQL `raise` at `0042:440` |
| Substituted customer id | **PASS** | Never accepted — identity is `getUserId()` (`checkout.ts:333`) |
| Substituted credit id | **PASS** | Ownership checked inside `place_order()` under lock; raises at `0042:530` if the credit belongs to no session |
| Concurrent points redemption | **PASS** | `pg_advisory_xact_lock(hashtext('khem.points:' || clerk_id))` (`0059:755`) — serialises per customer |
| Concurrent credit redemption | **PASS** | `for update` on `customer_credits` (`0027:215,350`) |
| Stacking rules | **PASS** | Benefit ladder inside `place_order()`; refusals carry `hint = 'BENEFIT:<code>'` (`checkout.ts:193-208`) |

Every guard sits **in the database, under a lock**, rather than in TypeScript —
`checkout.ts:354-361` explains the reasoning: a check in the action "could go
stale between this line and the write." **PASS.**

*Live concurrent-redemption races: **UNVERIFIED — requires staging.***

---

## Phase 9 — Resend / email security

| Requirement | Status | Evidence |
|---|---|---|
| API key server-only | **PASS** | `RESEND_API_KEY` has no `NEXT_PUBLIC_` prefix; absent from the built bundle (§1.2) |
| Recipients never caller-chosen | **PASS** | `send-order-mail.ts:195,265` — `to: order.customerEmail`, read from the order row, never from the request |
| Campaign sending admin-only | **PASS** | `src/actions/admin/campaigns.ts` — `requireAdmin()` ×11; dispatch also runs under `CRON_SECRET` |
| HTML escaped | **PASS** | `escapeHtml` on every interpolation — `campaign-template.ts:69,85,86,87`; `layout.ts:63,77,207` |
| Header injection | **PASS** | `stripHeaderBreaks` (`src/lib/email/escape.ts`) |
| Unsubscribe unforgeable | **PASS** | 64 hex chars from two `gen_random_uuid()` values (`0025:88`), unique index `:109` |
| Unsubscribe suppresses future sends | **PASS** | `unsubscribe_newsletter()` `0025:203`; `email_suppressions` table, no public grant |
| Unsubscribe is not a GET side effect | **PASS** | `actions/unsubscribe.ts:6-16` — link scanners and prefetchers would otherwise unsubscribe people silently. The page confirms; the action writes |
| Token probing tells nothing | **PASS** | `unsubscribe.ts:56-58` — same answer for unknown and tampered |
| Duplicate sends bounded | **PASS** | `campaign_sends` + dispatch lease (`0057_campaign_dispatch_lease.sql`) |
| Rate limited | **PASS** | `isRateLimited` in `newsletter.ts`, `contact.ts`, `marketing.ts` — subject to F5 |

**No email was sent during this audit.**

---

## Phase 10 — Cloudinary / upload security

Cloudinary is **delivery-only** — a `remotePatterns` entry in `next.config.ts`.
No upload code path exists, so no Cloudinary signing surface to audit. **N/A.**

The one real upload path is comment images → Supabase Storage:

| Requirement | Status | Evidence |
|---|---|---|
| Type validated by **content**, not header | **PASS** | `src/lib/comment-images.ts:57` — *"not evidence: `payload.pdf` renamed to `photo.png` arrives as `image/png`"*. Magic bytes sniffed at `:64` (JPEG), `:79` (PNG), `:82-94` (RIFF/WEBP) |
| Extension derived from sniffed type | **PASS** | `:46-50` — the stored path never uses the user's filename |
| Allowlist | **PASS** | `:31-34` — jpeg, png, webp only |
| Size limit | **PASS** | `:22` 5 MB, *"Mirrored by the bucket's own `file_size_limit`"* — enforced twice |
| Count limit | **PASS** | `:19` max 3 |
| Dimensions read | **PASS** | `:173` |
| Bucket policy | **PASS** | `product_comment_image_public_read` — SELECT only; RLS on |
| Secrets server-side | **PASS** | Upload runs in a Server Action (`actions/comments.ts:241`) |

Executable-extension and renamed-file attacks are defeated by sniffing rather
than trusting. **PASS.** *Malicious-file uploads were not executed (a write).*

---

## Phase 11 — Public forms & abuse protection

| Surface | Validation | Rate limit | Other |
|---|---|---|---|
| Checkout | `checkoutSchema` | 8 / 10 min (`checkout.ts:81`) | Honeypot `:236` |
| Contact | Zod | 3 / window | Honeypot |
| Newsletter | Zod | yes | — |
| Marketing / offers | Zod | yes | — |
| Comments | Zod | yes | Image limits (§10) |
| Discount preview | Zod | yes | — |
| `/api/search` | normalised | 20 / 10 s (`route.ts:54`) | Guards billed embedding calls |
| `/api/cart/catalog` | locale allowlist | **none** | Deliberate — cached, `s-maxage=300` (`route.ts:34,49`) |
| **`/api/checkout/intent`** | Zod | **none** | **F5** |
| Cron routes | — | — | Bearer token |

### F5 — Rate limiting is per-instance memory — MEDIUM

`src/lib/email/rate-limit.ts:10-14` is honest about it:

> *"Held in process memory, so it is per-instance and lost on redeploy — stated
> plainly rather than papered over. It stops a hammering tab or a naive script,
> not a distributed flood."*

That assessment is correct, and on Vercel it is weaker than it sounds: each
serverless instance keeps its own `Map`, so the effective limit is
`limit × instances`, and a cold start resets it. For the checkout limiter this
matters most — it is what stands between a script and mass stock reservation,
since every accepted checkout reserves bottles for 30 minutes.

`/api/checkout/intent` has no limiter at all. Its exposure is bounded by needing
a valid order uuid and by the reuse branch (`:128-136`), so this is defence in
depth rather than an open door.

**Proposed fix (Stage 2, or accept for launch).** The file already names the
upgrade: Upstash or Vercel KV for a shared counter. Given launch scale this is
reasonably an **accepted risk** — but it should be an explicit decision recorded
in the README, not an inherited default. Minimum: add the existing limiter to
`/api/checkout/intent`.

---

## Phase 12 — Security headers — F3, MEDIUM

**No security headers are configured anywhere in the repository.** Verified:
`next.config.ts` has no `headers()` block; `vercel.json` contains only `crons`.

| Header | Present | Consequence |
|---|---|---|
| `Content-Security-Policy` | **No** | F1 becomes directly exploitable rather than mitigated |
| `X-Content-Type-Options: nosniff` | **No** | MIME sniffing on user-uploaded comment images |
| `Referrer-Policy` | **No** | Full URLs leak to third parties |
| `Strict-Transport-Security` | **No** | Vercel serves HSTS at the edge for `.vercel.app`; must be confirmed for `khemperfumes.com` |
| `Permissions-Policy` | **No** | Camera/mic/geolocation not disavowed |
| `X-Frame-Options` / `frame-ancestors` | **No** | Clickjacking on `/account`, `/checkout` |

Cookies are Clerk's, which sets `Secure`, `HttpOnly` and `SameSite` itself.
No custom CORS is configured — same-origin default, correct.

### Proposed CSP — derived from the origins this codebase actually uses

Assembled from `next.config.ts` `remotePatterns`, the Clerk/Stripe integrations
and the Supabase client. **Not applied — Stage 2.**

```
default-src 'self';
script-src  'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.khemperfumes.com
            https://js.stripe.com https://challenges.cloudflare.com;
style-src   'self' 'unsafe-inline';
img-src     'self' data: blob: https://res.cloudinary.com https://images.unsplash.com
            https://img.clerk.com https://<project>.supabase.co;
media-src   'self' https://res.cloudinary.com;
font-src    'self' data:;
connect-src 'self' https://*.clerk.accounts.dev https://clerk.khemperfumes.com
            https://<project>.supabase.co https://api.stripe.com;
frame-src   https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com;
worker-src  'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

Three cautions for Stage 2, per the brief's *"do not add headers blindly"*:

1. **`'unsafe-inline'` in `script-src` is required today** by the inline
   `sessionStorage` script at `layout.tsx:375` and the JSON-LD block. Removing it
   needs a nonce threaded through both — worth doing, but it is a change to
   rendering, not a header edit, so it should not ride along in the same commit.
2. **Clerk's satellite/proxy domains vary by instance.** The `.clerk.accounts.dev`
   entry covers development keys; the production domain must be confirmed
   against the live Clerk configuration before this ships, or sign-in breaks.
3. **Ship `Content-Security-Policy-Report-Only` first.** Collect violations for a
   few days, then enforce. Rolling straight to enforcing CSP on a storefront
   with Stripe Elements and Clerk embedded is how checkout goes dark.

---

## Phase 13 — CSRF

| Surface | Cookie-authenticated? | Protection | Status |
|---|---|---|---|
| Server Actions (all 33 modules) | Yes (Clerk) | Next 16 verifies `Origin` against `Host` for every Server Action POST; Clerk cookies are `SameSite=Lax` | **PASS** |
| `/api/webhooks/stripe` | No | Signature | **PASS** — no cookie authority to abuse |
| `/api/webhooks/clerk` | No | Signature | **PASS** |
| `/api/cron/*` | No | Bearer | **PASS** — a cross-site form cannot set `Authorization` |
| `/api/checkout/intent` | **No** | Order-state guards | **PASS** — authority is the order uuid, not the session, so a forged cross-site POST gains the attacker nothing they did not already have |
| `/api/search`, `/api/cart/catalog` | No | — | **N/A** — GET, no state change |

No cookie-authenticated route handler performs a state change. The framework
protection is sufficient. **PASS.**

---

## Phase 14 — Error handling & information disclosure

| Check | Status | Evidence |
|---|---|---|
| Provider errors not shown to users | **PASS** | `src/actions/admin/shared.ts:9-16` — *"it leaks the schema's internal names"*. `postgresFailure()` maps codes to sentences; the raw message goes to the log |
| Uniform refusal shapes | **PASS** | `intent/route.ts:54-57` — *"so the response never says which guard fired"* |
| Enumeration resisted | **PASS** | `addresses.ts:164`, `unsubscribe.ts:56`, `requireAdmin` → `notFound()` |
| No stack traces to clients | **PASS** | Every `catch` narrows to `cause instanceof Error ? cause.message : "unknown error"` |
| Secrets in logs | **PASS** | Variable **names** only (§1.5) |
| PII in logs | **PASS** | `checkout.ts:49-53` — *"**Never** the name, email, phone, address, or note"*; `clerk/route.ts:50-54` likewise. Spot-checked and honoured |
| Swallowed errors | **PASS (deliberate, documented)** | `sweepStaleHolds` (`checkout.ts:109-111`) and `revalidateProductsBySlug` (`shared.ts:290-292`) swallow by design — each explains that failing there would refuse a customer's money or falsely report an unsaved edit. Both log |

Error-state text was reviewed statically; controlled 500s were not triggered
against production. **PASS.**

---

## Phase 15 — Dependencies & supply chain

`npm audit` — **4 high severity**. `npm outdated` — 19 packages behind.

### F2 — `sharp` / libvips CVEs — HIGH

```
sharp  <0.35.0   Severity: high
  libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591
  GHSA-f88m-g3jw-g9cj
via: next 16.2.12  →  fix: next@16.3.4
```

**Why this is not theoretical here.** `sharp` is what `next/image` uses to
optimise images. This deployment optimises images from the **`comment-images`
Supabase bucket** — files uploaded by members of the public
(`next.config.ts` `commentImagePattern()`). Visitor-supplied bytes therefore
reach libvips. The comment-image path does validate magic bytes (§10), which
narrows the input to real JPEG/PNG/WEBP, but these CVEs are parser bugs *in*
those formats.

**Proposed fix (Stage 2):** `next` 16.2.12 → **16.3.4**. Same major, and
`eslint-config-next` should move with it. Not `npm audit fix --force`, which the
tool itself warns goes "outside the stated dependency range."

### Classification

| Class | Packages | Action |
|---|---|---|
| **Security critical** | `next` 16.2.12 → 16.3.4 (+ `eslint-config-next`) | Stage 2 — resolves all 4 CVEs |
| **Recommended** | `@clerk/nextjs` 7.7.4 → 7.9.1, `@supabase/supabase-js` 2.109.0 → 2.115.0, `stripe` 22.5.0 → 22.6.1, `resend` 6.20.0 → 6.26.0, `@stripe/*` | Stage 2, one at a time, smoke-tested. All are security-sensitive integrations |
| **Safe to defer** | `lucide-react`, `motion`, `ai`, `tsx`, `@types/*`, `react`/`react-dom` 19.2.4 → 19.2.8 | Post-launch |
| **Breaking** | `eslint` 9 → 10, `@types/node` 20 → 26 | Not before launch |

`@supabase/supabase-js` is pinned exactly (`"2.109.0"`) while everything else uses
`^`. Deliberate pinning is good supply-chain practice; worth documenting in
Stage 4 so it is not "fixed" by someone later.

**No suspicious or abandoned package was found.** `package-lock.json` is
committed.

---

## Verification commands — actually executed

| Command | Result |
|---|---|
| `npm run build` | **exit 0** — succeeded; route table and client bundle produced |
| `npx tsc --noEmit` | **exit 0** — no type errors |
| `npm run lint` | **exit 0** — no findings |
| `npm audit` | **4 high** (F2) |
| `npm outdated` | 19 behind (§15) |
| `git log --all --diff-filter=A -- '.env*'` | only `.env.example` |
| `git ls-files \| grep -i env` | only `.env.example` |
| `find .next/static -name "*.map"` | **0** |
| Secret-value grep over `.next/static` + `.next/server/app` | **0 hits** across 8 testable secrets |
| `node -e 'JSON.stringify({headline:"</script>…"})'` | breakout **reproduced** (F1) |
| `pg_catalog` audit inside `begin transaction read only` | 71 tables, 7 views, 103 functions, 26 policies enumerated |
| 12 live anon-key REST probes | 9 × `401`, catalog `200`, archived `[]`, `welcome_offer` `200 []` |

**Not run:** `npm run db:verify`. Inspection showed it **writes** — probe inserts
at `scripts/db-verify.ts:503,548,553`. Skipped under D1. It should be run in
Stage 2 if a staging database is provisioned; it asserts, among other things,
"the public roles hold no write grant", which is exactly the property §3.2
verified by other means here.

---

## Open findings

| Severity | Finding | Location | Recommended action |
|---|---|---|---|
| MEDIUM–HIGH | F1 JSON-LD `</script>` breakout | `journal/[slug]/page.tsx:128` | Escape `<` → `<`; extract a shared helper **before** Phase 19.5 adds sitewide JSON-LD |
| HIGH (dep) | F2 sharp/libvips CVEs | `next` 16.2.12 | Upgrade to 16.3.4 |
| MEDIUM | F3 No security headers | `next.config.ts` | Add `headers()`; CSP in Report-Only first |
| MEDIUM | F4 Three RLS-bypassing views | `credit_balances`, `customer_directory`, `reward_balances` | `set (security_invoker = on)` after confirming admin reads still work |
| MEDIUM | F5 In-memory rate limiting | `lib/email/rate-limit.ts:23` | Add limiter to `/api/checkout/intent`; decide explicitly on shared-store upgrade |
| LOW–MED | F6 `/design-preview` public | `src/app/design-preview/` | Delete (per its own comment) or gate on `getAdminActor()` |
| LOW | F7 Doc recommends `NEXT_PUBLIC_KHEM_PRELAUNCH` | `Temporary-Pre-Launch-Cover.md:370` | Correct the doc to match `src/lib/prelaunch.ts:11` |
| LOW | F8 `0006_privileges.sql` "applied last" is false | `0006_privileges.sql:3` | Fix comment or rename to sort last |
| LOW | F9 `getSupabaseAdmin()` doc names 1 of 7 callers | `src/lib/supabase.ts:175` | Update to the §3.4 table |
| LOW | F10 5 trigger definers keep default EXECUTE | §3.5 | Revoke for consistency |
| LOW | F11 `slug_is_reserved()` unpinned `search_path` | `0047:44` | `set search_path = ''` |
| INFO | F12 AGENTS.md documents a non-existent architecture | `AGENTS.md` §9, §10 | Correct in Stage 4 |

## Fixed findings

**None.** Stage 1 is read-only by design. `git diff` is empty; the only change to
the working tree is this file plus the Stage 1 prompt.

## Accepted risks (proposed — for your decision in Stage 2)

1. **`/api/checkout/intent` does not verify order ownership.** Reasoned and
   documented at `route.ts:14-20`; bounded by a uuid and four state guards. The
   optional narrowing in §4 would reduce it further.
2. **Rate limiting is per-instance.** Honest about its own limits; adequate for
   launch traffic, inadequate against a distributed flood.
3. **Guest orders carry no session.** Inherent to guest checkout; the order uuid
   is the only credential, which is why it is a uuid.

## `UNVERIFIED — requires staging`

Each needs a write, refused under D1. Provisioning a staging Supabase project
would settle all four:

1. Cross-account credit redemption — expect the raise at `0042:530`.
2. Two-buyer race for the last unit — expect one success, one stock raise.
3. Concurrent discount redemption against `perCustomerLimit` — expect one grant.
4. Stripe webhook replay end-to-end — expect `duplicate: true` on redelivery.

---

## Files changed

| File | Why |
|---|---|
| `src/docs/SECURITY-AUDIT-STAGE-1.md` | **New.** This report — the sole deliverable of Stage 1. |

No source, SQL or configuration file was modified.

---

## Recommended Stage 2 order

Ordering matters here more than usual — one of these gates the next stage:

1. **F1** — before Phase 19.5 multiplies the pattern across every product page.
2. **F2** — `next` 16.3.4, then re-run build, lint, typecheck.
3. **F6** — delete `/design-preview`.
4. **F3** — headers, CSP in Report-Only.
5. **F4** — the view migration, after confirming admin reads are unaffected.
6. **F5** — limiter on `/api/checkout/intent`.
7. **F8–F11** — one migration and three comment corrections.
8. Re-run the full verification suite; then Phases 16–17.
