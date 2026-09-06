-- KHEM — Finance & Expenses.
--
-- Applied by `npm run db:migrate` after `0062_sales_ledger.sql`. It adds four
-- tables and six functions and **alters nothing that already exists** — no
-- column, no view, no function, and above all not `place_order()`.
--
-- ── What this is, and what it is not ────────────────────────
--
-- It is the other half of the profit question. `0062` answers "what did we
-- sell, and what did the goods cost" — per sold line, snapshotted, immutable.
-- This file answers "what did it cost to keep the doors open", and then joins
-- the two:
--
--     Actual Revenue − COGS              = Gross Profit    ← 0062, unchanged
--     Gross Profit   − Operating Expenses = Net Profit     ← the only new maths
--
-- It is **not** a second sales ledger and not an accounting package. Nothing
-- here prices an order, resolves a benefit, reads a balance, values a
-- promotion, or writes a sales row. Every revenue and cost figure below is read
-- from `public."SalesLedgerRow"` exactly as the Sales & Profit screen reads it,
-- filtered on the same `"countsAsRevenue"`. If every function in this file were
-- dropped, not one number on any existing screen would move.
--
-- ── The separation that matters ─────────────────────────────
--
-- COGS is the cost of the goods that were *sold*. An operating expense is the
-- cost of the *business*. They are different tables, different provenance and
-- different arithmetic, and the one thing this file must never do is add them
-- together before gross profit has been taken. Rent is not a cost of goods.
--
-- ── Historical integrity ────────────────────────────────────
--
-- Two rules, both enforced by structure rather than by discipline:
--
--   1. An expense row snapshots its category's **name and group** at the moment
--      it is written. Renaming *Rent* to *Premises* next year re-labels nothing
--      that has already been reported. The foreign key is still there, for
--      filtering and editing; the reports read the snapshot.
--
--   2. A recurring rule's amount is **copied onto each generated row**. Raising
--      the rent from 40,000 to 45,000 in October leaves September at 40,000
--      forever. A rule is a template for future periods, never a live join.
--
-- ── No duplicate expense is reachable ───────────────────────
--
-- `expenses ("recurringRuleId", "periodKey")` is unique. Generation is an
-- `insert … on conflict do nothing` against it, so running
-- `generate_recurring_expenses()` on every dashboard render — which is exactly
-- what the service does — writes each period exactly once, forever. A one-time
-- expense carries null in both columns, and Postgres treats nulls as distinct,
-- so the index constrains only the generated rows.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Service role only, like the orders and the sales ledger. RLS is on with no
-- policy at all, the public roles are revoked by name, and every function is
-- `security definer` with a pinned `search_path`, revoked from `public`, `anon`
-- and `authenticated`. There is no storefront surface that reads any of this and
-- there must never be one: these tables carry salaries.

-- ── Enums ───────────────────────────────────────────────────

