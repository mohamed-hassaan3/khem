# KHEM

The digital flagship for **KHEM**, a luxury Egyptian fragrance house —
*Essence of Heritage*. Production site: **https://khemperfumes.com**

This is a practical handbook. It tells you where things live, what is safe to
change, and what will hurt you. Read §22 before you touch payments, RLS or
secrets.

> **Companion documents.** `AGENTS.md` is the engineering handbook for AI agents
> and humans alike — read it for the design system and working conventions. Note
> that its §9 (Prisma schema) and §10 (middleware) describe an architecture this
> repository **does not have**; where they disagree with the code, the code
> wins. See §4 below.
>
> The pre-launch audit lives in `src/docs/SECURITY-AUDIT-STAGE-1.md`,
> `-2`, and `-3`. **`-3` documents F15, two features currently broken in
> production.** Read it before you conclude search is working.

---

## 1. Project overview

KHEM sells perfumes, body care, home fragrance and gift sets, in **English and
Arabic**, priced and settled in **Egyptian pounds (EGP)**. It is a storefront,
an editorial site ("World of KHEM"), and a full admin dashboard — content
management, inventory, orders, customers, discounts, campaigns and finance — in
one Next.js application.

Almost everything a merchandiser would want to change is **data**, editable at
`/admin` without a deploy. See §7 and §20.

---

## 2. Technology stack

Actual installed versions (`package.json`):

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | **16.3.4** |
| UI | React / React DOM | **19.2.4** |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS v4 + PostCSS | ^4 |
| Animation | Motion | ^13.0.0 |
| Icons | lucide-react | ^1.30.0 |
| Auth | `@clerk/nextjs` | ^7.7.4 |
| Database | Supabase Postgres via `@supabase/supabase-js` | **2.109.0** (pinned) |
| Payments | `stripe` + `@stripe/react-stripe-js` | ^22.5.0 / ^6.8.2 |
| Email | `resend` | ^6.20.0 |
| AI | `ai` (Vercel AI SDK) via AI Gateway | ^7.0.64 |
| Validation | `zod` | ^4.4.3 |
| Charts | `lightweight-charts` | ^5.2.1 |
| Hosting | Vercel | Node **24.x** |

**No Prisma. No Tiptap. No test framework.** AGENTS.md mentions the first two;
they were never adopted. The absence of the third is a known gap (§23).

`@supabase/supabase-js` is pinned exactly, deliberately — do not loosen it to a
caret without reading §22.

---

## 3. Repository structure

```
src/
├── app/
│   ├── [locale]/          Every user-facing route. `[locale]` is "en" | "ar".
│   │   ├── admin/         Dashboard (43 pages). Gated by requireAdmin().
│   │   ├── account/       Customer portal. Gated by getViewer().
│   │   ├── perfume/[slug] Fragrance PDP        ritual/[slug]  body & home PDP
│   │   ├── set/[slug]     Discovery/gift PDP   collections/   listings
│   │   ├── journal/       Editorial           heritage, craftsmanship, ingredients, about
│   │   ├── cart, checkout, search, contact, stockists, legal pages
│   │   ├── layout.tsx     Root layout: fonts, metadata, providers, JSON-LD
│   │   ├── loading.tsx    Site-wide Suspense boundary (see §24, soft 404)
│   │   └── not-found.tsx  404 UI
│   ├── api/               9 route handlers (§10, §13)
│   ├── prelaunch/         ⚠️ TEMPORARY Coming Soon cover — src/docs/prelaunch.md
│   ├── robots.ts          /robots.txt          sitemap.ts  /sitemap.xml
│   └── globals.css        Tailwind v4 theme + design tokens
├── actions/               Server Actions. 12 public + 21 under admin/.
├── services/              Data access. 22 public + 21 under admin/.
├── components/            195 components, by domain
├── lib/                   Infrastructure: supabase, auth, stripe, email, i18n,
│                          cart, currency, pricing, search, structured-data
├── schemas/               Zod schemas — the validation boundary
├── types/                 Shared TypeScript types
├── providers/             React context (cart, i18n, cart drawer)
└── docs/                  Design notes, audits, feature histories
supabase/
├── sql/                   64 numbered migrations — the schema's source of truth
├── seed/                  Catalogue/content/directory seed JSON
└── tests/                 SQL scenario tests (sales ledger, finance)
scripts/                   db:migrate, db:seed, db:verify, embed, …
prompts/                   Implementation prompts (the workflow in AGENTS.md §2)
```

`src/proxy.ts` — **not** `middleware.ts` — is the request interceptor.

---

## 4. Architecture

