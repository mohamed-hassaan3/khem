-- KHEM — report days start at Cairo midnight (prompts/cairo-time-zone.md).
--
-- Until now every report cut its days at UTC midnight, which is 02:00 in Cairo:
-- an order placed at 01:30 on the 20th counted toward the 19th, "today" began
-- two hours late, and a month's last two hours slipped into the next month.
-- The boutique trades in Cairo, so its days are Cairo days.
--
-- Changed, and nothing else in them:
--   · `at time zone 'UTC'`  → `at time zone 'Africa/Cairo'` (which day a sale
--     belongs to). The zone name, not a fixed +02, so Egypt's summer time is
--     handled by the tz database.
--   · `current_date` → `(now() at time zone 'Africa/Cairo')::date`. The database
--     session runs in UTC, so `current_date` was the UTC date.
--   · Rolling "last N days" windows (`now() - N days`) → from Cairo midnight
--     N-1 days ago, so "7 days" is today plus the six Cairo days before it —
--     the same reading `daily_sales()` already used.
--
-- Bodies were taken from the live database with `pg_get_functiondef()` on
-- 2026-11-19 and transformed mechanically; signatures, security and grants are
-- unchanged (CREATE OR REPLACE keeps grants). `sales_ledger_*` take instants and
-- are corrected in `src/lib/admin/sales.ts` instead.
--
-- Historic totals move: anything sold between 00:00 and 02:00 Cairo (01:00–03:00
-- in summer) now counts on its Cairo date. Stored rows are not modified.
--
-- Idempotent. Applied directly with psql, like 0073–0076.

create or replace view public."DailySales"
with (security_invoker = on) as
select
  (o."placedAt" at time zone 'Africa/Cairo')::date      as day,
  o.channel                                             as channel,
  count(distinct o.id)::int                             as "orderCount",
  coalesce(sum(i.quantity), 0)::int                     as units,
  coalesce(sum(i.quantity * i."priceInCents"), 0)::bigint as "revenueInCents"
from public."Order" o
join public."OrderItem" i on i."orderId" = o.id
where o.status not in ('CANCELLED', 'REFUNDED')
group by 1, 2;

