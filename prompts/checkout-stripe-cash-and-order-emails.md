# Checkout — Stripe Card, Cash on Delivery, and the Order Email Lifecycle

## Goal

Open the till. Today `/checkout` does not exist, `CartSummary` renders a disabled
button labelled "Secure checkout opens shortly", and the only way an `"Order"` row
is created is an admin typing a walk-in into `/admin/orders/new`. This change makes
the storefront sell.

Five deliverables:

1. **A `/checkout` page** — contact details, delivery address, order review, and a
   payment step offering exactly two methods: **Card** (Stripe) and **Cash on
   delivery**.
2. **Stripe integration** — `stripe` + `@stripe/stripe-js` + `@stripe/react-stripe-js`,
   a PaymentIntent route, the embedded Payment Element themed to obsidian/gold, and
   a signature-verified webhook.
3. **Every key documented in `.env.example`** so plugging a fresh Stripe account in
   is a copy-paste, not a code change.
4. **A confirmation surface with a genuine celebration** — `/checkout/confirmed`,
   reached by both methods, with a motion sequence that stays inside the house rules
   (no spring, no bounce).
5. **The email lifecycle** — a house notification to `khem.official@outlook.com` on
   every new order, a customer confirmation at PROCESSING, and a customer email on
   each subsequent status the desk sets from `/admin/orders/[orderNumber]`
   (SHIPPED, DELIVERED, CANCELLED, REFUNDED). All on the existing `luxuryShell`
   brand template — seal, wordmark, signature, social links, website.

## Skills read

- **`.agents/skills/supabase`** — the migration adds columns, an enum, and two
  `security definer` functions to `supabase/sql/`, and the webhook writes through
  the service-role client. Grants and RLS posture must match `0015_orders.sql`.
- **`.agents/skills/clerk`** — `/checkout` is *not* protected, but a present session
  must be observed server-side so `clerkUserId` is stamped from `auth()` and never
  from a form field.
- **`node_modules/next/dist/docs/`** — Route Handler conventions for the webhook
  (raw body access), Server Actions, and the `'use client'` boundary around Elements.
- `ai-sdk` is not involved. Stripe is not one of the four approved skills; follow the
  official Stripe Node/React docs and the existing project patterns in
  `src/lib/supabase.ts` and `src/lib/email/client.ts` for the lazy-singleton client
  shape.

## Existing code inspected

**Schema and order writes**
- `supabase/sql/0015_orders.sql` — `"Order"`, `"OrderItem"`, the `OrderStatus` /
  `PaymentStatus` / `OrderChannel` enums, `place_order(jsonb)`, `restock_order(text)`,
  `set_order_status(text, OrderStatus)`, the `DailySales` / `ProductSales` views.
  RLS on, **no policy at all**, public roles hold no grant, `execute` revoked from
  the public roles on all three functions.
- `src/actions/admin/orders.ts` — `createOrder`, `updateOrderStatus`,
  `updatePaymentStatus`. Each opens with `requireAdmin()`, parses with Zod, calls an
  RPC, revalidates by slug, logs actor + order number and never customer data.
- `src/services/admin/orders.ts` — `listAdminOrders`, `getAdminOrder`,
  `getAdminOrderById`, `countOpenOrders`; secret-key reads, `parseList`, narrow
  projections.
- `src/schemas/orders.ts` — `createOrderSchema` (no price field, by design),
  `updateOrderStatusSchema`, `orderStatusValues`, `TRANSITIONS`, `canTransition`.
- `src/schemas/db/orders.ts` — `ORDER_SUMMARY_COLUMNS`, `ORDER_DETAIL_COLUMNS`,
  `toAdminOrderDetail`, `customerOrderSchema`.
- `src/services/account.ts` — `getOrdersForUser` filters on `clerkUserId` with the
  secret key; the filter *is* the access control. `getAddressesForUser` still
  returns `[]` — there is no `"Address"` table.

**Cart and money**
- `src/lib/cart.ts` — `FREE_SHIPPING_THRESHOLD_IN_CENTS` (200_000),
  `SHIPPING_FEE_IN_CENTS` (9_000), `MAX_QUANTITY_PER_LINE` (10),
  `cartSubtotalInCents`, `shippingInCents`, `cartTotalInCents`, `clampQuantity`.
- `src/providers/cart-provider.tsx` — `localStorage` cart holding **product id +
  quantity only**, `isHydrated` gate, `clear()`.
- `src/lib/currency.ts` — `BASE_CURRENCY = "EGP"`, display conversion only; the
  header states outright that checkout must price from `priceInCents`.
- `src/components/ecommerce/CartSummary.tsx` — the disabled CTA and the
  `dict.cart.checkoutSoon` line this change removes.
- `src/services/products.ts` — `getProductCardsByCollection(locale)`, the projection
  `/cart` already resolves ids against.

