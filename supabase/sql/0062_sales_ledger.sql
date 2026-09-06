-- KHEM — the sales & profitability ledger.
--
-- Applied by `npm run db:migrate` after `0061_benefit_resolution.sql`, whose
-- `place_order()` body this file re-declares with **one statement added**.
--
-- ── What this is, and what it is not ────────────────────────
--
-- It is a permanent, per-line record of what was sold: what the goods were
-- worth before any benefit, what each benefit took off, what the customer
-- actually paid, what the goods cost the house, and the gross profit that
-- leaves. One row per `"OrderItem"`, written inside the order's own
-- transaction, never updated afterwards.
--
-- It is **not** a second pricing engine. Nothing here resolves a discount,
-- prices a promotion, values an offer or reads a balance. Every figure is
-- derived from rows the order transaction has already written — the line's
-- charged price, its list price, and the four order-level benefit columns —
-- and the only work this file does is deciding *which line* each order-level
-- reduction belongs to. `place_order()` remains the single authority for what
-- anybody is charged.
--
-- ── Why the reductions have to be attributed at all ─────────
--
-- Four of the five benefits are recorded against the **order**:
--
--     "offerDiscountInCents"   "discountInCents"
--     "pointsInCents"          "creditAppliedInCents"
--
-- Only the promotion is per line, because a promotion is a *price* and the
-- line already carries both halves of it (`"priceInCents"` charged,
-- `"listPriceInCents"` before). The other four are reductions on a basket, and
-- "which products actually made money" cannot be answered until each one has
-- been apportioned to the lines it came off.
--
-- The apportionment follows the ladder in 0061, in its order, because each
-- benefit there was capped against what the one before it left:
--
--   1. promotion  per line, already stored
--   2. offer      to the units the offer actually selected
--   3. coupon     across the lines the coupon was allowed to touch
--   4. points     across everything still standing
--   5. credit     across what is left after that
--
-- Steps 2–5 go through `allocate_amount()`, which is largest-remainder: the
-- parts sum to the recorded order-level figure **exactly**, so no piastre is
-- invented and none is lost. The invariant that falls out, and that
-- `npm run db:verify` asserts, is
--
--     sum(paidInCents) over an order = "totalInCents" - "shipInCents"
--
-- — merchandise revenue, delivery excluded, the same definition `DailySales`
-- has used since 0015.
--
-- ── Why the offer is not apportioned pro rata ───────────────
--
-- Because Buy 2 Get 1 does not reduce three bottles by a third each; it makes
-- **one named bottle** free, and by default the cheapest one. Spreading its
-- value evenly would report three discounted sales where there were two full
-- sales and a gift, and the whole point of this ledger is to be able to say
-- which of those it was. So the reward units are re-read from
-- `offer_reward_units()` — the selection rule 0060 already owns, lifted out of
-- `offer_value_of()` so both callers share one implementation.
--
-- ── Status is not snapshotted ───────────────────────────────
--
-- Everything else here is a snapshot, deliberately: a product renamed or
-- repriced next season must not rewrite what an old sale earned. A refund is
-- the exception, because it happens *after* the sale — a snapshot of "sold"
-- would simply be wrong the moment the money went back. So the ledger holds no
-- status at all, and `"SalesLedgerRow"` joins `"Order"` for it. There is one
-- refund system and this is not a second one.
--
-- Refunds in this schema are whole-order (`set_order_status()` reverses stock,
-- credits, coupons, offers and points together; `"PaymentStatus".REFUNDED`
-- marks the money). There is no partial refund anywhere, so the reporting
-- distinguishes sold / paid / refunded / cancelled at order granularity, which
-- is as fine as the truth goes.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- 0015's, restated and if anything stronger: these rows carry revenue *and*
-- cost. RLS on, **no policy**, no grant to `anon` or `authenticated`, `execute`
-- revoked from `public` on every function. `"Product"."costInCents"` is house
-- confidential and appears in no storefront projection.

-- ── Product cost ────────────────────────────────────────────
--
-- What a bottle costs the house, not what it sells for. Nullable, and null
-- means **not stated** — never zero. Every profit figure derived from a null
-- cost is itself null, and the dashboard prints "Cost unavailable" rather than
-- a number nobody entered.
--
-- One flat figure per product, deliberately. Landed cost, batch costing and
-- weighted averages are an inventory-accounting system; what is needed here is
-- a reliable COGS snapshot at the moment of sale, and a second table would buy
-- precision nobody is currently able to supply.

alter table public."Product"
  add column if not exists "costInCents" int
    check ("costInCents" is null or "costInCents" >= 0);

comment on column public."Product"."costInCents" is
  'What this product costs the house, in piastres. Null means not stated — never zero. Snapshotted onto order_item_sales_ledger at the moment of sale.';

-- ── allocate_amount ─────────────────────────────────────────
--
-- Split `total` across weighted shares so the parts sum to `total` exactly.
--
-- Takes `[{ "id": …, "weight": … }]` and answers `[{ "id": …, "amount": … }]`.
--
-- Largest remainder: every share gets `floor(total * weight / Σweight)`, and
-- the units left over by that rounding go to the largest fractional remainders,
-- ties broken by input order so the result is deterministic. The naive
-- alternative — round each share independently — loses or invents piastres,
-- and a ledger that does not add up to the order it describes is worse than no
-- ledger.
--
-- Two guards worth naming. `total` is capped at `Σweight`, so a caller can
-- never distribute more than the shares can absorb (which is how a scope
-- restriction or a deleted campaign is survived rather than silently
-- corrupting a row). And a share of weight zero is excluded from the leftover
-- pass: it is not entitled to a rounding unit it did not earn.

create or replace function public.allocate_amount(shares jsonb, total int)
returns jsonb
language sql
immutable
as $$
  with s as (
    select
      value->>'id'                                            as id,
      greatest(0, coalesce((value->>'weight')::bigint, 0))     as w,
      ordinality                                              as ord
    from jsonb_array_elements(coalesce(shares, '[]'::jsonb)) with ordinality
  ),
  t as (
    select
      coalesce(sum(s.w), 0)                                              as total_w,
      least(greatest(coalesce(total, 0)::bigint, 0), coalesce(sum(s.w), 0)) as amt
    from s
  ),
  base as (
    select
      s.id,
      s.ord,
      s.w,
      case when t.total_w = 0 then 0::bigint else (t.amt * s.w) / t.total_w end as b,
      case when t.total_w = 0 then 0::bigint else (t.amt * s.w) % t.total_w end as r,
      t.amt
    from s cross join t
  ),
  spread as (
    select
      b.id,
      (
        b.b
        + case
            when b.w > 0
             and row_number() over (
                   order by (case when b.w > 0 then 0 else 1 end), b.r desc, b.ord
                 ) <= (select max(x.amt) - coalesce(sum(x.b), 0) from base x)
            then 1 else 0
          end
      )::int as amount
    from base b
  )
  select coalesce(
           jsonb_agg(jsonb_build_object('id', spread.id, 'amount', spread.amount)),
           '[]'::jsonb
         )
    from spread;
$$;

-- ── offer_reward_units ──────────────────────────────────────
--
-- Which units an offer actually chose, rather than only what they were worth.
--
-- This is the selection rule from `0060_offers.sql` — the group arithmetic and
-- the cheapest-first (or dearest-first) pick — moved out of `offer_value_of()`
-- so that both the amount and the identity of the free bottles come from one
-- implementation. `offer_value_of()` is re-declared below to call it, so its
-- answer is unchanged by construction; nothing else about 0060 moves.
--
-- Takes the same unit array both of 0060's sources produce and answers the
-- selected subset, in selection order:
--
--     [{ "slug": …, "price": … }, …]