```
Browser
  │
  ├─► src/proxy.ts  (clerkMiddleware wrapper)
  │     · pre-launch cover gate      · locale rewrite  /x → /en/x
  │     · /account + /admin early redirect (a cost optimisation, NOT the gate)
  │     · currency cookie from x-vercel-ip-country
  │
  ├─► app/[locale]/**  Server Components — auth verified per route
  ├─► app/api/**       Route handlers — each protects itself
  │
  ├─► actions/  Server Actions ──► services/  ──► lib/supabase.ts
  │                                                 │
  │        getSupabasePublic()  publishable key ── RLS APPLIES  (all reads)
  │        getSupabaseAdmin()   secret key      ── RLS BYPASSED (7 modules only)
  │                                                 │
  └─────────────────────────────────────────────► Supabase Postgres
                                                   71 tables · 7 views · ~103 functions
```

**The most important architectural fact:** `src/proxy.ts` is *not* the security
boundary, and says so in its own header. Clerk v7 deprecates middleware-based
route matching because a matcher can drift from how Next actually routes. Every
protected resource verifies itself:

- `/account/*` → `getViewer()` in `account/layout.tsx` **and** in each panel.
- `/admin/*` → `requireAdmin()` in `admin/layout.tsx` **and** as the first
  statement of **every** admin Server Action.

A Server Action is a public HTTP endpoint. It does not inherit the protection of
the page that rendered its form. **Never rely on a layout to protect an action.**

### Where AGENTS.md is wrong

| AGENTS.md says | Reality |
|---|---|
| §9 Prisma schema, `npx prisma migrate` | No Prisma. Raw SQL in `supabase/sql/`, `npm run db:migrate` |
| §9 `Wishlist` / `WishlistItem` models | Never migrated; feature withdrawn. Do not rebuild from it |
| §10 `middleware.ts` with `createRouteMatcher` | `src/proxy.ts`; resource-based checks instead |
| §6 Tiptap | Not a dependency. Rich text is structured JSON |

---

## 5. Authentication

**Clerk** owns identity. Supabase holds a replica in `"User"`, kept current by a
webhook.

| Concern | Where |
|---|---|
| Session → user id | `src/lib/auth.ts` — `getUserId()`, `getViewer()` |
| Admin authorization | `src/lib/admin/auth.ts` — `getAdminActor()`, `requireAdmin()` |
| Request interception | `src/proxy.ts` |
| Clerk → Supabase sync | `src/app/api/webhooks/clerk/route.ts` |
| Sign-in / sign-up UI | `src/app/[locale]/sign-in`, `sign-up` |

### Admin access

Authority is a **verified primary email** on the Clerk user, compared against
the `ADMIN_EMAILS` allowlist. Not a role claim, not a database column, not a
cookie.

Adding an admin is a comma in `ADMIN_EMAILS`. An empty value means the default
(`khem.official@outlook.com`) — never "nobody", never "everybody".

`requireAdmin()` answers **404**, not a redirect, so `/admin` is
indistinguishable from a non-existent URL to anyone who should not see it.

Roles (e.g. an editor who may write journal entries but not prices) are not
implemented. `src/lib/auth.ts` documents the four steps to add them.

### Clerk webhook

Subscribe **exactly three** events: `user.created`, `user.updated`,
`user.deleted`. Signature is verified with `CLERK_WEBHOOK_SIGNING_SECRET`; a
missing secret returns 500 rather than trusting the request. `unsafeMetadata` is
user-writable and is treated as untrusted — one boolean and a locale, both
validated against an allowlist.

---

## 6. Database

**Supabase Postgres.** Schema lives in `supabase/sql/`, 64 numbered migrations
applied in **filename order** by `npm run db:migrate`.

### The security model, in three sentences

1. **Every one of the 71 tables has RLS enabled.**
2. **There is not a single INSERT, UPDATE or DELETE policy in the schema** —
   writes through the Data API are impossible by design. Every write goes
   through a Server Action or a `security definer` SQL function.
3. Private tables have **no policy and no grant** — two independent refusals.

`supabase/sql/0006_privileges.sql` revokes the write grants Supabase hands out
by default and narrows `alter default privileges` so later tables inherit
`SELECT` only. It runs **sixth of sixty-four**, not last; later tables are
covered by the default-privileges clauses, and a table needing narrower access
revokes in its own migration.

### Two clients, two authorities

| Function | Key | RLS | Used by |
|---|---|---|---|
| `getSupabasePublic()` | publishable | **applies** | every storefront read |
| `getSupabaseAdmin()` | secret | **bypassed** | 7 modules only — listed in `src/lib/supabase.ts` |

