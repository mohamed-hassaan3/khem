# Admin — Unopened Order Tracking ("New" orders the desk has not looked at yet)

## Goal

The desk cannot tell which orders nobody has looked at yet. `status` answers
"what has been *done* to this order"; it does not answer "has a human at the
boutique ever opened it". A PENDING order that has been read three times and a
PENDING order that arrived ninety seconds ago look identical in the order book,
which is exactly the case the team needs to see.

Add a first-open record to `"Order"` and surface it in two places:

1. **`/admin` overview** — a tile counting orders that have **never been
   opened**, linking into the order book filtered to those rows.
2. **`/admin/orders`** — a `New` marker on every row whose order has never been
   opened, plus a filter chip row (`All` / `New` / `Opened`) so the desk can
   work through the untouched ones.

Opening `/admin/orders/[orderNumber]` claims the order as opened — once, by the
first admin who opens it. Nothing else in the dashboard or the storefront
changes.

## Non-goals

- No change to `status`, `paymentStatus`, the transition table, stock movement,
  emails, or anything a customer sees. "Opened" is desk telemetry, not order state.
- No rebuild of the dashboard, no new sections (`/admin/customers`,
  `/admin/discounts`, credits, newsletter, CMS, stockists, settings stay absent —
  they are separate pieces of work, out of scope here).
- Not a per-admin read receipt. One row = one first-open. A per-user seen table
  is a different feature and is not needed to answer "did anyone look at this".

## Skills read

- `.agents/skills/supabase` — migration shape, `security definer` function
  conventions, the privilege clawback pattern used by every file in
  `supabase/sql/`.
- `.agents/skills/clerk` — `requireAdmin()` already owns the boundary; the actor
  id written by this feature is the Clerk user id from `AdminActor.id`.
- `ai-sdk` does not apply.

## Existing code inspected

- `supabase/sql/0015_orders.sql` — `"Order"`, `"OrderItem"`, `place_order()`,
  `set_order_status()`. RLS on, **no policy**, no grant to `anon`/`authenticated`;
  every read goes through the secret key behind `requireAdmin()`.
- `supabase/sql/0016_checkout.sql` — the `alter table … add column if not exists`
  pattern this migration copies.
- `supabase/sql/0017_order_events.sql` — `"OrderStatusEvent"`, append-only trail.
- `supabase/sql/0022_order_feedback.sql` — `mark_feedback_requested(order_id)`:
  the **claim-once** idiom (`update … where "feedbackRequestedAt" is null` +
  `get diagnostics … row_count`) that `mark_order_opened` copies exactly.
- `src/schemas/db/orders.ts` — `ORDER_SUMMARY_COLUMNS`, `ORDER_DETAIL_COLUMNS`,
  `orderSummaryRowSchema`, `toAdminOrderSummary`.
- `src/types/order.ts` — `AdminOrderSummary`, `AdminOrderDetail`, `SalesTotals`.
- `src/services/admin/orders.ts` — `listAdminOrders`, `getAdminOrder`,
  `getAdminOrderById`, `countOpenOrders`, `OPEN_STATUSES`.
- `src/services/admin/analytics.ts` — `getSalesTotals()` composes `countOpenOrders()`.
- `src/actions/admin/orders.ts` — `requireAdmin()` first, Zod-parsed input,
  `postgresFailure`, actor-only logging (never customer PII).
- `src/app/[locale]/admin/page.tsx` — the four trade tiles + latest-orders table.
- `src/app/[locale]/admin/orders/page.tsx` — `FilterChips` for `status` and
  `channel`, `AdminTable` rows.
- `src/app/[locale]/admin/orders/[orderNumber]/page.tsx` — `force-dynamic`,
  `getAdminOrder(orderNumber)`, renders `<OrderStatusControl orderId=… />`.
- `src/components/admin/FilterChips.tsx` — link-based, carries other params across,
  supports an optional `count`.
- `src/components/admin/OrderStatusControl.tsx` — the `"use client"` +
  `useTransition` + `router.refresh()` pattern the new marker component follows.

## Decisions and assumptions

1. **Two columns on `"Order"`, not a new table.** "First opened" is a single
   nullable fact about one order, the same shape as `feedbackRequestedAt` and
   `stockReleasedAt`. A table would only earn its place if we tracked *every*
   view by *every* admin, which is explicitly not the goal.
2. **Claimed in SQL, once.** `mark_order_opened()` is `security definer` and
   updates only `where "firstOpenedAt" is null`, so two admins opening the same
   order in the same second produce one stamp and one owner — the same race the
   `for update` locks in `place_order()` exist to close.
3. **`updatedAt` is not touched.** It means "when this order's business state
   last changed". Reading an order is not a change, and moving it would make
   every unopened order look freshly edited on the desk.
4. **Marked from a client effect, not during render.** A Server Component render
   is a GET; writing during it is a mutation-in-render and would also fire on a
   prefetch. A small `"use client"` component calls the action once in
   `useEffect` after the page is actually on screen.
5. **The marker is not a status badge.** It renders beside the order number in
   the existing gold accent, so it cannot be confused with the `status` chip in
   the Status column.
