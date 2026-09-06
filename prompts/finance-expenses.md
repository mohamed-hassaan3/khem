# Finance & Expenses — operating costs, targets, and the net result

Source brief: `src/docs/Finance-Expenses.md`.

## Goal

Answer five questions on one screen, for any period:

> How much did we sell? What did the products cost us? What did we spend running
> the business? What did we actually make? Did we reach our target?

The first two are already answered — by `order_item_sales_ledger` and the
`"SalesLedgerRow"` view. This work adds only the third (an expense ledger), the
fifth (monthly targets), and the arithmetic that joins them:

```
Actual Revenue − COGS            = Gross Profit     ← already exists, unchanged
Gross Profit  − Operating Expenses = Net Profit     ← new, and the only new maths
```

Nothing here prices an order, resolves a benefit, reads a balance, or writes a
sales row. Finance **consumes** the sales ledger and adds one ledger of its own.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) governs this
work — it is Postgres schema plus admin Server Components, with no auth change
and no model call. The conventions actually followed are the repository's own:
`supabase/README.md` (migration order, the PostgREST cache reload, the three
security invariants), `supabase/sql/0060_offers.sql` (a modern snake_case table
with quoted camelCase columns, enums via `do $$ … exception when
duplicate_object`, RLS + explicit grants), and
`supabase/sql/0062_sales_ledger.sql` (snapshots over joins, aggregation in
Postgres, null-not-zero for unknown money).

## Existing code inspected

**Database**

- `supabase/sql/0062_sales_ledger.sql` — `order_item_sales_ledger`, the
  `"SalesLedgerRow"` view, `sales_ledger_summary()`,
  `sales_ledger_by_product()`, `record_sales_ledger()`, the re-declared
  `place_order()`, `"Product"."costInCents"`, the backfill, RLS and grants.
- `supabase/sql/0015_orders.sql` — `"Order"` (`subtotalInCents`, `shipInCents`,
  `totalInCents`, `placedAt`, `channel`, `status`, `paymentStatus`),
  `"OrderItem"`, `place_order()`, `set_order_status()`, `daily_sales()`.
- `supabase/sql/0016_checkout.sql`, `0050_payment_authority.sql`,
  `0051_retire_pending.sql` — where payment status actually changes.
- `supabase/sql/0053_delivery_terms.sql` — `"DeliverySetting"."feeInCents"`,
  the delivery fee **charged to the customer**.
- `supabase/sql/0026`–`0028`, `0059`, `0060`, `0061` — credits, discounts,
  rewards, offers, the benefit ladder. Read to confirm none of them is touched.
- `supabase/sql/0060_offers.sql` — the table/enum/RLS/grant conventions copied.

**TypeScript**

- `src/types/sales.ts`, `src/schemas/db/sales.ts`, `src/services/admin/sales.ts`,
  `src/lib/admin/sales.ts` — the shapes, parsers, reads and window maths this
  work reuses rather than restates.
- `src/services/admin/analytics.ts`, `src/app/[locale]/admin/analytics/page.tsx`
  — gap-filled series and the `ChartPanel` + `SalesChart` pattern.
- `src/app/[locale]/admin/sales/page.tsx`, `src/app/[locale]/admin/sales/items/page.tsx`
  — the tile grid, filter chips, date range, and the "cost unavailable" posture.
- `src/actions/admin/offers.ts`, `src/actions/admin/shared.ts` — the Server
  Action shape: `requireAdmin()` first, Zod parse, `getSupabaseAdmin()`,
  mapped Postgres failure, `AdminActionResult`.
- `src/schemas/offers.ts`, `src/schemas/admin.ts` — Zod conventions.
- `src/components/admin/{AdminShell,AdminTable,FilterChips,MovementDateRange,SalesFigure,SalesPeriodTabs,OfferForm,fields}.tsx`,
  `src/components/admin/charts/{ChartPanel,SalesChart,TopProductsBars,RangeTabs}.tsx`.
- `src/lib/admin/{auth,money,revalidate,filter}.ts`.
- `scripts/db-migrate.ts`, `scripts/db-verify.ts`, `scripts/db-test-sales.ts`,
  `supabase/tests/sales_ledger_scenarios.sql`, `scripts/db-dump.ts`.