Reads go through the *weaker* key on purpose: it makes RLS load-bearing rather
than a second copy of the `where` clause. **Adding an eighth service-role caller
is a security decision.**

### Column-level privilege

`"Product"."costInCents"` — the house's unit cost — is withheld from `anon` by a
**column-level** grant (`0062_sales_ledger.sql:1643`). `select=*` on `Product`
is denied; the specific public columns succeed.

⚠ **This is the cause of F15** (§24). Four functions return `setof "Product"`
and run as invoker, so they cannot read the row. Read
`src/docs/SECURITY-AUDIT-STAGE-3.md` before changing anything here.

### Adding a migration — the safe path

```bash
# 1. Write it. Never edit an applied migration; always add a new one.
$EDITOR supabase/sql/0065_your_change.sql

# 2. Apply
npm run db:migrate
#    Must print: "PostgREST schema cache reload signalled"

# 3. Verify
npm run db:verify     # ⚠ writes probe rows — staging only, see §23
```

**The PostgREST cache is the trap.** `supabase-js` reads through PostgREST,
which serves a *cached* schema. A migration applied any other way (the Supabase
SQL editor, `psql`) leaves the cache stale — and the services here degrade
rather than throw, so the page renders a fallback and the feature just looks
broken. A green migration and a broken page are indistinguishable until you
reload the cache:

```sql
notify pgrst, 'reload schema';
```

### Updating RLS

Every new table needs, in the same migration:

```sql
alter table public."YourTable" enable row level security;

-- Public content: a SELECT policy, and SELECT only.
create policy "YourTable is readable" on public."YourTable"
  for select to anon, authenticated using (true);

-- Private: no policy at all, and revoke the inherited grant.
revoke all on public."YourTable" from public, anon, authenticated;
```

For a `security definer` function: pin `search_path`, and revoke `execute`.
Postgres grants EXECUTE to `PUBLIC` by default, and `anon` inherits it:

```sql
create or replace function public.your_fn(...)
returns ... language plpgsql security definer set search_path = public
as $$ ... $$;

revoke all on function public.your_fn(...) from public, anon, authenticated;
grant execute on function public.your_fn(...) to service_role;
```

---

## 7. Products & content — where to change what

Nearly all content is **database-controlled** and edited at `/admin`. No deploy.

| To change | Go to | Table |
|---|---|---|
| A product, its price, stock, images | `/admin/products` | `Product`, `ProductImage` |
| Collections / categories | `/admin/collections`, `/admin/categories` | `Collection`, `Category` |
| Home page sections | `/admin/content/landing` | `LandingSection` |
| Hero slides | `/admin/content` | `HeroSetting`, `HeroSlide` |
| Announcement bar | `/admin/announcements` | `Announcement`, `MarketingSetting` |
| Navigation menu | `/admin/navigation` | `NavLink` |
| Heritage / craftsmanship / ingredients / about | `/admin/content/*` | `TimelineEvent`, `CraftPillar`, `CraftStep`, `Ingredient`, … |
| Journal articles | `/admin/journal` | `Article` |
| Stockists | `/admin/stockists` | `Stockist` |
| Legal pages | `/admin/content` | `LegalDocument` |
| Delivery fee, free-shipping threshold | `/admin/settings` | `DeliverySetting` |
| Contact details, social links | `/admin/settings` | `BoutiqueSetting`, `ContactChannel`, `SocialProfile` |

**Prices are never hardcoded.** `Product.priceInCents` is EGP **piastres**
(56000 = EGP 560.00). The six display currencies in `src/lib/currency.ts` are a
presentation transform and must never become a pricing input.

⚠ **A new public page that quotes stored data must be added to
`src/lib/admin/revalidate.ts`.** The `revalidate` windows in the route table are
backstops, not the freshness mechanism — freshness comes from re-rendering
affected paths on the write. A page only in the route table can be a day stale.

---

## 8. Navigation, UI & design tokens

| Thing | Where |
|---|---|
| Design tokens (colour, type, spacing, easing) | `src/app/globals.css` (`@theme`) |
| Nav / Footer / mobile nav | `src/components/layout/` |
| Menu contents | **database** — `NavLink`, `/admin/navigation` |
| Shared UI | `src/components/ui/` |
| Animation wrappers | `src/components/animation/` |
| Translations | `src/lib/i18n/dictionaries/{en,ar}.ts` |
| Fonts | `src/lib/fonts.ts` |

The design language is in AGENTS.md §2–3 and `src/docs/khem-ui-design-system.md`:
obsidian and ivory grounds, pale gold, Cinzel display, **no spring, no bounce**.

