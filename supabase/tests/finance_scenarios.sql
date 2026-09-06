-- KHEM — functional checks for Finance & Expenses.
--
--     npm run db:test:finance
--
-- ── Read this before running it ─────────────────────────────
--
-- This file **places a real order and records real expenses**. The runner
-- (`scripts/db-test-finance.ts`) wraps it in a transaction and always rolls
-- back, so nothing survives — but `order_number_seq` and `gen_random_uuid()`
-- are not transactional, so the visible trace of a run is a gap in the order
-- numbering. That is the entire cost, and it buys the only kind of check worth
-- having: the scenarios go through `place_order()`,
-- `generate_recurring_expenses()` and `finance_summary()` exactly as the
-- dashboard does, rather than through fixtures that could agree with a bug.
--
-- ── Everything is measured as a delta ───────────────────────
--
-- The database this runs against is a live one with real orders and real
-- expenses in it. Nothing below asserts an absolute total; every check captures
-- a baseline, does one thing, and asserts what *moved*. That is what makes the
-- file safe to run on any day, against any amount of history.
--
-- ── What is asserted ────────────────────────────────────────
--
--   1. a sale reaches Finance revenue and COGS, unchanged from the sales ledger
--   2. Finance and Sales & Profit report identical revenue for one window
--   3. an expense lands in operating expenses, and lowers net profit by exactly it
--   4. an unpaid expense counts; a voided one counts nowhere
--   5. net profit is exactly gross profit less operating expenses
--   6. a recurring rule generates one row per period, once — and again writes nothing
--   7. raising a rule's amount never rewrites a period already recorded
--   8. a monthly target is joined to the month it belongs to
--   9. a custom range narrows revenue and expenses together
--  10. a refunded order leaves every Finance figure
--  11. the daily series sums to the summary beside it
--
-- A failure raises, which rolls the transaction back and exits non-zero.

do $$
declare
  a_slug     text;
  o_number   text;
  o_id       text;

  cat_id     text := 'finance-scenario-category';
  rule_id    text;
  exp_id     text;

  d_today    date := current_date;
  d_month    date := date_trunc('month', current_date)::date;
  d_start    date := (date_trunc('month', current_date) - interval '2 months')::date;

  base       record;
  cur        record;
  v_after    record;
  m          record;

  v_int      int;
  v_bigint   bigint;
  v_ledger   bigint;

  passed     int := 0;