create or replace function public.offer_reward_units(units jsonb, offer_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o        public.offers;
  v_t      int;
  v_r      int;
  v_b      int;
  v_groups int;
  v_free   int;
  v_out    jsonb;
begin
  select * into o from public.offers where id = offer_id;

  if not found then
    return '[]'::jsonb;
  end if;

  select
    count(*) filter (where (u.value->>'t')::boolean and not (u.value->>'r')::boolean),
    count(*) filter (where (u.value->>'r')::boolean and not (u.value->>'t')::boolean),
    count(*) filter (where (u.value->>'t')::boolean and (u.value->>'r')::boolean)
    into v_t, v_r, v_b
    from jsonb_array_elements(coalesce(units, '[]'::jsonb)) as u;

  -- The closed form from 0060's header. All three terms, always: dropping the
  -- last one is what would hand a free bottle to somebody who bought two.
  v_groups := least(
    (v_t + v_b) / o."triggerQuantity",
    (v_r + v_b) / o."rewardQuantity",
    (v_t + v_r + v_b) / (o."triggerQuantity" + o."rewardQuantity")
  );

  if v_groups <= 0 then
    return '[]'::jsonb;
  end if;

  v_free := v_groups * o."rewardQuantity";

  -- The selected units, cheapest or dearest first as the campaign says, drawn
  -- only from the reward pool.
  with chosen as (
    select u.value->>'slug' as slug,
           (u.value->>'price')::int as price
      from jsonb_array_elements(coalesce(units, '[]'::jsonb)) as u
     where (u.value->>'r')::boolean
     order by case when o."rewardSelection" = 'LOWEST_PRICED'
                   then (u.value->>'price')::int end asc nulls last,
              case when o."rewardSelection" = 'HIGHEST_PRICED'
                   then (u.value->>'price')::int end desc nulls last
     limit v_free
  )
  select coalesce(
           jsonb_agg(jsonb_build_object('slug', c.slug, 'price', c.price)),
           '[]'::jsonb
         )
    into v_out
    from chosen c;

  return coalesce(v_out, '[]'::jsonb);
end;
$$;

-- ── offer_value_of, re-declared over it ─────────────────────
--
-- Same signature, same answer, same rounding. What changes is that the
-- selection is no longer written out here: it is read from
-- `offer_reward_units()` above, so the ledger's idea of which bottle was free
-- and the checkout's idea of what the offer was worth cannot drift apart.
--
-- `rewardProductSlug` / `rewardUnitPriceInCents` remain the **first** selected
-- unit, which is what `offer_redemptions` has always recorded.

create or replace function public.offer_value_of(units jsonb, offer_id text)
returns table (
  "amountInCents" int,
  "rewardProductSlug" text,
  "rewardUnitPriceInCents" int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o      public.offers;
  v_sel  jsonb;
  v_sum  int := 0;
  v_slug text;
  v_unit int;
begin
  select * into o from public.offers where id = offer_id;

  if not found then
    return query select 0, null::text, null::int;
    return;
  end if;

  v_sel := public.offer_reward_units(units, offer_id);

  if jsonb_array_length(v_sel) = 0 then
    return query select 0, null::text, null::int;
    return;
  end if;

  select
    coalesce(sum((u.value->>'price')::int), 0)::int,
    (array_agg(u.value->>'slug'  order by u.ord))[1],
    (array_agg((u.value->>'price')::int order by u.ord))[1]
    into v_sum, v_slug, v_unit
    from jsonb_array_elements(v_sel) with ordinality as u(value, ord);

  if o."rewardKind" = 'PERCENTAGE' then
    -- Rounded down, matching `resolve_discount()` and
    -- `active_product_promotions`: the house never gives away a piastre it did
    -- not mean to.
    v_sum := (v_sum::bigint * o."rewardValue" / 100)::int;
  end if;

  return query select greatest(0, v_sum), v_slug, v_unit;
end;
$$;

-- ── discount_eligible_order_items ───────────────────────────
--
-- **Which lines** a discount was allowed to come off, as opposed to what they
-- added up to.
--
-- The predicate is `0035_marketing.sql`'s, moved here unchanged — the scope
-- test plus the non-stacking promotion exclusion — and
-- `discount_eligible_subtotal()` is re-declared below to sum exactly this set.
-- One definition, three readers: `resolve_discount()`, the dashboard's
-- estimate, and the ledger's attribution. Restating it in the ledger would be
-- a fourth copy of the rule that decides what a coupon may touch, and the copy
-- that drifts is the one nobody is looking at.

create or replace function public.discount_eligible_order_items(
  order_id    text,
  discount_id text
)
returns table ("orderItemId" text)
language sql
stable
security definer
set search_path = public
as $$
  select i.id
    from public."OrderItem" i
    join public."Product" p on p.slug = i."productSlug"
    join public.discounts d on d.id = discount_id
   where i."orderId" = order_id
     and (
       i."promotionId" is null
       or exists (
         select 1 from public.promotions pr
          where pr.id = i."promotionId" and pr."stacksWithCodes"
       )
     )
     and (
       d."appliesTo" = 'ALL'
       or (
         d."appliesTo" = 'PRODUCTS'
         and exists (
           select 1 from public.discount_products dp
            where dp."discountId" = d.id and dp."productSlug" = i."productSlug"
         )
       )
       or (
         d."appliesTo" = 'COLLECTIONS'
         and exists (
           select 1 from public.discount_collections dc
            where dc."discountId" = d.id
              and dc."collectionSlug" = p."collectionSlug"
         )
       )
     );
$$;

create or replace function public.discount_eligible_subtotal(
  order_id    text,
  discount_id text
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.quantity * i."priceInCents"), 0)::int
    from public."OrderItem" i
   where i.id in (
     select e."orderItemId"
       from public.discount_eligible_order_items(order_id, discount_id) e
   );
$$;

-- ── order_item_sales_ledger ─────────────────────────────────
--
-- One row per sold line, immutable once written.
--
-- Snapshots rather than joins for everything the passage of time can change:
-- the product's name, its SKU, its collection, its price, and its cost. The
-- foreign keys are still there so the analytical rows can be joined back to the
-- live catalogue; they are not what the reporting reads. A product repriced
-- next year must leave last year's margin exactly where it was.

create table if not exists public.order_item_sales_ledger (
  id            text primary key default gen_random_uuid()::text,

  -- ── The sale this row belongs to ──
  "orderId"     text not null
    references public."Order"(id) on delete cascade,

  -- The idempotency key. One line, one ledger row, forever — a retried order
  -- flow, a re-run migration and a second backfill all converge on the same
  -- row rather than counting a sale twice.
  "orderItemId" text not null
    references public."OrderItem"(id) on delete cascade,

  -- Snapshotted so the Items Sold table can print and filter without joining,
  -- and so a row stays readable if an order is ever archived out of reach.
  "orderNumber" text not null,
  channel       public."OrderChannel" not null,
  "soldAt"      timestamptz not null,

  -- ── The product, as it was ──
  "productSlug"    text not null
    references public."Product"(slug) on update cascade,
  "productName"    text not null,
  sku              text,
  "collectionSlug" text,
  "collectionName" text,

  quantity      int not null check (quantity > 0),

  -- ── What it was worth before anything came off ──
  --
  -- The **list** price: `"listPriceInCents"` where a campaign ran, and the
  -- charged price otherwise. A promotion is a discount, not a cheaper product,
  -- so it belongs below rather than here.
  "originalUnitPriceInCents" int not null check ("originalUnitPriceInCents" >= 0),
  "originalLineTotalInCents" int not null check ("originalLineTotalInCents" >= 0),

  -- ── What came off, by instrument ──
  --
  -- Five columns rather than one amount and a type, because an order may carry
  -- several at once and "which of them gave this away" is the question the
  -- ledger exists to answer. A single `source` column would have to pick one
  -- and lie about the rest.
  "promotionDiscountInCents" int not null default 0 check ("promotionDiscountInCents" >= 0),
  "offerDiscountInCents"     int not null default 0 check ("offerDiscountInCents" >= 0),
  "couponDiscountInCents"    int not null default 0 check ("couponDiscountInCents" >= 0),
  "pointsDiscountInCents"    int not null default 0 check ("pointsDiscountInCents" >= 0),
  "creditDiscountInCents"    int not null default 0 check ("creditDiscountInCents" >= 0),

  "totalDiscountInCents" int generated always as (
    "promotionDiscountInCents" + "offerDiscountInCents" + "couponDiscountInCents"
    + "pointsDiscountInCents" + "creditDiscountInCents"
  ) stored,

  -- ── What the customer actually paid for these goods ──
  --
  -- Delivery is not in here and never will be: it is a cost recovered, not
  -- something sold, and folding it in would make every margin on this table
  -- disagree with the order it came from.
  "paidInCents" int not null check ("paidInCents" >= 0),

  -- How many units of this line an offer gave away outright. Recorded beside
  -- `"isFree"` because a line of three with one free is a real and different
  -- fact from a line that was free entirely.
  "freeUnits"   int not null default 0 check ("freeUnits" >= 0),

  "isFree" boolean generated always as (
    "paidInCents" = 0 and "originalLineTotalInCents" > 0
  ) stored,

  -- Derived from the five amounts so the filter chips and the columns cannot
  -- disagree about which instruments touched a row.
  "discountSources" text[] generated always as (
    array_remove(array[
      case when "promotionDiscountInCents" > 0 then 'PROMOTION'::text end,
      case when "offerDiscountInCents"     > 0 then 'OFFER'::text end,
      case when "couponDiscountInCents"    > 0 then 'COUPON'::text end,
      case when "pointsDiscountInCents"    > 0 then 'REWARDS'::text end,
      case when "creditDiscountInCents"    > 0 then 'DISCOVERY_CREDIT'::text end
    ], null)
  ) stored,

  -- ── References back to the instruments ──
  --
  -- Plain columns, not foreign keys, for the same reason `"discountCode"` sits
  -- beside `"discountId"` on the order: a campaign deleted next season must not
  -- take a historical sale's explanation with it.
  "promotionId"  text,
  "offerId"      text,
  "offerLabel"   text,
  "discountId"   text,
  "discountCode" text,
  "creditId"     text,

  -- ── Cost, and what it leaves ──
  --
  -- Null means the cost was not known at the moment of sale. Nothing here
  -- guesses: `"totalCostInCents"` and `"grossProfitInCents"` are null with it,
  -- and the dashboard says so rather than showing a zero that would read as
  -- "this sale was pure profit".
  "unitCostInCents" int check ("unitCostInCents" is null or "unitCostInCents" >= 0),

  "totalCostInCents" int generated always as (
    "unitCostInCents" * quantity
  ) stored,

  "grossProfitInCents" int generated always as (
    "paidInCents" - "unitCostInCents" * quantity
  ) stored,

  "recordedAt" timestamptz not null default now()
);

-- The whole of "the same order can never be counted twice".
create unique index if not exists order_item_sales_ledger_item_idx
  on public.order_item_sales_ledger ("orderItemId");

create index if not exists order_item_sales_ledger_sold_idx
  on public.order_item_sales_ledger ("soldAt" desc);
create index if not exists order_item_sales_ledger_order_idx
  on public.order_item_sales_ledger ("orderId");
create index if not exists order_item_sales_ledger_product_idx
  on public.order_item_sales_ledger ("productSlug", "soldAt" desc);
create index if not exists order_item_sales_ledger_collection_idx
  on public.order_item_sales_ledger ("collectionSlug");
create index if not exists order_item_sales_ledger_channel_idx
  on public.order_item_sales_ledger (channel, "soldAt" desc);

-- ── record_sales_ledger ─────────────────────────────────────
--
-- Write the ledger rows for one order. Called by `place_order()` as its last
-- statement, and by the backfill at the bottom of this file — one code path, so
-- history and new sales are produced by the same arithmetic.
--
-- Returns the number of rows written: the count is zero on a second call, which
-- is what makes a retried order flow safe.
--
-- **Reads only.** Every input is a column the order transaction has already
-- committed to. If this function were deleted the orders would be unchanged.

create or replace function public.record_sales_ledger(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number      text;
  v_channel     public."OrderChannel";
  v_placed      timestamptz;
  v_offer_id    text;
  v_offer_label text;
  v_offer_amt   int;
  v_disc_id     text;
  v_disc_code   text;
  v_disc_amt    int;
  v_points_amt  int;
  v_credit_id   text;
  v_credit_amt  int;
  v_offer_kind  public."OfferRewardKind";
  v_chosen      jsonb := '[]'::jsonb;
  v_written     int   := 0;
begin
  select
    o."orderNumber", o.channel, o."placedAt",
    o."offerId", o."offerLabel", coalesce(o."offerDiscountInCents", 0),
    o."discountId", o."discountCode", coalesce(o."discountInCents", 0),
    coalesce(o."pointsInCents", 0),
    o."creditId", coalesce(o."creditAppliedInCents", 0)
    into
      v_number, v_channel, v_placed,
      v_offer_id, v_offer_label, v_offer_amt,
      v_disc_id, v_disc_code, v_disc_amt,
      v_points_amt,
      v_credit_id, v_credit_amt
    from public."Order" o
   where o.id = order_id;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  /*
   * Which units the offer actually chose.
   *
   * Read from 0060's own selection rule against the order's own lines, so the
   * bottle this ledger calls free is the bottle the checkout gave away. A
   * PERCENTAGE offer selects units too — it just does not make them free — so
   * the kind is carried separately and only `FREE_ITEM` produces `freeUnits`.
   */
  if v_offer_id is not null and v_offer_amt > 0 then
    select f."rewardKind" into v_offer_kind from public.offers f where f.id = v_offer_id;

    if found then
      v_chosen := public.offer_reward_units(
        public.offer_units_for_order(order_id, v_offer_id),
        v_offer_id
      );
    end if;
  end if;

  with lines as (
    select
      i.id,
      i."productSlug",
      i."productName",
      i.quantity,
      i."priceInCents",
      i."listPriceInCents",
      i."promotionId",
      coalesce(i."listPriceInCents", i."priceInCents")            as orig_unit,
      coalesce(i."listPriceInCents", i."priceInCents") * i.quantity as orig_total,
      i.quantity * i."priceInCents"                                as net0
    from public."OrderItem" i
    where i."orderId" = order_id
  ),

  -- ── 2. Offer ────────────────────────────────────────────
  --
  -- The chosen units carry a slug and a price, not a line id — a line of three
  -- becomes three units, which is the level an offer reasons at. They are
  -- matched back by numbering each line's units within its slug and taking as
  -- many as the offer chose. Two lines of the same product are
  -- indistinguishable to the offer and carry the same unit price, so which of
  -- them is credited does not change any figure.
  chosen as (
    select u.value->>'slug' as slug, count(*)::int as n
      from jsonb_array_elements(v_chosen) as u
     group by 1
  ),
  line_units as (
    select
      l.id,
      l."productSlug" as slug,
      l."priceInCents" as unit,
      row_number() over (partition by l."productSlug" order by l.id, g.n) as k
    from lines l
    cross join lateral generate_series(1, l.quantity) as g(n)
  ),
  line_offer as (
    select lu.id, count(*)::int as free_units, sum(lu.unit)::bigint as weight
      from line_units lu
      join chosen c on c.slug = lu.slug
     where lu.k <= c.n
     group by lu.id
  ),
  s1 as (
    select l.*,
           coalesce(lo.weight, 0)::bigint as offer_weight,
           coalesce(lo.free_units, 0)     as free_units
      from lines l
      left join line_offer lo on lo.id = l.id
  ),
  a1 as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object('id', s1.id, 'weight', s1.offer_weight)),
                         '[]'::jsonb)
                  from s1),
               v_offer_amt
             )
           ) a
  ),
  /*
   * The spill.
   *
   * `allocate_amount()` never distributes more than the weights can absorb, so
   * a selection that has gone missing — an offer deleted since the sale, a
   * backfilled order whose campaign no longer exists — would otherwise leave
   * part of a recorded reduction unattributed and break the sum. What could not
   * be attributed to the units the offer chose is spread across whatever value
   * the lines still hold, which is the honest fallback: the money did come off,
   * we simply no longer know from where.
   */
  s1b as (
    select s1.*, coalesce(a1.amt, 0) as offer_primary
      from s1 left join a1 on a1.id = s1.id
  ),
  a1b as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object(
                           'id', s1b.id,
                           'weight', s1b.net0 - s1b.offer_primary)),
                         '[]'::jsonb)
                  from s1b),
               v_offer_amt - (select coalesce(sum(x.offer_primary), 0)::int from s1b x)
             )
           ) a
  ),
  s2 as (
    select s1b.*,
           s1b.offer_primary + coalesce(a1b.amt, 0)              as offer_amt,
           s1b.net0 - s1b.offer_primary - coalesce(a1b.amt, 0)   as net1
      from s1b left join a1b on a1b.id = s1b.id
  ),

  -- ── 3. Coupon ───────────────────────────────────────────
  --
  -- Across the lines the code was *allowed* to touch, from the one definition
  -- of that rule. A code scoped to one collection must not be reported as
  -- having discounted a product it could never have applied to.
  elig as (
    select e."orderItemId" as id
      from public.discount_eligible_order_items(order_id, v_disc_id) e
  ),
  a2 as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object(
                           'id', s2.id,
                           'weight', case when e.id is null then 0 else s2.net1 end)),
                         '[]'::jsonb)
                  from s2 left join elig e on e.id = s2.id),
               v_disc_amt
             )
           ) a
  ),
  -- The same spill, and here it is load-bearing rather than defensive: the
  -- offer above may have consumed the eligible lines entirely, and a discount
  -- row deleted since the sale leaves no eligible set at all.
  s2b as (
    select s2.*, coalesce(a2.amt, 0) as coupon_primary
      from s2 left join a2 on a2.id = s2.id
  ),
  a2b as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object(
                           'id', s2b.id,
                           'weight', s2b.net1 - s2b.coupon_primary)),
                         '[]'::jsonb)
                  from s2b),
               v_disc_amt - (select coalesce(sum(x.coupon_primary), 0)::int from s2b x)
             )
           ) a
  ),
  s3 as (
    select s2b.*,
           s2b.coupon_primary + coalesce(a2b.amt, 0)            as coupon_amt,
           s2b.net1 - s2b.coupon_primary - coalesce(a2b.amt, 0) as net2
      from s2b left join a2b on a2b.id = s2b.id
  ),

  -- ── 4. Points ───────────────────────────────────────────
  --
  -- No scope: `place_order()` values a redemption against the whole remaining
  -- order, so it is spread across whatever is still standing. No spill needed —
  -- the amount was capped against exactly this sum when it was taken.
  a3 as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object('id', s3.id, 'weight', s3.net2)),
                         '[]'::jsonb)
                  from s3),
               v_points_amt
             )
           ) a
  ),
  s4 as (
    select s3.*,
           coalesce(a3.amt, 0)          as points_amt,
           s3.net2 - coalesce(a3.amt, 0) as net3
      from s3 left join a3 on a3.id = s3.id
  ),

  -- ── 5. Discovery Credit ─────────────────────────────────
  --
  -- Last, as in the ladder, and capped against what the other four left — so
  -- the same reasoning as points applies and the amount always fits.
  a4 as (
    select a.value->>'id' as id, (a.value->>'amount')::int as amt
      from jsonb_array_elements(
             public.allocate_amount(
               (select coalesce(
                         jsonb_agg(jsonb_build_object('id', s4.id, 'weight', s4.net3)),
                         '[]'::jsonb)
                  from s4),
               v_credit_amt
             )
           ) a
  ),
  final as (
    select s4.*,
           coalesce(a4.amt, 0)           as credit_amt,
           s4.net3 - coalesce(a4.amt, 0) as paid
      from s4 left join a4 on a4.id = s4.id
  ),
  written as (
    insert into public.order_item_sales_ledger (
      "orderId", "orderItemId", "orderNumber", channel, "soldAt",
      "productSlug", "productName", sku, "collectionSlug", "collectionName",
      quantity,
      "originalUnitPriceInCents", "originalLineTotalInCents",
      "promotionDiscountInCents", "offerDiscountInCents", "couponDiscountInCents",
      "pointsDiscountInCents", "creditDiscountInCents",
      "paidInCents", "freeUnits",
      "promotionId", "offerId", "offerLabel", "discountId", "discountCode", "creditId",
      "unitCostInCents"
    )
    select
      order_id,
      f.id,
      v_number,
      v_channel,
      v_placed,
      f."productSlug",
      f."productName",
      p.sku,
      p."collectionSlug",
      col.name,
      f.quantity,
      f.orig_unit,
      f.orig_total,
      -- The promotion is the only reduction already carried by the line: the
      -- gap between what the catalogue asks and what was charged.
      f.orig_total - f.net0,
      f.offer_amt,
      f.coupon_amt,
      f.points_amt,
      f.credit_amt,
      f.paid,
      case when v_offer_kind = 'FREE_ITEM' then f.free_units else 0 end,
      f."promotionId",
      case when f.offer_amt  > 0 then v_offer_id   end,
      case when f.offer_amt  > 0 then v_offer_label end,
      case when f.coupon_amt > 0 then v_disc_id    end,
      case when f.coupon_amt > 0 then v_disc_code  end,
      case when f.credit_amt > 0 then v_credit_id  end,
      -- The cost **as it stands at the moment of sale**. Null when the desk has
      -- not stated one, and null it stays: a cost entered next month describes
      -- next month's purchasing, not this sale's.
      p."costInCents"
    from final f
    join public."Product" p on p.slug = f."productSlug"
    left join public."Collection" col on col.slug = p."collectionSlug"
    -- The idempotency guarantee, and the reason a retried order flow is safe.
    on conflict ("orderItemId") do nothing
    returning 1
  )
  select count(*)::int into v_written from written;

  return coalesce(v_written, 0);