## Audit findings

1. **There is no Prisma.** `AGENTS.md` §9 prints a Prisma schema; the repository
   has 62 SQL files applied in filename order by `npm run db:migrate`. This work
   adds `supabase/sql/0063_finance.sql` and touches no existing SQL file.
2. **Sales & Profit is already the source of truth and needs no change.**
   `"SalesLedgerRow"` gives, per sold line: `paidInCents` (merchandise only),
   `totalCostInCents`, `grossProfitInCents`, `countsAsRevenue` (false for
   cancelled/refunded), `channel`, `soldAt`. Finance reads this view and the two
   existing RPCs. **No new pricing, discount, refund or COGS logic is written.**
3. **Refunds are already handled and stay that way.** `saleStatus` and
   `countsAsRevenue` are derived in the view from the order's *current* status,
   not snapshotted, so `set_order_status()` remains the only refund authority.
   Every Finance figure filters on `countsAsRevenue`.
4. **Online and offline are both covered**, because both go through
   `place_order()`, which writes the ledger. Finance inherits the channel filter.
5. **Cost may be unknown, and the codebase already has a posture for it.**
   `unitCostInCents` is null when the desk never stated one; the summary returns
   `costInCents`/`profitInCents` as **null** rather than zero, plus
   `costedRevenueInCents` and `linesMissingCost`. Finance keeps exactly this
   posture: an unknown gross profit makes net profit unknown, and the screen says
   so instead of printing a number it cannot support.
6. **§14 — payment and shipping.** `"Order"."shipInCents"` is delivery *charged
   to the customer*; the ledger deliberately excludes it, so Finance revenue is
   merchandise revenue only. There is **no** column anywhere for shipping *cost*
   or for payment-processing fees — `StripeWebhookEvent` stores events, not fees.
   Therefore: those two costs are recorded as **expenses** (the shipped
   categories include *Bank / Payment Fees*, and categories are admin-manageable
   so a courier-cost category can be added), and nothing is estimated. The
   dashboard states this in one line rather than leaving it to be discovered.
7. **Money is piastres (integer minor units) throughout**, rendered by
   `egp()` / `egpCompact()`. Every new column follows it. No floats, no stored
   percentages — every margin is derived at print time behind a zero guard.
8. **Dates are UTC**, per `src/lib/admin/sales.ts`. Finance uses UTC calendar
   months so its "September" is the same September the sales screen shows.
9. **Naming.** New tables are snake_case with quoted camelCase columns, matching
   `offers` and `order_item_sales_ledger`.
10. **Revalidation is not needed.** Finance has no public surface; every route is
    `force-dynamic` behind `requireAdmin()`. Nothing is added to
    `src/lib/admin/revalidate.ts`.

## Decisions and assumptions

- **Expenses are recorded against a `date`, not a timestamp.** An expense belongs
  to a day in the books, not to an instant. `incurredOn date` is the period key
  for every report.
- **Category names are snapshotted onto the expense row** (`categoryName`,
  `categoryGroup`) alongside the foreign key. §15/§17: renaming *Rent* to
  *Premises* must not rewrite September's breakdown. Reports read the snapshot;
  the key exists for filtering and editing.
- **Recurring expenses generate real rows, once per period.** A rule
  (`expense_recurring_rules`) plus generated `expenses` rows carrying
  `("recurringRuleId", "periodKey")` under a **unique index** — that index is the
  whole of "without creating duplicate records". The amount is copied onto the
  row at generation; changing the rule later moves future periods only, never a
  closed one (§4, §17).
- **Generation is idempotent and runs on read.** `generate_recurring_expenses()`
  is called once by the Finance dashboard service (a single RPC, `on conflict do
  nothing`) and is also exposed as an explicit action. It never generates beyond
  `current_date`, so no future month is pre-filled.