begin
  -- ── Setup ─────────────────────────────────────────────────
  --
  -- Silence every live campaign first. A promotion or an offer the house is
  -- actually running would reprice the scenario order and make this file fail
  -- on a Tuesday for reasons that have nothing to do with Finance.
  update public.promotions set "isActive" = false where "isActive";
  update public.offers      set "isActive" = false where "isActive";

  select p.slug into a_slug
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
   where c.kind = 'FRAGRANCE' and not p."isArchived"
   order by p.slug limit 1;

  if a_slug is null then
    raise exception 'Setup: no live fragrance to run the scenarios against.';
  end if;

  -- 1,800 EGP, cost 650 EGP. The same figures the sales-ledger scenarios use,
  -- so a discrepancy between the two files is a discrepancy in the code.
  update public."Product"
     set "priceInCents" = 180000, "costInCents" = 65000
   where slug = a_slug;

  insert into public.expense_categories (id, name, "group", "sortOrder", "isSystem")
  values (cat_id, 'Finance scenario category', 'OPERATIONS', 999, false)
  on conflict (id) do nothing;

  raise notice 'Finance scenarios';
  raise notice '';

  -- ── 1. A sale reaches Finance ─────────────────────────────
  --
  -- Finance reads `"SalesLedgerRow"`, so an order placed through
  -- `place_order()` must appear in `finance_summary()` with the same revenue
  -- and the same cost the ledger recorded — no second definition anywhere.
  select * into base from public.finance_summary(d_today, d_today, null);

  o_number := public.place_order(jsonb_build_object(
    'customerName', 'Finance Scenario',
    'channel', 'OFFLINE',
    'items', jsonb_build_array(jsonb_build_object('slug', a_slug, 'quantity', 1))
  ));

  select o.id into o_id from public."Order" o where o."orderNumber" = o_number;

  select * into cur from public.finance_summary(d_today, d_today, null);

  if cur."revenueInCents" - base."revenueInCents" <> 180000 then
    raise exception 'Sale: revenue moved by % when it should have risen by 180000.',
      cur."revenueInCents" - base."revenueInCents";
  end if;

  if coalesce(cur."cogsInCents", 0) - coalesce(base."cogsInCents", 0) <> 65000 then
    raise exception 'Sale: COGS moved by % when it should have risen by 65000.',
      coalesce(cur."cogsInCents", 0) - coalesce(base."cogsInCents", 0);
  end if;

  if coalesce(cur."grossProfitInCents", 0) - coalesce(base."grossProfitInCents", 0)
     <> 115000 then
    raise exception 'Sale: gross profit moved by % when it should have risen by 115000.',
      coalesce(cur."grossProfitInCents", 0) - coalesce(base."grossProfitInCents", 0);
  end if;

  passed := passed + 1;
  raise notice '  ok  a sale reaches Finance with the ledger''s own revenue and cost';

  -- ── 2. Finance and Sales & Profit agree ───────────────────
  --
  -- The check that matters most in this file. The two read the same view
  -- through different functions; if they ever disagree, Finance has quietly
  -- become a second sales engine, which is the one thing it must never be.
  select f."revenueInCents" into v_bigint
    from public.finance_summary(d_today, d_today, null) f;

  select coalesce(s."revenueInCents", 0) into v_ledger
    from public.sales_ledger_summary(
      (d_today::text || ' 00:00:00+00')::timestamptz,
      (d_today::text || ' 23:59:59.999999+00')::timestamptz,
      null
    ) s;

  if v_bigint <> v_ledger then
    raise exception 'Agreement: Finance says % for today, the sales ledger says %.',
      v_bigint, v_ledger;
  end if;

  passed := passed + 1;
  raise notice '  ok  Finance and Sales & Profit report identical revenue';

  -- ── 3. An expense lands, and lowers net profit by exactly it ──
  select * into base from public.finance_summary(d_today, d_today, null);

  insert into public.expenses (
    name, "categoryId", "categoryName", "categoryGroup",
    "amountInCents", "incurredOn", status, "createdBy"
  )
  values (
    'Scenario rent', cat_id, 'Finance scenario category', 'OPERATIONS',
    4000000, d_today, 'PENDING', 'scenario'
  )
  returning id into exp_id;

  select * into cur from public.finance_summary(d_today, d_today, null);

  if cur."expenseInCents" - base."expenseInCents" <> 4000000 then
    raise exception 'Expense: operating expenses moved by % when they should have risen by 4000000.',
      cur."expenseInCents" - base."expenseInCents";
  end if;

  -- An unpaid expense is still a cost of the month it was incurred in. If this
  -- ever stops being true, every month's net profit starts depending on when a
  -- bank transfer happened to clear.
  if cur."expensePendingInCents" - base."expensePendingInCents" <> 4000000 then
    raise exception 'Expense: an unpaid expense did not register as unpaid.';
  end if;

  if base."netProfitInCents" - cur."netProfitInCents" <> 4000000 then
    raise exception 'Expense: net profit moved by % when it should have fallen by 4000000.',
      base."netProfitInCents" - cur."netProfitInCents";
  end if;

  -- Revenue and gross profit are untouched by an operating expense. Rent is not
  -- a cost of goods, and the moment it starts behaving like one every product
  -- margin on the Sales screen is wrong.
  if cur."revenueInCents" <> base."revenueInCents"
     or cur."grossProfitInCents" is distinct from base."grossProfitInCents" then
    raise exception 'Expense: an operating expense changed revenue or gross profit.';
  end if;

  passed := passed + 1;
  raise notice '  ok  an expense lowers net profit and leaves gross profit alone';

  -- ── 4. Voiding removes it from every figure ───────────────
  update public.expenses
     set status = 'VOID', "voidedAt" = now()
   where id = exp_id;

  select * into v_after from public.finance_summary(d_today, d_today, null);

  if v_after."expenseInCents" <> base."expenseInCents" then
    raise exception 'Void: a voided expense is still counted (% vs %).',
      v_after."expenseInCents", base."expenseInCents";
  end if;

  if v_after."netProfitInCents" is distinct from base."netProfitInCents" then
    raise exception 'Void: net profit did not return to what it was.';
  end if;

  -- And it is still there. Voiding is a removal from the figures, never from
  -- the record — §12 asks for exactly this.
  select count(*)::int into v_int from public.expenses where id = exp_id;
  if v_int <> 1 then
    raise exception 'Void: the expense was deleted rather than voided.';
  end if;

  update public.expenses set status = 'PAID', "voidedAt" = null where id = exp_id;

  passed := passed + 1;
  raise notice '  ok  a voided expense counts nowhere and stays on record';

  -- ── 5. Net profit is gross profit less expenses ───────────
  select * into cur from public.finance_summary(d_today, d_today, null);

  if cur."netProfitInCents" is distinct from
     (cur."grossProfitInCents" - cur."expenseInCents") then
    raise exception 'Arithmetic: net (%) <> gross (%) - expenses (%).',
      cur."netProfitInCents", cur."grossProfitInCents", cur."expenseInCents";
  end if;

  passed := passed + 1;
  raise notice '  ok  net profit = gross profit − operating expenses';

  -- ── 6. Recurring: one row per period, once ────────────────
  --
  -- Three months — two ago, last month, this month — every one of them on or
  -- before today, and none after it.
  insert into public.expense_recurring_rules (
    name, "categoryId", "amountInCents", cadence, "startsOn", "createdBy"
  )
  values (
    'Scenario internet', cat_id, 100000, 'MONTHLY', d_start, 'scenario'
  )
  returning id into rule_id;

  if public.generate_recurring_expenses() < 3 then
    raise exception 'Recurring: the rule did not generate its three periods.';
  end if;

  select count(*)::int into v_int
    from public.expenses where "recurringRuleId" = rule_id;

  if v_int <> 3 then
    raise exception 'Recurring: expected 3 generated periods, found %.', v_int;
  end if;

  -- The guarantee. Generation runs on every dashboard read; if it were not
  -- idempotent the expense ledger would grow a duplicate every time somebody
  -- opened the screen.
  if public.generate_recurring_expenses() <> 0 then
    raise exception 'Recurring: a second generation wrote rows that already existed.';
  end if;

  select count(*)::int into v_int
    from public.expenses where "recurringRuleId" = rule_id;

  if v_int <> 3 then
    raise exception 'Recurring: a second generation changed the row count to %.', v_int;
  end if;

  -- Nothing is ever written into the future.
  select count(*)::int into v_int
    from public.expenses
   where "recurringRuleId" = rule_id and "incurredOn" > current_date;

  if v_int <> 0 then
    raise exception 'Recurring: % period(s) were written into the future.', v_int;
  end if;

  passed := passed + 1;
  raise notice '  ok  a recurring rule generates each period exactly once, never ahead';

  -- ── 7. Historical immutability ────────────────────────────
  --
  -- §17, and the reason the amount is copied onto each row rather than joined.
  -- September's internet stays at 1,000 whatever October becomes.
  update public.expense_recurring_rules
     set "amountInCents" = 120000
   where id = rule_id;

  if public.generate_recurring_expenses() <> 0 then
    raise exception 'Immutability: changing the amount regenerated closed periods.';
  end if;

  select count(*)::int into v_int
    from public.expenses
   where "recurringRuleId" = rule_id and "amountInCents" <> 100000;

  if v_int <> 0 then
    raise exception 'Immutability: % recorded period(s) were rewritten to the new amount.', v_int;
  end if;

  passed := passed + 1;
  raise notice '  ok  raising a recurring amount never rewrites a period already recorded';

  -- ── 8. A monthly target reaches its month ─────────────────
  insert into public.financial_targets (
    "periodMonth", "revenueTargetInCents", "netProfitTargetInCents", "createdBy"
  )
  values (d_month, 30000000, 10000000, 'scenario')
  on conflict ("periodMonth") do update
     set "revenueTargetInCents" = excluded."revenueTargetInCents",
         "netProfitTargetInCents" = excluded."netProfitTargetInCents";

  select * into m
    from public.finance_monthly(d_month, d_month, null)
   where month = d_month;

  if m."revenueTargetInCents" <> 30000000
     or m."netProfitTargetInCents" <> 10000000 then
    raise exception 'Targets: the month''s targets did not reach its row.';
  end if;

  -- And the actual beside it is the same revenue the summary reports, so a
  -- target can never be compared against a figure from a different definition.
  select f."revenueInCents" into v_bigint
    from public.finance_summary(
      d_month,
      (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
      null
    ) f;

  if m."revenueInCents" <> v_bigint then
    raise exception 'Targets: the month row says % and the summary says %.',
      m."revenueInCents", v_bigint;
  end if;

  passed := passed + 1;
  raise notice '  ok  a monthly target sits beside the actual the summary reports';

  -- ── 9. A custom range narrows everything together ─────────
  select * into cur
    from public.finance_summary(d_today + 1, d_today + 1, null);

  if cur."revenueInCents" <> 0 or cur."expenseInCents" <> 0 then
    raise exception 'Range: tomorrow reports % revenue and % expenses.',
      cur."revenueInCents", cur."expenseInCents";
  end if;

  passed := passed + 1;
  raise notice '  ok  a custom range narrows revenue and expenses together';

  -- ── 10. A refund leaves every Finance figure ──────────────
  --
  -- Finance does not know what a refund is, and must not: it reads
  -- `"countsAsRevenue"`, which the view derives from the order's own status.
  -- `set_order_status()` remains the only refund authority in the system.
  select * into base from public.finance_summary(d_today, d_today, null);

  perform public.set_order_status(o_id, 'REFUNDED');

  select * into cur from public.finance_summary(d_today, d_today, null);

  if base."revenueInCents" - cur."revenueInCents" <> 180000 then
    raise exception 'Refund: revenue moved by % when it should have fallen by 180000.',
      base."revenueInCents" - cur."revenueInCents";
  end if;

  if coalesce(base."cogsInCents", 0) - coalesce(cur."cogsInCents", 0) <> 65000 then
    raise exception 'Refund: the refunded goods'' cost is still counted.';
  end if;

  if cur."refundedOrderCount" <= base."refundedOrderCount" then
    raise exception 'Refund: the refunded order was not reported as refunded.';
  end if;

  -- Expenses are untouched by a refund. The rent was still due.
  if cur."expenseInCents" <> base."expenseInCents" then
    raise exception 'Refund: a refund changed operating expenses.';
  end if;

  passed := passed + 1;
  raise notice '  ok  a refunded order leaves revenue and cost, and does not touch expenses';

  -- ── 11. The series sums to the summary ────────────────────
  --
  -- The two are separate statements over the same predicate, which is exactly
  -- the shape that drifts. This is what would catch it.
  select coalesce(sum(d."expenseInCents"), 0) into v_bigint
    from public.finance_daily(d_start, d_today, null) d;

  select f."expenseInCents" into v_ledger
    from public.finance_summary(d_start, d_today, null) f;

  if v_bigint <> v_ledger then
    raise exception 'Series: the daily expenses sum to % and the summary says %.',
      v_bigint, v_ledger;
  end if;

  select coalesce(sum(d."revenueInCents"), 0) into v_bigint
    from public.finance_daily(d_start, d_today, null) d;

  select f."revenueInCents" into v_ledger
    from public.finance_summary(d_start, d_today, null) f;

  if v_bigint <> v_ledger then
    raise exception 'Series: the daily revenue sums to % and the summary says %.',
      v_bigint, v_ledger;
  end if;

  select coalesce(sum(mm."expenseInCents"), 0) into v_bigint
    from public.finance_monthly(d_start, d_today, null) mm;

  select f."expenseInCents" into v_ledger
    from public.finance_summary(d_start, d_today, null) f;

  if v_bigint <> v_ledger then
    raise exception 'Series: the monthly expenses sum to % and the summary says %.',
      v_bigint, v_ledger;
  end if;

  passed := passed + 1;
  raise notice '  ok  the daily and monthly series sum to the summary beside them';

  -- ── The invariants, over every expense in the table ───────
  select count(*)::int into v_int
    from (
      select e."recurringRuleId", e."periodKey"
        from public.expenses e
       where e."recurringRuleId" is not null
       group by e."recurringRuleId", e."periodKey"
      having count(*) > 1
    ) d;

  if v_int > 0 then
    raise exception 'Invariant: % recurring period(s) recorded twice.', v_int;
  end if;

  select count(*)::int into v_int
    from public.expenses e
   where e."categoryName" is null or btrim(e."categoryName") = '';

  if v_int > 0 then
    raise exception 'Invariant: % expense(s) carry no category snapshot.', v_int;
  end if;

  select count(*)::int into v_int
    from public.financial_targets t
   where t."periodMonth" <> date_trunc('month', t."periodMonth")::date;

  if v_int > 0 then
    raise exception 'Invariant: % target(s) are not stamped on the first of a month.', v_int;
  end if;

  passed := passed + 1;
  raise notice '  ok  invariants — no duplicate period, every snapshot present, every target a month';

  raise notice '';
  raise notice '% scenario group(s) passed.', passed;
end $$;