**Email**
- `src/lib/email/layout.ts` — `luxuryShell`, `signatureBlock`, `ctaButton`,
  `paragraph`, `mutedParagraph`, `markedList`, `spacer`, `signoff`, the token set,
  `assetBase()` / `EMAIL_ASSET_BASE_URL`.
- `src/lib/email/templates.ts` — `EmailPayload`, the internal `shell()` + `row()`
  notification format, `enquiryEmail`, `enquiryAcknowledgementEmail`,
  `newsletterWelcomeEmail`.
- `src/lib/email/copy.ts` — per-locale `Record<Locale, …>` copy, trusted and
  unescaped; visitor input never lands here.
- `src/lib/email/addresses.ts` — `fromAddress()`, `houseFromAddress()`,
  `inboxAddress()`; `src/lib/email/client.ts` — lazy Resend, `isEmailConfigured()`.
- `src/actions/contact.ts` — the reference send path: honeypot → throttle → Zod →
  fail closed when unconfigured → check `{ error }` on the Resend result → courtesy
  mail last and never allowed to fail the primary action.

**Routing and identity**
- `src/proxy.ts` — locale rewrite, Clerk wrapper, early shed for `/account` and
  `/admin`, currency cookie. `api` is excluded from the matcher, so the Stripe
  webhook is untouched by the locale rewrite.
- `src/lib/auth.ts` — `getUserId()`, `getViewer()`.
- `src/lib/routes.ts` — `ACCOUNT_PATHS`, `ADMIN_PATH`, `AUTH_PATHS`.
- `src/lib/i18n/dictionaries/en.ts` / `ar.ts` — 1,218 lines, `cart` block at 879,
  `account.orders.status` label map at ~1002.

## Decisions and assumptions

Three were put to the user and answered; they are settled, not open.

- **Guest checkout is allowed.** `/checkout` stays out of the protected paths in
  `src/proxy.ts`. Name, email, phone and address are collected on the form. When a
  Clerk session exists, `clerkUserId` is stamped **from `await auth()` on the
  server** so the order appears in `/account/orders`; a guest order simply carries
  `null` there, which the existing `getOrdersForUser` filter already handles
  correctly. The signed-in visitor's fields are pre-filled from `getViewer()`, and
  the pre-fill is a convenience only — the server never trusts the posted email for
  identity, only for delivery.
- **Embedded Stripe Payment Element**, per AGENTS.md §8. The visitor never leaves
  khemperfumes.com. Themed with the Appearance API to the `@theme` tokens.
- **Stock is reserved at placement, and unpaid card orders are swept.**
  `place_order()` is the only supported creation path and it moves stock inside its
  own transaction — that invariant does not get an exception for checkout. So a card
  order is created **before** payment as `PENDING` / `UNPAID`, the webhook promotes
  it to `PROCESSING` / `PAID`, and a Vercel cron cancels-and-restocks anything left
  `PENDING` + `UNPAID` + `CARD` for longer than 30 minutes. Cancelling routes
  through `set_order_status`, so the restock is the same idempotent path the desk
  uses.

Everything else:

- **`channel` is `ONLINE`** for every order this flow creates. Non-negotiable — it
  is what separates storefront revenue from walk-ins in `DailySales`.
- **Cash on delivery skips PENDING entirely.** There is nothing to wait for, so the
  order is created and immediately moved to `PROCESSING` with `paymentStatus`
  `UNPAID`. The user's brief — "by default be Processing" — is satisfied for both
  methods, just at different moments: cash at placement, card at
  `payment_intent.succeeded`.
- **Prices come from the catalog, never from the browser.** The cart posts
  `{ productId, quantity }` pairs. The Server Action resolves ids → slugs against
  `"Product"`, and `place_order()` reads `priceInCents` under a row lock. Shipping
  is recomputed server-side from `shippingInCents(subtotal)` — the posted total is
  never read for anything. Same rule the `currency.ts` header already states.
- **Stripe is charged in EGP**, `BASE_CURRENCY`, in the minor unit already stored.
  `priceInCents` is piastres and Stripe's EGP minor unit is piastres, so the amount
  passes straight through with no conversion. The displayed currency is a display
  transform and must never reach `amount`. Note plainly on the payment step which
  currency will be charged when the visitor is browsing in another one — the copy
  for this already exists as `dict.currencySwitcher.conversionNote`.
- **The PaymentIntent amount is derived from the created order row, not the
  request body.** The order is placed first; the route reads `totalInCents` back
  from `"Order"` and charges that. A request cannot name its own amount.
- **`Order.locale` is a new column.** A status email sent three days later has no
  request context to infer language from, and mailing an Arabic customer in English
  because the desk clicked "Shipped" from an English dashboard is the exact failure
  the i18n work exists to prevent.
- **No `"Address"` table in this change.** The address is denormalised onto
  `"Order"` as six columns, which is what an order needs anyway — a shipping address
  is a snapshot of where the parcel went, not a live pointer to an editable record.
  The address book at `/account/addresses` stays empty and stays honest; when it
  lands it becomes a pre-fill source for this form and nothing here changes.