end;
$$;

-- ── place_order ─────────────────────────────────────────────
--
-- The **0061 body**, unchanged in every particular — the line loop with the
-- promotion pricing and `move_stock`, the offer block, the discount block, the
-- points block with its four refusals, the credit block, and the final update —
-- plus one statement: `record_sales_ledger()` immediately before the return.
--
-- ⚠ Same warning 0061 carries, now with one more block to lose. The next person
-- to add something here must diff against **this** file and keep every block.
-- Losing one is not a compile error; it is a silent change to what people pay.
--
-- The ledger call is last so that every figure it reads has already been
-- written, and inside the same transaction so an order that fails leaves no
-- row behind it. It cannot fail an order it did not cause: it computes nothing
-- and validates nothing, it only records.

create or replace function public.place_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   text;
  v_number     text;
  v_subtotal   int := 0;
  v_ship       int := coalesce((payload->>'shipInCents')::int, 0);
  v_channel    public."OrderChannel" :=
                 coalesce((payload->>'channel')::public."OrderChannel", 'OFFLINE');
  v_method     public."PaymentMethod" :=
                 coalesce((payload->>'paymentMethod')::public."PaymentMethod", 'CASH');
  v_locale     text := coalesce(nullif(payload->>'locale', ''), 'en');
  v_item       jsonb;
  v_slug       text;
  v_qty        int;
  v_product    record;
  -- Promotion pricing, restored from 0035.
  v_promo      record;
  v_promo_id   text;
  v_unit       int;
  -- Credits, 0027.
  v_credit_id  text := nullif(payload->>'creditId', '');
  v_owner      text := nullif(payload->>'clerkUserId', '');
  v_credit     record;
  v_applied    int := 0;
  v_eligible   int := 0;
  -- Discounts, 0028/0040.
  v_code       text := upper(btrim(coalesce(payload->>'discountCode', '')));
  v_discount   jsonb;
  v_disc_id    text;
  v_disc_code  text;
  v_disc_amt   int := 0;
  v_email      text := lower(nullif(payload->>'customerEmail', ''));
  -- Offers, 0060.
  v_offer      jsonb;
  v_offer_id   text;
  v_offer_lbl  text;
  v_offer_amt  int := 0;
  -- Points, 0059.
  v_asked      int := greatest(0, coalesce((payload->>'pointsToRedeem')::int, 0));
  v_points     jsonb;
  v_points_qty int := 0;
  v_points_amt int := 0;
  v_settings   public."BenefitSetting";
  -- What is left of the merchandise as each benefit takes its share.
  v_remaining  int := 0;
  v_promoted   boolean := false;
