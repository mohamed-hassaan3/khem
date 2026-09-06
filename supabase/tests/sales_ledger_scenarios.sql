-- KHEM — functional checks for the sales & profitability ledger.
--
--     npm run db:test:sales
--
-- ── Read this before running it ─────────────────────────────
--
-- This file **places real orders**. The runner (`scripts/db-test-sales.ts`)
-- wraps it in a transaction and always rolls back, so nothing survives — but
-- `order_number_seq` and `gen_random_uuid()` are not transactional, so the
-- visible trace of a run is a gap in the order numbering. That is the entire
-- cost, and it buys the only kind of check worth having here: the scenarios go
-- through `place_order()` exactly as a customer or the desk would, rather than
-- through a fixture that could agree with a bug.
--
-- Everything it touches — prices, costs, stock, the rewards switch, live
-- campaigns — is edited inside the same transaction and reverted by the
-- rollback.
--
-- ── What is asserted ────────────────────────────────────────
--
-- The nine scenarios in `src/docs/Sales-Profitability-Items-Sold-ledger.md` §21,
-- and after them the two invariants that must hold over every row the ledger
-- has ever written:
--
--   · a line's original value minus everything taken off equals what was paid;
--   · an order's ledger rows sum to its merchandise total, delivery excluded.
--
-- A failure raises, which rolls the transaction back and exits non-zero.

do $$
declare
  -- The three fragrances and the Discovery Set the scenarios are run against.
  -- Borrowed from the live catalogue rather than invented, so the product-type
  -- and collection-kind triggers are satisfied by rows that already satisfy
  -- them.
  a_slug     text;
  b_slug     text;
  c_slug     text;
  d_slug     text;
  frag_coll  text;

  v_disc_id  text;
  v_promo_id text;
  v_offer_id text;
  v_credit   text;

  n1 text; n2 text; n3 text; n4 text; n5 text; n6 text;
  o1 text; o4 text; od text;

  owner_id text := 'user_ledger_scenarios';
  r        record;
  v_int      int;
  v_before   int;
  v_after    int;
  v_bool     boolean;
  v_status   text;

  passed     int := 0;