-- The six families the brief names. A group is a property of the *category*,
-- not of the expense, so moving a category between groups is one row — but the
-- expense keeps the group it was written under, so a closed month's breakdown
-- does not reshuffle.
do $$ begin
  create type public."ExpenseGroup" as enum (
    'OPERATIONS',
    'PEOPLE',
    'BUSINESS',
    'MARKETING',
    'PRODUCTION',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

/*
 * Three states, and the middle one is the point.
 *
 * PENDING is an expense the house has incurred and not yet paid — October's
 * rent on the 1st. It counts toward operating expenses, because the cost
 * belongs to the month it was incurred in and not to the day the transfer
 * cleared. Reporting it any other way would make every month's net profit
 * depend on the bank's timing.
 *
 * VOID is the delete that keeps the audit trail. Nothing counts it, anywhere.
 */
do $$ begin
  create type public."ExpenseStatus" as enum ('PENDING', 'PAID', 'VOID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."ExpenseCadence" as enum ('MONTHLY', 'YEARLY');
exception when duplicate_object then null; end $$;

-- ── expense_categories ──────────────────────────────────────
--
-- Where the money goes, as a manageable list rather than an enum. The brief
-- ships thirty of them and asks that they be editable later; a type would have
-- made "add a courier-cost category" a migration.
--
-- `"isSystem"` marks the shipped defaults. They may be renamed and archived —
-- the desk's vocabulary is the desk's — but not deleted, because an expense
-- somewhere is pointing at one and the seed below would silently recreate it on
-- the next migration.

create table if not exists public.expense_categories (
  -- A slug, so the seed below is idempotent and a category is legible in a URL.
  id           text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  name         text not null unique
    check (char_length(btrim(name)) between 2 and 60),

  "group"      public."ExpenseGroup" not null,

  "sortOrder"  int not null default 0,

  "isSystem"   boolean not null default false,
  "isArchived" boolean not null default false,

  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists expense_categories_group_idx
  on public.expense_categories ("group", "sortOrder");

comment on table public.expense_categories is
  'Operating-expense categories. Ships with the thirty defaults; admin-manageable thereafter. Never a cost of goods — COGS lives on the sales ledger.';

-- ── expense_recurring_rules ─────────────────────────────────
--
-- A template, not a ledger row. It says "rent is 40,000 a month from July"; the
-- rows it generates are what the reports actually read, and they are ordinary
-- expenses in every other respect.
--
-- Editing a rule therefore changes the **future** and nothing else, which is
-- the entire reason the amount is copied down rather than joined.

create table if not exists public.expense_recurring_rules (
  id              text primary key default gen_random_uuid()::text,

  name            text not null
    check (char_length(btrim(name)) between 2 and 120),

  "categoryId"    text not null
    references public.expense_categories(id) on update cascade,

  -- The amount **new** periods will be written with. Piastres, the same minor
  -- unit as `"Product"."priceInCents"` and everything on the sales ledger.
  "amountInCents" int not null check ("amountInCents" >= 0),

  cadence         public."ExpenseCadence" not null default 'MONTHLY',

  /*
   * The first occurrence, and the shape of every one after it.
   *
   * Occurrence n is `"startsOn" + n months` (or years), which Postgres clamps
   * for short months — 31 Jan + 1 month is 28 Feb, and + 2 months is back to 31
   * Mar rather than drifting to the 28th. That clamping is why the day of the
   * month is not stored separately.
   *
   * Floored at 2020 so a mistyped year cannot ask the generator for four
   * hundred years of rent.
   */
  "startsOn"      date not null check ("startsOn" >= date '2020-01-01'),
  "endsOn"        date,
  constraint expense_rule_window check ("endsOn" is null or "endsOn" >= "startsOn"),

  vendor          text check (char_length(vendor) <= 120),
  notes           text check (char_length(notes) <= 2000),

  -- Stopping a rule leaves every row it has already written exactly where it
  -- is. This is "no more of these", never "undo the last six months".
  "isActive"      boolean not null default true,

  "createdBy"     text,
  "createdAt"     timestamptz not null default now(),
  "updatedBy"     text,
  "updatedAt"     timestamptz not null default now()
);

create index if not exists expense_recurring_rules_active_idx
  on public.expense_recurring_rules ("isActive", "startsOn");

comment on table public.expense_recurring_rules is
  'Templates for recurring expenses. Generates rows into `expenses`; changing one never rewrites a period already generated.';

-- ── expenses ────────────────────────────────────────────────
--
-- The ledger the reports read. One row is one cost, in one period.

create table if not exists public.expenses (
  id              text primary key default gen_random_uuid()::text,

  name            text not null
    check (char_length(btrim(name)) between 2 and 120),

  "categoryId"    text not null
    references public.expense_categories(id) on update cascade,

  /*
   * The category as it was called when this expense was recorded.
   *
   * Not a convenience — the whole of §17. `finance_expense_by_category()` groups
   * on these two columns and never joins back to `expense_categories`, so a
   * category renamed in December cannot change what September's breakdown says
   * it spent on rent.
   */
  "categoryName"  text not null,
  "categoryGroup" public."ExpenseGroup" not null,

  "amountInCents" int not null check ("amountInCents" >= 0),

  /*
   * The day the cost belongs to, and the key every report groups by.
   *
   * A `date`, not a timestamp: an expense belongs to a day in the books, not to
   * an instant, and giving it a time would invite a timezone to decide which
   * month it landed in. `"createdAt"` below is the timestamp, and it answers a
   * different question — when somebody typed it.
   */
  "incurredOn"    date not null,

  status          public."ExpenseStatus" not null default 'PENDING',

  vendor          text check (char_length(vendor) <= 120),
  -- An invoice number, a cheque number, a link to a scan. Free text on purpose:
  -- this is a pointer for a human, not something the system resolves.
  reference       text check (char_length(reference) <= 500),
  notes           text check (char_length(notes) <= 2000),

  -- Null for a one-time expense. Set — together with `"periodKey"` — for a row
  -- the generator wrote.
  "recurringRuleId" text
    references public.expense_recurring_rules(id) on delete set null,

  -- `YYYY-MM` for a monthly rule, `YYYY` for a yearly one.
  "periodKey"     text check ("periodKey" is null or "periodKey" ~ '^\d{4}(-\d{2})?$'),

  "isRecurring"   boolean generated always as ("recurringRuleId" is not null) stored,

  -- ── Audit trail (§15) ──
  --
  -- An email, stamped on the server from `requireAdmin()`. Never a value a form
  -- sent, and never an identifier a browser could choose.
  "createdBy"     text,
  "createdAt"     timestamptz not null default now(),
  "updatedBy"     text,
  "updatedAt"     timestamptz not null default now(),
  "voidedAt"      timestamptz,

  /*
   * Both null, or both set. A rule reference with no period would defeat the
   * unique index below and let one month be generated twice.
   *
   * ⚠ It follows that deleting a rule means clearing **both** columns on its
   * rows first: the foreign key's `on delete set null` would clear one and
   * leave the other, and this check would refuse the delete.
   * `deleteExpenseRule()` in `src/actions/admin/finance.ts` does exactly that,
   * in one update, and the occurrences survive as ordinary one-time expenses —
   * which is correct, because the house did pay that rent whatever became of
   * the template.
   */
  constraint expense_recurrence_complete check (
    ("recurringRuleId" is null) = ("periodKey" is null)
  ),

  -- The whole of "recurring expenses do not duplicate". Nulls are distinct in a
  -- Postgres unique index, so one-time expenses are unconstrained by it.
  constraint expense_rule_period_once unique ("recurringRuleId", "periodKey")
);

create index if not exists expenses_incurred_idx
  on public.expenses ("incurredOn" desc);
create index if not exists expenses_category_idx
  on public.expenses ("categoryId", "incurredOn" desc);
create index if not exists expenses_status_idx
  on public.expenses (status, "incurredOn" desc);
create index if not exists expenses_rule_idx
  on public.expenses ("recurringRuleId");

comment on table public.expenses is
  'Operating expenses — rent, salaries, utilities, taxes, marketing. NOT cost of goods sold: COGS is snapshotted per sold line on order_item_sales_ledger.';

comment on column public.expenses."categoryName" is
  'Snapshot of the category name at the moment of writing. Reports group on this so a rename cannot rewrite history.';

-- ── financial_targets ───────────────────────────────────────
--
-- One row per calendar month, three independent and optional amounts. Optional
-- because a house that has decided on a revenue target has not necessarily
-- decided on a profit one, and a zero would read as "we aim to make nothing".

create table if not exists public.financial_targets (
  id             text primary key default gen_random_uuid()::text,

  -- Always the first of the month, UTC. Enforced rather than trusted, because
  -- a target stamped mid-month would never match the month the reports group by.
  "periodMonth"  date not null unique
    check ("periodMonth" = date_trunc('month', "periodMonth")::date),

  "revenueTargetInCents"     int check ("revenueTargetInCents" >= 0),
  "grossProfitTargetInCents" int check ("grossProfitTargetInCents" >= 0),
  "netProfitTargetInCents"   int check ("netProfitTargetInCents" >= 0),

  notes          text check (char_length(notes) <= 2000),

  "createdBy"    text,
  "createdAt"    timestamptz not null default now(),
  "updatedBy"    text,
  "updatedAt"    timestamptz not null default now()
);

comment on table public.financial_targets is
  'Monthly revenue / gross profit / net profit targets. All three optional and independent; null means "no target", never zero.';

-- ── The shipped categories ──────────────────────────────────
--
-- Exactly the list in `src/docs/Finance-Expenses.md` §3. `on conflict do
-- nothing` on the primary key, so re-running the migration adds nothing and a
-- category the desk has renamed keeps its new name.

insert into public.expense_categories (id, name, "group", "sortOrder", "isSystem")
values
  ('rent',                  'Rent',                    'OPERATIONS', 10, true),
  ('electricity',           'Electricity',             'OPERATIONS', 20, true),
  ('water',                 'Water',                   'OPERATIONS', 30, true),
  ('internet',              'Internet',                'OPERATIONS', 40, true),
  ('phone',                 'Phone',                   'OPERATIONS', 50, true),
  ('facility-maintenance',  'Facility / Maintenance',  'OPERATIONS', 60, true),
  ('cleaning',              'Cleaning',                'OPERATIONS', 70, true),
  ('security',              'Security',                'OPERATIONS', 80, true),
  ('other-operations',      'Other Operations',        'OPERATIONS', 90, true),

  ('salaries',              'Salaries',                'PEOPLE',     10, true),
  ('freelancers',           'Freelancers',             'PEOPLE',     20, true),
  ('commissions',           'Commissions',             'PEOPLE',     30, true),
  ('other-staff-costs',     'Other Staff Costs',       'PEOPLE',     40, true),

  ('taxes',                 'Taxes',                   'BUSINESS',   10, true),
  ('licenses',              'Licenses',                'BUSINESS',   20, true),
  ('insurance',             'Insurance',               'BUSINESS',   30, true),
  ('accounting',            'Accounting',              'BUSINESS',   40, true),
  ('legal',                 'Legal',                   'BUSINESS',   50, true),
  -- The category §14 points at: Stripe's cut is a real cost and there is no
  -- per-order column for it anywhere, so it is recorded here rather than
  -- estimated from an order total.
  ('bank-payment-fees',     'Bank / Payment Fees',     'BUSINESS',   60, true),
  ('software-subscriptions','Software / Subscriptions','BUSINESS',   70, true),

  ('advertising',           'Advertising',             'MARKETING',  10, true),
  ('influencers',           'Influencers',             'MARKETING',  20, true),
  ('photography-video',     'Photography / Video',     'MARKETING',  30, true),
  ('events',                'Events',                  'MARKETING',  40, true),
  ('printing',              'Printing',                'MARKETING',  50, true),
  ('other-marketing',       'Other Marketing',         'MARKETING',  60, true),

  ('packaging',             'Packaging',               'PRODUCTION', 10, true),
  ('bottles',               'Bottles',                 'PRODUCTION', 20, true),
  ('boxes',                 'Boxes',                   'PRODUCTION', 30, true),
  ('labels',                'Labels',                  'PRODUCTION', 40, true),
  ('accessories',           'Accessories',             'PRODUCTION', 50, true),
  ('raw-materials',         'Raw Materials',           'PRODUCTION', 60, true),
  ('other-production',      'Other Production',        'PRODUCTION', 70, true),

  ('miscellaneous',         'Miscellaneous',           'OTHER',      10, true)
on conflict (id) do nothing;

-- ── generate_recurring_expenses ─────────────────────────────
--
-- Write the missing occurrences for every active rule, up to `p_through`.
-- Returns how many rows it wrote — which is zero on every call after the first
-- within a period, and that is the property the whole design rests on.
--
-- Called by the Finance service on each dashboard read (one cheap RPC) and by
-- an explicit action on the Expenses screen. It is safe to call from anywhere,
-- any number of times, concurrently: the unique index is the arbiter, not a
-- lock and not a "have we run today" flag.
--
-- **It never writes into the future.** An occurrence dated after `p_through` is
-- skipped rather than pre-filled, so next month's rent does not appear in this
-- month's expenses. It will be written the first time the dashboard is opened
-- after that date passes.

create or replace function public.generate_recurring_expenses(
  p_through date default current_date
)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_rule    record;
  v_on      date;
  v_key     text;
  v_last    date;
  v_n       int;
  v_written int := 0;
begin
  for v_rule in
    select r.id,
           r.name,
           r."categoryId",
           r."amountInCents",
           r.cadence,
           r."startsOn",
           r."endsOn",
           r.vendor,
           c.name    as category_name,
           c."group" as category_group
      from public.expense_recurring_rules r
      join public.expense_categories c on c.id = r."categoryId"
     where r."isActive"
  loop
    -- The last period worth considering: the rule's own end, or today, whichever
    -- comes first.
    v_last := least(coalesce(v_rule."endsOn", p_through), p_through);

    v_n := 0;
    loop
      /*
       * `+ n months` rather than "advance a cursor", so a rule that starts on
       * the 31st lands on the 28th in February and back on the 31st in March
       * instead of drifting one day earlier every short month.
       */
      if v_rule.cadence = 'MONTHLY' then
        v_on  := (v_rule."startsOn" + (v_n * interval '1 month'))::date;
        v_key := to_char(v_on, 'YYYY-MM');
      else
        v_on  := (v_rule."startsOn" + (v_n * interval '1 year'))::date;
        v_key := to_char(v_on, 'YYYY');
      end if;

      exit when v_on > v_last;

      insert into public.expenses (
        name, "categoryId", "categoryName", "categoryGroup",
        "amountInCents", "incurredOn", status, vendor,
        "recurringRuleId", "periodKey", "createdBy"
      )
      values (
        v_rule.name,
        v_rule."categoryId",
        v_rule.category_name,
        v_rule.category_group,
        -- Copied, not joined. This is what keeps September at 40,000 when
        -- October becomes 45,000.
        v_rule."amountInCents",
        v_on,
        'PENDING',
        v_rule.vendor,
        v_rule.id,
        v_key,
        'system:recurring'
      )
      on conflict ("recurringRuleId", "periodKey") do nothing;

      if found then
        v_written := v_written + 1;
      end if;

      v_n := v_n + 1;

      -- Fifty years of monthly occurrences. A rule cannot start before 2020, so
      -- this is unreachable in practice and exists so that a future data error
      -- fails as a bounded no-op rather than as an unbounded loop.
      exit when v_n > 600;
    end loop;
  end loop;

  return v_written;
end;
$$;

-- ── finance_summary ─────────────────────────────────────────
--
-- The dashboard tiles, as one row, for one window.
--
-- Both halves are computed over the **same** date predicate, in the same
-- statement, so a tile and the chart beneath it cannot disagree about what
-- "September" means. Null bounds mean unbounded, which is how "all time" is
-- asked for.
--
-- ## The two nulls, and why they are not zeros
--
-- `"cogsInCents"` and everything derived from it are null when no line in the
-- window carried a cost — the posture `sales_ledger_summary()` established and
-- the reason it exists. Zero would read as "these sales were pure profit", and
-- a net profit built on it would be the most expensive wrong number this
-- dashboard could print. Null travels up, and the screen says "cost unavailable"
-- instead. `"linesMissingCost"` says how much of the window is affected.
--
-- ## What revenue is
--
-- `"paidInCents"` from the sales ledger: what customers actually paid **for
-- merchandise**. Delivery charged to the customer is not in it and must never
-- be — it is a cost recovered, not something sold. There is no per-order
-- shipping cost or payment-fee column anywhere in this schema, so neither is
-- deducted here; both are recorded as expenses, which is why they appear in
-- `"expenseInCents"` and not in the gross-profit line.

create or replace function public.finance_summary(
  p_from    date default null,
  p_to      date default null,
  p_channel text default null
)
returns table (
  "orderCount"            int,
  units                   int,
  "originalInCents"       bigint,
  "discountInCents"       bigint,
  "revenueInCents"        bigint,
  "cogsInCents"           bigint,
  "grossProfitInCents"    bigint,
  "costedRevenueInCents"  bigint,
  "linesMissingCost"      int,
  "refundedOrderCount"    int,
  "expenseInCents"        bigint,
  "expensePaidInCents"    bigint,
  "expensePendingInCents" bigint,
  "expenseCount"          int,
  "voidCount"             int,
  "netProfitInCents"      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with sales as (
    select
      count(distinct r."orderId") filter (where r."countsAsRevenue")::int as order_count,
      coalesce(sum(r.quantity) filter (where r."countsAsRevenue"), 0)::int as units,
      coalesce(sum(r."originalLineTotalInCents") filter (where r."countsAsRevenue"), 0)::bigint as original,
      coalesce(sum(r."totalDiscountInCents") filter (where r."countsAsRevenue"), 0)::bigint as discount,
      coalesce(sum(r."paidInCents") filter (where r."countsAsRevenue"), 0)::bigint as revenue,
      (sum(r."totalCostInCents") filter (where r."countsAsRevenue"))::bigint as cogs,
      (sum(r."grossProfitInCents") filter (where r."countsAsRevenue"))::bigint as gross,
      coalesce(sum(r."paidInCents")
        filter (where r."countsAsRevenue" and r."unitCostInCents" is not null), 0)::bigint as costed_revenue,
      count(*) filter (where r."countsAsRevenue" and r."unitCostInCents" is null)::int as missing_cost,
      count(distinct r."orderId") filter (where not r."countsAsRevenue")::int as refunded_orders
    from public."SalesLedgerRow" r
    where (p_from is null or (r."soldAt" at time zone 'UTC')::date >= p_from)
      and (p_to   is null or (r."soldAt" at time zone 'UTC')::date <= p_to)
      and (p_channel is null or r.channel::text = p_channel)
  ),
  spend as (
    select
      coalesce(sum(e."amountInCents") filter (where e.status <> 'VOID'), 0)::bigint as total,
      coalesce(sum(e."amountInCents") filter (where e.status = 'PAID'), 0)::bigint as paid,
      coalesce(sum(e."amountInCents") filter (where e.status = 'PENDING'), 0)::bigint as pending,
      count(*) filter (where e.status <> 'VOID')::int as n,
      count(*) filter (where e.status = 'VOID')::int as voided
    from public.expenses e
    where (p_from is null or e."incurredOn" >= p_from)
      and (p_to   is null or e."incurredOn" <= p_to)
  )
  select
    s.order_count,
    s.units,
    s.original,
    s.discount,
    s.revenue,
    s.cogs,
    s.gross,
    s.costed_revenue,
    s.missing_cost,
    s.refunded_orders,
    x.total,
    x.paid,
    x.pending,
    x.n,
    x.voided,
    -- Null minus anything is null, which is exactly right: an unknown gross
    -- profit makes the net profit unknown, and the screen says so.
    (s.gross - x.total)::bigint
  from sales s cross join spend x;
$$;

-- ── finance_expense_summary ─────────────────────────────────
--
-- The expense totals for a window, unfiltered and uncapped.
--
-- The Expenses screen reads at most 500 rows — the cap every list on this
-- dashboard has — so summing what it rendered would understate a busy range.
-- This counts them all.

create or replace function public.finance_expense_summary(
  p_from date default null,
  p_to   date default null
)
returns table (
  "totalInCents"   bigint,
  "paidInCents"    bigint,
  "pendingInCents" bigint,
  "expenseCount"   int,
  "voidCount"      int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(e."amountInCents") filter (where e.status <> 'VOID'), 0)::bigint,
    coalesce(sum(e."amountInCents") filter (where e.status = 'PAID'), 0)::bigint,
    coalesce(sum(e."amountInCents") filter (where e.status = 'PENDING'), 0)::bigint,
    count(*) filter (where e.status <> 'VOID')::int,
    count(*) filter (where e.status = 'VOID')::int
  from public.expenses e
  where (p_from is null or e."incurredOn" >= p_from)
    and (p_to   is null or e."incurredOn" <= p_to);
$$;

-- ── finance_expense_by_category ─────────────────────────────
--
-- Where the money went, largest first.
--
-- Grouped on the **snapshotted** name and group, and deliberately not joined
-- back to `expense_categories`: that join is what would let a rename in
-- December change what September says it spent on rent.

create or replace function public.finance_expense_by_category(
  p_from date default null,
  p_to   date default null
)
returns table (
  "categoryName"  text,
  "categoryGroup" text,
  "amountInCents" bigint,
  "expenseCount"  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e."categoryName",
    e."categoryGroup"::text,
    coalesce(sum(e."amountInCents"), 0)::bigint,
    count(*)::int
  from public.expenses e
  where e.status <> 'VOID'
    and (p_from is null or e."incurredOn" >= p_from)
    and (p_to   is null or e."incurredOn" <= p_to)
  group by e."categoryName", e."categoryGroup"
  order by 3 desc, 1 asc;
$$;

-- ── finance_daily ───────────────────────────────────────────
--
-- One row per day in the window, zeros included.
--
-- Gap-filled in SQL with `generate_series` rather than in TypeScript, because
-- the two sides being filled here are read from different tables: a day with an
-- expense and no sale, and a day with a sale and no expense, are both real and
-- both have to appear. Left joins onto a dense calendar is the only shape where
-- neither can drop a row.
--
-- A null bound means "from the first thing that happened" / "up to today", so a
-- fresh boutique gets a short chart rather than an empty one.

create or replace function public.finance_daily(
  p_from    date default null,
  p_to      date default null,
  p_channel text default null
)
returns table (
  day                    date,
  "revenueInCents"       bigint,
  "cogsInCents"          bigint,
  "grossProfitInCents"   bigint,
  "expenseInCents"       bigint,
  "netProfitInCents"     bigint,
  "costedRevenueInCents" bigint,
  "linesMissingCost"     int,
  units                  int,
  "orderCount"           int
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      coalesce(
        p_from,
        least(
          (select min((r."soldAt" at time zone 'UTC')::date) from public."SalesLedgerRow" r),
          (select min(e."incurredOn") from public.expenses e),
          current_date
        )
      ) as lo,
      coalesce(p_to, current_date) as hi
  ),
  calendar as (
    select generate_series(b.lo, greatest(b.hi, b.lo), interval '1 day')::date as day
    from bounds b
  ),
  sales as (
    select
      (r."soldAt" at time zone 'UTC')::date as day,
      coalesce(sum(r."paidInCents"), 0)::bigint as revenue,
      (sum(r."totalCostInCents"))::bigint as cogs,
      (sum(r."grossProfitInCents"))::bigint as gross,
      coalesce(sum(r."paidInCents") filter (where r."unitCostInCents" is not null), 0)::bigint as costed_revenue,
      count(*) filter (where r."unitCostInCents" is null)::int as missing_cost,
      coalesce(sum(r.quantity), 0)::int as units,
      count(distinct r."orderId")::int as order_count
    from public."SalesLedgerRow" r, bounds b
    where r."countsAsRevenue"
      and (r."soldAt" at time zone 'UTC')::date between b.lo and b.hi
      and (p_channel is null or r.channel::text = p_channel)
    group by 1
  ),
  spend as (
    select
      e."incurredOn" as day,
      coalesce(sum(e."amountInCents"), 0)::bigint as total
    from public.expenses e, bounds b
    where e.status <> 'VOID'
      and e."incurredOn" between b.lo and b.hi
    group by 1
  )
  select
    c.day,
    coalesce(s.revenue, 0)::bigint,
    -- Not coalesced: a day whose sales carried no cost has an unknown cost, and
    -- the chart draws a gap rather than a zero.
    s.cogs,
    s.gross,
    coalesce(x.total, 0)::bigint,
    (s.gross - coalesce(x.total, 0))::bigint,
    coalesce(s.costed_revenue, 0)::bigint,
    coalesce(s.missing_cost, 0),
    coalesce(s.units, 0),
    coalesce(s.order_count, 0)
  from calendar c
  left join sales s on s.day = c.day
  left join spend x on x.day = c.day
  order by c.day;
$$;

-- ── finance_monthly ─────────────────────────────────────────
--
-- The same, per calendar month, with the month's targets alongside.
--
-- Targets are joined here rather than fetched separately so that "did we hit
-- September" is answered by one row containing both the target and the actual —
-- there is no arrangement of two queries in which those can be about different
-- months, because there is only one query.

create or replace function public.finance_monthly(
  p_from    date default null,
  p_to      date default null,
  p_channel text default null
)
returns table (
  month                      date,
  "revenueInCents"           bigint,
  "cogsInCents"              bigint,
  "grossProfitInCents"       bigint,
  "expenseInCents"           bigint,
  "netProfitInCents"         bigint,
  "costedRevenueInCents"     bigint,
  "linesMissingCost"         int,
  units                      int,
  "orderCount"               int,
  "revenueTargetInCents"     int,
  "grossProfitTargetInCents" int,
  "netProfitTargetInCents"   int
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', coalesce(
        p_from,
        least(
          (select min((r."soldAt" at time zone 'UTC')::date) from public."SalesLedgerRow" r),
          (select min(e."incurredOn") from public.expenses e),
          current_date
        )
      ))::date as lo,
      date_trunc('month', coalesce(p_to, current_date))::date as hi
  ),
  calendar as (
    select generate_series(b.lo, greatest(b.hi, b.lo), interval '1 month')::date as month
    from bounds b
  ),
  sales as (
    select
      date_trunc('month', (r."soldAt" at time zone 'UTC')::date)::date as month,
      coalesce(sum(r."paidInCents"), 0)::bigint as revenue,
      (sum(r."totalCostInCents"))::bigint as cogs,
      (sum(r."grossProfitInCents"))::bigint as gross,
      coalesce(sum(r."paidInCents") filter (where r."unitCostInCents" is not null), 0)::bigint as costed_revenue,
      count(*) filter (where r."unitCostInCents" is null)::int as missing_cost,
      coalesce(sum(r.quantity), 0)::int as units,
      count(distinct r."orderId")::int as order_count
    from public."SalesLedgerRow" r, bounds b
    where r."countsAsRevenue"
      and date_trunc('month', (r."soldAt" at time zone 'UTC')::date)::date between b.lo and b.hi
      and (p_channel is null or r.channel::text = p_channel)
    group by 1
  ),
  spend as (
    select
      date_trunc('month', e."incurredOn")::date as month,
      coalesce(sum(e."amountInCents"), 0)::bigint as total
    from public.expenses e, bounds b
    where e.status <> 'VOID'
      and date_trunc('month', e."incurredOn")::date between b.lo and b.hi
    group by 1
  )
  select
    c.month,
    coalesce(s.revenue, 0)::bigint,
    s.cogs,
    s.gross,
    coalesce(x.total, 0)::bigint,
    (s.gross - coalesce(x.total, 0))::bigint,
    coalesce(s.costed_revenue, 0)::bigint,
    coalesce(s.missing_cost, 0),
    coalesce(s.units, 0),
    coalesce(s.order_count, 0),
    t."revenueTargetInCents",
    t."grossProfitTargetInCents",
    t."netProfitTargetInCents"
  from calendar c
  left join sales s on s.month = c.month
  left join spend x on x.month = c.month
  left join public.financial_targets t on t."periodMonth" = c.month
  order by c.month;
$$;

-- ── Row level security ──────────────────────────────────────
--
-- Enabled with **no policy**, on all four. The secret key bypasses RLS; every
-- other role therefore sees nothing, which is the intent — these tables carry
-- salaries, supplier names and the house's margin.

alter table public.expense_categories      enable row level security;
alter table public.expense_recurring_rules enable row level security;
alter table public.expenses                enable row level security;
alter table public.financial_targets       enable row level security;

-- ── Privileges ──────────────────────────────────────────────
--
-- Revoked by name rather than left to the absence of a policy. Supabase grants
-- `anon` and `authenticated` table privileges by default on new tables in
-- `public`; RLS with no policy already refuses them, but a belt is warranted
-- where the data is payroll — and `scripts/db-verify.ts` asserts both halves.

revoke all on public.expense_categories      from anon, authenticated;
revoke all on public.expense_recurring_rules from anon, authenticated;
revoke all on public.expenses                from anon, authenticated;
revoke all on public.financial_targets       from anon, authenticated;

grant all on public.expense_categories      to service_role;
grant all on public.expense_recurring_rules to service_role;
grant all on public.expenses                to service_role;
grant all on public.financial_targets       to service_role;

revoke all on function public.generate_recurring_expenses(date)            from public, anon, authenticated;
revoke all on function public.finance_summary(date, date, text)            from public, anon, authenticated;
revoke all on function public.finance_expense_summary(date, date)          from public, anon, authenticated;
revoke all on function public.finance_expense_by_category(date, date)      from public, anon, authenticated;
revoke all on function public.finance_daily(date, date, text)              from public, anon, authenticated;
revoke all on function public.finance_monthly(date, date, text)            from public, anon, authenticated;

grant execute on function public.generate_recurring_expenses(date)         to service_role;
grant execute on function public.finance_summary(date, date, text)         to service_role;
grant execute on function public.finance_expense_summary(date, date)       to service_role;
grant execute on function public.finance_expense_by_category(date, date)   to service_role;
grant execute on function public.finance_daily(date, date, text)           to service_role;
grant execute on function public.finance_monthly(date, date, text)         to service_role;