- **Emails are best-effort and never fail the order.** Same posture as
  `sendAcknowledgement` in `contact.ts`: the sale is secured first, every send is
  wrapped, every failure is logged, and nothing about mail changes what the visitor
  or the desk sees. An order that exists with no email sent is recoverable; an order
  refused because Resend was down is not.
- **Status emails fire from `updateOrderStatus`, after the RPC succeeds.** Four
  statuses mail the customer: SHIPPED, DELIVERED, CANCELLED, REFUNDED. PROCESSING
  set manually by the desk also mails, using the same confirmation template, because
  a desk pulling an order back from PENDING is telling the customer it is now moving.
  `PENDING` never mails — nobody wants "your order is pending" as a notification.
- **A guest order with no email address still works.** `customerEmail` is required
  by the checkout schema (it is how anyone gets a receipt), so in practice it is
  always present; the send helpers still guard on it rather than assuming.
- **`@stripe/react-stripe-js` and `@stripe/stripe-js` are client-only**;
  `stripe` (Node) is server-only and must never be imported from a
  `'use client'` module or from anything one imports.

### Flagged, not fixed by this change

`.env.example` currently has a **live-looking `AI_GATEWAY_API_KEY` committed** on its
last line (`vck_7BLRhb…`). An example file is meant to hold empty values, and this
one is in git history. Rotate that key in the Vercel dashboard and blank the line.
This change will blank the line as part of editing the file, but rotating is a
dashboard action only the user can take.

## Files likely to change

**New — schema**
- `supabase/sql/0016_checkout.sql`

**New — Stripe**
- `src/lib/stripe/server.ts` — lazy `Stripe` singleton, `isStripeConfigured()`
- `src/lib/stripe/client.ts` — `loadStripe` promise singleton (client)
- `src/lib/stripe/appearance.ts` — Elements Appearance API theme
- `src/app/api/checkout/intent/route.ts` — create/return a PaymentIntent for an order
- `src/app/api/webhooks/stripe/route.ts` — signature-verified event handler
- `src/app/api/cron/sweep-unpaid-orders/route.ts` — the 30-minute sweeper
- `vercel.json` — the cron entry

**New — checkout surface**
- `src/app/[locale]/checkout/page.tsx`
- `src/app/[locale]/checkout/confirmed/page.tsx`
- `src/components/checkout/CheckoutView.tsx` — the stepper shell (client)
- `src/components/checkout/ContactStep.tsx`
- `src/components/checkout/DeliveryStep.tsx`
- `src/components/checkout/PaymentStep.tsx` — method choice
- `src/components/checkout/CardPaymentForm.tsx` — Elements + Payment Element
- `src/components/checkout/CashPaymentPanel.tsx`
- `src/components/checkout/OrderReview.tsx` — sticky line/total column
- `src/components/checkout/CheckoutField.tsx` — the luxury input primitive
- `src/components/checkout/OrderCelebration.tsx` — the confirmed-page motion piece

**New — orders domain**
- `src/actions/checkout.ts` — `placeCustomerOrder`
- `src/schemas/checkout.ts` — the checkout Zod schema
- `src/services/orders.ts` — `getOrderForConfirmation`, `resolveCartToLines`
- `src/types/checkout.ts`

**New — email**
- `src/lib/email/order-copy.ts` — per-locale prose for the five customer emails
- `src/lib/email/order-templates.ts` — `orderConfirmationEmail`,
  `orderStatusEmail`, `newOrderNotificationEmail`
- `src/lib/email/send-order-mail.ts` — the two best-effort senders

**Modified**
- `.env.example` — Stripe keys, cron secret, blanked gateway key
- `package.json` — three dependencies
- `src/components/ecommerce/CartSummary.tsx` — live CTA
- `src/actions/admin/orders.ts` — status-change mail
- `src/schemas/db/orders.ts` — new columns in the detail projection
- `src/types/order.ts` — `paymentMethod`, address, `locale` on `AdminOrderDetail`
- `src/app/[locale]/admin/orders/[orderNumber]/page.tsx` — show method + address
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — the `checkout` block; edit `cart`
- `src/lib/routes.ts` — `CHECKOUT_PATHS`
- `supabase/README.md` — the new file in the list

## Implementation requirements

### 1. `supabase/sql/0016_checkout.sql`

Idempotent throughout (`do $$ … exception when duplicate_object`,
`add column if not exists`, `create or replace function`), because
`scripts/db-migrate.ts` re-applies every file in one transaction on each run.
Header comment in the voice of `0015`: what it adds, why, and the trust model.