begin
  -- ── Setup ─────────────────────────────────────────────────
  --
  -- Silence every live campaign first. A promotion or an offer the house is
  -- actually running would otherwise reprice a scenario and make this file fail
  -- on a Tuesday for reasons that have nothing to do with the ledger.
  update public.promotions set "isActive" = false where "isActive";
  update public.offers      set "isActive" = false where "isActive";

  select p.slug, p."collectionSlug"
    into a_slug, frag_coll
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
   where c.kind = 'FRAGRANCE' and not p."isArchived"
   order by p.slug limit 1;

  select p.slug into b_slug
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
   where c.kind = 'FRAGRANCE' and not p."isArchived" and p.slug <> a_slug
     and p."collectionSlug" = frag_coll
   order by p.slug limit 1;

  select p.slug into c_slug
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
   where c.kind = 'FRAGRANCE' and not p."isArchived"
     and p.slug not in (a_slug, b_slug)
     and p."collectionSlug" = frag_coll
   order by p.slug limit 1;

  select p.slug into d_slug
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
   where c.kind = 'DISCOVERY' and not p."isArchived"
   order by p.slug limit 1;

  if a_slug is null or b_slug is null or c_slug is null then
    raise exception 'These scenarios need three live fragrances in one collection; the catalogue has fewer.';
  end if;

  -- Deep enough that no scenario can run the shelf out, on both counters,
  -- because scenario 1 is an offline sale and the rest are online.
  update public."Product"
     set "inventoryOnline" = 500, "inventoryOffline" = 500
   where slug in (a_slug, b_slug, c_slug, coalesce(d_slug, a_slug));

  -- ── 1. A normal sale ──────────────────────────────────────
  --
  -- 1,800 EGP, cost 650 EGP, nothing taken off. The simplest row the ledger can
  -- hold, and the one every other scenario is a deviation from.
  update public."Product"
     set "priceInCents" = 180000, "costInCents" = 65000
   where slug = a_slug;

  n1 := public.place_order(jsonb_build_object(
    'customerName', 'Ledger Scenario One',
    'channel', 'OFFLINE',
    'items', jsonb_build_array(jsonb_build_object('slug', a_slug, 'quantity', 1))
  ));

  select l.* into r
    from public.order_item_sales_ledger l
   where l."orderNumber" = n1;

  if r."originalLineTotalInCents" <> 180000
     or r."totalDiscountInCents" <> 0
     or r."paidInCents" <> 180000
     or r."unitCostInCents" <> 65000
     or r."totalCostInCents" <> 65000
     or r."grossProfitInCents" <> 115000
     or r.channel <> 'OFFLINE'
     or r."isFree" then
    raise exception 'Normal sale: expected 180000 / 0 / 180000 with cost 65000, got % / % / % cost %',
      r."originalLineTotalInCents", r."totalDiscountInCents", r."paidInCents", r."unitCostInCents";
  end if;
  passed := passed + 1;
  raise notice '  ok  normal sale — 1,800 in, 1,800 paid, 650 cost, 1,150 profit';

  -- ── 8. Offline order ──────────────────────────────────────
  --
  -- Asserted on the row above rather than by placing a second one: scenario 1
  -- *is* an offline sale, and the point of the check is that a walk-in reaches
  -- the ledger at all.
  select count(*)::int into v_int
    from public."SalesLedgerRow" s
   where s."orderNumber" = n1 and s.channel = 'OFFLINE';
  if v_int <> 1 then
    raise exception 'Offline order: the desk sale did not reach Items Sold.';
  end if;
  passed := passed + 1;
  raise notice '  ok  offline order — a desk sale appears in Items Sold';

  -- ── 2. A coupon ───────────────────────────────────────────
  --
  -- 10% off 1,800 → 180 off, 1,620 paid. The coupon column carries it and the
  -- other four stay at zero: the ledger must be able to say *which* instrument
  -- gave the money away.
  insert into public.discounts (code, kind, value, "appliesTo")
  values ('LEDGERSCENARIO10', 'PERCENTAGE', 10, 'ALL')
  returning id into v_disc_id;

  n2 := public.place_order(jsonb_build_object(
    'customerName', 'Ledger Scenario Two',
    'channel', 'ONLINE',
    'discountCode', 'LEDGERSCENARIO10',
    'items', jsonb_build_array(jsonb_build_object('slug', a_slug, 'quantity', 1))
  ));

  select l.* into r from public.order_item_sales_ledger l where l."orderNumber" = n2;

  if r."originalLineTotalInCents" <> 180000
     or r."couponDiscountInCents" <> 18000
     or r."paidInCents" <> 162000
     or r."promotionDiscountInCents" <> 0
     or r."discountCode" <> 'LEDGERSCENARIO10'
     or not (r."discountSources" @> array['COUPON']) then
    raise exception 'Coupon: expected 180000 / coupon 18000 / 162000, got % / % / %',
      r."originalLineTotalInCents", r."couponDiscountInCents", r."paidInCents";
  end if;
  passed := passed + 1;
  raise notice '  ok  coupon — 10%% of 1,800 recorded as a coupon, 1,620 paid';

  -- ── 3. A promotion ────────────────────────────────────────
  --
  -- 20% off 1,800 → the campaign price of 1,440 reaches the till, and the
  -- ledger reports the *list* price with the reduction beside it rather than a
  -- 1,440 product that was never discounted.
  insert into public.promotions (name, kind, value, "appliesTo", "isActive")
  values ('Ledger scenario promotion', 'PERCENTAGE', 20, 'PRODUCTS', true)
  returning id into v_promo_id;

  insert into public.promotion_products ("promotionId", "productSlug")
  values (v_promo_id, a_slug);

  n3 := public.place_order(jsonb_build_object(
    'customerName', 'Ledger Scenario Three',
    'channel', 'ONLINE',
    'items', jsonb_build_array(jsonb_build_object('slug', a_slug, 'quantity', 1))
  ));

  select l.* into r from public.order_item_sales_ledger l where l."orderNumber" = n3;

  if r."originalLineTotalInCents" <> 180000
     or r."promotionDiscountInCents" <> 36000
     or r."paidInCents" <> 144000
     or r."promotionId" is distinct from v_promo_id then
    raise exception 'Promotion: expected 180000 / promotion 36000 / 144000, got % / % / %',
      r."originalLineTotalInCents", r."promotionDiscountInCents", r."paidInCents";
  end if;
  passed := passed + 1;
  raise notice '  ok  promotion — list 1,800, campaign took 360, 1,440 paid';

  update public.promotions set "isActive" = false where id = v_promo_id;

  -- ── 4. Buy 2 Get 1 ────────────────────────────────────────
  --
  -- 890 + 1,470 + 2,200, the cheapest free. The assertion that matters is not
  -- the 3,670 total — a pro-rata split would reach that too — it is that the
  -- **890 row** reads zero and the other two read their full price. Anything
  -- else means the ledger cannot answer which product was given away.
  update public."Product" set "priceInCents" =  89000, "costInCents" = 30000 where slug = a_slug;
  update public."Product" set "priceInCents" = 147000, "costInCents" = 52000 where slug = b_slug;
  update public."Product" set "priceInCents" = 220000, "costInCents" = 80000 where slug = c_slug;

  insert into public.offers (
    name, "triggerQuantity", "triggerScope", "rewardQuantity", "rewardKind",
    "rewardScope", "rewardSelection", audience, "isActive"
  ) values (
    'Ledger scenario buy two get one', 2, 'COLLECTIONS', 1, 'FREE_ITEM',
    'COLLECTIONS', 'LOWEST_PRICED', 'EVERYONE', true
  ) returning id into v_offer_id;

  insert into public.offer_trigger_collections ("offerId", "collectionSlug")
  values (v_offer_id, frag_coll);
  insert into public.offer_reward_collections ("offerId", "collectionSlug")
  values (v_offer_id, frag_coll);

  n4 := public.place_order(jsonb_build_object(
    'customerName', 'Ledger Scenario Four',
    'channel', 'ONLINE',
    'items', jsonb_build_array(
      jsonb_build_object('slug', a_slug, 'quantity', 1),
      jsonb_build_object('slug', b_slug, 'quantity', 1),
      jsonb_build_object('slug', c_slug, 'quantity', 1)
    )
  ));

  select o.id into o4 from public."Order" o where o."orderNumber" = n4;

  select l.* into r
    from public.order_item_sales_ledger l
   where l."orderNumber" = n4 and l."productSlug" = a_slug;

  if r."paidInCents" <> 0 or not r."isFree" or r."freeUnits" <> 1
     or r."offerDiscountInCents" <> 89000 then
    raise exception 'Buy 2 Get 1: the 890 line should be free, got paid % free % units %',
      r."paidInCents", r."isFree", r."freeUnits";
  end if;

  select l."paidInCents" into v_int
    from public.order_item_sales_ledger l
   where l."orderNumber" = n4 and l."productSlug" = c_slug;
  if v_int <> 220000 then
    raise exception 'Buy 2 Get 1: the dearest bottle must be paid for in full, got %', v_int;
  end if;

  select coalesce(sum(l."paidInCents"), 0)::int into v_int
    from public.order_item_sales_ledger l where l."orderNumber" = n4;
  if v_int <> 367000 then
    raise exception 'Buy 2 Get 1: expected 367000 paid across the order, got %', v_int;
  end if;
  passed := passed + 1;
  raise notice '  ok  buy 2 get 1 — the 890 bottle free, 3,670 paid, the 2,200 untouched';

  update public.offers set "isActive" = false where id = v_offer_id;

  -- ── 5. A Discovery Credit ─────────────────────────────────
  --
  -- Issued the way the house issues one — a Discovery Set bought by a signed-in
  -- customer, settled and delivered — then spent on a full-size fragrance. The
  -- assertion is that it lands in its **own** column: a credit is not a coupon,
  -- and reporting cannot conflate the two.
  if d_slug is not null then
    update public."Product" set "priceInCents" = 40000 where slug = d_slug;

    od := null;
    n5 := public.place_order(jsonb_build_object(
      'customerName', 'Ledger Scenario Five',
      'customerEmail', 'ledger.scenarios@example.invalid',
      'clerkUserId', owner_id,
      'channel', 'ONLINE',
      'items', jsonb_build_array(jsonb_build_object('slug', d_slug, 'quantity', 1))
    ));

    select o.id into od from public."Order" o where o."orderNumber" = n5;

    perform public.settle_order_payment(od, 'pi_ledger_scenarios');
    perform public.set_order_status(od, 'SHIPPED');
    perform public.set_order_status(od, 'DELIVERED');

    select c.id into v_credit
      from public.customer_credits c
     where c."sourceOrderId" = od
     limit 1;

    if v_credit is null then
      raise exception 'Discovery Credit: the set did not issue one, so the scenario cannot run.';
    end if;

    update public."Product" set "priceInCents" = 147000, "costInCents" = 52000 where slug = b_slug;

    n6 := public.place_order(jsonb_build_object(
      'customerName', 'Ledger Scenario Five',
      'customerEmail', 'ledger.scenarios@example.invalid',
      'clerkUserId', owner_id,
      'channel', 'ONLINE',
      'creditId', v_credit,
      'items', jsonb_build_array(jsonb_build_object('slug', b_slug, 'quantity', 1))
    ));

    select l.* into r from public.order_item_sales_ledger l where l."orderNumber" = n6;

    if r."creditDiscountInCents" <> 40000
       or r."paidInCents" <> 107000
       or r."couponDiscountInCents" <> 0
       or not (r."discountSources" @> array['DISCOVERY_CREDIT']) then
      raise exception 'Discovery Credit: expected credit 40000 and 107000 paid, got % / %',
        r."creditDiscountInCents", r."paidInCents";
    end if;
    passed := passed + 1;
    raise notice '  ok  discovery credit — 400 recorded as a credit, not a discount, 1,070 paid';
  else
    raise notice '  -   discovery credit skipped: the catalogue has no Discovery collection';
  end if;

  -- ── 6. Rewards points ─────────────────────────────────────
  --
  -- 100 points at the house rate is 50 EGP. The check is the same as the
  -- credit's and for the same reason: points are a reward the customer earned,
  -- not a discount the house ran, and a margin report that mixed them would be
  -- describing two different kinds of giveaway as one.
  update public."BenefitSetting" set "rewardsEnabled" = true where id = 'default';

  insert into public.points_transactions ("clerkUserId", amount, source, note)
  values (owner_id, 400, 'ADMIN_ADJUSTMENT', 'Ledger scenario balance');

  update public."Product" set "priceInCents" = 147000, "costInCents" = 52000 where slug = b_slug;

  n5 := public.place_order(jsonb_build_object(
    'customerName', 'Ledger Scenario Six',
    'customerEmail', 'ledger.scenarios@example.invalid',
    'clerkUserId', owner_id,
    'channel', 'ONLINE',
    'pointsToRedeem', 100,
    'items', jsonb_build_array(jsonb_build_object('slug', b_slug, 'quantity', 1))
  ));

  select l.* into r from public.order_item_sales_ledger l where l."orderNumber" = n5;

  if r."pointsDiscountInCents" <> 5000
     or r."paidInCents" <> 142000
     or r."couponDiscountInCents" <> 0
     or r."creditDiscountInCents" <> 0
     or not (r."discountSources" @> array['REWARDS']) then
    raise exception 'Points: expected points 5000 and 142000 paid, got % / %',
      r."pointsDiscountInCents", r."paidInCents";
  end if;
  passed := passed + 1;
  raise notice '  ok  rewards — 100 points recorded as points, not a product discount';

  -- ── 7. A refund ───────────────────────────────────────────
  --
  -- The row stays — the sale happened and the history is worth keeping — but it
  -- stops counting. Nothing is deleted and nothing is rewritten: the ledger
  -- reads the refund out of the order, which is the only place it is recorded.
  select o.id into o1 from public."Order" o where o."orderNumber" = n1;

  select coalesce(s."revenueInCents", 0)::int into v_before
    from public.sales_ledger_summary(null, null, null) s;

  perform public.set_order_status(o1, 'REFUNDED');

  select s."countsAsRevenue", s."saleStatus" into v_bool, v_status
    from public."SalesLedgerRow" s where s."orderNumber" = n1;

  if v_bool or v_status <> 'REFUNDED' then
    raise exception 'Refund: the refunded line still counts as revenue (%).', v_status;
  end if;

  -- The row is still there — a refunded sale is history worth keeping — but the
  -- 1,800 it earned has left the totals exactly once.
  select coalesce(s."revenueInCents", 0)::int into v_after
    from public.sales_ledger_summary(null, null, null) s;

  if v_after <> v_before - 180000 then
    raise exception 'Refund: revenue moved by % when it should have fallen by 180000.',
      v_before - v_after;
  end if;

  select count(*)::int into v_int
    from public.sales_ledger_by_product(null, null, null, 500) p
   where p."productSlug" = a_slug and p."revenueInCents" < 0;
  if v_int > 0 then
    raise exception 'Refund: product performance went negative after a refund.';
  end if;

  select count(*)::int into v_int
    from public.order_item_sales_ledger l where l."orderNumber" = n1;
  if v_int <> 1 then
    raise exception 'Refund: the ledger row was deleted rather than discounted.';
  end if;

  passed := passed + 1;
  raise notice '  ok  refund — the line survives, its 1,800 leaves the totals';

  -- ── 9. A price change after the sale ──────────────────────
  --
  -- The whole reason the ledger snapshots instead of joining. The catalogue
  -- moves; last quarter's margin does not.
  update public."Product" set "priceInCents" = 999900, "costInCents" = 999900 where slug = a_slug;

  select l.* into r from public.order_item_sales_ledger l where l."orderNumber" = n2;
  if r."originalLineTotalInCents" <> 180000 or r."paidInCents" <> 162000 then
    raise exception 'Historical price: the old sale moved with the catalogue — % / %',
      r."originalLineTotalInCents", r."paidInCents";
  end if;
  passed := passed + 1;
  raise notice '  ok  historical price — a repriced product leaves old sales alone';

  -- ── 10. Idempotency ───────────────────────────────────────
  --
  -- The guarantee that makes a retried order flow safe. `place_order()` already
  -- called this once for each order above; a second call must write nothing.
  if public.record_sales_ledger(o4) <> 0 then
    raise exception 'Idempotency: re-recording an order wrote a duplicate row.';
  end if;

  select count(*)::int into v_int
    from public.order_item_sales_ledger l where l."orderId" = o4;
  if v_int <> 3 then
    raise exception 'Idempotency: expected 3 rows for the offer order, found %.', v_int;
  end if;
  passed := passed + 1;
  raise notice '  ok  idempotency — re-recording an order writes nothing';

  -- ── The invariants, over every row in the table ───────────
  select count(*)::int into v_int
    from public.order_item_sales_ledger l
   where l."originalLineTotalInCents" - l."totalDiscountInCents" <> l."paidInCents";
  if v_int > 0 then
    raise exception 'Invariant: % row(s) where original - discount <> paid.', v_int;
  end if;

  select count(*)::int into v_int
    from (
      select o.id
        from public."Order" o
        join public.order_item_sales_ledger l on l."orderId" = o.id
       group by o.id, o."totalInCents", o."shipInCents"
      having coalesce(sum(l."paidInCents"), 0)::int <> o."totalInCents" - o."shipInCents"
    ) bad;
  if v_int > 0 then
    raise exception 'Invariant: % order(s) whose ledger does not sum to their merchandise total.', v_int;
  end if;

  select count(*)::int into v_int
    from public."OrderItem" i
   where not exists (
     select 1 from public.order_item_sales_ledger l where l."orderItemId" = i.id
   );
  if v_int > 0 then
    raise exception 'Invariant: % order line(s) with no ledger row.', v_int;
  end if;

  passed := passed + 1;
  raise notice '  ok  invariants — every line balances, every order sums, nothing is missing';

  raise notice '';
  raise notice '% scenario group(s) passed.', passed;
end $$;
