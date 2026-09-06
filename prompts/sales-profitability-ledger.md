# Sales & Profitability — the Items Sold ledger

Source brief: `src/docs/Sales-Profitability-Items-Sold-ledger.md`.

## Goal

A permanent, per-line record of everything KHEM has actually sold — what it was
worth before any benefit, what each benefit took off, what the customer actually
paid, what the goods cost the house, and the gross profit that leaves. Built
*beside* the existing order system, reading the same authoritative numbers, never
recomputing them.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) governs this
work directly; it is Postgres schema plus admin Server Components. The Supabase
conventions actually followed are the ones this repository already documents:
`supabase/README.md` (migrations, the PostgREST cache reload, the three security
invariants) and `supabase/sql/0015_orders.sql` (RLS on, no policy, secret key
only, aggregation in Postgres).

## Existing code inspected

- `supabase/sql/0015_orders.sql` — `Order`, `OrderItem`, `place_order()`,
  `restock_order()`, `set_order_status()`, `DailySales`, `ProductSales`,
  `daily_sales()`, `product_sales()`, `channel_split()`, the trust model.
- `supabase/sql/0016_checkout.sql` — payment method, address, locale,
  `settle_order_payment()`, `expire_unpaid_orders()`.
- `supabase/sql/0026`/`0027` — Discovery Credits, `credit_balances`,
  `credit_transactions`, `reverse_credit_redemption()`.
- `supabase/sql/0028_discounts.sql` — `discounts`, scopes,
  `discount_eligible_subtotal()`, `resolve_discount()`,
  `reverse_discount_redemption()`, the `"Order"."discount*"` columns.
- `supabase/sql/0035_marketing.sql` — `promotions`,
  `active_product_promotions`, `"OrderItem"."listPriceInCents"` and
  `"promotionId"`, the promotion-aware `discount_eligible_subtotal()`.
- `supabase/sql/0042_inventory_channels.sql` — `move_stock()`,
  `"InventoryMovement"`, the two counters.
- `supabase/sql/0050`/`0051` — payment authority, the forward-only status
  ladder, `set_order_payment_status()`.
- `supabase/sql/0058`–`0061` — `"BenefitSetting"`, points, offers, and the
  benefit ladder inside the current `place_order()`.
- `src/actions/checkout.ts` and `src/actions/admin/orders.ts` — the only two
  callers of `place_order()`; online and offline both go through it.
- `src/services/admin/analytics.ts`, `src/app/[locale]/admin/analytics/page.tsx`,
  `src/app/[locale]/admin/inventory/history/page.tsx` — the existing reporting
  screens and the filtered-table pattern to copy.
- `src/components/admin/{AdminShell,AdminTable,FilterChips,AdminSearch,MovementDateRange,ProductForm,fields}.tsx`.
- `src/schemas/admin.ts`, `src/schemas/db/admin.ts`, `src/schemas/db/orders.ts`,
  `src/actions/admin/catalog.ts`.
- `scripts/db-migrate.ts`, `scripts/db-verify.ts`, `scripts/db-dump.ts`,
  `scripts/db-seed.ts`, `scripts/db.ts`.

## Audit findings

1. **There is no Prisma.** `AGENTS.md` §9 prints a Prisma schema;
   `supabase/AGENTS.md` forbids Prisma outright and the repository has 61 SQL
   migrations applied in filename order by `npm run db:migrate`. The SQL files
   are the source of truth. This work adds `supabase/sql/0062_sales_ledger.sql`.
2. **`place_order()` is the single authority for what a customer pays**, for
   both channels. It has been re-declared by ten files; `0061` is current and
   carries the ladder: promotion (per line) → offer → coupon → points → credit
   (all four per order, each capped against what the previous one left).
3. **There is no cost/COGS field anywhere.** `Product` has `priceInCents` and
   nothing else about money going out.
4. **Line-level facts already exist**: `"OrderItem"."priceInCents"` (charged,
   post-promotion), `"listPriceInCents"` (pre-promotion, null when no campaign
   ran), `"promotionId"`, `productName` snapshot, `quantity`.
5. **Order-level benefit facts already exist**: `offerId` / `offerLabel` /
   `offerDiscountInCents`, `discountId` / `discountCode` / `discountInCents`,
   `pointsRedeemed` / `pointsInCents`, `creditId` / `creditAppliedInCents`.
   None of them is attributed to a line.
6. **Which unit an offer made free is computed but discarded.**
   `offer_value_of()` selects the reward units (cheapest first by default) and
   returns only their total plus the *first* slug. `offer_redemptions` keeps
   that one slug. Attribution therefore needs the selected set, not the sum.