- **Status is `PENDING` / `PAID` / `VOID`.** Operating Expenses counts everything
  that is not `VOID` (accrual — an unpaid October rent is still October's cost);
  the dashboard shows the unpaid share separately. **Void, never delete**, for
  anything that has been reported on; a hard delete exists only for a row created
  by mistake and is a distinct, confirmed action.
- **Targets are one row per month**, three independent nullable amounts
  (revenue, gross profit, net profit), keyed by the first day of the month.
- **Net profit is null when gross profit is null.** Gross profit is the profit of
  the *costed* lines; when nothing in the window carries a cost, both read "—"
  with the count of uncosted lines beside them. Expenses are still exact.
- **`src/lib/admin/sales.ts` is imported, not duplicated.** `parseIsoDate`,
  `SalesWindow`, `marginPercent`, `formatMargin` are reused as they are. Finance
  adds only the periods the brief asks for that sales does not have (yesterday,
  previous month) in its own module.
- **A new chart component rather than a change to `SalesChart`.** The Finance
  charts need two or three series and a target price line;
  `charts/SalesChart.tsx` is used by `/admin/analytics` and is left untouched.
- **No new dependency.** lightweight-charts and lucide-react are already here.

## Proposed schema — `supabase/sql/0063_finance.sql`

Four tables, three enums, five functions. Nothing existing is altered.

```
enum "ExpenseGroup"   OPERATIONS | PEOPLE | BUSINESS | MARKETING | PRODUCTION | OTHER
enum "ExpenseStatus"  PENDING | PAID | VOID
enum "ExpenseCadence" MONTHLY | YEARLY

expense_categories
  id text pk                      -- slug: 'rent', 'salaries'
  name text not null unique
  "group" "ExpenseGroup" not null
  "sortOrder" int not null default 0
  "isSystem" boolean not null default false   -- shipped default; archivable, not deletable
  "isArchived" boolean not null default false
  "createdAt" / "updatedAt"

expense_recurring_rules
  id text pk
  name text not null
  "categoryId" text references expense_categories(id) on update cascade
  "amountInCents" int not null check >= 0
  cadence "ExpenseCadence" not null
  "startsOn" date not null          -- its day-of-month drives each occurrence, clamped
  "endsOn" date                     -- null = open-ended
  vendor text, notes text
  "isActive" boolean not null default true
  "createdBy"/"createdAt"/"updatedBy"/"updatedAt"

expenses
  id text pk
  name text not null
  "categoryId" text references expense_categories(id) on update cascade
  "categoryName" text not null       -- snapshot §15/§17
  "categoryGroup" "ExpenseGroup" not null
  "amountInCents" int not null check >= 0
  "incurredOn" date not null
  status "ExpenseStatus" not null default 'PENDING'
  vendor text, reference text, notes text
  "recurringRuleId" text references expense_recurring_rules(id) on delete set null
  "periodKey" text                   -- 'YYYY-MM' | 'YYYY' for generated rows
  "isRecurring" boolean generated always as ("recurringRuleId" is not null) stored
  "createdBy"/"createdAt"/"updatedBy"/"updatedAt"/"voidedAt"
  unique ("recurringRuleId","periodKey")   -- the anti-duplication guarantee
  indexes on ("incurredOn" desc), ("categoryId"), (status)

financial_targets
  id text pk
  "periodMonth" date not null unique    -- first of the month, UTC
  "revenueTargetInCents" int check >= 0
  "grossProfitTargetInCents" int check >= 0
  "netProfitTargetInCents" int check >= 0
  notes text
  "createdBy"/"createdAt"/"updatedBy"/"updatedAt"
```

Seeded categories (`insert … on conflict do nothing`, so re-running the migration
adds nothing): exactly the brief's §3 list — Operations (Rent, Electricity,
Water, Internet, Phone, Facility / Maintenance, Cleaning, Security, Other
Operations), People (Salaries, Freelancers, Commissions, Other Staff Costs),
Business (Taxes, Licenses, Insurance, Accounting, Legal, Bank / Payment Fees,
Software / Subscriptions), Marketing (Advertising, Influencers, Photography /
Video, Events, Printing, Other Marketing), Production (Packaging, Bottles, Boxes,
Labels, Accessories, Raw Materials, Other Production), Other (Miscellaneous).

Functions — all `stable`/`volatile` as appropriate, `security definer`,
`set search_path = public`:

| Function | Returns |
| :--- | :--- |
| `generate_recurring_expenses(p_through date default current_date)` | int — rows written; idempotent |
| `finance_expense_summary(p_from date, p_to date)` | one row: total, paid, pending, count, void count |
| `finance_expense_by_category(p_from, p_to)` | breakdown by snapshotted category, largest first |
| `finance_daily(p_from date, p_to date, p_channel text)` | one row per day over `generate_series`: revenue, cogs, grossProfit, expenses, costedRevenue, linesMissingCost |
| `finance_monthly(p_from date, p_to date, p_channel text)` | the same per calendar month, left-joined to `financial_targets` |

Revenue and COGS in the last two come **only** from `"SalesLedgerRow"` filtered
on `countsAsRevenue`; expenses come only from `expenses` filtered on
`status <> 'VOID'`. No other source.

## Files likely to change

**New**

- `supabase/sql/0063_finance.sql`
- `supabase/tests/finance_scenarios.sql`
- `scripts/db-test-finance.ts`
- `src/types/finance.ts`
- `src/schemas/db/finance.ts`
- `src/schemas/finance.ts`
- `src/services/admin/finance.ts`
- `src/actions/admin/finance.ts`
- `src/lib/admin/finance.ts`
- `src/components/admin/ExpenseForm.tsx`
- `src/components/admin/RecurringExpenseForm.tsx`
- `src/components/admin/TargetForm.tsx`
- `src/components/admin/FinancePeriodTabs.tsx`
- `src/components/admin/TargetMeter.tsx`
- `src/components/admin/charts/FinanceChart.tsx`
- `src/components/admin/charts/BreakdownBars.tsx`
- `src/app/[locale]/admin/finance/page.tsx`
- `src/app/[locale]/admin/finance/expenses/page.tsx`
- `src/app/[locale]/admin/finance/expenses/new/page.tsx`
- `src/app/[locale]/admin/finance/expenses/[id]/page.tsx`
- `src/app/[locale]/admin/finance/recurring/[id]/page.tsx`
- `src/app/[locale]/admin/finance/targets/page.tsx`
- `src/app/[locale]/admin/finance/reports/page.tsx`

**Edited**

- `src/components/admin/AdminShell.tsx` — one new rail group, **Finance**, with
  four rows (Dashboard, Expenses, Targets, Reports). No existing route moves.
- `scripts/db-verify.ts` — a `verifyFinance()` section.
- `package.json` — `"db:test:finance"`.
- `supabase/README.md` — the `0063` row and the new command.

**Untouched, deliberately**: every existing SQL file, `place_order()`,
`set_order_status()`, the order/promotion/coupon/rewards/credit/offer code, the
sales ledger and its screens, `src/lib/admin/revalidate.ts`, the storefront.

## Implementation requirements

### Dashboard — `/admin/finance`

Period switch (Today, Yesterday, This week, This month, Previous month, This
year, Custom) and the channel chips, both carried in the URL exactly as
`/admin/sales` does. Tiles, in this order and with these words:

**Revenue** (actual merchandise revenue, delivery excluded) · **COGS** ·
**Gross Profit** · **Operating Expenses** · **Net Profit** · **Net Margin**.

Below them: gross margin, unpaid expenses, and the target block for the selected
month — Target / Actual / Remaining / Achievement % for each of the three targets
that is set, plus the pace line (§8): monthly target, days elapsed, days
remaining, actual, **required average per remaining day**. When the month is over
or the target is met, the pace line says so instead of dividing by zero.

One line under the tiles states the boundary honestly: *"Revenue is merchandise
only — delivery charged to customers is not counted. Shipping cost and payment
processing fees are not recorded per order; enter them as expenses."*

### Expenses — `/admin/finance/expenses`

Table: Date · Expense · Category · Amount · Recurring · Status, plus vendor on a
second line. Filters (URL-driven, `FilterChips` + `MovementDateRange`): date
range, category, recurring/one-time, status. Free-text search filters the
returned rows in the page, **not** by building a PostgREST `or` expression —
`src/lib/admin/filter.ts` explains why. Add / edit / void / delete-if-unreported.

The create form carries: name, category (grouped select), amount, date, vendor,
reference, notes, status, and **Repeats: One-time / Monthly / Yearly**. Choosing a
cadence creates a rule and immediately generates every occurrence up to today.

Recurring rules are listed on the same screen beneath the ledger, each linking to
`/admin/finance/recurring/[id]`, where editing changes future occurrences only —
the form says so above the amount field.