begin
  if jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'An order needs at least one line.'
      using errcode = 'check_violation';
  end if;

  if v_locale not in ('en', 'ar') then
    v_locale := 'en';
  end if;

  insert into public."Order" (
    "customerName", "customerEmail", "customerPhone", "clerkUserId",
    note, channel, "paymentMethod", locale,
    "shipLine1", "shipLine2", "shipCity", "shipState", "shipPostalCode", "shipCountry",
    "subtotalInCents", "shipInCents", "totalInCents"
  ) values (
    payload->>'customerName',
    nullif(payload->>'customerEmail', ''),
    nullif(payload->>'customerPhone', ''),
    nullif(payload->>'clerkUserId', ''),
    nullif(payload->>'note', ''),
    v_channel,
    v_method,
    v_locale,
    nullif(payload->>'shipLine1', ''),
    nullif(payload->>'shipLine2', ''),
    nullif(payload->>'shipCity', ''),
    nullif(payload->>'shipState', ''),
    nullif(payload->>'shipPostalCode', ''),
    nullif(payload->>'shipCountry', ''),
    0, v_ship, 0
  )
  returning id, "orderNumber" into v_order_id, v_number;

  -- The opening event. `PROCESSING` since 0051.
  insert into public."OrderStatusEvent" ("orderId", status)
  values (v_order_id, 'PROCESSING');

  for v_item in
    select value
    from jsonb_array_elements(payload->'items')
    order by value->>'slug'
  loop
    v_slug := v_item->>'slug';
    v_qty  := (v_item->>'quantity')::int;

    if v_qty is null or v_qty < 1 then
      raise exception 'Quantity must be at least 1.'
        using errcode = 'check_violation';
    end if;

    select slug, name, "priceInCents", "isArchived"
      into v_product
      from public."Product"
     where slug = v_slug
     for update;

    if not found then
      raise exception 'No product with the slug %.', v_slug
        using errcode = 'foreign_key_violation';
    end if;

    if v_product."isArchived" then
      raise exception '% is archived and cannot be sold.', v_product.name
        using errcode = 'check_violation';
    end if;

    /*
     * ── The price ─────────────────────────────────────────
     *
     * Restored from 0035, after four migrations without it. This is the
     * sentence the marketing work exists to serve: the browser sends slugs and
     * quantities, and what each of those costs is decided here, from rows this
     * transaction has locked.
     *
     * Looked up **after** the `for update` on the product, so a price edit and
     * a campaign edit racing this order serialise behind the same lock rather
     * than half-landing.
     *
     * The `found` check is load-bearing and the `v_promo_id := null` above it
     * doubly so: `select into` leaves the previous iteration's row in `v_promo`
     * when it matches nothing, so reading it unconditionally would price a
     * second bottle at the first one's campaign.
     */
    v_promo_id := null;

    select *
      into v_promo
      from public.active_product_promotions
     where "productSlug" = v_product.slug;

    if found then
      v_unit     := v_promo."priceInCents";
      v_promo_id := v_promo."promotionId";
      v_promoted := true;
    else
      v_unit := v_product."priceInCents";
    end if;

    insert into public."OrderItem" (
      "orderId", "productSlug", "productName", quantity, "priceInCents",
      "listPriceInCents", "promotionId"
    ) values (
      v_order_id, v_product.slug, v_product.name, v_qty, v_unit,
      -- Recorded only when it differs, so a plain sale carries no misleading
      -- "was" price on the order it becomes.
      case when v_promo_id is null then null else v_product."priceInCents" end,
      v_promo_id
    );

    /*
     * The decrement, the shortfall check and the ledger row are one call, and
     * they draw from the counter this order belongs to (0042).
     */
    perform public.move_stock(
      v_product.slug, v_channel, 'SALE', -v_qty,
      'Order ' || v_number, nullif(payload->>'clerkUserId', ''), v_order_id
    );

    v_subtotal := v_subtotal + (v_qty * v_unit);
  end loop;

  v_remaining := v_subtotal;

  select * into v_settings from public.points_settings();

  -- ── 2. Offer ──────────────────────────────────────────────
  --
  -- The house's own benefit, chosen by the house. Nothing in the payload names
  -- one — that is the difference between an offer and a coupon.
  --
  -- Resolved before the coupon so the automatic benefit is weighed against the
  -- bag as it stands. `resolve_offer()` is given the code the customer typed and
  -- whether they are spending a credit, and declines itself when either would
  -- stack against its own switches: an offer nobody asked for yields quietly
  -- rather than refusing an order.

  v_offer := public.resolve_offer(jsonb_build_object(
    'orderId', v_order_id,
    'clerkUserId', v_owner,
    'email', v_email,
    'discountCode', v_code,
    'usingCredit', v_credit_id is not null
  ));

  if coalesce((v_offer->>'ok')::boolean, false) then
    v_offer_id  := v_offer->>'offerId';
    v_offer_lbl := v_offer->>'label';
    v_offer_amt := least((v_offer->>'amountInCents')::int, v_remaining);

    if v_offer_amt > 0 then
      insert into public.offer_redemptions (
        "offerId", "orderId", email, "clerkUserId", "amountInCents",
        "rewardProductSlug", "rewardUnitPriceInCents"
      ) values (
        v_offer_id, v_order_id, v_email, v_owner, v_offer_amt,
        v_offer->>'rewardProductSlug',
        (v_offer->>'rewardUnitPriceInCents')::int
      );

      v_remaining := v_remaining - v_offer_amt;
    else
      v_offer_id  := null;
      v_offer_lbl := null;
    end if;
  end if;

  -- ── 3. Discount ───────────────────────────────────────────
  --
  -- The 0051 block, unchanged. `resolve_discount()` judges the minimum against
  -- the **subtotal before any reduction** (0028) — judging it after would let a
  -- discount disqualify itself — and holds the lock that makes the caps real for
  -- the rest of this transaction.

  if v_code <> '' then
    v_discount := public.resolve_discount(jsonb_build_object(
      'code', v_code,
      'orderId', v_order_id,
      'email', v_email,
      'clerkUserId', v_owner,
      'subtotalInCents', v_subtotal
    ));

    if not coalesce((v_discount->>'ok')::boolean, false) then
      raise exception '%', coalesce(v_discount->>'reason', 'That code cannot be used.')
        using errcode = 'check_violation',
              hint = 'DISCOUNT:' || coalesce(v_discount->>'reasonCode', 'UNKNOWN');
    end if;

    v_disc_id   := v_discount->>'discountId';
    v_disc_code := v_discount->>'code';
    -- Capped against what the offer left, so the two together can never take off
    -- more than the merchandise is worth.
    v_disc_amt  := least((v_discount->>'amountInCents')::int, v_remaining);

    insert into public.discount_redemptions
      ("discountId", "orderId", email, "clerkUserId", "amountInCents")
    values (v_disc_id, v_order_id, v_email, v_owner, v_disc_amt);

    update public.discount_grants
       set "usedAt" = now(),
           "usedOrderId" = v_order_id
     where "discountId" = v_disc_id
       and email = v_email
       and "usedAt" is null;

    v_remaining := v_remaining - v_disc_amt;
  end if;

  -- ── 4. Points ─────────────────────────────────────────────
  --
  -- A count, never an amount: what those points are worth is decided by
  -- `resolve_points_redemption()` from `"BenefitSetting"`, against a balance read
  -- under the advisory lock taken here. Two checkouts racing one balance
  -- serialise on that lock, then the second reads a balance the first has
  -- already reduced.

  if v_asked > 0 then
    if v_owner is null then
      raise exception 'KHEM Points belong to an account. Sign in to redeem them.'
        using errcode = 'check_violation', hint = 'BENEFIT:POINTS_NOT_SIGNED_IN';
    end if;

    /*
     * The ladder, stated as four refusals rather than one, because "points
     * cannot be used here" tells a customer nothing they can act on.
     *
     * Every switch is read through `coalesce(…, false)`. `"BenefitSetting"` is
     * seeded by 0058 and its primary key admits exactly one row, so an absent
     * row should be impossible — but `not null` is `null`, which is not `true`,
     * so a missing row would silently *permit* every combination the house has
     * refused. A guard about money fails closed or it is not a guard.
     */
    if v_disc_id is not null
       and not coalesce(v_settings."pointsStackWithCodes", false) then
      raise exception 'KHEM Points cannot be combined with a discount code.'
        using errcode = 'check_violation', hint = 'BENEFIT:POINTS_WITH_CODE';
    end if;

    if v_promoted
       and not coalesce(v_settings."pointsStackWithPromotions", false) then
      raise exception 'KHEM Points cannot be combined with a promotional price.'
        using errcode = 'check_violation', hint = 'BENEFIT:POINTS_WITH_PROMOTION';
    end if;

    if v_offer_id is not null
       and not coalesce(v_settings."pointsStackWithOffers", false) then
      raise exception 'KHEM Points cannot be combined with an offer.'
        using errcode = 'check_violation', hint = 'BENEFIT:POINTS_WITH_OFFER';
    end if;

    if v_credit_id is not null
       and not coalesce(v_settings."pointsStackWithCredit", false) then
      raise exception 'KHEM Points cannot be combined with a Discovery Credit.'
        using errcode = 'check_violation', hint = 'BENEFIT:POINTS_WITH_CREDIT';
    end if;

    perform pg_advisory_xact_lock(hashtext('khem.points:' || v_owner));

    v_points := public.resolve_points_redemption(jsonb_build_object(
      'clerkUserId', v_owner,
      'points', v_asked,
      'remainingInCents', v_remaining
    ));

    if not coalesce((v_points->>'ok')::boolean, false) then
      raise exception '%', coalesce(v_points->>'reason', 'Those points cannot be redeemed.')
        using errcode = 'check_violation',
              hint = 'BENEFIT:POINTS_' || coalesce(v_points->>'reasonCode', 'UNKNOWN');
    end if;

    v_points_qty := (v_points->>'points')::int;
    v_points_amt := (v_points->>'amountInCents')::int;

    insert into public.points_transactions
      ("clerkUserId", amount, source, "orderId", note)
    values (
      v_owner, -v_points_qty, 'REDEMPTION', v_order_id,
      'Redeemed against ' || v_number
    );

    v_remaining := v_remaining - v_points_amt;
  end if;

  -- ── 5. Discovery Credit ───────────────────────────────────
  --
  -- The 0051 block, unchanged but for the cap, which now subtracts what the
  -- offer and the points took as well as the discount.
  --
  -- Deliberately **not** gated on `"BenefitSetting"."discoveryCreditEnabled"`. A
  -- credit is a promise the house has already made; withdrawing it because a
  -- switch moved would be the same harm as deleting it. The switch stops
  -- issuance, in `issue_discovery_credits()`.

  if v_credit_id is not null then
    if v_owner is null then
      raise exception 'A Discovery Credit belongs to an account. Sign in to use it.'
        using errcode = 'check_violation';
    end if;

    perform 1
      from public.customer_credits c
     where c.id = v_credit_id
       for update;

    if not found then
      raise exception 'That credit does not exist.'
        using errcode = 'foreign_key_violation';
    end if;

    select b."clerkUserId", b.status, b."balanceInCents"
      into v_credit
      from public.credit_balances b
     where b.id = v_credit_id;

    if v_credit."clerkUserId" is distinct from v_owner then
      raise exception 'That credit belongs to another account.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'PENDING_DELIVERY' then
      raise exception 'That credit becomes available when your Discovery Set is delivered.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'EXPIRED' then
      raise exception 'That credit has passed its sixty-day window.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'CANCELLED' then
      raise exception 'That credit was cancelled when its Discovery Set was refunded.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status <> 'AVAILABLE' or v_credit."balanceInCents" <= 0 then
      raise exception 'That credit has already been used.'
        using errcode = 'check_violation';
    end if;

    select count(*)
      into v_eligible
      from public."OrderItem" i
      join public."Product" p on p.slug = i."productSlug"
      join public."Collection" col on col.slug = p."collectionSlug"
     where i."orderId" = v_order_id
       and col.kind = 'FRAGRANCE';

    if v_eligible = 0 then
      raise exception 'A Discovery Credit pays for a full-size fragrance. Add one to your bag.'
        using errcode = 'check_violation';
    end if;

    -- The 0027 rule, unchanged and still the strictest adjacency in the system.
    if v_disc_id is not null then
      raise exception 'A Discovery Credit cannot be combined with a promotional discount.'
        using errcode = 'check_violation';
    end if;

    v_applied := least(v_credit."balanceInCents", v_remaining);

    /*
     * The ledger row is written for the credit's **whole** balance, not for the
     * amount applied. That difference is the forfeit: a credit has no cash value
     * and does not carry a remainder.
     */
    insert into public.credit_transactions
      ("creditId", kind, "amountInCents", "orderId", note)
    values (
      v_credit_id,
      'USED',
      -v_credit."balanceInCents",
      v_order_id,
      'Redeemed against ' || v_number
    );

    v_remaining := v_remaining - v_applied;
  end if;

  update public."Order"
     set "subtotalInCents"      = v_subtotal,
         "offerId"              = v_offer_id,
         "offerLabel"           = v_offer_lbl,
         "offerDiscountInCents" = v_offer_amt,
         "discountId"           = v_disc_id,
         "discountCode"         = v_disc_code,
         "discountInCents"      = v_disc_amt,
         "pointsRedeemed"       = v_points_qty,
         "pointsInCents"        = v_points_amt,
         "creditId"             = v_credit_id,
         "creditAppliedInCents" = v_applied,
         -- Every reduction was capped against what the one before it left, so
         -- this can never fall below `"shipInCents"` and never below zero.
         "totalInCents"         = v_subtotal + v_ship
                                  - v_offer_amt - v_disc_amt
                                  - v_points_amt - v_applied,
         "updatedAt"            = now()
   where id = v_order_id;

  /*
   * ── 6. The sales ledger ───────────────────────────────────
   *
   * New in 0062, and the last thing this function does. Everything it reads has
   * just been written, and it is inside this transaction, so an order that
   * fails leaves no analytical row behind and an order that succeeds always has
   * one per line.
   *
   * It records; it decides nothing. No figure above depends on it.
   */
  perform public.record_sales_ledger(v_order_id);

  return v_number;