Arabic is RTL: `dir` is set on `<html>`, and `src/lib/i18n/rtl.ts` holds
direction-aware helpers. Test both trees.

---

## 9. Cart & checkout

```
Cart (localStorage, {productId, quantity} only)
  └─► placeCustomerOrder()            src/actions/checkout.ts
        1 honeypot  2 rate limit  3 Zod  4 card-rail check
        5 resolveCartToLines()   ids → slugs + SERVER prices
        6 delivery re-read from "DeliverySetting"
        7 sweepStaleHolds()      free abandoned reservations
        8 identity from getUserId()   ← never from the request body
        9 place_order()          one transaction: order + stock, under row locks
  ├─ CASH → PROCESSING/UNPAID, both emails sent now
  └─ CARD → PROCESSING/UNPAID, stock reserved, NO customer email yet
        └─► POST /api/checkout/intent  { orderId } → { clientSecret }
              amount read from the order row, never from the request
        └─► Stripe → webhook → settle_order_payment() → PAID → emails
```

**The browser sends only `{ productId, quantity }`.** Every figure — line
prices, subtotal, delivery, discounts, credits, points, total — is derived
server-side, most of it inside `place_order()` under row locks.

An unpaid card order holds its stock for **30 minutes**, then
`expire_unpaid_orders()` cancels and restocks it. That sweep runs opportunistically
before every checkout *and* on a daily cron — daily alone is far too slow, and
the Hobby plan allows only one cron run per day.

---

## 10. Orders

| Stage | Where |
|---|---|
| Creation | `place_order()` — `supabase/sql/0016_checkout.sql` |
| Payment intent | `src/app/api/checkout/intent/route.ts` |
| Settlement | `src/app/api/webhooks/stripe/route.ts` → `settle_order_payment()` |
| Status changes | `set_order_status()` — restocks on CANCELLED/REFUNDED |
| Customer view | `/account/orders` |
| Admin view | `/admin/orders` |
| Emails | `src/lib/email/send-order-mail.ts` |

**A browser can never mark an order paid.** Only the signature-verified Stripe
webhook can, and it verifies the intent's **amount and currency** against the
order row before settling. A success redirect is presentation only.

Idempotency is two-layered: `record_stripe_event()` (per event) and
`settle_order_payment()` returning true exactly once (per order).

---

## 11. Discounts, promotions, credits & points

| Mechanism | Table | Admin |
|---|---|---|
| Discount codes | `discounts` (+ `discount_products`, `discount_collections`) | `/admin/discounts` |
| Redemption ledger | `discount_redemptions`, `discount_grants` | — |
| Promotions (price overrides) | `promotions` + join tables | `/admin/promotions` |
| Offers (cart-level) | `offers` + trigger/reward joins | `/admin/offers` |
| Discovery credits | `customer_credits`, `credit_transactions` | `/admin/credits` |
| Points / rewards | `points_transactions`, `reward_balances` | `/admin/rewards` |
| Welcome benefit | `BenefitSetting` | `/admin/rewards` |

**Every monetary rule is enforced in SQL, under a lock** — not in TypeScript.
`resolve_discount()` takes `for update` on the discount row *before* counting
redemptions; points use `pg_advisory_xact_lock` per customer; credits use
`for update` on `customer_credits`.

`src/actions/checkout.ts` deliberately forwards `creditId`, `discountCode` and
`pointsToRedeem` **unexamined** — validating in the action would be a check that
can go stale between that line and the write. Do not "improve" this by adding
pre-checks.

---

## 12. Emails

**Resend.** Key is server-only. Nothing is sent when `RESEND_API_KEY` is absent
— each send logs a warning and returns, so an order still saves.

| Email | Trigger | Template | Recipient |
|---|---|---|---|
| Order confirmation | CASH at checkout; CARD on `payment_intent.succeeded` | `order-templates.ts:347` `customerOrderEmail` | `order.customerEmail` |
| House order notification | same | `order-templates.ts:478` `newOrderNotificationEmail` | `ORDER_NOTIFICATION_EMAIL` |
| Refund notice | `charge.refunded` | `order-templates.ts` | `order.customerEmail` |
| Feedback request | `/api/cron/order-feedback` | `order-templates.ts:648` `customerFeedbackEmail` | `order.customerEmail` |
| Account welcome | Clerk `user.created` | `welcome-templates.ts:107` `accountWelcomeEmail` | new user |
| Admin invitation | `/admin` invitation | `welcome-templates.ts:215` `invitationEmail` | invitee |
| Contact enquiry | contact form | `templates.ts:136` `enquiryEmail` | `CONTACT_INBOX_EMAIL` |
| Enquiry acknowledgement | contact form | `templates.ts:183` | enquirer |
| Newsletter welcome | newsletter signup | `templates.ts:244` | subscriber |
| Campaign | `/api/cron/send-campaigns` or admin send | `campaign-template.ts:110` | campaign audience |