- `create type public."PaymentMethod" as enum ('CARD', 'CASH')`.
- `alter table public."Order" add column if not exists`:
  - `"paymentMethod" public."PaymentMethod" not null default 'CASH'` — the walk-in
    default, so existing rows are described correctly.
  - `"shipLine1" text`, `"shipLine2" text`, `"shipCity" text`, `"shipState" text`,
    `"shipPostalCode" text`, `"shipCountry" text` — each with a `char_length` check
    matching the Zod maxima below. Nullable: a walk-in has no delivery address.
  - `"locale" text not null default 'en' check ("locale" in ('en', 'ar'))`.
  - `"stripePaymentIntentId" text` + a **partial unique index** on it
    `where "stripePaymentIntentId" is not null`.
  - `"paidAt" timestamptz`.
- Index `order_unpaid_card_idx on public."Order" ("placedAt") where status = 'PENDING'
  and "paymentStatus" = 'UNPAID' and "paymentMethod" = 'CARD'` — the sweeper's query.
- **Replace `place_order(jsonb)`** to read the new keys from the payload
  (`paymentMethod`, `locale`, the six `ship*` fields) and insert them. Keep every
  existing behaviour byte-for-byte: the slug-ordered `for update` locks, the archived
  check, the stock check, the snapshot of name and price, the subtotal recompute.
  Default `paymentMethod` to `'CASH'` and `locale` to `'en'` when the key is absent,
  so `src/actions/admin/orders.ts` keeps working untouched.
- **New `settle_order_payment(order_id text, intent_id text)` returns boolean.**
  `security definer`, `set search_path = public`. Locks the row, and:
  - returns `false` unchanged if `"paymentStatus"` is already `'PAID'` — this is what
    makes webhook retries idempotent and is the guard that stops a duplicate
    confirmation email;
  - otherwise sets `"paymentStatus" = 'PAID'`, `"paidAt" = now()`,
    `"stripePaymentIntentId" = intent_id`, `"updatedAt" = now()`, and promotes
    `status` to `'PROCESSING'` **only when it is currently `'PENDING'`** (an order the
    desk already shipped must not be dragged backwards), then returns `true`.
- **New `expire_unpaid_orders(older_than_minutes int) returns setof text`** — selects
  ids matching the partial index older than the cutoff, calls
  `set_order_status(id, 'CANCELLED')` on each (which restocks, idempotently, via
  `restock_order`), and returns the cancelled order numbers so the route can log a
  count.
- Close with the same clawback `0015` ends on: `revoke all on ... from anon,
  authenticated` for the new functions, and re-assert the table revokes.

### 2. Dependencies