end;
$$;

-- ── SalesLedgerRow ──────────────────────────────────────────
--
-- The reporting shape: every snapshot the ledger holds, plus the order's
-- **current** disposition.
--
-- The join is the whole design. A refund happens after a sale, so recording
-- "sold" on the row and then trying to keep it in step would be a second refund
-- system quietly disagreeing with the first. `set_order_status()` remains the
-- only authority on whether money was given back; this reads its answer.
--
-- `security_invoker = on` so the view cannot be used as a way around the RLS on
-- the tables beneath it.

create or replace view public."SalesLedgerRow"
with (security_invoker = on) as
select
  l.id,
  l."orderId",
  l."orderItemId",
  l."orderNumber",
  l.channel,
  l."soldAt",
  l."productSlug",
  l."productName",
  l.sku,
  l."collectionSlug",
  l."collectionName",
  l.quantity,
  l."originalUnitPriceInCents",
  l."originalLineTotalInCents",
  l."promotionDiscountInCents",
  l."offerDiscountInCents",
  l."couponDiscountInCents",
  l."pointsDiscountInCents",
  l."creditDiscountInCents",
  l."totalDiscountInCents",
  l."paidInCents",
  l."freeUnits",
  l."isFree",
  l."discountSources",
  l."promotionId",
  l."offerId",
  l."offerLabel",
  l."discountId",
  l."discountCode",
  l."creditId",
  l."unitCostInCents",
  l."totalCostInCents",
  l."grossProfitInCents",
  o.status         as "orderStatus",
  o."paymentStatus" as "paymentStatus",
  o."customerName",
  /*
   * Four states, in the order they override one another.
   *
   * CANCELLED and REFUNDED are both money the boutique does not have, and
   * neither counts as revenue anywhere below. PAID is money collected; SOLD is
   * an order that has happened and is not yet settled — a cash parcel with a
   * courier, which is a healthy state and not a failure.
   */
  case
    when o.status = 'CANCELLED' then 'CANCELLED'
    when o.status = 'REFUNDED' or o."paymentStatus" = 'REFUNDED' then 'REFUNDED'
    when o."paymentStatus" = 'PAID' then 'PAID'
    else 'SOLD'
  end as "saleStatus",
  (o.status not in ('CANCELLED', 'REFUNDED') and o."paymentStatus" <> 'REFUNDED')
    as "countsAsRevenue"