**Senders** are resolved in `src/lib/email/addresses.ts`, never hardcoded at
call sites: `fromAddress()` (no-reply), `houseFromAddress()` (replyable),
`orderFromAddress()`, `inboxAddress()`, `orderInboxAddress()`.

**Recipients are never caller-chosen.** Order mail goes to the address on the
order row. Campaign sending is admin-only plus `CRON_SECRET`.

**All interpolated values are escaped** — `escapeHtml()` and
`stripHeaderBreaks()` in `src/lib/email/escape.ts`. Keep it that way.

### To change a template

Edit the builder in `src/lib/email/*-templates.ts`. Shared chrome (header,
footer, logo) is `layout.ts`. The logo travels as an inline attachment
(`logo.ts`) so it renders before remote images are allowed — which is why
`next.config.ts` has an `outputFileTracingIncludes` entry for it.

### To add an email

1. Add a builder returning `EmailPayload` in the appropriate `*-templates.ts`.
2. Add a send function in a `send-*.ts` that resolves its sender from
   `addresses.ts` and its recipient from **stored data**.
3. Escape every interpolated value.
4. If it is marketing, honour `email_suppressions` and include the unsubscribe
   link.

### Unsubscribe

Each `NewsletterSubscriber` row carries a 64-hex-character
`unsubscribeToken` (two `gen_random_uuid()`s). `/unsubscribe?token=` **confirms**
before writing — a GET must not unsubscribe, because link scanners and
prefetchers fetch every URL in an email. The write is
`src/actions/unsubscribe.ts`.

---

## 13. Campaigns

`campaigns` → `campaign_recipients` → `campaign_sends`, dispatched in chunks by
`/api/cron/send-campaigns` under a lease
(`0057_campaign_dispatch_lease.sql`) so two runs cannot overlap.

Audiences: newsletter subscribers, customers, or a specific list. Managed at
`/admin/campaigns`. Test sends: `sendCampaignTest()`.

⚠ **The cron holds a copy of `CRON_SECRET`. Rotating it silently stops scheduled
campaigns** — see the header of `src/app/api/cron/send-campaigns/route.ts`.

---

## 14. Media

- **Cloudinary** — delivery only. There is **no upload code path**; assets are
  uploaded in the Cloudinary dashboard and their URLs stored on rows. The
  `res.cloudinary.com` pattern is allowlisted in `next.config.ts`.
- **Supabase Storage** — the `comment-images` bucket holds visitor photographs.
  This is the only upload path. Validation (`src/lib/comment-images.ts`) sniffs
  **magic bytes**, not the declared MIME type: 3 images max, 5 MB each, JPEG/PNG/WEBP
  only, extension derived from the sniffed type. A renamed `.pdf` is rejected.

`next/image` is configured for AVIF/WebP, a 31-day cache, restricted
`deviceSizes`/`imageSizes`, and `qualities: [75]` — all cost controls. Replacing
an image requires a **new URL**; nothing overwrites in place.

---

## 15. Admin

Entry point `/admin` — 43 pages. Protected by `requireAdmin()` in
`admin/layout.tsx` **and** at the top of every action in `src/actions/admin/`
(21 modules). A hidden button is not authorization.

Sections: products, collections, categories, inventory, orders, customers,
discounts, promotions, offers, credits, rewards, campaigns, announcements,
navigation, content (landing, world, ingredients, legal), journal, stockists,
analytics, finance, settings.

---

## 16. Environment variables

