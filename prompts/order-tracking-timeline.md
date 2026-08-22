# Track Your Order — station timeline in the customer portal

## Goal

Make the "Track Your Order" button we already send in the shipped/confirmation
emails land on a page that actually *tracks*: the signed-in customer opens
`/[locale]/account/orders`, is scrolled to the exact order the email was about,
and sees that order's progress drawn as a rail of stations — PENDING →
PROCESSING → SHIPPED → DELIVERED — with the real date each station was reached.
Every status the desk sets in `/admin` moves the rail forward on the customer's
next view, and still sends the branded email it sends today.

Three requirements from the request, restated as acceptance:

1. The email CTA navigates to the orders page **and to that order**.
2. The customer can follow every update the desk makes (processing → shipped → …).
3. The newest order is above the older ones.
4. Progress is drawn as points with a station per status.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) govern new
ground here: the read path is an existing `getSupabaseAdmin()` query behind an
existing Clerk session, and no AI is involved. `supabase/sql/0015_orders.sql`
and `0016_checkout.sql` are the authority for the SQL below and were read in
full.

## Existing code inspected

- `src/app/[locale]/account/orders/page.tsx` — force-dynamic, gated on
  `getViewer()`, maps `getOrdersForUser(viewer.id)` into `<OrderCard>`.
- `src/services/account.ts` — `getOrdersForUser` already returns newest first
  (`.order("placedAt", { ascending: false })`), filtered on `clerkUserId` from
  the verified session. **Requirement 3 is already satisfied**; this prompt only
  makes it visible with a "Latest" marker and does not touch the ordering.
- `src/components/account/OrderCard.tsx` — server component, status chip,
  tracking-code line.
- `src/types/account.ts` — `OrderStatus`, `OrderLine`, `OrderSummary`.
- `src/schemas/db/orders.ts` — `customerOrderSchema`, the narrow customer
  projection (no email, no phone, no `note`).
- `src/actions/admin/orders.ts` — `updateOrderStatus` calls
  `set_order_status()` then `notifyCustomerOfOrder()`; the mail path is done and
  is **not** being changed.
- `src/lib/email/order-templates.ts:299-302` — the CTA href today is
  `${SITE_URL}${ACCOUNT_PATHS.orders}`: not locale-prefixed and not
  order-specific.
- `supabase/sql/0015_orders.sql` — `place_order`, `set_order_status`,
  `restock_order`; RLS on with no policy, no grants to the public roles.
- `supabase/sql/0016_checkout.sql` — the live `place_order` (adds address,
  locale, paymentMethod, clerkUserId) and `settle_order_payment`, which promotes
  PENDING → PROCESSING when the card clears.

## Decisions and assumptions

**A station needs a date, and a date has to be stored.** `"Order"` records only
the current `status` and one `updatedAt`, so a rail drawn from it could show
"Shipped" but never *when*. AGENTS.md forbids inventing the rest. So this adds
`"OrderStatusEvent"` — an append-only trail, written inside the same functions
that already own a status change, so the trail cannot drift from the row.
Without it, requirement 4 degrades to four unlabelled dots.

**The lifecycle starts at PENDING.** Two changes agreed after the first draft:
`settle_order_payment` no longer promotes a paid order to PROCESSING — a cleared
card is a *payment* fact, not a fulfilment one, so every order sits at PENDING
until the desk moves it. And `mailKindForStatus("PENDING")` returns
`"confirmation"` instead of `null`, so PENDING is a station the customer is told
about rather than a silent one.

**Status moves stay in SQL.** No TypeScript writes an event. `place_order`,
`set_order_status` and `settle_order_payment` are re-declared in the new
migration with one `insert` added each — the same rule 0015 states for stock.

**No realtime subscription.** `0015` grants the public roles nothing on
`"Order"`, so a browser cannot subscribe to it and must not be able to. The page
is `force-dynamic`; a status change is visible on the next load, and the email
is what actively notifies. This is a deliberate non-goal, not an omission.

