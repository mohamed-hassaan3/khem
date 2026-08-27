# Admin — Customers, Newsletter, Stockists, Settings, Content, Order Search

## Goal

Close the gap between the dashboard that exists and the one `supabase/AGENTS.md`
describes, for everything that does **not** touch money. Six phases, applied in
order, each independently reviewable and each leaving the site working:

1. **Customers foundation** — the `User` and `Address` tables the codebase has
   been written *around* but never got, synced from Clerk by webhook, plus
   `/admin/customers` and `/admin/customers/[id]`.
2. **Newsletter** — real subscriber persistence with consent timestamps and a
   working unsubscribe, replacing today's send-and-forget, plus `/admin/newsletter`.
3. **Stockists** — `/admin/stockists`, CRUD over the `"Stockist"` table that
   already drives the public store locator.
4. **Settings** — `/admin/settings` over `"BoutiqueSetting"`, `"ContactChannel"`
   and `"SocialProfile"`. No secrets, ever.
5. **Content** — `/admin/content`, editors over the existing typed content tables.
6. **Order search and pagination** — the order book's missing half.

## Explicitly deferred (decided with the user, not overlooked)

- **Discovery credits.** `supabase/AGENTS.md` §10 specifies a ledger, but
  "discovery" in this codebase is a *product category* (`DiscoverySetCard`,
  `DiscoveryComparison`, the Discovery Set in the catalog) and no credit concept
  exists anywhere. The credit value, what earns it, what redeems it, and its
  expiry are business policy that must not be invented. Build it when the rules
  arrive; do not stub it.
- **Discounts / the first-subscription 10% offer.** §11–12. These change how an
  order total is computed and would touch `actions/checkout.ts`, `place_order()`
  and the Stripe webhook — the highest-risk surface in the app. Deferred as a
  batch of its own. **Phase 2 must therefore not issue a discount code**; it
  records the subscriber and the consent, which is what the offer will later
  hang on.

## Conflicts with `supabase/AGENTS.md` worth stating

- **§15 asks for generic reusable section types.** The site instead runs on
  twelve purpose-built, typed content tables (`TimelineEvent`, `CraftPillar`,
  `CraftStep`, `CraftStat`, `CraftQuote`, `BrandValue`, `MissionStatement`,
  `Testimonial`, `Ingredient`, `IngredientFamily`, `IngredientUsage`,
  `Article`) that feed live customer pages and are validated by Zod on read.
  Migrating them into a generic `content_section` table would rewrite working
  pages and flatten shapes that Zod currently checks. **Decision: build editors
  over the existing tables.** §15's intent — "an editor can change this without
  a deploy" — is met; its suggested mechanism is not, deliberately.
- **§6 says customer detail shows a Wishlist.** The root `AGENTS.md` §9 records
  that the wishlist was withdrawn from the product entirely and must not be
  rebuilt. The customer detail screen therefore has no wishlist panel.
- **§5 lists a `confirmed` order status.** The Postgres enum has six members and
  no `CONFIRMED`. Adding one is an orders-lifecycle change with email and
  transition-table consequences; out of scope here, and the six existing
  statuses stay.
- **§3 names a `/admin` route tree**; this app's admin lives under
  `src/app/[locale]/admin/` because `src/proxy.ts` rewrites unprefixed requests
  into `app/[locale]/`. A top-level `app/admin/` would never be reached.

## Skills read

- `.agents/skills/supabase` — table/RLS/privilege conventions, `security
  definer` functions, the explicit `revoke` every post-`0006` table needs.
- `.agents/skills/clerk` — `verifyWebhook` from `@clerk/nextjs/webhooks`
  (confirmed present in the installed 7.7.4; it bundles Svix, so **no new
  dependency**), `currentUser()`, `unsafeMetadata` trust rules.
- `ai-sdk` does not apply.

## Existing code inspected

- `src/services/account.ts` — `getOrdersForUser`, `getAccountSummary`, and
  `getAddressesForUser`, which is a **stub returning `[]`** with the exact
  intended query written in its doc comment. The closing block of that file
  specifies the `User` table, the `marketingOptIn` webhook sync, and the rule
  that consent needs a timestamp. Phase 1 and Phase 2 are that plan, executed.
- `src/types/account.ts` — `SavedAddress` (`id, label, recipient, line1, line2,
  city, state, postalCode, country, isDefault`). The `Address` table must match
  these names so the service body is the only thing that changes.