CREATE OR REPLACE FUNCTION public.channel_split(days integer)
 RETURNS TABLE(channel text, "orderCount" integer, "revenueInCents" bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    o.channel::text,
    count(distinct o.id)::int,
    coalesce(sum(i.quantity * i."priceInCents"), 0)::bigint
  from public."Order" o
  join public."OrderItem" i on i."orderId" = o.id
  where o.status not in ('CANCELLED', 'REFUNDED')
    and o."placedAt" >= ((((now() at time zone 'Africa/Cairo')::date - (greatest(days, 1) - 1))::timestamp at time zone 'Africa/Cairo'))
  group by o.channel;
$function$;

CREATE OR REPLACE FUNCTION public.daily_sales(days integer)
 RETURNS TABLE(day text, "orderCount" integer, units integer, "revenueInCents" bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    to_char(d.day, 'YYYY-MM-DD'),
    sum(d."orderCount")::int,
    sum(d.units)::int,
    sum(d."revenueInCents")::bigint
  from public."DailySales" d
  where d.day >= ((now() at time zone 'Africa/Cairo')::date - greatest(days, 1) + 1)
  group by d.day
  order by d.day;
$function$;

CREATE OR REPLACE FUNCTION public.finance_daily(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_channel text DEFAULT NULL::text)
 RETURNS TABLE(day date, "revenueInCents" bigint, "cogsInCents" bigint, "grossProfitInCents" bigint, "expenseInCents" bigint, "netProfitInCents" bigint, "costedRevenueInCents" bigint, "linesMissingCost" integer, units integer, "orderCount" integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (
    select
      coalesce(
        p_from,
        least(
          (select min((r."soldAt" at time zone 'Africa/Cairo')::date) from public."SalesLedgerRow" r),
          (select min(e."incurredOn") from public.expenses e),
          (now() at time zone 'Africa/Cairo')::date
        )
      ) as lo,
      coalesce(p_to, (now() at time zone 'Africa/Cairo')::date) as hi
  ),
  calendar as (
    select generate_series(b.lo, greatest(b.hi, b.lo), interval '1 day')::date as day
    from bounds b
  ),
  sales as (
    select
      (r."soldAt" at time zone 'Africa/Cairo')::date as day,
      coalesce(sum(r."paidInCents"), 0)::bigint as revenue,
      (sum(r."totalCostInCents"))::bigint as cogs,
      (sum(r."grossProfitInCents"))::bigint as gross,
      coalesce(sum(r."paidInCents") filter (where r."unitCostInCents" is not null), 0)::bigint as costed_revenue,
      count(*) filter (where r."unitCostInCents" is null)::int as missing_cost,
      coalesce(sum(r.quantity), 0)::int as units,
      count(distinct r."orderId")::int as order_count
    from public."SalesLedgerRow" r, bounds b
    where r."countsAsRevenue"
      and (r."soldAt" at time zone 'Africa/Cairo')::date between b.lo and b.hi
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
$function$;

CREATE OR REPLACE FUNCTION public.finance_monthly(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_channel text DEFAULT NULL::text)
 RETURNS TABLE(month date, "revenueInCents" bigint, "cogsInCents" bigint, "grossProfitInCents" bigint, "expenseInCents" bigint, "netProfitInCents" bigint, "costedRevenueInCents" bigint, "linesMissingCost" integer, units integer, "orderCount" integer, "revenueTargetInCents" integer, "grossProfitTargetInCents" integer, "netProfitTargetInCents" integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (
    select
      date_trunc('month', coalesce(
        p_from,
        least(
          (select min((r."soldAt" at time zone 'Africa/Cairo')::date) from public."SalesLedgerRow" r),
          (select min(e."incurredOn") from public.expenses e),
          (now() at time zone 'Africa/Cairo')::date
        )
      ))::date as lo,
      date_trunc('month', coalesce(p_to, (now() at time zone 'Africa/Cairo')::date))::date as hi
  ),
  calendar as (
    select generate_series(b.lo, greatest(b.hi, b.lo), interval '1 month')::date as month
    from bounds b
  ),
  sales as (
    select
      date_trunc('month', (r."soldAt" at time zone 'Africa/Cairo')::date)::date as month,
      coalesce(sum(r."paidInCents"), 0)::bigint as revenue,
      (sum(r."totalCostInCents"))::bigint as cogs,
      (sum(r."grossProfitInCents"))::bigint as gross,
      coalesce(sum(r."paidInCents") filter (where r."unitCostInCents" is not null), 0)::bigint as costed_revenue,
      count(*) filter (where r."unitCostInCents" is null)::int as missing_cost,
      coalesce(sum(r.quantity), 0)::int as units,
      count(distinct r."orderId")::int as order_count
    from public."SalesLedgerRow" r, bounds b
    where r."countsAsRevenue"
      and date_trunc('month', (r."soldAt" at time zone 'Africa/Cairo')::date)::date between b.lo and b.hi
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
$function$;

CREATE OR REPLACE FUNCTION public.finance_summary(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_channel text DEFAULT NULL::text)
 RETURNS TABLE("orderCount" integer, units integer, "originalInCents" bigint, "discountInCents" bigint, "revenueInCents" bigint, "cogsInCents" bigint, "grossProfitInCents" bigint, "costedRevenueInCents" bigint, "linesMissingCost" integer, "refundedOrderCount" integer, "expenseInCents" bigint, "expensePaidInCents" bigint, "expensePendingInCents" bigint, "expenseCount" integer, "voidCount" integer, "netProfitInCents" bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    where (p_from is null or (r."soldAt" at time zone 'Africa/Cairo')::date >= p_from)
      and (p_to   is null or (r."soldAt" at time zone 'Africa/Cairo')::date <= p_to)
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_recurring_expenses(p_through date DEFAULT ((now() AT TIME ZONE 'Africa/Cairo'::text))::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.product_sales(days integer, row_limit integer DEFAULT 8)
 RETURNS TABLE("productSlug" text, "productName" text, units integer, "revenueInCents" bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    i."productSlug",
    max(i."productName"),
    sum(i.quantity)::int,
    sum(i.quantity * i."priceInCents")::bigint
  from public."OrderItem" i
  join public."Order" o on o.id = i."orderId"
  where o.status not in ('CANCELLED', 'REFUNDED')
    and o."placedAt" >= ((((now() at time zone 'Africa/Cairo')::date - (greatest(days, 1) - 1))::timestamp at time zone 'Africa/Cairo'))
  group by i."productSlug"
  order by 4 desc
  limit greatest(row_limit, 1);
$function$;

CREATE OR REPLACE FUNCTION public.search_top_queries(days integer, lim integer)
 RETURNS TABLE(query text, searches bigint, avg_results numeric, zero_result_share numeric, last_searched_at timestamp with time zone, locales text[])
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    (array_agg(e.query order by e.searched_at desc))[1]          as query,
    count(*)                                                      as searches,
    round(avg(e.result_count), 1)                                 as avg_results,
    round(avg((e.result_count = 0)::int), 4)                      as zero_result_share,
    max(e.searched_at)                                            as last_searched_at,
    array_agg(distinct e.locale order by e.locale)                as locales
  from public.search_events e
  where e.searched_at >= (((now() at time zone 'Africa/Cairo')::date - (least(greatest(days, 1), 90) - 1))::timestamp at time zone 'Africa/Cairo')
  group by e.query_key
  order by count(*) desc, max(e.searched_at) desc
  limit least(greatest(lim, 1), 100);
$function$;

CREATE OR REPLACE FUNCTION public.search_totals(days integer)
 RETURNS TABLE(searches bigint, distinct_queries bigint, zero_result_searches bigint, hybrid_share numeric, ar_share numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with w as (
    select *
      from public.search_events
     where searched_at >= (((now() at time zone 'Africa/Cairo')::date - (least(greatest(days, 1), 90) - 1))::timestamp at time zone 'Africa/Cairo')
  )
  select
    count(*)                                              as searches,
    count(distinct query_key)                             as distinct_queries,
    count(*) filter (where result_count = 0)              as zero_result_searches,
    coalesce(round(avg((mode = 'hybrid')::int), 4), 0)    as hybrid_share,
    coalesce(round(avg((locale = 'ar')::int), 4), 0)      as ar_share
  from w;
$function$;

CREATE OR REPLACE FUNCTION public.search_zero_result_queries(days integer, lim integer)
 RETURNS TABLE(query text, searches bigint, last_searched_at timestamp with time zone, locales text[])
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    (array_agg(e.query order by e.searched_at desc))[1]   as query,
    count(*)                                               as searches,
    max(e.searched_at)                                     as last_searched_at,
    array_agg(distinct e.locale order by e.locale)         as locales
  from public.search_events e
  where e.searched_at >= (((now() at time zone 'Africa/Cairo')::date - (least(greatest(days, 1), 90) - 1))::timestamp at time zone 'Africa/Cairo')
  group by e.query_key
  having max(e.result_count) = 0
  order by count(*) desc, max(e.searched_at) desc
  limit least(greatest(lim, 1), 100);
$function$;

notify pgrst, 'reload schema';