Copy `.env.example` → `.env.local`. **Never commit `.env.local`.** Real values
belong in the Vercel project settings.

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | public | Clerk client |
| `CLERK_SECRET_KEY` | yes | **server** | Clerk backend |
| `CLERK_WEBHOOK_SIGNING_SECRET` | yes | **server** | Verifies the Clerk webhook |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | public | Anon key — RLS applies |
| `SUPABASE_SECRET_KEY` | yes | **server** | **Bypasses RLS.** Never `NEXT_PUBLIC_` |
| `SUPABASE_DB_URL` | tooling | **server** | Direct Postgres for `db:*` scripts |
| `ADMIN_EMAILS` | no | **server** | Admin allowlist. Default: the house account |
| `STRIPE_SECRET_KEY` | for cards | **server** | Stripe API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for cards | public | Stripe Elements |
| `STRIPE_WEBHOOK_SECRET` | for cards | **server** | Verifies the Stripe webhook |
| `STRIPE_PAYMENT_ENABLED` | for cards | **server** | Kill switch — `true`/`1` only |
| `RESEND_API_KEY` | for email | **server** | Resend |
| `RESEND_FROM_EMAIL` | no | server | No-reply sender |
| `RESEND_HOUSE_FROM_EMAIL` | no | server | Replyable sender |
| `RESEND_ORDER_FROM_EMAIL` | no | server | Order-notification sender |
| `CONTACT_INBOX_EMAIL` | no | server | Where enquiries land |
| `ORDER_NOTIFICATION_EMAIL` | no | server | Where order slips land |
| `EMAIL_ASSET_BASE_URL` | no | server | Absolute base for email images |
| `AI_GATEWAY_API_KEY` | no | **server** | Search embeddings. Prefer OIDC on Vercel |
| `CRON_SECRET` | yes | **server** | Bearer token for all 4 cron routes |
| `KHEM_PRELAUNCH` | no | **server** | ⚠️ Coming Soon cover. `true` = on |
| `KHEM_PRELAUNCH_VIDEO_URL` | no | server | Optional cover film |

**Never put a secret behind `NEXT_PUBLIC_`** — that prefix compiles the value
into the JavaScript every visitor downloads.

`KHEM_PRELAUNCH` is server-only on purpose. A doc once suggested
`NEXT_PUBLIC_KHEM_PRELAUNCH`; that is wrong — see `src/lib/prelaunch.ts:11`.

---

## 17. Local development

```bash
nvm use                 # Node 24.x, per .nvmrc
npm install
cp .env.example .env.local && $EDITOR .env.local

npm run db:migrate      # apply supabase/sql/*.sql
npm run db:seed         # optional: seed the catalogue
npm run embed           # optional: build search embeddings

npm run dev             # http://localhost:3000
```

Available scripts:

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck (**there is no `typecheck` script**) |
| `npm run db:migrate` | Apply migrations + reload the PostgREST cache |
| `npm run db:seed` | Seed from `supabase/seed/` |
| `npm run db:dump` | Dump schema |
| `npm run db:verify` | Assert RLS/grants — ⚠ **writes probe rows** |
| `npm run db:test:sales` / `db:test:finance` | SQL scenario tests |
| `npm run embed` | Build catalogue embeddings |
| `npm run email:logo` | Rebuild the inline email logo |

---

## 18. Production deployment

**Vercel**, Node 24.x, domain `khemperfumes.com`.

1. Set every variable from §16 in the Vercel project. Env vars are bound at
   **build** time — a change takes effect on the next deploy, not immediately.
2. Point the domain at the project; confirm HTTPS and HSTS at the platform.
3. **Clerk** — production instance; set the webhook to
   `https://khemperfumes.com/api/webhooks/clerk` with exactly `user.created`,
   `user.updated`, `user.deleted`; copy the signing secret.
4. **Supabase** — run `npm run db:migrate` against production. Confirm the
   PostgREST cache reload.
5. **Stripe** — live keys, webhook to
   `https://khemperfumes.com/api/webhooks/stripe`, subscribed to
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `payment_intent.canceled`, `payment_intent.processing`, `charge.refunded`.
   Copy the signing secret. Then set `STRIPE_PAYMENT_ENABLED=true` — keys alone
   do **not** enable cards. Full procedure: `STRIPE-SETUP.md`.
6. **Resend** — verify `khemperfumes.com`; set the sender addresses.
7. **Cron** — `CRON_SECRET` on the project; Vercel sends it automatically. Note
   `vercel.json` uses daily schedules because Hobby allows one run per day. On
   Pro, tighten `sweep-unpaid-orders` to `*/15 * * * *`.
8. Turn `KHEM_PRELAUNCH=false` to open the storefront.

---

## 19. SEO

| Thing | Where | Notes |
|---|---|---|
| Sitemap | `src/app/sitemap.ts` → `/sitemap.xml` | Database-driven, both locales, full `hreflang`. Publishing a product adds its URL automatically |
| Robots | `src/app/robots.ts` → `/robots.txt` | Blocks `/api`, `/account`, `/admin`, `/cart`, auth, `/prelaunch` — in **both** locale trees |
| Canonical origin | `src/lib/i18n/metadata.ts` `SITE_URL` | Never a `*.vercel.app` URL |
| Page metadata | `localeMetadata()` in the same file | Always use it — a partial `openGraph` block silently drops `og:locale` |
| Canonicals & hreflang | `localeAlternates()`, `src/lib/i18n/config.ts` | Each locale canonical for its own URL |
| Structured data | `src/lib/structured-data.ts` | Organization + WebSite sitewide; Product + Offer + Breadcrumb on all three PDP routes |
| JSON-LD serialisation | `src/lib/json-ld.ts` | **Mandatory** — see §22 |