- `supabase/sql/0006_privileges.sql` — revokes the public write grants and
  narrows the default privileges. Tables created *after* it still carry their
  own explicit `revoke` (see 0015, 0017), so every new table below does too.
- `supabase/sql/0015_orders.sql` — `"Order"."clerkUserId"`, nullable, no FK.
- `supabase/sql/0003_directory.sql` — `"Stockist"` (with `region`, `type`,
  `status` enums, `isPublished`, `sortOrder`), `"BoutiqueSetting"` (singleton,
  `id = 'default'`, three house emails + `featuredProductSlug`),
  `"ContactChannel"`, `"SocialProfile"`, `"EnquirySubject"`, `"LegalDocument"`.
- `supabase/sql/0002_content.sql` — the twelve content tables above.
- `src/app/api/webhooks/stripe/route.ts` — the webhook pattern Phase 1 copies:
  `runtime = "nodejs"`, `force-dynamic`, signature verification as the
  authentication, a missing secret is a 500 and never a bypass, idempotent
  handling, and 200 on any *handled* event so the provider stops retrying.
- `src/actions/newsletter.ts` — sends two emails and stores nothing; the header
  comment says so explicitly and says real list management is a consent question.
- `src/services/admin/orders.ts`, `catalog.ts`, `journal.ts` — the read layer's
  house style: `getSupabaseAdmin()`, explicit column lists, `parseList`, log the
  provider message and return an empty projection rather than throwing.
- `src/actions/admin/catalog.ts`, `shared.ts` — `requireAdmin()` first,
  Zod-parsed input, `postgresFailure(error, entity)`, `AdminActionResult`
  (`{ ok: true; slug; message } | { ok: false; message; fieldErrors? }`),
  `AdminEntity` union (**must be extended** for the new row kinds).
- `src/components/admin/*` — `AdminTable`/`AdminRow`/`AdminCell`/`AdminEmpty`/
  `AdminPageHeader`/`AdminLinkButton`, `FilterChips` (link-based, carries other
  params, optional `count`), `AdminSearch`, `StatusToggle`, `fields.tsx`,
  `ProductForm`/`CollectionForm`/`ArticleForm` as the form template.
- `src/components/admin/AdminShell.tsx` — the seven-item nav that must grow.
- `src/proxy.ts` — excludes `api` from its matcher, so a new webhook route is
  reachable unauthenticated without a middleware change.

## Decisions and assumptions

1. **`User` is keyed by `clerkId`, and Clerk stays the identity authority.**
   Supabase stores application facts about a customer; it never stores a
   password, a session, or anything that could be used to authenticate. The
   webhook is a *replica*, not a source.
2. **No foreign key from `"Order"."clerkUserId"` to `"User"."clerkId"`.** An
   order must be recordable for a walk-in with no account, and a checkout must
   not fail because a `user.created` webhook is thirty seconds late. The link
   stays soft and the join happens in the service. Stated in the migration.
3. **Customer aggregates are computed in SQL.** `/admin/customers` shows order
   count and lifetime spend per customer; doing that in TypeScript means
   fetching every order in the boutique to render fifty rows — the exact N+1
   `supabase/AGENTS.md` §23 forbids. A `customer_summary()` function returns the
   page already aggregated.
4. **A customer who has never signed in still appears.** Orders carry a name and
   email without a `clerkUserId`. The customer list is therefore driven by the
   union of `"User"` and the distinct customers on `"Order"`, not by `"User"`
   alone — otherwise the walk-in trade, which is most of the order book, would
   be invisible on a screen called Customers.
5. **`marketingOptIn` is read from Clerk `unsafeMetadata` as untrusted input.**
   It is coerced to a boolean and nothing else is read out of that object. It
   can never influence a role, a price, or admin access. Consent is stored with
   `marketingOptInAt`, because a bare boolean cannot answer "when did they
   agree?" — the only question that matters if it is ever challenged.
6. **Unsubscribe works without a login, via an HMAC token**, not a guessable id.
   A subscriber id in a URL is an enumeration hole that lets anyone unsubscribe
   anyone. The token is `HMAC-SHA256(secret, subscriberId)`, compared with a
   timing-safe equality. Unsubscribing **writes `false` and a new timestamp**;
   it never deletes the row, because a deleted row cannot prove consent was
   withdrawn.
7. **Newsletter double-subscription is idempotent.** Re-subscribing an existing
   address updates the consent timestamp and re-activates it; it never creates a
   second row and never re-sends the welcome to someone already subscribed.