from public.order_item_sales_ledger l
join public."Order" o on o.id = l."orderId";

-- ── sales_ledger_summary ────────────────────────────────────
--
-- The overview tiles, as one row.
--
-- Aggregation is Postgres's job, for `0015_orders.sql`'s reason: summing the
-- ledger in Node means fetching every line ever sold to print eight numbers,
-- and getting slower with each sale.
--
-- **Revenue is not profit**, and the two columns are named so that no screen
-- can accidentally call one the other. `revenueInCents` is what customers paid
-- for merchandise; `profitInCents` is what is left after the goods cost. The
-- gap between them is `costInCents`, and it is only ever the cost of the lines
-- that actually had one — `linesMissingCost` says how many did not, so a
-- dashboard can say "incomplete" instead of implying a margin it cannot
-- support.

create or replace function public.sales_ledger_summary(
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_channel text        default null
)
returns table (
  "orderCount"             int,
  "lineCount"              int,
  units                    int,
  "originalInCents"        bigint,
  "discountInCents"        bigint,
  "revenueInCents"         bigint,
  "costInCents"            bigint,
  "profitInCents"          bigint,
  "costedRevenueInCents"   bigint,
  "linesMissingCost"       int,
  "refundedOrderCount"     int,
  "refundedRevenueInCents" bigint,
  "freeLineCount"          int
)
language sql
stable
security definer
set search_path = public
as $$
  with rows_in_window as (
    select *
      from public."SalesLedgerRow" r
     where (p_from is null or r."soldAt" >= p_from)
       and (p_to   is null or r."soldAt" <= p_to)
       and (p_channel is null or r.channel::text = p_channel)
  )
  select
    count(distinct r."orderId") filter (where r."countsAsRevenue")::int,
    count(*) filter (where r."countsAsRevenue")::int,
    coalesce(sum(r.quantity) filter (where r."countsAsRevenue"), 0)::int,
    coalesce(sum(r."originalLineTotalInCents") filter (where r."countsAsRevenue"), 0)::bigint,
    coalesce(sum(r."totalDiscountInCents") filter (where r."countsAsRevenue"), 0)::bigint,
    coalesce(sum(r."paidInCents") filter (where r."countsAsRevenue"), 0)::bigint,
    -- **Not** coalesced to zero, unlike everything above it. A window in which
    -- nothing carried a cost has an *unknown* cost, and zero would read as
    -- "these sales were pure profit" — the single most misleading number this
    -- table could print. Null travels up to the dashboard, which says so.
    (sum(r."totalCostInCents") filter (where r."countsAsRevenue"))::bigint,
    (sum(r."grossProfitInCents") filter (where r."countsAsRevenue"))::bigint,
    -- The revenue of the costed lines only. Dividing profit by *this* is the
    -- honest margin when part of the catalogue has no cost on it.
    coalesce(sum(r."paidInCents")
      filter (where r."countsAsRevenue" and r."unitCostInCents" is not null), 0)::bigint,
    count(*) filter (where r."countsAsRevenue" and r."unitCostInCents" is null)::int,
    count(distinct r."orderId") filter (where not r."countsAsRevenue")::int,
    coalesce(sum(r."paidInCents") filter (where not r."countsAsRevenue"), 0)::bigint,
    count(*) filter (where r."countsAsRevenue" and r."isFree")::int
  from rows_in_window r;