**Never emit JSON-LD with bare `JSON.stringify`.** It does not escape `<`, so
stored text containing `</script>` breaks out of the tag. Always use
`jsonLdHtml()`.

**Do not invent structured data.** No fake ratings or reviews, no invented social
profiles (`sameAs` reads the `SocialProfile` table), no price that differs from
the page. Prices in markup are the stored EGP figure, never a display conversion.

### Before changing a public route

Title · description · canonical · sitemap behaviour · robots · structured data ·
internal links · mobile · production URL. And add it to
`src/lib/admin/revalidate.ts` if it quotes stored data.

---

## 20. Content change guide

- **Merchandising / editorial** → `/admin`. Database. No deploy. §7.
- **Layout, components, styling** → `src/components/`, `src/app/globals.css`. Deploy.
- **Copy that is not in the database** → `src/lib/i18n/dictionaries/{en,ar}.ts`.
  Both files, or the Arabic tree falls back to English.
- **Business rules** → `src/actions/`, `src/services/`, or SQL. Deploy/migrate.
- **Secrets and endpoints** → Vercel env. Redeploy.

---

## 21. Testing

**There is no automated test framework.** No Vitest, no Playwright, no `tests/`.
This is the largest known gap in the repository.

What exists:

```bash
npx tsc --noEmit        # types
npm run lint            # lint
npm run build           # build + prerender (watch the log for failures)
npm run db:test:sales   # SQL scenarios — staging only
npm run db:test:finance # SQL scenarios — staging only
```

⚠ **Read the build log, do not just check the exit code.** The build exits 0
while printing 60 `getRelatedProductCards failed` lines — that is F15 (§24), a
broken production feature that a green build concealed for months.

### Manual tests before a release

Storefront: home · collection · PDP · add to cart · cart drawer · discount code ·
checkout (cash **and** card) · order confirmation · account orders.
Admin: sign in as admin · edit a product · verify the storefront updated ·
create a discount · send a test campaign.
Both locales, and a real mobile device.

---

## 22. Security rules — the non-negotiables

1. **Never expose `SUPABASE_SECRET_KEY`.** It bypasses RLS. Never
   `NEXT_PUBLIC_`, never imported from a Client Component. `src/lib/supabase.ts`
   imports `server-only` as the compile-time guard.
2. **Never trust a client-supplied price, total, or discount.** The browser
   sends `{ productId, quantity }`. Everything else is derived server-side.
3. **Never trust a client-supplied user or customer id.** Identity comes from
   `getUserId()` / `getViewer()` / `currentUser()`. Always.
4. **Never mark an order paid from a redirect.** Only the signature-verified
   Stripe webhook may settle a payment.
5. **Always verify webhook signatures**, and read the **raw body** — a
   re-serialised body has a different signature. A missing secret is a 500,
   never a bypass.
6. **Never make an admin check client-only.** `requireAdmin()` at the top of
   every admin action — a layout guard protects pages, not actions.
7. **Never add an INSERT/UPDATE/DELETE policy** without understanding
   `0006_privileges.sql`. The schema has none today, and that is a feature.
8. **Pin `search_path` and revoke `execute`** on every `security definer`
   function. Postgres grants EXECUTE to `PUBLIC` by default.
9. **Views bypass RLS** unless created `with (security_invoker = on)`.
10. **Validate uploads by content, not by filename or declared MIME.**
11. **Escape everything interpolated into HTML or email.** Use
    `jsonLdHtml()` for JSON-LD and `escapeHtml()` for mail.
12. **Never log a secret or PII.** Log the variable *name*, an order number, an
    error message — never an address, phone, email or token.

---

## 23. Troubleshooting

| Symptom | Likely cause |
|---|---|
| A feature renders empty after a migration | **Stale PostgREST cache.** `notify pgrst, 'reload schema';` (§6) |
| Search results look poor; related products empty | **F15** (§24) — the RPCs are 401ing |
| Storefront shows stale content after an admin edit | Path missing from `src/lib/admin/revalidate.ts` |
| Card payment option missing | `STRIPE_PAYMENT_ENABLED` is not `true`, or keys absent |
| Card orders stuck PENDING/UNPAID | `STRIPE_WEBHOOK_SECRET` wrong, or the endpoint is not subscribed |
| No emails | `RESEND_API_KEY` absent (sends log a warning and return), or domain unverified |
| Scheduled campaigns stopped | `CRON_SECRET` was rotated (§13) |
| `/admin` returns 404 for the right person | Email not **verified** in Clerk, or not in `ADMIN_EMAILS` |
| Whole site shows Coming Soon | `KHEM_PRELAUNCH=true` |
| Unknown URL returns 200 instead of 404 | Known — F13 (§24) |
| Deploy failed with `timed out after 60000ms` / `fetch failed` | Known — F17 (§24). Retry; it is not your commit |
| `permission denied for table X` | Missing grant, or a `setof "Product"` invoker function (§6) |

