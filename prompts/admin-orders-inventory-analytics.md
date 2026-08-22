# Admin — Orders, Inventory & Sales Analytics

## Goal

Turn the Boutique Desk from a catalog/journal editor into an operating desk: record and manage
**orders**, hold a single authoritative **online stock** number per product that moves by itself when
an order is placed, and read **sales charts** (lightweight-charts) that join orders to products.

The website is the only sales channel that owns stock. Physical branches are not modelled: an order
may be marked as having come in offline, but every order draws from the same website inventory.

## Skills read

- `AGENTS.md` (root) — §3 design tokens, §6 stack, §7 structure, §9 schema vocabulary, §12 checklist.
- `prisma/AGENTS.md` — data layer policy: service layer is the only DB caller, explicit column lists,
  parse-don't-assert, no write grants to `anon`/`authenticated`.
- `.agents/skills/supabase` — SQL/migrations, service-role usage, RLS.
- Existing project patterns for Zod, Tailwind v4, Next.js App Router (no new skills invented).

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/app/[locale]/admin/page.tsx` | Dashboard: `force-dynamic`, `AdminPageHeader`, `Tile` grid, warning panel pattern. |
| `src/app/[locale]/admin/layout.tsx` | `requireAdmin()` gate, English-only tree, `robots: noindex`. |
| `src/components/admin/AdminShell.tsx` | `SECTIONS` rail array — new sections are added here. |
| `src/components/admin/AdminTable.tsx` | `AdminPageHeader`, `AdminLinkButton`, `AdminTable/Row/Cell/Status/Empty`. |
| `src/components/admin/ProductForm.tsx` | `AdminInput` "Stock" field already writes `inventory`. |
| `src/components/admin/fields.tsx` | Field primitives every admin form uses. |
| `src/services/admin/catalog.ts` | Admin reads via `getSupabaseAdmin()`, `logFailure`, `parseList`, `[]`/`null` on error. |
| `src/actions/admin/catalog.ts` | `"use server"`, `requireAdmin()` first statement, Zod parse, `AdminActionResult`, revalidate. |
| `src/actions/admin/shared.ts` | `UNCONFIGURED`, `fieldErrorsFrom`, `postgresFailure`. |
| `src/lib/admin/revalidate.ts` | Both locales, paths from `src/lib/routes.ts`. |
| `src/services/account.ts` | Honest empty seam: `getOrdersForUser` returns `[]` because no `Order` table exists. |
| `src/types/account.ts` | `OrderStatus`, `OrderSummary`, `OrderLine`, `SavedAddress` already defined. |
| `supabase/sql/0001_catalog.sql` | `Product.inventory int not null default 0 check (inventory >= 0)`. |
| `supabase/sql/0006_privileges.sql` | `anon`/`authenticated` hold `select` only; writes go through the secret key. |
| `src/components/ecommerce/ProductPurchase.tsx` | Low-stock label already exists; `LOW_STOCK_THRESHOLD = 6` is a local constant. |
| `src/lib/cart.ts` | `MAX_QUANTITY_PER_LINE`, piastre arithmetic, `quantityCeiling` ceiling for the stepper. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `product.soldOut` / `inStock` / `lowStock: "Only {count} remaining"`. |
| `package.json` | No Prisma, no charting library. Supabase JS + `pg` scripts only. |

## Decisions & assumptions

1. **No Prisma.** Root `AGENTS.md` §9 names Prisma, but the repository has none installed and every
   read goes through `supabase-js` with SQL in `supabase/sql/`. This follows the code, and adds
   `supabase/sql/0015_orders.sql`. `prisma/AGENTS.md` §17 (Open Decisions) is where the divergence
   already lives; no Prisma dependency is introduced by this task.
2. **Stock is website-only and single-valued.** No `Branch`/`ProductStock` tables. `Product.inventory`
   stays the one number; the storefront, the admin, and the order flow all read and move that column.
3. **Inventory moves in the database, not in TypeScript.** Placing an order runs a Postgres function
   (`public.place_order`) that inserts the order and its items, locks each product row, checks stock,
   and decrements `inventory` — one transaction. Two admins recording the last unit at the same
   moment must not both succeed; a `select` then `update` from Node cannot promise that.
4. **Cancel/refund restores stock; delivery does not.** Moving an order to `CANCELLED` or `REFUNDED`
   returns its units via `public.restock_order`, once — guarded by a `stockReleasedAt` column so a
   double status flip cannot inflate stock.
5. **`channel` records provenance only** (`ONLINE` | `OFFLINE`). Both draw from the same inventory.
   Offline orders are the ones an admin types in; `ONLINE` is reserved for checkout when it ships.
6. **Low-stock threshold becomes 3** (user's number) and moves out of `ProductPurchase.tsx` into
   `src/lib/inventory.ts` so the admin and the storefront agree on what "low" means.
7. **`lightweight-charts` is client-only** (canvas, needs `window`), so every chart lives in a
   `"use client"` component that receives already-aggregated, serialisable points from the server.
   No data fetching happens in the chart.
8. **Aggregation happens in Postgres**, in SQL views/RPC, not by pulling every order into Node.
9. **Currency.** Amounts are stored in piastres (`totalInCents` etc.), matching `Product.priceInCents`
   and `src/lib/currency.ts`. Charts plot EGP (major units) on the price scale.
10. **Prices are captured at sale time** into `OrderItem.priceInCents`; later catalog edits never
    rewrite history.
11. **Admin surface stays English** per the layout's documented rule. Only the storefront strings
    (low-stock label) touch dictionaries, and both `en` and `ar` are updated together.
12. **`src/services/account.ts` is filled in** for `getOrdersForUser`/`getAccountSummary` now that the
    table exists — the file's own comment says migrating means replacing a function body.

## Files likely to change

**New — database**
- `supabase/sql/0015_orders.sql` — enums, `Order`, `OrderItem`, indexes, RLS, `place_order`,
  `restock_order`, `set_order_status`, and the reporting views.

**New — types & schemas**
- `src/types/order.ts` — `OrderChannel`, `PaymentStatus`, `AdminOrder`, `AdminOrderLine`, analytics point types.
- `src/schemas/db/orders.ts` — column lists + row parsers (`toAdminOrder`, `toAdminOrderLine`, `toSalesPoint`, `toProductSalesRow`).
- `src/schemas/admin/orders.ts` (or additions to `src/schemas/admin.ts`) — `createOrderSchema`,
  `updateOrderStatusSchema`, `adjustInventorySchema`.

**New — services**
- `src/services/admin/orders.ts` — `listAdminOrders`, `getAdminOrder`, `countOrdersByStatus`.
- `src/services/admin/analytics.ts` — `getSalesSeries`, `getRevenueTotals`, `getTopProducts`,
  `getChannelSplit`, `listInventoryRows`, `countLowStock`, `countOutOfStock`.

**New — actions**
- `src/actions/admin/orders.ts` — `createOrder`, `updateOrderStatus`, `updatePaymentStatus`.
- `src/actions/admin/inventory.ts` — `adjustInventory`.

**New — components**
- `src/components/admin/charts/ChartFrame.tsx` — `"use client"`, shared lightweight-charts setup
  (theme options, resize observer, teardown).
- `src/components/admin/charts/RevenueChart.tsx` — area series, revenue per day.
- `src/components/admin/charts/UnitsChart.tsx` — histogram series, units sold per day.
- `src/components/admin/charts/TopProductsBars.tsx` — CSS bars (not a chart lib; a ranked list).
- `src/components/admin/OrderForm.tsx` — `"use client"` offline order capture with a product line builder.
- `src/components/admin/OrderStatusControl.tsx` — status/payment transitions.
- `src/components/admin/InventoryEditor.tsx` — inline stock edit per row.
- `src/components/admin/RangeTabs.tsx` — 7 / 30 / 90-day range switch (URL search param).

**New — routes**
- `src/app/[locale]/admin/orders/page.tsx` — list with status/channel/range filters.
- `src/app/[locale]/admin/orders/new/page.tsx` — record an offline sale.
- `src/app/[locale]/admin/orders/[orderNumber]/page.tsx` — detail: lines, customer, totals, transitions.
- `src/app/[locale]/admin/inventory/page.tsx` — stock table, low/out-of-stock first, inline edit.
- `src/app/[locale]/admin/analytics/page.tsx` — full charts view (revenue, units, top products, channel split).

**Modified**
- `src/app/[locale]/admin/page.tsx` — add an Orders & Revenue tile row, a revenue chart block, a
  low-stock panel, and a recent-orders table beneath the existing catalog tiles.
- `src/components/admin/AdminShell.tsx` — `SECTIONS` gains Orders, Inventory, Analytics.
- `src/lib/admin/revalidate.ts` — `revalidateStock(slugs)` for paths a stock change makes stale.
- `src/lib/inventory.ts` (new) — `LOW_STOCK_THRESHOLD = 3`, `stockState(inventory)`.
- `src/components/ecommerce/ProductPurchase.tsx` — import the shared constant, drop the local `6`.
- `src/services/account.ts` — real queries for `getOrdersForUser`, `getAccountSummary`.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — only if a storefront string changes.
- `package.json` — `lightweight-charts` dependency.
- `supabase/README.md` — the new migration listed in order.

## Implementation requirements

### 1. Migration — `supabase/sql/0015_orders.sql`

Idempotent in the style of the existing files (`create ... if not exists`, `do $$ ... exception when duplicate_object`).

Enums:
- `public."OrderStatus"` — `PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED` (exactly the
  members of `OrderStatus` in `src/types/account.ts` — the dictionary is keyed by them).
- `public."PaymentStatus"` — `UNPAID, PAID, FAILED, REFUNDED`.
- `public."OrderChannel"` — `ONLINE, OFFLINE`.

`public."Order"`:
- `id text primary key` (uuid text, generated app-side like other tables), `orderNumber text not null unique`
  in the form `KHEM-YYYY-NNNN` — generated by a sequence-backed default or by `place_order`, never by the client.
- `customerName text not null`, `customerEmail text`, `customerPhone text`, `clerkUserId text` (null for
  offline walk-ins), `note text`.
- `status public."OrderStatus" not null default 'PENDING'`,
  `paymentStatus public."PaymentStatus" not null default 'UNPAID'`,
  `channel public."OrderChannel" not null default 'OFFLINE'`.
- `subtotalInCents int not null check (>= 0)`, `shipInCents int not null default 0`,
  `totalInCents int not null check (>= 0)`.
- `stockReleasedAt timestamptz` — set once when stock is returned; the double-restock guard.
- `placedAt timestamptz not null default now()`, `createdAt`, `updatedAt`.
- Indexes on `(placedAt desc)`, `(status)`, `(channel, placedAt desc)`, `(clerkUserId)`.

`public."OrderItem"`:
- `id text primary key`, `orderId text not null references "Order"(id) on delete cascade`,
  `productSlug text not null references "Product"(slug) on update cascade` (slug is the join key the
  rest of the schema uses), `productName text not null` (a snapshot, so a renamed or archived product
  still prints), `quantity int not null check (quantity > 0)`, `priceInCents int not null check (>= 0)`.
- Index on `(orderId)` and `(productSlug)`.

`public.place_order(payload jsonb) returns text` (`security definer`, `set search_path = public`):
- Parses `{ customerName, customerEmail, customerPhone, channel, note, shipInCents, items:[{ slug, quantity }] }`.
- `select ... for update` on every referenced product, ordered by slug (deterministic lock order, no deadlock).
- Raises a clear exception when a product is missing/archived, or when `quantity > inventory`
  (message naming the product and the units available — the action turns it into a field error).
- Prices each line from the current `Product.priceInCents`, computes subtotal and total.
- Inserts `Order` + `OrderItem` rows, decrements `Product.inventory`, returns the `orderNumber`.

`public.restock_order(order_id text) returns void` — adds each line's quantity back to
`Product.inventory` and stamps `stockReleasedAt`; a no-op when `stockReleasedAt` is already set.

`public.set_order_status(order_id text, next public."OrderStatus") returns void` — updates status,
calls `restock_order` when `next in ('CANCELLED','REFUNDED')`, bumps `updatedAt`.

Reporting (views, so the aggregation is Postgres's job):
- `public."DailySales"` — `day date, orderCount int, units int, revenueInCents bigint, channel`.
  Excludes `CANCELLED` and `REFUNDED` orders from revenue.
- `public."ProductSales"` — `productSlug, productName, units, revenueInCents, lastSoldAt`.

Security:
- `alter table ... enable row level security` on both tables, **no policies and no grants** to
  `anon`/`authenticated` — the dashboard reaches them with the secret key only, which is what
  `0006_privileges.sql` argues for. Revoke `execute` on the three functions from `anon`/`authenticated`.
- Head-comment the trust model the way `0005_comments.sql` does.

### 2. Services

- `getSupabaseAdmin()`, explicit column lists, never `select("*")`.
- Every function returns `[]`/`null`/`0` on failure after `logFailure(...)`; nothing throws into a page.
- Rows are parsed through Zod (`parseList`, `toAdminOrder`, …), never asserted.
- `getSalesSeries(days, channel?)` returns `{ time: "YYYY-MM-DD"; value: number }[]` **already
  gap-filled** — lightweight-charts needs ascending unique dates, and a missing day should read as
  zero, not as a straight line between two peaks.
- `listInventoryRows()` returns slug, name, sku, inventory, price, collection, `unitsSoldLast30Days`,
  ordered out-of-stock first, then low, then the rest.

### 3. Actions

- `"use server"`, `requireAdmin()` as the **first statement** of every export, Zod parse before any query.
- Return `AdminActionResult` shaped exactly like `src/actions/admin/catalog.ts`.
- `createOrder` calls the `place_order` RPC; an insufficient-stock exception becomes a readable field
  error on that line, not a 500.
- Status changes call `set_order_status`; the transition set is validated in Zod (no `DELIVERED → PENDING`).
- `adjustInventory` writes an absolute value (an admin correcting a count), clamped `>= 0`.
- Every write revalidates the affected storefront paths in **both locales** via `src/lib/admin/revalidate.ts`.
- Log actor + action + order number. Never a customer's contact details, never a key.

### 4. Charts (`lightweight-charts`)

- `npm i lightweight-charts` — verify the installed major version's API against
  `node_modules/lightweight-charts/` before writing code (v5 uses `chart.addSeries(AreaSeries, opts)`,
  v4 uses `chart.addAreaSeries(opts)`). **Read the installed package; do not write from memory.**
- `ChartFrame` is the only module importing the library:
  - `"use client"`, creates the chart in `useEffect`, disposes with `chart.remove()` on unmount.
  - `ResizeObserver` → `chart.applyOptions({ width })`; fixed height per chart, so no layout shift.
  - Theme: transparent background, `#f7f4ec` at low opacity for text, `rgba(255,255,255,0.06)` grid,
    gold `#c8a96a` series line, champagne-to-transparent area gradient, `borderVisible: false`,
    `timeScale.borderVisible: false`, crosshair in gold at 1px, no default watermark.
  - Tooltip/legend text uses `font-heading` micro-caps consistent with the rest of the desk.
  - Renders an empty state (a centred `No sales recorded in this range.` line) instead of an axis-only
    chart when the series is empty.