```
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

Pin whatever the registry resolves; do not hand-write versions.

### 3. `src/lib/stripe/server.ts`

Mirror `src/lib/email/client.ts` exactly: lazy singleton, never throws at import
time, `isStripeConfigured()` reported separately so callers fail *closed* with a
clear error rather than falling through to a fake success. `apiVersion` pinned to the
version the installed types declare. Import `"server-only"`.

### 4. `src/schemas/checkout.ts`

```
checkoutSchema = {
  customerName   trim 2..120
  customerEmail  email, required
  customerPhone  trim 7..40, required (a courier needs a number)
  paymentMethod  enum ['CARD','CASH']
  locale         enum ['en','ar']
  line1          trim 4..200
  line2          trim max 200, default ""
  city           trim 2..80
  state          trim 2..80          // governorate
  postalCode     trim max 20, default ""   // Egypt does not always use one
  country        trim 2..80
  note           trim max 500, default ""
  company        honeypot, must be ""
  items          array 1..50 of { productId: uuid-ish string, quantity int 1..MAX_QUANTITY_PER_LINE }
                 refined: no duplicate productId
}
```

Messages are visitor-facing prose, so unlike `schemas/orders.ts` they are **keys into
the dictionary**, not English sentences — the checkout is bilingual. Return
`fieldErrors` keyed by field name and let the client look the copy up.

### 5. `src/actions/checkout.ts` — `placeCustomerOrder`

Order of operations, mirroring `contact.ts`:

1. Honeypot → return a fabricated success and do nothing.
2. Throttle. `isRateLimited("checkout", await clientKey(), { limit: 8, windowMs: 10 * 60_000 })`.
   Higher than contact's 3 because a genuine buyer retries a declined card.
3. Zod parse. Field errors back to the client.
4. `getSupabaseAdmin()`; `UNCONFIGURED`-shaped failure if absent.
5. Resolve `productId[] → { slug, quantity }[]` with one `in` query against
   `"Product"` (`select id, slug, isArchived`). An id with no row, or an archived
   one, is a form-level error naming the product — never a silent drop.
6. Compute `shipInCents` server-side: fetch `priceInCents` in the same query, compute
   the subtotal, then `shippingInCents(subtotal)` from `src/lib/cart.ts`. This is
   advisory only — `place_order` recomputes the subtotal authoritatively — but the
   shipping figure must be derived here because the SQL function takes it as input.
7. `clerkUserId = await getUserId()` — from the session, never the body.
8. `supabase.rpc("place_order", { payload: { …, channel: "ONLINE", paymentMethod,
   locale, ship* } })`. Translate a raise into a form-level message the same way
   `placementFailure` does; reuse that helper by exporting it from
   `src/actions/admin/shared.ts` rather than copying it.
9. **Cash**: `rpc("set_order_status", { order_id, next_status: "PROCESSING" })`, then
   fire both emails (house notification + customer confirmation), then
   `revalidateProductsBySlug(...)`, then return
   `{ ok: true, orderNumber, paymentMethod: "CASH" }`.
10. **Card**: leave it `PENDING`/`UNPAID`. Send **no** customer mail yet — an
    unpaid order is not a confirmed one. Return
    `{ ok: true, orderNumber, orderId, paymentMethod: "CARD" }`; the client then
    calls the intent route.
11. Log actor-free: order number and method only. **Never** the name, email, phone,
    address, or note — `0015`'s header makes that rule explicit and it applies with
    more force here, where the row now holds a street address.

### 6. `src/app/api/checkout/intent/route.ts`

`POST { orderId }`. Reads the order with the service key, and refuses unless it is
`PENDING` + `UNPAID` + `CARD` + placed within the last 30 minutes. Amount and
currency come from the row (`totalInCents`, `"EGP"`), never the body. Sets
`metadata: { orderId, orderNumber }` so the webhook can resolve the order without a
lookup table. If `"stripePaymentIntentId"` is already set, retrieve and reuse that
intent instead of creating a second one — a visitor who refreshes the payment step
must not leave a trail of orphan intents. Returns `{ clientSecret }` and nothing
else. `automatic_payment_methods: { enabled: true }`.

### 7. `src/app/api/webhooks/stripe/route.ts`

- `export const runtime = "nodejs"` — signature verification needs the raw body,
  read via `await request.text()`. **Never** `request.json()`.
- `stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)`
  inside a try; a failure is `400` and a log line with no event content.
- A missing `STRIPE_WEBHOOK_SECRET` is `500`, not a bypass.
- `payment_intent.succeeded` → `rpc("settle_order_payment", { order_id, intent_id })`.
  **Only when it returns `true`** send the house notification and the customer
  confirmation. That boolean is the entire duplicate-email defence.
- `payment_intent.payment_failed` → set `paymentStatus = 'FAILED'`. Leave the order
  `PENDING` so the sweeper eventually restocks it; do not cancel on the first decline,
  because a visitor commonly retries with another card.
- `charge.refunded` → `set_order_status(id, 'REFUNDED')`, which restocks and, through
  the shared helper, mails the customer.
- Everything else: `200` with no work. Always answer `200` on a handled event even
  when a downstream email failed, or Stripe will retry the whole event.

### 8. `src/app/api/cron/sweep-unpaid-orders/route.ts`

`GET`, guarded by `authorization: Bearer ${CRON_SECRET}` compared with a
**timing-safe** comparison. Calls `expire_unpaid_orders(30)`, logs the count.
`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/sweep-unpaid-orders", "schedule": "*/15 * * * *" }] }
```

### 9. The `/checkout` page

Server Component. Reads the locale, the dictionary, `getViewer()`, and
`getProductCardsByCollection(locale)` — the same catalog projection `/cart` uses, for
the same reason: `localStorage` is unreadable on the server. Renders `<CheckoutView>`
with `viewer` pre-fill values and the catalog. `export const dynamic = "force-dynamic"`
(it reads the session) and `robots: { index: false, follow: false }`.

An empty cart after hydration renders the same `EmptyState` the cart page uses rather
than a broken form. Before hydration, hold the height — never flash an empty state,
the rule `CartView` already documents.

### 10. Visual specification

**Layout.** Two columns from `lg`, `lg:grid-cols-[1fr_420px]`, the review column
`lg:sticky lg:top-20 lg:h-fit` on `bg-surface` — the same relationship `/cart`
already establishes, so the visitor recognises the screen. Single column below `lg`
with the review collapsed into a summary bar that expands on tap. Page ground
`bg-background`, `pt-20` for the fixed nav, `<PageHeader>` reused with
`eyebrow: dict.checkout.eyebrow`, `heading: dict.checkout.heading`.

**Steps.** Three numbered sections stacked on one page — Contact, Delivery, Payment —
not a wizard. A luxury boutique does not make you click "next" three times. Each
section header: a gold hairline rule, a `font-heading text-sm tracking-[0.15em]`
title, and a small `01 / 02 / 03` numeral in `text-gold/40`. A section whose fields
are all valid earns a `Check` icon at `strokeWidth={1.25}` in `text-gold`.

**Fields.** Per AGENTS.md §3.2: transparent fill, `border-b border-border` that
becomes `border-gold` on focus, uppercase gold label at `text-[10px]
tracking-[0.2em]`, `focus:outline-none` with a glow rather than the webkit ring,
`transition-colors duration-300 ease-out`. Errors in `text-danger` at
`text-[11px]`, `aria-invalid` + `aria-describedby` wired. Logical properties
throughout (`ps-`, `border-s`) — Arabic is a first-class locale here.

**Payment methods.** Two selectable cards, not radio dots. Each is a bordered panel
that goes `border-gold shadow-[0_0_30px_rgba(200,169,106,0.15)]` when chosen; a
`CreditCard` icon for one, `Banknote` for the other, a title, and one line of
supporting copy. Implement as real `<input type="radio">` inside `<label>` with the
input visually hidden — keyboard and screen-reader behaviour comes free, and
`focus-visible` styling goes on the panel via `has-[:focus-visible]`.

**Payment Element theme** (`src/lib/stripe/appearance.ts`):
`theme: "night"`, `colorPrimary: "#c8a96a"`, `colorBackground: "#1a1a1a"`,
`colorText: "#f7f4ec"`, `colorDanger: "#c0392b"`, `borderRadius: "6px"`,
`fontFamily` the body stack, plus rules pushing `.Input` to a bottom-border-only
treatment and `.Label` to uppercase `0.2em` tracking.

**Submit.** Full-width `btn-luxury btn-luxury-fill`, uppercase,
`tracking-[0.2em]`. Disabled with `opacity-45` while submitting; the label swaps to
a "Securing your order" string, and the button never un-disables on success — the
navigation to `/checkout/confirmed` is what ends the interaction. A double-submit
must be impossible.

**The celebration** (`/checkout/confirmed`). This is the moment the brief asks to be
creative, and the constraint is that "expensive" and "confetti" are opposites. The
sequence, all `cubic-bezier(0.16, 1, 0.3, 1)`, zero spring:

1. `0ms` — the page is black. A single gold hairline draws itself horizontally from
   the centre outward to 56px, `600ms`.
2. `400ms` — the KHEM seal (`/email/khem-seal.png`, already in `public/`) fades in
   and settles from `scale(1.04)` to `scale(1)` over `900ms`.
3. `900ms` — a slow radial gold glow blooms behind the seal from `opacity 0` to
   `0.18` over `1200ms` and stays. This is the whole "celebration": light, not
   particles.
4. `1100ms` — the eyebrow, then the headline, then the order number, each rising
   `12px` with a `120ms` stagger.
5. `1800ms` — the order card (number, method, total, delivery estimate, the "a
   confirmation is on its way to {email}" line) fades up as one block.
6. Two CTAs last: "Track your order" → `/account/orders` for a signed-in customer,
   or "Create an account to track this order" → sign-up for a guest; and "Continue
   exploring" → `/collections`.

Honour `prefers-reduced-motion`: everything renders in final state with opacity
transitions only. Fire `clear()` on the cart in an effect on this page, once, and
only after the order number has been confirmed present.

The confirmed page reads the order **server-side** by `orderNumber` from the query
string, through a new `getOrderForConfirmation(orderNumber)` in
`src/services/orders.ts` that returns a deliberately thin projection — number,
status, total, method, masked email, line names and quantities. No address, no
phone, no note. An order number is guessable (`KHEM-2026-1043`), so this projection
must contain nothing worth guessing for. An unknown number renders a calm "we cannot
find that order" panel, never a 500.

### 11. Email

Everything customer-facing goes through `luxuryShell` — that is the brand template
the brief asks for and it already carries the seal, the wordmark, the tagline, the
Instagram / Facebook / Pinterest / website links, and the rights line. Do not build a
second one. `getSocialProfiles()` is awaited in the sender and passed in, exactly as
`contact.ts` does, because the template is synchronous.

**`src/lib/email/order-copy.ts`** — `Record<Locale, …>` for five messages:
`confirmation`, `shipped`, `delivered`, `cancelled`, `refunded`. Each with
`subject` (supporting `{orderNumber}`), `preheader`, `eyebrow`, `headline`, `intro`,
`detail`, `cta`, `signoff`. Trusted prose, unescaped, no visitor input — the file
header must say so, as `copy.ts` does. Arabic must be real Arabic, matched in
register to the existing `ACKNOWLEDGEMENT_COPY.ar`.

**`src/lib/email/order-templates.ts`**
- A shared `lineItemsTable(lines, currency, align)` helper: product name, `×qty`,
  line total, then subtotal / delivery / total rows with the total in
  `${GOLD}` at 18px. Nested tables and inline styles only — the `layout.ts` header
  explains why, and Word has not improved since.
- `orderConfirmationEmail({ order, locale, socials })` — eyebrow "Order Confirmed",
  the number as a gold-bordered block, the items table, the delivery address, the
  payment method (cash orders get an explicit "please have EGP X ready for the
  courier" line, which is the one thing a COD customer actually needs told), and
  `ctaButton` to `/account/orders`.
- `orderStatusEmail({ order, status, locale, socials })` — the same shell with the
  status copy, plus the tracking code when `status === "SHIPPED"` and one is set.
- `newOrderNotificationEmail(order)` — the **internal** format: reuse the existing
  `shell()` + `row()` from `templates.ts`, English only, dense, no seal. It goes to
  one person who needs to read it in three seconds, not to be charmed. Include the
  number, method, payment status, total, the item lines, and the full delivery
  address and phone — this is the picking slip.
- Every visitor-supplied value — name, address lines, city, product names, the note —
  goes through `escapeHtml`. Product names come from the database but are still not
  authored for this file.

**`src/lib/email/send-order-mail.ts`** — two exported functions, both `async`, both
returning `void`, both swallowing every failure with a log:
- `notifyHouseOfOrder(order)` → `from: fromAddress()`, `to: await inboxAddress()`
  (which already resolves to `khem.official@outlook.com` via `ADMIN_EMAILS` /
  `CONTACT_INBOX_EMAIL` / the `"BoutiqueSetting"` row — verify that resolution and,
  if it lands anywhere else, set `CONTACT_INBOX_EMAIL` in `.env.example` to the
  requested address with a comment rather than hardcoding it), `replyTo` the
  customer so the desk can answer with one click.
- `notifyCustomerOfOrder(order, kind)` → `from: houseFromAddress()`, `to:
  order.customerEmail`, `headers: AUTO_REPLY_HEADERS`.
Both guard on `getEmailClient()` returning `null` and on a missing recipient, and
both check the `{ error }` field of the Resend result — the silent-drop bug
`contact.ts` calls out by name.

**`src/actions/admin/orders.ts`** — after a successful `set_order_status`, map the
new status to a mail kind and call `notifyCustomerOfOrder`, awaited but wrapped so a
mail failure never turns a successful status change into an error toast. `PENDING`
maps to nothing. Add one line to the success message so the desk knows mail went out
("Order KHEM-2026-1043 is now shipped. The customer has been notified.").

### 12. `.env.example`

Append a Stripe block in the file's established voice — what the variable is, whether
it is optional, and what breaks without it:

```
# ── Stripe ──────────────────────────────────────────────────
# Card payments at /checkout. Test keys (pk_test_… / sk_test_…) work end to end
# against Stripe's test cards; nothing else needs changing to go live beyond
# swapping these three for their live counterparts.
#
# Optional in the sense that the site still runs without them — the card option
# on the payment step is hidden and cash on delivery remains available. It is
# never silently broken: an unconfigured key fails closed.
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=