Logs: Vercel runtime logs. Supabase: the SQL editor and Postgres logs.

---

## 24. Known issues

Full detail in `src/docs/SECURITY-AUDIT-STAGE-3.md`.

### F15 — search and related products are broken (**HIGH**)

`related_products()` and `hybrid_search_products()` both answer **401
permission denied** for `anon`, and have since `0062_sales_ledger.sql` added the
`costInCents` column grant. Both return `setof "Product"` and run as invoker, so
they must read a column `anon` no longer holds.

Consequences: the "you may also like" rail is **empty on every product page**,
and search runs permanently on its in-memory fallback — pgvector and the AI
Gateway contribute nothing.

**FIXED — `supabase/sql/0065_restore_catalog_rpcs.sql`, applied 2026-09-07.**
The fix keeps `setof "Product"` so PostgREST embedding still works, takes
`security definer` so the function can read the row, and strips `costInCents`
from the output by name so the margin is never exposed. Verified live: both RPCs
answer 200 for `anon`, `costInCents` comes back `null`, and the build prints 0
failures (was 60).

**Follow-up, unrelated to F15:** no product or article carries an `embedding`
(0 of 31, 0 of 6), so the semantic half of hybrid search is inert and
`/api/search` reports `mode: "lexical"`. Run `npm run embed` to populate them.

### F13 — soft 404 (**MEDIUM**, indexing harm mitigated)

Unknown URLs return `200 OK` with the 404 page inside. Cause: the Suspense
boundary from `src/app/[locale]/loading.tsx` commits the status before
`notFound()` resolves — proven by removing it and rebuilding. `not-found.tsx`
now sends `noindex`, so the SEO harm is contained; the status code is unchanged
because the cure removes the sitewide loading screen, which is a design
decision.

### F17 — the build is not reliably reproducible (**MEDIUM**)

One build in five failed during the audit on unchanged code; the immediate
re-run passed. Cause is the Supabase REST stall documented in
`src/lib/supabase.ts:56` (roughly one request in five hangs indefinitely),
combined with `timeoutFetch()` deliberately removing its deadline during the
build phase. Next retries a hung page 3 × 60s, and when several prerendered
pages stall together the budget runs out and the export aborts.

If a deploy fails with `getLiveAnnouncements timed out` or
`TypeError: fetch failed`, **retry it** — it is not your commit. The fix is to
give the build phase a finite bound rather than none.

### Others

- **No test framework** (§21).
- **Rate limiting is per-instance memory** — `src/lib/email/rate-limit.ts`.
  Adequate for launch; use a shared store when traffic grows.
- **CSP is enforcing** as of 2026-09-07, after a browser-measured sweep of 14
  routes and a full Stripe.js load found zero violations. The one path that
  could not be exercised locally is mounting a real Payment Element and a 3-D
  Secure challenge (no publishable key on that machine) — smoke-test it on the
  first preview with live Stripe keys. Reverting is one word: rename the header
  key back to `Content-Security-Policy-Report-Only` in `next.config.ts`.
- **Unsplash placeholder images** remain on part of the catalogue.
- **AGENTS.md §9/§10** describe an architecture that does not exist (§4).

---

## 25. Checklist before you merge

- [ ] Authentication checked — identity from the session, never an argument
- [ ] Authorization checked — `requireAdmin()` on **every** new admin action
- [ ] RLS checked — new tables have RLS on, and a policy *or* a revoke
- [ ] `security definer` functions pin `search_path` and revoke `execute`
- [ ] Input validated with Zod at the boundary
- [ ] No secret added behind `NEXT_PUBLIC_`
- [ ] Payment logic unchanged, or re-read §22
- [ ] Migration added as a **new** numbered file; cache reload confirmed
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass
- [ ] **Build log read**, not just its exit code
- [ ] New public route added to `src/lib/admin/revalidate.ts`
- [ ] Metadata, canonical, sitemap and structured data considered
- [ ] Both locales checked, including RTL
- [ ] Mobile checked