7. **Refunds are whole-order.** `set_order_status()` moves an order to
   `CANCELLED`/`REFUNDED` and reverses stock, credits, discounts, offers and
   points. `PaymentStatus.REFUNDED` exists. There is **no partial refund**
   anywhere in the schema, so reporting can only distinguish sold / paid /
   refunded / cancelled at order granularity — which is what it will do.
8. **Channel already exists**: `"Order"."channel"` is `ONLINE` | `OFFLINE`.
   Nothing new is needed for §9 of the brief.
9. The existing `/admin/analytics` counts merchandise revenue at
   **charged** prices and excludes cancelled and refunded orders. The new
   screens must not contradict it.

## Decisions

- **New table `order_item_sales_ledger`**, one row per `"OrderItem"`, unique on
  `"orderItemId"`. Immutable snapshot; nothing updates a row after insert.
- **Status is not snapshotted.** A refund happens after the sale, so the row
  would go stale. The reporting view `"SalesLedgerRow"` joins `"Order"` for
  `status` / `paymentStatus` and derives `saleStatus`. This is the brief's
  "refer to the existing refund information rather than creating a competing
  refund engine".
- **Written from inside `place_order()`**, as its last statement, so it is the
  same transaction as the order and covers online and offline identically. An
  order that fails writes nothing.
- **Idempotent** by `order_item_sales_ledger_item_idx` (unique on
  `"orderItemId"`) plus `on conflict do nothing`.
- **Cost**: new nullable `"Product"."costInCents"`, admin-edited on the product
  form, snapshotted as `"unitCostInCents"` when a line is sold. Null means *not
  stated*, and every profit figure derived from it is null too — never zero.
- **Backfill leaves cost null**, always: no historical cost exists, and the
  brief forbids inventing one. The UI says "Cost unavailable".
- **Attribution** — how each benefit reaches a line:
  - *promotion*: already per line. `(listPrice − charged) × qty`.
  - *offer*: by the **actual reward units the offer selected**, not pro rata, so
    Buy 2 Get 1 shows the cheap bottle at `paid = 0`. Requires the selected set,
    so `offer_value_of()` is refactored to call a new
    `offer_reward_units()` — one implementation of the selection rule, two
    callers.
  - *coupon*: pro rata across the lines the coupon was **allowed** to touch.
    The eligibility predicate is lifted out of `discount_eligible_subtotal()`
    into `discount_eligible_order_items()`, and `discount_eligible_subtotal()`
    is re-declared to call it — again, one implementation.
  - *points* and *credit*: pro rata across every line, because neither is
    scoped in `place_order()`.
  - Every allocation is **largest remainder**, so the parts sum to the recorded
    order-level figure exactly and no piastre is invented or lost.
- **Shipping stays out.** `sum(paid)` over an order's ledger rows equals
  `"totalInCents" − "shipInCents"`, which is merchandise revenue — the same
  definition `DailySales` already uses.
- **New admin section "Sales & Analytics"** in the rail, holding the existing
  Analytics screen plus `/admin/sales` (overview + product performance) and
  `/admin/sales/items` (the Items Sold table). Orders is untouched; the order
  column on Items Sold links to the existing `/admin/orders/[orderNumber]`.

## Files that will change

New:

- `supabase/sql/0062_sales_ledger.sql`
- `supabase/tests/sales_ledger_scenarios.sql`
- `scripts/db-test-sales.ts`
- `src/types/sales.ts`
- `src/schemas/db/sales.ts`
- `src/services/admin/sales.ts`
- `src/lib/admin/sales.ts`
- `src/app/[locale]/admin/sales/page.tsx`
- `src/app/[locale]/admin/sales/items/page.tsx`

Edited:

- `src/components/admin/AdminShell.tsx` (two rail rows)
- `src/components/admin/ProductForm.tsx` (cost input)
- `src/schemas/admin.ts` (`costEgp`)
- `src/schemas/db/admin.ts` (`costInCents` column + row field)
- `src/actions/admin/catalog.ts` (map `costEgp` → `costInCents`)
- `scripts/db-dump.ts`, `scripts/db-seed.ts` (round-trip the cost)
- `scripts/db-verify.ts` (ledger invariants)
- `package.json` (`db:test:sales`)

## Implementation requirements

1. `0062_sales_ledger.sql` must be idempotent and re-runnable, like every file
   before it.