$$;

-- ── sales_ledger_by_product ─────────────────────────────────
--
-- "Which products actually make money", which is a different question from
-- "which products sell", and the reason `product_sales()` in 0015 is not enough:
-- that one ranks by charged price and knows nothing about what was given away
-- or what the goods cost.
--
-- Ordered by gross profit, nulls last — a product with no cost cannot be ranked
-- against one that has, and pretending its profit is its revenue would put it
-- straight to the top.

create or replace function public.sales_ledger_by_product(
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_channel text        default null,
  p_limit   int         default 100
)
returns table (
  "productSlug"          text,
  "productName"          text,
  sku                    text,
  "collectionName"       text,
  units                  int,
  "orderCount"           int,
  "originalInCents"      bigint,
  "discountInCents"      bigint,
  "revenueInCents"       bigint,
  "costInCents"          bigint,
  "profitInCents"        bigint,
  "costedRevenueInCents" bigint,
  "linesMissingCost"     int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r."productSlug",
    -- The most recent snapshot of the name, so a renamed product reports under
    -- what it is called now while every historical figure stays as it was.
    (array_agg(r."productName" order by r."soldAt" desc))[1],
    (array_agg(r.sku order by r."soldAt" desc))[1],
    (array_agg(r."collectionName" order by r."soldAt" desc))[1],
    coalesce(sum(r.quantity), 0)::int,
    count(distinct r."orderId")::int,
    coalesce(sum(r."originalLineTotalInCents"), 0)::bigint,
    coalesce(sum(r."totalDiscountInCents"), 0)::bigint,
    coalesce(sum(r."paidInCents"), 0)::bigint,
    -- Null rather than zero when this product has never carried a cost — see
    -- `sales_ledger_summary()`.
    (sum(r."totalCostInCents"))::bigint,
    (sum(r."grossProfitInCents"))::bigint,
    coalesce(sum(r."paidInCents") filter (where r."unitCostInCents" is not null), 0)::bigint,
    count(*) filter (where r."unitCostInCents" is null)::int
  from public."SalesLedgerRow" r
  where r."countsAsRevenue"
    and (p_from is null or r."soldAt" >= p_from)
    and (p_to   is null or r."soldAt" <= p_to)
    and (p_channel is null or r.channel::text = p_channel)
  group by r."productSlug"
  order by 11 desc nulls last, 9 desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

-- ── Backfill ────────────────────────────────────────────────
--
-- Every order that has lines and is missing at least one ledger row, through
-- the same function new orders use. One code path, so a historical row and a
-- row written this morning were produced by identical arithmetic.
--
-- Idempotent twice over: the predicate skips orders already recorded, and
-- `record_sales_ledger()` conflicts on `"orderItemId"` regardless. Running
-- `npm run db:migrate` a second time writes nothing.
--
-- **Cost is null on every backfilled row, always.** No cost was recorded before
-- this migration, so there is none to snapshot, and stamping today's figure onto
-- last year's sale would be inventing a margin. The dashboard says "Cost
-- unavailable" instead, which is true.

do $$
declare
  v_order record;
  v_total int := 0;
begin
  for v_order in
    select o.id
      from public."Order" o
     where exists (
       select 1
         from public."OrderItem" i
        where i."orderId" = o.id
          and not exists (
            select 1
              from public.order_item_sales_ledger l
             where l."orderItemId" = i.id
          )
     )
     order by o."placedAt"
  loop
    v_total := v_total + public.record_sales_ledger(v_order.id);
  end loop;

  if v_total > 0 then
    raise notice 'Sales ledger backfilled: % row(s).', v_total;
  end if;
end $$;

-- ── Row level security ──────────────────────────────────────
--
-- On, with no policy at all — 0015's posture, and the case is stronger here
-- than it is for an order: these rows carry the house's cost and margin as well
-- as its revenue. Nothing reaches this table except code holding
-- SUPABASE_SECRET_KEY.

alter table public.order_item_sales_ledger enable row level security;

drop policy if exists "Sales ledger is readable" on public.order_item_sales_ledger;

-- ── Privileges ──────────────────────────────────────────────
--
-- `0006_privileges.sql` runs long before this file, so its
-- `alter default privileges … grant select on tables` applies to everything
-- created here. For the catalog that default is right; for revenue and cost it
-- is not. Taken back explicitly, and the view with it — even with
-- `security_invoker` there is no reason a browser key should see a margin.
--
-- ⚠ `from public`, not just `from anon, authenticated`, on every function.
-- Postgres grants EXECUTE on each new function to the pseudo-role PUBLIC, which
-- every role inherits; revoking by role name leaves that inherited grant intact.
-- `place_order()` is `security definer`, so an anon role that may execute it is
-- a write path with the door left open — proved once already, in 0015.

revoke all on public.order_item_sales_ledger from anon, authenticated;
revoke all on public."SalesLedgerRow"        from anon, authenticated;

/*
 * ── The cost column, which needs more than a convention ─────
 *
 * `0006_privileges.sql` grants the public roles `select` on `"Product"`, and
 * the RLS policy lets them read every published row. A column added to that
 * table is therefore **public by default**, and PostgREST will return any
 * column the caller holds `select` on — so "no storefront projection selects
 * it" is a statement about this repository's code, not about what a browser can
 * ask for. `?select=slug,costInCents` with the publishable key is one request.
 *
 * That was proved rather than assumed: before this block, the publishable key
 * could read the column. It was empty at the time, which is the only reason
 * nothing had leaked.
 *
 * Postgres will not let a column-level revoke undercut a table-level grant, so
 * the fix is the documented shape — take the table grant back, then hand the
 * columns out one by one, minus this one.
 *
 * The list is **built from the catalogue** rather than written here. A literal
 * list would turn every future `alter table "Product" add column` into a column
 * the storefront silently could not read, which is a worse failure than the one
 * being fixed. This file re-runs on every `npm run db:migrate`, after the file
 * that added the column and inside the same transaction, so a new column is
 * granted the moment it exists and `costInCents` stays out for good.
 */
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'Product'
     and column_name <> 'costInCents';

  revoke select on public."Product" from anon, authenticated;
  execute format(
    'grant select (%s) on public."Product" to anon, authenticated', v_cols
  );
end $$;

-- Restated because the revoke above is table-wide. The secret key reads the
-- cost — that is the whole point of the column — and the dashboard is the only
-- thing holding it.
grant all on public."Product" to service_role;

revoke all on function public.allocate_amount(jsonb, int)                    from public, anon, authenticated;
revoke all on function public.offer_reward_units(jsonb, text)                from public, anon, authenticated;
revoke all on function public.offer_value_of(jsonb, text)                    from public, anon, authenticated;
revoke all on function public.discount_eligible_order_items(text, text)      from public, anon, authenticated;
revoke all on function public.discount_eligible_subtotal(text, text)         from public, anon, authenticated;
revoke all on function public.record_sales_ledger(text)                      from public, anon, authenticated;
revoke all on function public.place_order(jsonb)                             from public, anon, authenticated;
revoke all on function public.sales_ledger_summary(timestamptz, timestamptz, text)         from public, anon, authenticated;
revoke all on function public.sales_ledger_by_product(timestamptz, timestamptz, text, int) from public, anon, authenticated;

grant all    on public.order_item_sales_ledger to service_role;
grant select on public."SalesLedgerRow"        to service_role;

grant execute on function public.allocate_amount(jsonb, int)                to service_role;
grant execute on function public.offer_reward_units(jsonb, text)            to service_role;
grant execute on function public.offer_value_of(jsonb, text)                to service_role;
grant execute on function public.discount_eligible_order_items(text, text)  to service_role;
grant execute on function public.discount_eligible_subtotal(text, text)     to service_role;
grant execute on function public.record_sales_ledger(text)                  to service_role;
grant execute on function public.place_order(jsonb)                         to service_role;
grant execute on function public.sales_ledger_summary(timestamptz, timestamptz, text)         to service_role;
grant execute on function public.sales_ledger_by_product(timestamptz, timestamptz, text, int) to service_role;