- Data crosses the server/client boundary as a plain array of `{ time, value }`. No fetching in the client.

### 5. Dashboard (`src/app/[locale]/admin/page.tsx`)

Keep the existing header, catalog tiles, and embedding warning. Add, in order:
1. **Trade tiles** — Revenue (30d, formatted EGP), Orders (30d), Units sold (30d), Awaiting fulfilment
   (`PENDING + PROCESSING`, linking to the filtered order list).
2. **Revenue chart block** — `RevenueChart` with a 7/30/90 `RangeTabs` (search param, server-read).
3. **Low-stock panel** — same visual language as the existing embedding warning, listing products at
   or below the threshold and those at zero, linking to `/admin/inventory`.
4. **Recent orders** — the five newest, using `AdminTable`, each row linking to its detail page.

All reads stay in one `Promise.all`; the page stays `force-dynamic`.

### 6. Inventory page

Table of every non-archived product: name, SKU, collection, price, units sold (30d), stock state chip
(`Out of stock` danger / `Low` warning / `In stock` muted), and an inline number input that saves via
`adjustInventory`. Sort: out of stock, then low, then the rest by name. Filter chips for
`All / Low / Out of stock` driven by search params, matching `src/lib/admin/filter.ts`.

### 7. Storefront consequence

`src/lib/inventory.ts` exports `LOW_STOCK_THRESHOLD = 3` and `stockState()`. `ProductPurchase.tsx`
imports it and deletes its local constant, so a product with 1–2 units shows
`Only {count} remaining` and 3+ shows the `inStock` line. No dictionary keys are added — both
already exist in `en` and `ar`.