2. Re-declaring `place_order()` must **diff against `0061`** and keep every
   block — the file says so in its own header, and the promotion block has been
   lost once already. The only change is `perform public.record_sales_ledger(v_order_id);`
   before `return v_number;`.
3. `record_sales_ledger()` derives every figure from rows already written by
   the order transaction. It computes no price, resolves no discount, and calls
   no resolver.
4. Money is `int` piastres throughout. No floats anywhere.
5. Generated columns for anything derivable (`totalDiscountInCents`,
   `totalCostInCents`, `grossProfitInCents`, `isFree`, `discountSources`), so
   they cannot drift from their parts.
6. Margin is computed in the reporting layer with an explicit zero guard —
   never `x/0`.
7. Backfill runs at the end of the migration over every existing order, through
   the same function, so history and new sales are produced by one code path.
8. Services follow the house posture: `getSupabaseAdmin()`, explicit column
   lists, rows parsed with Zod, an empty projection and a logged message rather
   than a throw.
9. Pages are Server Components, `force-dynamic`, filters in the URL.
10. UI in the KHEM dashboard idiom — `AdminPageHeader`, `AdminTable`,
    `FilterChips`, `AdminSearch`, `MovementDateRange`, gold-on-obsidian, Cinzel
    headings, no bounce.

## Security requirements

- RLS enabled on `order_item_sales_ledger`, **no policy**, no grant to `anon`
  or `authenticated` — the row carries revenue and cost. Same posture as
  `"Order"`.
- The reporting view is `security_invoker = on` and revoked from the public
  roles, so it cannot be used to walk around the table's RLS.
- `execute` revoked from `public, anon, authenticated` on every new or
  re-declared function, and granted to `service_role` only. `place_order()` is
  `security definer`; a `create or replace` restores the default `public`
  grant, so the revoke must be restated in this file.
- Every new Server Component read sits behind the admin layout's
  `requireAdmin()`, and reads through the secret key only.
- `"Product"."costInCents"` is house-confidential. It must **not** be added to
  any storefront projection in `src/schemas/db/catalog.ts`.

## Acceptance criteria

- Every `"OrderItem"`, past and future, has exactly one ledger row.
- For every order, `sum(paidInCents) = totalInCents − shipInCents`.
- For every row, `originalLineTotal − totalDiscount = paid`, and no component
  is negative.
- A Buy 2 Get 1 order records the *cheapest* eligible unit at `paid = 0`,
  `isFree = true`, and the other lines at their full charged price.
- A coupon scoped to a collection attributes its whole value to lines in that
  collection and nothing to the others.
- Changing a product's price or name after a sale does not change the ledger
  row for that sale.
- Re-running `place_order()` logic or the backfill creates no duplicate row.
- Refunded and cancelled orders are excluded from revenue, cost and profit, and
  are reported separately.
- Offline (desk) orders appear in Items Sold with `channel = OFFLINE`.
- A product with no cost shows "Cost unavailable" rather than a zero.

## Checks to run

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run db:migrate`
- `npm run db:verify`
- `npm run db:test:sales` — the functional pricing scenarios, in a transaction
  that always rolls back.

## Manual test steps

1. `npm run db:migrate` — confirm the last line reads *"Schema applied.
   PostgREST schema cache reload signalled."*
2. `npm run db:verify` — confirm the new ledger assertions pass.
3. `npm run db:test:sales` — confirm all scenarios pass and the transaction
   rolls back.
4. `npm run dev`, sign in as an admin.
5. **Cost** — `/admin/products/<slug>`, set *Cost (EGP)* to `650`, save.
   Reopen and confirm it persisted.
6. **Normal sale** — `/admin/orders/new`, record an offline order for that
   product. Open `/admin/sales/items`: Original = price, Discount = 0,
   Paid = price, Cost = 650, Profit = paid − 650.
7. **Coupon** — place a storefront order with a 10% code. The row shows the
   coupon amount under Discount and a *Coupon* indicator.
8. **Promotion** — run a promotion, order the promoted product, confirm
   Original is the list price and Discount is the campaign's reduction.
9. **Buy 2 Get 1** — activate the offer, order three qualifying bottles,
   confirm the cheapest row reads `0` with a *Free* pill.
10. **Discovery Credit / Points** — redeem each and confirm the reduction is
    labelled separately from a coupon.
11. **Refund** — refund an order from `/admin/orders/<number>`; confirm its
    revenue leaves the overview totals and its rows read *Refunded*.
12. **Historical price** — change the product's price, reload
    `/admin/sales/items`, confirm the old row is unchanged.
13. **Drill-down** — click an order number and land on the existing order page.