8. **The settings screen never renders a secret.** It edits the house email
   addresses, the featured product, contact channels and social profiles. API
   keys, signing secrets and connection strings stay in environment variables and
   are not readable from any admin screen.
9. **Content editors change no schema.** Phase 5 is UI and actions over tables
   that already exist and already have Zod row schemas.
10. **Order search is server-side.** `ilike` against order number, customer name
    and email, with pagination by range request — never fetching the table and
    filtering in memory.
11. **Every new table gets RLS on, no policy, and an explicit revoke**, matching
    `"Order"`: these rows carry customer PII and identity is Clerk's, so
    `auth.uid()` is null and no policy could express "this row is mine". The
    publishable key must not reach them. `scripts/db-verify.ts` already asserts
    the public roles hold no write grant, so a regression is caught.

## Phase 1 — Customers foundation

**`supabase/sql/0024_customers.sql`**

- `public."User"`: `id` text pk, `clerkId` text unique not null, `email` text not
  null, `firstName`, `lastName`, `phone` nullable, `marketingOptIn` boolean not
  null default false, `marketingOptInAt` timestamptz, `createdAt`, `updatedAt`,
  `deletedAt` timestamptz (soft delete — a `user.deleted` event must not cascade
  a customer's order history out of existence).
  Indexes on `clerkId` and lower(`email`). No `role` column: authority is the
  `ADMIN_EMAILS` allowlist in `src/lib/admin/auth.ts`, and a second source of
  truth for who is an admin is a way to disagree with it.
- `public."Address"`: matches `SavedAddress` exactly — `id`, `userId` →
  `"User"(id) on delete cascade`, `label`, `recipient`, `line1`, `line2`,
  `city`, `state`, `postalCode`, `country`, `isDefault` boolean default false,
  timestamps. Partial unique index so one user has at most one default:
  `create unique index … on "Address" ("userId") where "isDefault"`.
- `sync_clerk_user(payload jsonb) returns text` — `security definer`, upserts on
  `clerkId`, sets `marketingOptInAt` **only when the flag actually changes**, so
  a profile edit does not silently restamp a consent date.
- `soft_delete_clerk_user(clerk_id text)` — sets `deletedAt`, clears nothing else.
- `customer_summary(search text, limit_count int, offset_count int)` — one row
  per customer over the union described in decision 4: identity fields, order
  count, lifetime spend (excluding `CANCELLED`/`REFUNDED`, matching
  `getAccountSummary`), last order date, and whether they have an account.
- RLS on, no policy, `revoke all … from public, anon, authenticated` on both
  tables and all three functions.

**`src/app/api/webhooks/clerk/route.ts`** — `runtime = "nodejs"`,
`force-dynamic`. `verifyWebhook(req)` from `@clerk/nextjs/webhooks`; a missing
`CLERK_WEBHOOK_SIGNING_SECRET` is a 500, never a bypass. Handles
`user.created`, `user.updated` (both → `sync_clerk_user`) and `user.deleted`
(→ `soft_delete_clerk_user`); any other event answers 200 and does nothing.
Logs the Clerk id and the event type only — never the email, name or phone.
Add `CLERK_WEBHOOK_SIGNING_SECRET` to `.env.example` with a comment on where to
get it and which events to subscribe to.

**`src/services/account.ts`** — give `getAddressesForUser` the real body its own
doc comment specifies, and delete the "NEXT STEP" block that this phase closes.

**`src/services/admin/customers.ts`** — `listAdminCustomers({ search, page })`
over `customer_summary()`, and `getAdminCustomer(id)` returning profile,
addresses, orders and newsletter status in one projection.

**Screens** — `/admin/customers` (search, paginated table: name, email, phone,
account or guest, orders, lifetime spend, joined) and `/admin/customers/[id]`
(profile, addresses, order history linking into the order book, marketing
consent with its timestamp). Both `force-dynamic`. Add **Customers** to
`AdminShell`.

## Phase 2 — Newsletter

**`supabase/sql/0025_newsletter.sql`** — `public."NewsletterSubscriber"`:
`id`, `email` citext-or-lowercased text **unique**, `status` enum
(`SUBSCRIBED` / `UNSUBSCRIBED`), `locale`, `source` (`HOME_FORM` / `SIGN_UP` /
`ADMIN`), `clerkUserId` nullable soft link, `consentAt`, `unsubscribedAt`,
`createdAt`, `updatedAt`. `subscribe_newsletter(payload jsonb) returns jsonb`
performing the idempotent upsert of decision 7 and returning whether the row was
newly created (which is what gates the welcome email); `unsubscribe_newsletter
(subscriber_id text)`. RLS on, no policy, revoke.

**`src/actions/newsletter.ts`** — keep the existing rate limit, honeypot,
validation and the house-inbox notification; add persistence *before* the send,
and send the welcome only when the subscriber is new. The address must remain
unlogged. Rewrite the header comment: it currently states the opposite of what
the file will now do.

**Unsubscribe** — `src/lib/newsletter/token.ts` (HMAC sign/verify, timing-safe)
and a route that accepts `?id=&token=`, flips the row, and renders a plain
confirmation. Every marketing email footer links to it.

**`/admin/newsletter`** — counts (total, subscribed, unsubscribed), a filterable
searchable paginated list, and CSV-free export deferred. Add to `AdminShell`.

## Phase 3 — Stockists

`/admin/stockists` + `/admin/stockists/[id]` + `/new`, CRUD over the existing
table via `schemas/admin.ts`-style Zod plus `actions/admin/directory.ts`. All
existing columns are editable including `region`, `type`, `status`,
`isPublished`, `sortOrder`, coordinates-bearing `mapsUrl`, and the image pair.
Publishing toggles reuse `StatusToggle`. Revalidate the public `/stockists`
page on write. No schema change.

## Phase 4 — Settings

`/admin/settings` — the `"BoutiqueSetting"` singleton (three house emails,
featured product picker), `"ContactChannel"` and `"SocialProfile"` rows. No
schema change. Explicitly renders no secret of any kind. Revalidate the public
pages that read these.

## Phase 5 — Content

`/admin/content` — an index of the editable content groups, then editors for
`TimelineEvent`, `BrandValue`, `MissionStatement`, `CraftPillar`, `CraftStep`,
`CraftStat`, `CraftQuote`, `Testimonial`, and the ingredient tables. Reorder via
the existing `sortOrder` columns. No schema change. Revalidate `/heritage`,
`/craftsmanship`, `/ingredients` and the home page on write.

## Phase 6 — Order search and pagination

`listAdminOrders` gains `search` and `page`; `/admin/orders` gains `AdminSearch`
and pager controls, composing with the existing status/channel/seen filters.
Search is `ilike` over order number, customer name and email, in the query.

## Security requirements

- `requireAdmin()` is the first statement of **every** new Server Action.
- The Clerk webhook is authenticated by signature only; an unverified request is
  a 400 and a missing secret is a 500. No admin action is reachable from it.
- `unsafeMetadata` is coerced to a boolean and never read for anything else.
- Unsubscribe is authorised by HMAC token compared timing-safely; ids alone are
  never sufficient.
- All new tables: RLS on, no policy, no grant to `anon`/`authenticated`.
- No email, name, phone, address or note reaches a log line anywhere in this work.
- No screen renders an API key, signing secret, or connection string.
- Nothing in phases 1–6 alters an order total, a price, stock, or a payment
  state.

## Acceptance criteria

1. `npm run db:migrate` applies `0024` and `0025` cleanly and is idempotent on a
   second run; `npm run db:verify` passes.
2. A Clerk sign-up creates exactly one `"User"` row; editing the profile updates
   it without duplicating; deleting soft-deletes and leaves orders intact.
3. `/admin/customers` lists both account holders and guest purchasers, searches
   by name and email, paginates, and its spend figures match the customer's own
   `/account` panel for the same person.
4. `/account` addresses render from the database instead of an empty stub.
5. Subscribing twice yields one row, one welcome email, and a refreshed consent
   timestamp; unsubscribing via the emailed link flips the row without deleting
   it; a tampered token is refused.
6. Stockists, settings and content edits appear on the corresponding public page
   after revalidation, with no customer-facing regression.
7. `/admin/orders` search and pagination compose with status, channel and seen.
8. `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass at the end of
   **each** phase, and no existing admin or storefront screen changes behaviour
   except where listed.
9. Zero `any`. Every new row read is Zod-parsed, never asserted.

## Checks to run (after each phase, not only at the end)

- `npx tsc --noEmit`
- `npm run lint`
- `npm run db:migrate` (twice, on the phases that add SQL)
- `npm run db:verify`
- `npm run build`

## Manual test steps

Given per phase at the point each is delivered, since phases 3–6 depend on
screens phases 1–2 introduce into the nav. Phase 1's Clerk webhook additionally
needs a signing secret configured in the Clerk dashboard and the endpoint
subscribed to `user.created`, `user.updated`, `user.deleted` — I will hand over
those exact steps rather than assume the dashboard is already set up.