## Security requirements

- `requireAdmin()` is the first statement of every action; the layout gate is never treated as sufficient.
- No new grant or RLS policy for `anon`/`authenticated` on `Order`/`OrderItem`. Both are secret-key only.
- `execute` on `place_order` / `restock_order` / `set_order_status` revoked from `anon`/`authenticated`.
- All inputs Zod-parsed server-side; the client form's validation is a convenience, not the check.
- Stock decrement happens under a row lock inside the RPC — never read-modify-write from Node.
- Customer contact details are never logged and never rendered outside `/admin`.
- `clerkUserId` is only ever written from a verified session, never from a form field.
- The admin tree remains `robots: noindex` (inherited from the layout).
- No secret ever reaches a client component; charts receive numbers only.

## Acceptance criteria

- [ ] `supabase/sql/0015_orders.sql` applies cleanly on a fresh database and is re-runnable.
- [ ] Recording an offline order at `/admin/orders/new` creates the order and reduces each product's
      stock by the quantity sold, visible on `/admin/inventory` and on the storefront after revalidation.
- [ ] Ordering more units than are in stock fails with a message naming the product and the units
      available; no order row and no stock change is left behind.
- [ ] Cancelling or refunding an order returns its units exactly once; flipping status again does not.
- [ ] Charts render real series from `DailySales`, resize with the panel, and show an empty state
      rather than a bare axis when a range has no sales.