**Guest orders.** A checkout without a session stores `clerkUserId` null, so
that order can never appear in anybody's portal. The email CTA for those must
point at `/checkout/confirmed?order=…` instead — otherwise "Track Your Order"
sends a guest to a sign-in wall for an order no account owns.

**Cancelled and refunded are not stations.** They are not a later stop on the
same line; they end it. The rail renders the stations actually reached, then a
final halted station in a muted danger tone, and the unreached stops are
dropped rather than greyed — a greyed "Delivered" under a cancelled order reads
as a promise.

## Files likely to change

| File | Change |
| --- | --- |
| `supabase/sql/0017_order_events.sql` | **new** — table, backfill, three function re-declarations, grants revoked |
| `src/types/account.ts` | `OrderEvent`; `OrderSummary.events` |
| `src/schemas/db/orders.ts` | `events:` in `customerOrderSchema` |
| `src/services/account.ts` | embed `OrderStatusEvent` in the select; map to `events` |
| `src/components/account/OrderTracker.tsx` | **new** — the station rail |
| `src/components/account/OrderCard.tsx` | anchor id, `isLatest` badge, render the tracker |
| `src/app/[locale]/account/orders/page.tsx` | pass `isLatest={index === 0}` |
| `src/lib/email/order-templates.ts` | locale-prefixed, order-anchored CTA href |
| `src/lib/i18n/dictionaries/en.ts`, `ar.ts` | `account.orders.tracker.*`, `account.orders.latest` |
| `src/lib/email/send-order-mail.ts` | `mailKindForStatus("PENDING")` → `"confirmation"` |
| `src/services/orders.ts` | `clerkUserId` in the mail projection |

## Implementation requirements

### 1. `supabase/sql/0017_order_events.sql`

```sql
create table if not exists public."OrderStatusEvent" (
  id           text primary key default gen_random_uuid()::text,
  "orderId"    text not null references public."Order"(id) on delete cascade,
  status       public."OrderStatus" not null,
  "occurredAt" timestamptz not null default now()
);
create index if not exists order_event_order_idx
  on public."OrderStatusEvent" ("orderId", "occurredAt");
alter table public."OrderStatusEvent" enable row level security;
revoke all on public."OrderStatusEvent" from public, anon, authenticated;
```

- No RLS policy and no grants, matching `"Order"` in `0015` and for the same
  reason: identity is Clerk's, `auth.uid()` is null, the `clerkUserId` filter in
  the service *is* the access control.
- **Backfill, idempotent** (`where not exists`): a `PENDING` event at `placedAt`
  for every existing order, plus one event at `updatedAt` carrying the current
  status for every order whose status is not `PENDING`. Existing orders get a
  short but true trail rather than an empty rail.
- Re-declare `place_order(jsonb)` **from the 0016 body verbatim**, adding a
  single `insert into "OrderStatusEvent" ("orderId", status, "occurredAt")
  values (v_order_id, 'PENDING', now());` after the order insert. Copy 0016's
  body exactly — re-declaring from 0015's would silently drop the address,
  locale, paymentMethod and clerkUserId columns.
- Re-declare `set_order_status` with the same insert of `next_status` after the
  update, before the restock branch.
- Re-declare `settle_order_payment` **without the status promotion**: it sets
  `paymentStatus`, `paidAt` and `stripePaymentIntentId` and leaves `status`
  alone. It therefore writes no event — a payment is not a fulfilment step. The
  header comment explaining the PENDING-only promotion goes with it.
- Re-`revoke all on function …` for all three, since they are re-created here.

### 2. Types, schema, service

- `OrderEvent { status: OrderStatus; occurredAt: string }` in
  `src/types/account.ts`; `OrderSummary.events: readonly OrderEvent[]`.
- `customerOrderSchema` gains
  `events: z.array(z.object({ status: orderStatusSchema, occurredAt: z.string() })).default([])`.