### Targets — `/admin/finance/targets`

A row per month (the last 12 plus the current, newest first): month, the three
targets, actual, achievement. Editing a month writes one `financial_targets` row.
All three amounts optional and independent.

### Reports — `/admin/finance/reports`

Granularity switch (Daily / Monthly) over the selected period, and:

- **Revenue vs Target** — revenue series with the target as a price line.
- **Gross Profit** and **Net Profit** over time (a period with no costed line is
  a gap, not a zero).
- **Expenses** over time.
- **Expense breakdown** — CSS bars, server-rendered, by snapshotted category.
- **Revenue vs Expenses vs Net Profit** — the management chart.
- **Comparison** — this period against the one before it (September vs August,
  2026 vs 2025): revenue, gross profit, expenses, net profit, each with the
  change %. A change from zero reads "—", never "∞" or "+100%".

### Rules that must hold in code

- Every read is `getSupabaseAdmin()` behind `requireAdmin()`; a failed read logs
  and returns an empty projection rather than throwing into a page.
- Every action starts with `requireAdmin()`, parses with Zod, and returns
  `AdminActionResult`.
- Aggregation happens in Postgres. TypeScript divides two integers and formats.
- No `any`. Rows are parsed with Zod, never asserted. Explicit column lists.
- Zero-guard every division; null is rendered "—" and never as 0.

## Security requirements

- RLS enabled on all four new tables, **no policy for `anon`/`authenticated`**.
- `revoke all … from anon, authenticated` on the tables; `grant all … to
  service_role`.
- Every new function `security definer set search_path = public`, revoked from
  `public, anon, authenticated`, granted to `service_role`.
- No Finance table or column is exposed on any storefront surface, in any
  service used by one, or in any API route.
- Audit columns (`createdBy`/`updatedBy`) are stamped from `requireAdmin()`'s
  actor email on the server, never from the form.
- `scripts/db-verify.ts`'s existing blanket assertions (RLS on every public
  table, no write policy or write grant for the public roles) must keep passing —
  they are what catches a mistake here.

## Acceptance criteria

1. `place_order()`, `set_order_status()`, and every existing SQL file are
   byte-identical; `git diff supabase/sql/` shows one new file only.
2. Sales & Profit and Items Sold render exactly as before; `npm run
   db:test:sales` still passes.
3. Orders, promotions, coupons, rewards, discovery credits and offers are
   unmodified in schema and in behaviour.
4. Expense create / edit / void / delete works, with audit fields populated.
5. A monthly rule started three months ago generates three rows; running
   generation again writes nothing; changing the rule's amount leaves the three
   existing rows untouched and applies from the next period.
6. Monthly targets save, and Target / Actual / Remaining / Achievement are
   correct; the required daily pace matches the worked example in §8.
7. Every period option (today, yesterday, week, month, previous month, year,
   custom range) narrows revenue, COGS and expenses identically.
8. Gross Profit = Revenue − COGS; Net Profit = Gross Profit − Expenses; margins
   divide by the right denominator, and print "—" rather than 0 when unknown.
9. Refunded and cancelled orders contribute nothing to revenue, COGS or profit.
10. Voided expenses contribute nothing to Operating Expenses.
11. Online and offline sales are both included, and the channel filter narrows
    both the tiles and the charts.
12. Renaming a category does not change a closed month's breakdown.
13. No duplicate expense row is reachable — the unique index proves it.
14. Every screen renders correctly with no expenses, no targets, and no product
    costs recorded.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run db:migrate        # must print "PostgREST schema cache reload signalled"