# From `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in
# development, or the endpoint's signing secret in the Stripe dashboard for
# production. Without it the webhook answers 500 and no card order is ever
# promoted past PENDING — which is the correct failure, not a bypass.
STRIPE_WEBHOOK_SECRET=

# ── Cron ────────────────────────────────────────────────────
# Bearer token for /api/cron/sweep-unpaid-orders, which cancels and restocks
# card orders left unpaid for 30 minutes. Vercel sends it automatically once the
# variable exists on the project. Any long random string.
CRON_SECRET=

# ── Email assets ────────────────────────────────────────────
# Absolute base for images in emails. Defaults to SITE_URL; override only to
# render mail against a preview deployment.
EMAIL_ASSET_BASE_URL=
```

And blank the committed `AI_GATEWAY_API_KEY` value.

### 13. Dictionary

A new top-level `checkout` block in both `en.ts` and `ar.ts`: `meta`, `eyebrow`,
`heading`, the three step titles, every field label and placeholder, every validation
message keyed to match the Zod field names, the two payment method cards, the submit
labels, the error states, and a `confirmed` sub-block for the celebration page. In
`cart`, delete `checkoutSoon` and keep `checkout` as the now-live CTA label. Arabic
is a real translation, not a copy of the English.

## Security requirements

- **Every amount is server-derived.** The browser posts ids and quantities. Prices
  come from `"Product"` under a row lock inside `place_order`; shipping from
  `shippingInCents`; the Stripe amount from the persisted `"Order"."totalInCents"`.
  No code path anywhere reads a monetary value out of a request body.
- **`clerkUserId` comes from `await auth()`.** Never from the form. A posted email is
  a delivery address, never an identity.
- **The webhook verifies the signature before touching anything**, from the raw
  body, and a missing secret is a hard 500.
- **`settle_order_payment` is the idempotency boundary.** Its boolean is what
  prevents a Stripe retry from mailing the customer twice.
- **The confirmation page's projection carries nothing sensitive.** No address, no
  phone, no note. Order numbers are sequential and therefore enumerable.
- **`src/lib/stripe/server.ts` imports `"server-only"`** and `STRIPE_SECRET_KEY` never
  appears in a `NEXT_PUBLIC_` name.
- **No PII in any log line.** Order number, payment method, status, provider error
  message. Nothing else. This already holds in `src/actions/admin/orders.ts` and must
  hold in the four new server modules.
- **The cron route compares its bearer token in constant time** and returns 401
  otherwise.
- **The honeypot and the throttle both run before any Stripe or Supabase call**, so
  an abusive client costs nothing metered.
- **Address and name reach an HTML email**, so every one of them goes through
  `escapeHtml`; anything reaching a mail header goes through `stripHeaderBreaks`.
- **New tables/columns inherit `0015`'s posture** — the public roles gain no grant,
  and `execute` on the two new functions is revoked from `anon` and `authenticated`.

## Acceptance criteria

1. `/checkout` renders in both locales, RTL correct in Arabic, legible from 360px.
2. A guest completes a cash order: the row exists with `channel = 'ONLINE'`,
   `paymentMethod = 'CASH'`, `status = 'PROCESSING'`, `paymentStatus = 'UNPAID'`,
   `clerkUserId` null; product inventory has dropped by the ordered quantity.
3. A signed-in customer's order carries `clerkUserId` and appears at
   `/account/orders` with the right status.
4. A card order with test card `4242 4242 4242 4242` moves `PENDING/UNPAID` →
   `PROCESSING/PAID` when the webhook fires, and `"stripePaymentIntentId"` and
   `"paidAt"` are set.
5. Replaying the same webhook event changes nothing and sends no second email.
6. Declined card `4000 0000 0000 0002` leaves the order `PENDING`, sets
   `paymentStatus = 'FAILED'`, shows the visitor the decline reason, and lets them
   retry without creating a second order or a second intent.
7. `khem.official@outlook.com` receives the internal notification for every order,
   containing the full address and phone.
8. The customer receives the branded confirmation with the seal, the item table, the
   correct total, and working social/website links — in the locale they ordered in.
9. Setting SHIPPED, then DELIVERED in `/admin/orders/[orderNumber]` sends one
   customer email each; the shipped one includes the tracking code when set.
   CANCELLED and REFUNDED also mail, and restock.
10. An unpaid card order older than 30 minutes is CANCELLED and restocked by the
    cron route; running it twice restocks once.
11. `/checkout/confirmed` plays the sequence, clears the cart exactly once, and
    renders in final state under `prefers-reduced-motion`.
12. With `STRIPE_SECRET_KEY` absent the card option is hidden, cash still works, and
    nothing throws at import.
13. Zero `any`. `npm run lint` clean. No server-only module reachable from a
    `'use client'` import graph.
14. `npm run db:migrate` applies `0016` twice with no error and no duplicate column.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
npm run db:migrate      # twice, to prove idempotency
npm run db:verify
```