6. **`firstOpenedBy` stores the Clerk user id**, never an email — same rule as
   the action logs. It is not rendered anywhere in this change; it exists so
   "who saw it first" is answerable later without a second migration.

## Files that will change

**New**
- `supabase/sql/0023_order_opened.sql`
- `src/components/admin/MarkOrderOpened.tsx`

**Edited**
- `src/types/order.ts` — `firstOpenedAt` on `AdminOrderSummary`; `unopened` on `SalesTotals`.
- `src/schemas/db/orders.ts` — column lists + `orderSummaryRowSchema`.
- `src/schemas/orders.ts` — `markOrderOpenedSchema`.
- `src/services/admin/orders.ts` — `seen` filter + `countUnopenedOrders()`.
- `src/services/admin/analytics.ts` — `unopened` in `getSalesTotals()`.
- `src/actions/admin/orders.ts` — `markOrderOpened()`.
- `src/app/[locale]/admin/page.tsx` — the tile.
- `src/app/[locale]/admin/orders/page.tsx` — chips + row marker.
- `src/app/[locale]/admin/orders/[orderNumber]/page.tsx` — mount the marker.

## Implementation requirements

### 1. `supabase/sql/0023_order_opened.sql`

Header comment in the voice of the neighbouring files: what the columns mean,
why they are not `status`, why the claim is a function and not an update, why
`updatedAt` is left alone, and the trust model (unchanged from 0015 — RLS on,
no policy, no public grant).

```sql
alter table public."Order"
  add column if not exists "firstOpenedAt" timestamptz,
  add column if not exists "firstOpenedBy" text
    check (char_length("firstOpenedBy") <= 120);

-- The order book's "New" filter and the overview tile: both ask only for rows
-- where the stamp is null, so the index carries only those rows.
create index if not exists order_unopened_idx
  on public."Order" ("placedAt" desc)
  where "firstOpenedAt" is null;
```

Backfill: **none.** Every order that exists before this file is genuinely
unopened as far as the record goes, and inventing a stamp would hide exactly the
rows the desk wants to see. Say so in a comment.

`mark_order_opened(order_id text, opened_by text) returns boolean`, `language
plpgsql`, `security definer`, `set search_path = public`. Body mirrors
`mark_feedback_requested`: update where `"firstOpenedAt" is null`, set both
columns (`opened_by` via `nullif(opened_by, '')`), `get diagnostics v_claimed =
row_count`, `return v_claimed = 1`. It must **not** write `"updatedAt"`.

Close with the privilege clawback:
`revoke all on function public.mark_order_opened(text, text) from public, anon, authenticated;`

The file must be re-runnable — `npm run db:migrate` applies every file on every deploy.

### 2. Types

- `AdminOrderSummary`: `firstOpenedAt: string | null` — "when someone at the
  desk first opened this order; null means nobody has."
- `SalesTotals`: `unopened: number`, documented like `awaitingFulfilment` — a
  state, not a window.

### 3. Schemas (`src/schemas/db/orders.ts`)

- Append `firstOpenedAt` to `ORDER_SUMMARY_COLUMNS`. `ORDER_DETAIL_COLUMNS`
  extends the summary shape, so add it there too and keep the two in step.
- `orderSummaryRowSchema`: `firstOpenedAt: z.string().nullable().default(null)`.
  The `.default(null)` matters — a deployment running ahead of the migration
  must degrade to "unopened", not blank the order screen.
- Do **not** add it to `customerOrderSchema`. It is desk-only.

### 4. `src/schemas/orders.ts`

`markOrderOpenedSchema = z.object({ orderId: z.string().min(1) })`, exported
beside the other order-action schemas.

### 5. `src/services/admin/orders.ts`

- `export type OrderSeenFilter = "new" | "opened";` and `seen?: OrderSeenFilter`
  on `OrderListFilter`.
- In `listAdminOrders`: `"new"` → `.is("firstOpenedAt", null)`; `"opened"` →
  `.not("firstOpenedAt", "is", null)`. Both are bound calls, not the
  string-built filter syntax `src/lib/admin/filter.ts` refuses.
- `countUnopenedOrders(): Promise<number>` — `head: true` count with
  `.is("firstOpenedAt", null)`, same failure shape as `countOpenOrders` (log,
  return 0).

### 6. `src/services/admin/analytics.ts`

Add `countUnopenedOrders()` to the existing `Promise.all` in `getSalesTotals`
and return it as `unopened`. Extend the existing comment about
`awaitingFulfilment` being a state rather than a window to cover both.

### 7. `src/actions/admin/orders.ts`

```ts
export async function markOrderOpened(input: unknown): Promise<AdminActionResult>
```

- `requireAdmin()` first statement — actor id is what gets stored.
- Parse with `markOrderOpenedSchema`; invalid input returns `ok: false` with a
  plain message (no field errors — there is no form).
- `supabase.rpc("mark_order_opened", { order_id, opened_by: actor.id })`.
- On error: `console.error` + `postgresFailure(error, "order")`.
- On success: `ok: true`. Log **only** when the claim actually landed
  (`data === true`) so re-renders do not spam the log; the line is
  `[admin] ${actor.email} opened ${orderId}` — no customer fields.