- `getOrdersForUser` embeds `events:OrderStatusEvent(status, occurredAt)` in the
  existing select string and maps it onto the returned object beside `lines`.
  The projection stays narrow — no new `"Order"` column is added to it.
- Sort ascending by `occurredAt` in TypeScript and keep the **earliest** event
  per status, so a re-entered status cannot draw two dots for one station.

### 3. `<OrderTracker />` — server component, no state

Props: `{ status, events, locale, dict }`. Everything derived; nothing fetched.

- Stations in order: `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`. A station
  is *reached* when an event carries it, or when a later station was reached
  (a desk that jumps PENDING → SHIPPED still implies the parcel was prepared).
- Terminal states: render only the reached stations, then one final station
  labelled Cancelled / Refunded. Do not render unreached stops after it.
- Geometry: vertical rail on mobile, horizontal from `sm:`. Reached dot is a
  filled `bg-gold` disc; the current station adds a thin `ring-1 ring-gold/40`
  and `shadow-gold`; unreached is a `border border-border` hollow disc on
  `bg-surface`. Connector is a 1px line — `bg-gold/40` behind reached segments,
  `bg-border` ahead. Halted final station uses `bg-danger/70`, and its connector
  stays `bg-border`.
- Labels: `font-heading text-[9px] tracking-[0.15em]`, ivory at full strength
  for reached, `text-ivory/25` for unreached. Date under each reached station in
  `text-[10px] text-ivory/25`, formatted with `Intl.DateTimeFormat` in the
  active locale (`ar-EG` for Arabic, `timeZone: "UTC"`) — day + short month,
  never a stored string.
- Transitions `duration-500 ease-out` only; no spring, no keyframes, no layout
  shift. Nothing animates on load.
- RTL: use logical properties (`ms-*`/`me-*`, `start`/`end`) so the horizontal
  rail mirrors in Arabic. Order numbers and tracking codes stay `ltrIsland`.
- Accessibility: `<ol>` with one `<li>` per station; the current station carries
  `aria-current="step"`; the whole rail is labelled from
  `dict.tracker.label`.

### 4. `<OrderCard />` and the page

- `id={order.orderNumber}` on the `<article>` plus `scroll-mt-32`, which is what
  makes the email's `#KHEM-2026-1042` anchor land correctly under the fixed nav.
- New `isLatest?: boolean` prop; when true, a small gold-bordered
  `dict.latest` chip beside the order number.
- Render `<OrderTracker>` below the item list, above the tracking-code line,
  separated by a hairline `border-t border-border` and `pt-6 mt-6`.
- The page passes `isLatest={index === 0}` — the service already sorts newest
  first, so this is a render marker and not a re-sort.

### 5. Email CTA

In `customerOrderEmail`, replace the `ctaHref` expression with:

- `confirmation` / `shipped` **and** `order.clerkUserId` present →
  `${SITE_URL}${localizePath(order.locale, ACCOUNT_PATHS.orders)}#${order.orderNumber}`
- `confirmation` / `shipped` with no `clerkUserId` (guest) →
  `${SITE_URL}${localizePath(order.locale, "/checkout/confirmed")}?order=${encodeURIComponent(order.orderNumber)}`
- everything else → unchanged `${SITE_URL}${localizePath(order.locale, "/collections")}`

This needs `clerkUserId` added to the `getOrderForMail` select and to
`mailRowSchema` (`z.string().nullable().default(null)`). It is not rendered into
the letter — only branched on. Mirror the same href in `customerOrderText`.

### 6. Lifecycle starts at PENDING

- `mailKindForStatus` returns `"confirmation"` for `PENDING`; the switch keeps
  its exhaustive `never` default. Update the header note that currently explains
  why PENDING is silent.