npm run db:verify
npm run db:test:sales     # proof the existing ledger is unharmed
npm run db:test:finance   # the new functional checks
```

`supabase/tests/finance_scenarios.sql` asserts, inside one transaction that is
always rolled back: expense totals over a window; void exclusion; recurring
generation and its idempotence; historical immutability when a rule's amount
changes; net profit = gross profit − expenses; target achievement and remaining;
required daily pace; custom-range narrowing; a refunded order's absence from
revenue; and the invariant that Finance's revenue for a window equals
`sales_ledger_summary()`'s for the same window — the guarantee that Finance never
becomes a second sales engine.

## Visual specification

The house look, unchanged — this is the same desk as `/admin/sales`, and Finance
must not read as a different product.

- **Ground** `ground-ivory`; panels `border border-ground-border bg-ivory/2`;
  no shadows, no rounded corners (`rounded-none`), hairline rules only.
- **Typography** `font-heading` uppercase `tracking-[0.2em]` at 9–10px for
  labels, chips and column heads; values in `font-heading` `text-xl sm:text-2xl`
  `tracking-[0.08em]`; body copy 11–12px `text-ground-muted`, `leading-relaxed`.
- **Colour is meaning, not decoration.** `text-ground` for a figure,
  `text-ground-accent` (gold) for the one that matters on that panel — Net Profit
  — and `text-danger` **only** for a negative net profit or an over-budget line.
  Charts use `#8a6a3f` (`--color-gold-deep`, legible on ivory), expenses in a
  muted ink, the target as a dashed gold price line.
- **Tiles**: reuse `<SalesFigure>` — same component, same `note` discipline, so
  Revenue / Gross Profit / Net Profit can never be mistaken for one another.
- **Spacing**: `space-y-6`, panels `p-6 sm:p-8`, tile grid
  `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`.
- **Motion**: `duration-300` colour transitions on links and chips;
  `duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]` on bar widths. No spring, no
  bounce, no entrance animation on a working screen.
- **Responsiveness**: tiles 1 → 2 → 3 columns; charts full width with the canvas
  measured by `ResizeObserver`; every table inside its own `overflow-x-auto`
  wrapper so the rail never slides. Nothing below 360px scrolls the body
  sideways.
- **Density over drama**: at most two charts per row on `xl`, one below it. The
  dashboard is six tiles, one target block, and one chart — the reports screen is
  where the rest live. §9's "do not make the dashboard visually crowded" is a
  requirement, not a preference.

## Manual test steps

```bash
npm run db:migrate && npm run db:verify && npm run db:test:finance
npm run dev
```

1. **Baseline** — open `/admin/sales` and note Actual Revenue and Gross Profit
   for *This month*. Open `/admin/finance` for the same month: Revenue and Gross
   Profit must match exactly. Open `/admin/orders` and confirm nothing changed.
2. **One-time expense** — Finance → Expenses → New: "September rent", category
   Rent, 40,000 EGP, today's date, status Pending. Save. It appears in the table
   and Operating Expenses on the dashboard rises by 40,000; Net Profit falls by
   the same amount.
3. **Recurring** — New expense "Internet", category Internet, 1,000 EGP, dated
   three months ago, Repeats → Monthly. Save. Three rows exist, one per month.
   Reload the dashboard twice: still three. Open the rule, change the amount to
   1,200, save: the three existing rows still read 1,000; next month's will be
   1,200.
4. **Void** — void the rent row. It stays in the table marked Void and drops out
   of Operating Expenses; Net Profit returns to its step-2 value.
5. **Targets** — Finance → Targets: set this month's Revenue 300,000, Gross
   Profit 180,000, Net Profit 100,000. The dashboard shows Target, Actual,
   Remaining and Achievement % for each, and a required-per-remaining-day figure
   that equals (target − actual) ÷ days left in the month.
6. **Periods** — cycle Today / Yesterday / This week / This month / Previous
   month / This year, then a custom range spanning two months. Revenue, COGS and
   Expenses all move together, and the URL is shareable.
7. **Channels** — switch to Offline: revenue and COGS narrow to boutique orders;
   expenses do not (they are not per-channel), and the screen says so.
8. **Refund** — refund a paid order in `/admin/orders`. Its revenue, COGS and
   profit leave every Finance figure immediately, on both screens.
9. **Category rename** — rename *Rent* to *Premises* in the category editor. A
   closed month's breakdown still reads *Rent*; new expenses read *Premises*.
10. **Reports** — `/admin/finance/reports`: switch Daily / Monthly, confirm the
    target price line on Revenue vs Target, the breakdown bars sum to Operating
    Expenses, and the comparison block's percentages match the two periods'
    figures by hand.
11. **Empty states** — with a date range containing no sales and no expenses,
    every panel renders a sentence, not a zeroed chart or a blank table.
12. **Boundary** — sign out, request `/admin/finance` → 404, not a redirect.