- No `revalidatePath`: every admin screen is `force-dynamic`.

### 8. `src/components/admin/MarkOrderOpened.tsx`

`"use client"`. Props: `{ orderId: string; alreadyOpened: boolean }`. Renders
`null`. A `useEffect` guarded by `alreadyOpened` and a `useRef` latch fires
`markOrderOpened({ orderId })` exactly once per mount, inside `startTransition`.
It ignores the result and never surfaces an error — a failed telemetry write
must not put a red toast in front of someone reading an order. Header comment
explains why this is an effect and not a call in the server render.

### 9. `/admin` overview tile

A fifth tile in the trade grid, which becomes `xl:grid-cols-5` (keep
`sm:grid-cols-2`; verify the row still reads at 360px and at `lg`):

- label `New · unopened`
- value `totals.unopened`
- note: `> 0` → `Nobody has opened these yet`; `0` → `Every order seen`
- href `${ordersPath}?seen=new`

In the **Latest orders** table, prefix the order number of any row with
`firstOpenedAt === null` with the same `New` marker used in the order book, so
the tile and the list agree.

### 10. `/admin/orders`

- `SEEN` values `["new", "opened"] as const`; read `query.seen` with the existing
  `readParam`, resolve with `.find()` so an unknown value filters by nothing.
- A third `FilterChips` row, `param="seen"`, chips
  `All` (`""`) / `New` / `Opened`. Pass `count` on the `New` chip from
  `countUnopenedOrders()` (fetch it alongside the list in one `Promise.all`).
- Row marker in the **Order** cell, under the order number beside the channel
  line, only when `order.firstOpenedAt === null`:

  ```tsx
  <span className="inline-block border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-gold">
    New
  </span>
  ```

  Give it `title="Nobody at the desk has opened this order yet"`.
- Empty-state copy must account for the new filter (`seen` set → "No orders
  match that filter.").

### 11. `/admin/orders/[orderNumber]`

Render `<MarkOrderOpened orderId={order.id} alreadyOpened={order.firstOpenedAt !== null} />`
once, near the page header. Nothing else on this page changes.

## Security requirements

- `requireAdmin()` is the first statement of `markOrderOpened`. A Server Action
  is a public endpoint and does not inherit the layout's gate.
- `orderId` is parsed before it reaches a query; the RPC binds both arguments.
- `mark_order_opened` is revoked from `public`, `anon`, `authenticated`. Only
  the secret-key client can call it. No RLS policy is added to `"Order"` — the
  table stays unreachable without the secret key.
- `firstOpenedBy` holds a Clerk user id. No email, name, phone, or note is
  written to a row or a log by this change.
- The action cannot change `status`, `paymentStatus`, money, or stock; it writes
  two columns and only when `"firstOpenedAt"` is null.
- Nothing here is exposed to the storefront or the customer portal — the column
  is absent from `customerOrderSchema`.

## Acceptance criteria

1. `npm run db:migrate` applies `0023` cleanly, and a second run is a no-op.
2. A freshly recorded order shows `New` in `/admin/orders` and is counted by the
   overview tile.
3. Opening that order's detail page clears the marker and decrements the tile on
   the next dashboard load.
4. Opening it a second time (or from a second admin account) does not change
   `firstOpenedAt` or `firstOpenedBy`.
5. `?seen=new` lists only unopened orders; `?seen=opened` only opened ones;
   both compose with `status` and `channel` without dropping either param.
6. An unknown `?seen=` value shows the full list rather than throwing.
7. Order status, payment, stock, emails, and the customer portal's order rail
   are byte-for-byte unchanged in behaviour.
8. `"Order"."updatedAt"` does not move when an order is opened.
9. Existing orders placed before the migration appear as `New` — none are
   silently backfilled as seen.
10. No `any`; strict TypeScript passes; the dashboard reads correctly at 360px,
    768px, and 1440px.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run db:migrate` (twice, to prove idempotence)
- `npm run build` if the two above are clean

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`; sign in as an allowlisted admin.
2. Open `/admin` — note the `New · unopened` figure (it will count every
   pre-existing order on first run).
3. `/admin/orders` → confirm every row carries the `New` marker and the `New`
   chip count matches the tile.
4. `/admin/orders/new` → record a sale. Return to `/admin/orders`: the new order
   is at the top, marked `New`, and both counts went up by one.
5. Open that order. Go back to `/admin/orders` — its marker is gone; the tile and
   the chip count are down by one.
6. Reload the order detail page twice, then check the row in
   `/admin/orders?seen=opened` — it is listed there and not under `?seen=new`.
7. Combine filters: `/admin/orders?status=PENDING&seen=new` — chips for both stay
   active and the list respects both.
8. Hand-edit the URL to `?seen=banana` — the full list renders, no error.
9. As a signed-out visitor, hit `/admin/orders` — 404, unchanged.
10. Visit `/account` as the customer who placed an order — the status rail is
    unchanged and shows no mention of "opened".