- `settle_order_payment` drops its `status = case when …` clause.
- **Third promotion, found during implementation:** `src/actions/checkout.ts`
  moved a cash order to PROCESSING the instant it was placed. That is the one a
  buyer actually sees, so it goes too — a COD order now stays PENDING and still
  sends both emails. `OPEN_STATUSES` already counts PENDING as owed, so the desk
  queue is unaffected, and `expire_unpaid_orders` already filters
  `paymentMethod = 'CARD'`, so the sweep cannot cancel a cash order that now
  sits PENDING and UNPAID by design. The stale comments in `0016_checkout.sql`
  and `CheckoutView.tsx` that asserted "a cash order is never PENDING" are
  corrected.

### 7. Dictionary (`en` and `ar`, identical shape)

Under `account.orders`:

```
latest: "Latest Order" / "أحدث طلب"
tracker: {
  label: "Order progress" / "مسار الطلب"
  PENDING / PROCESSING / SHIPPED / DELIVERED / CANCELLED / REFUNDED  — station names
}
```

Station names are the *stop*, not the state: "Order Placed", "Being Prepared",
"On Its Way", "Delivered" in English; "تم الطلب"، "قيد التجهيز"، "في الطريق"،
"تم التسليم" in Arabic. Keyed by the `OrderStatus` union so a new enum member is
a compile error, matching the existing `status` map above it.

## Security requirements

- No new column reaches the customer projection: no email, no phone, no `note`.
- `"OrderStatusEvent"` gets RLS on, zero policies, zero grants — a browser must
  not be able to read it, exactly as with `"Order"`.
- `clerkUserId` is only ever read from `getViewer()`/`auth()` on the server. The
  anchor in the email URL is a fragment: it never reaches the server and cannot
  select somebody else's order.
- The re-declared `security definer` functions have `execute` revoked from
  `public`, `anon`, `authenticated` in the same file that creates them.
- The orders page keeps `robots: { index: false, follow: false }`.
- Nothing here logs a customer name, email or phone.

## Acceptance criteria

- [ ] An order placed while signed in shows a four-station rail with the PENDING
      station dated and the rest hollow.
- [ ] Setting PROCESSING then SHIPPED in `/admin` fills those stations with the
      dates the desk clicked, and sends the existing emails unchanged.
- [ ] Clicking "Track Your Order" in the shipped email opens the orders page in
      the order's own locale, scrolled to that order.
- [ ] A guest order's email CTA opens `/checkout/confirmed?order=…` instead.
- [ ] The newest order renders first and carries the "Latest Order" chip.
- [ ] A cancelled order shows the stations it reached and a halted final
      station — no greyed "Delivered".
- [ ] Arabic mirrors the rail and prints Arabic month names.
- [ ] Orders that existed before the migration render a rail from the backfill
      rather than an empty one.
- [ ] Re-running `npm run db:migrate` produces no duplicate events.
- [ ] A card order that clears stays PENDING; only `paymentStatus` becomes PAID.
- [ ] Setting PENDING at the desk sends the confirmation email.
- [ ] A cash order is PENDING on the desk and on the customer's rail, and the
      unpaid sweep leaves it alone.

## Checks to run

```
npm run db:migrate
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`.
2. Sign in, place a cash-on-delivery order, land on `/checkout/confirmed`.
3. Open `/account/orders` — new order on top, "Latest Order" chip, rail at
   "Order Placed".
4. In `/admin/orders`, move it to PROCESSING, then add a tracking code and set
   SHIPPED. Confirm the desk toast says the customer was notified.
5. Reload `/account/orders` — two more stations filled with today's date, the
   SHIPPED station ringed as current, tracking code printed below.
6. Open the shipped email (Resend dashboard or the dev log), click **Track Your
   Order**: it should open `/en/account/orders#KHEM-…` scrolled to that card.
7. Repeat 2–6 signed out with an `ar` locale: the CTA must open
   `/ar/checkout/confirmed?order=…`, and the Arabic portal rail must run
   right-to-left.
8. Cancel an order from the desk and confirm the rail halts.