- [ ] A product at 0 reads `Sold Out`; at 1–2 reads `Only N remaining`; at 3+ reads the `inStock` line —
      in both `en` and `ar`.
- [ ] `/account/orders` shows a signed-in customer's real orders (and remains empty for a walk-in
      order with no `clerkUserId`).
- [ ] No `any`; every DB row parsed, not asserted; every service failure returns an empty projection.
- [ ] Visual language matches the desk: obsidian surfaces, `border-border`, gold accents, `font-heading`
      micro-caps, `cubic-bezier(0.16,1,0.3,1)` transitions, no bounce.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run db:verify   # after applying the migration
```

## Manual test steps

1. Apply the migration (`npm run db:migrate`), then `npm run dev` and sign in as an admin.
2. Open `/admin` — trade tiles read zero, the revenue chart shows its empty state, no low-stock panel
   if every product has stock.
3. `/admin/inventory` — set a known product's stock to `5`, save, confirm the row updates.
4. `/admin/orders/new` — record an offline order for that product, quantity `1`. Expect a redirect to
   the order detail page with a `KHEM-YYYY-NNNN` number.
5. `/admin/inventory` — that product now reads `4`.
6. Repeat step 4 with quantity `99` — expect an inline error naming the product and `4` available, and
   no new order in the list.
7. Sell down to `2` and open the product's storefront page — the stock line reads `Only 2 remaining`;
   check `/ar/...` for the Arabic equivalent.
8. Sell the last `2` — the PDP reads `Sold Out` and the add-to-cart is disabled.
9. `/admin/orders` — open an order, set it to `CANCELLED`; inventory returns to `2`. Set it to
   `REFUNDED` as well — inventory stays `2`.
10. `/admin` — the revenue chart now plots the recorded days; switch 7 / 30 / 90 and confirm the series
    and the tiles change together. Resize the window and confirm the chart follows without layout shift.
11. `/admin/analytics` — top products lists the product sold, channel split shows the offline share.
12. Sign in as a customer whose Clerk id was attached to an order and open `/account/orders`.