## Manual test steps

**Setup**
1. `npm install` after the three dependencies land.
2. Fill `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` in `.env.local`
   from the Stripe test dashboard.
3. `stripe login && stripe listen --forward-to localhost:3000/api/webhooks/stripe`,
   and paste the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
4. `npm run db:migrate`, then `npm run dev`.

**Cash, as a guest**
5. Sign out. Add two products to the bag from any PDP. Open `/cart` — the CTA is now
   live. Click it.
6. Fill contact, address, choose **Cash on delivery**, submit.
7. Land on `/checkout/confirmed`; watch the sequence; confirm the nav cart badge is
   now zero.
8. `/admin/orders` shows the order as PROCESSING / ONLINE / UNPAID. Open it: the
   address and CASH method are printed.
9. Check `khem.official@outlook.com` for the picking slip and the buyer's address for
   the branded confirmation.
10. `/admin/inventory` — both products dropped by the ordered quantity.

**Card, signed in**
11. Sign in, fill a bag, go to `/checkout`. Contact fields are pre-filled from Clerk.
12. Choose **Card**, pay with `4242 4242 4242 4242`, any future expiry, any CVC.
13. Watch the `stripe listen` terminal for `payment_intent.succeeded`; the order flips
    to PROCESSING / PAID.
14. `/account/orders` lists it. Both emails have arrived.
15. `stripe events resend <event_id>` — the order is unchanged and no second email
    arrives.

**Decline and retry**
16. New bag, card `4000 0000 0000 0002`. Confirm the decline message, then retry in
    place with the good card. One order, one intent, one confirmation.

**Status lifecycle**
17. In `/admin/orders/[orderNumber]`: set a tracking code, then SHIPPED → the customer
    gets the shipped email with the code. Then DELIVERED → the delivered email.
18. On a different order, CANCELLED → the cancelled email arrives and the stock
    returns.

**Sweeper**
19. Start a card order and abandon it at the Payment Element.
20. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sweep-unpaid-orders`
    — nothing happens (under 30 min). Temporarily call `expire_unpaid_orders(0)` in
    the SQL editor to prove the path: the order is CANCELLED and stock is back.
    Run it again — stock does not double.

**Arabic**
21. `/ar/checkout` — layout mirrors, labels translate, the Payment Element renders
    RTL-adjacent without breaking the column. Place a cash order and confirm the
    confirmation email arrives **in Arabic**, and that setting SHIPPED days later
    still mails in Arabic (this is what `Order.locale` is for).

**Unconfigured**
22. Comment out `STRIPE_SECRET_KEY`, restart. `/checkout` offers cash only, no
    console error, no crash.
