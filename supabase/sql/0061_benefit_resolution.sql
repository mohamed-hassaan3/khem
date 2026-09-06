-- KHEM — how the benefits are resolved against one order.
--
-- Applied by `npm run db:migrate` last, after `0058`–`0060`. This is the **only**
-- file in the loyalty work that can change what a customer is charged, which is
-- the split `0026`/`0027` established for credits: the ledgers and the engines
-- are declared where nothing can move money, and the money moves here.
--
-- ── Read this before re-declaring `place_order()` again ─────
--
-- `place_order()` has now been declared by nine files. Every one of them copies
-- the previous body and changes one thing, and the discipline held until
-- `0040_discount_refusal_detail.sql`, which copied from **0028** instead of
-- **0035** and silently dropped promotion pricing. `0042` and `0051` then copied
-- 0040 forward. For four migrations a running promotion has shown on product
-- cards and been ignored at the till, and `"OrderItem"."promotionId"` has never
-- been written — which also disabled the non-stacking exclusion in
-- `discount_eligible_subtotal()`, since it reads exactly that column.
--
-- This file restores it. The body below is:
--
--   the 0051 body                        (line loop with `move_stock`, credit
--                                         block, discount block with `hint`)
--   + the 0035 promotion pricing         (restored — see above)
--   + the offer block                    (new, 0060)
--   + the points block                   (new, 0059)
--   + the benefit ladder                 (new)
--
-- The next person to add something here must diff against **this** file and
-- must keep every block. Losing one is not a compile error; it is a silent
-- change to what people pay.
--
-- ── The ladder ──────────────────────────────────────────────
--
-- Five things can reduce an order, and they are not the same kind of thing:
--
--   1. promotion  a *price*      chosen by the house   per line
--   2. offer      a *benefit*    chosen by the house   per order
--   3. coupon     a *discount*   typed by the customer per order
--   4. points     a *reward*     spent by the customer per order
--   5. credit     a *credit*     spent by the customer per order
--
-- Automatic before customer-supplied, so a campaign never silently displaces
-- something the customer deliberately chose to use — an offer that would refuse
-- to stack simply does not apply, whereas a coupon a customer typed is refused
-- out loud.
--
-- **One promotional mechanism per order** is the default, and every adjacency is
-- refused unless a named switch permits it:
--
--   promotions."stacksWithCodes"          promotion  + coupon
--   offers."stacksWithCodes"              offer      + coupon
--   offers."stacksWithCredit"             offer      + credit
--   "BenefitSetting"."pointsStackWith*"   points     + each of the four
--   (the 0027 rule, unchanged)            credit     + coupon
--
-- Earning is not stacking and is governed by none of these: a qualifying order
-- earns points on what was actually paid even when all five applied. Only
-- *spending* two benefits together is what they refuse.
--
-- ── Refusals the customer can act on ────────────────────────
--
-- The new guards raise with `hint = 'BENEFIT:<code>'`, beside a sentence written
-- for a customer. `src/actions/checkout.ts` already reads `DISCOUNT:<code>` out
-- of `hint` and translates the name rather than the sentence; this is the same
-- channel, for the same reason — a bilingual storefront must not parse English.

-- ── place_order ─────────────────────────────────────────────

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

  return v_number;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The **0051 body** — the closed-order guard, the forward-only ladder, the
-- delivery gate and all four refund calls — plus the two new reversals.
--
-- Six `perform` calls now hang off one refund, and they are six different
-- things. Dropping any of them is how a customer keeps points for goods they
-- returned, or an offer stays capped against a use that never happened.

create or replace function public.set_order_status(
  order_id text,
  next_status public."OrderStatus"
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public."PaymentStatus";
  v_current public."OrderStatus";
  v_rank    jsonb := '{"PROCESSING": 1, "SHIPPED": 2, "DELIVERED": 3}'::jsonb;
begin
  select status, "paymentStatus"
    into v_current, v_payment
    from public."Order"
   where id = order_id
     for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_current in ('CANCELLED', 'REFUNDED') then
    raise exception
      'Order % is %. A closed order cannot be reopened — record a new one.',
      order_id, lower(v_current::text)
      using errcode = 'check_violation';
  end if;

  if v_rank ? next_status::text
     and (v_rank->>next_status::text)::int <= (v_rank->>v_current::text)::int then
    raise exception
      'Order % is already %. Fulfilment cannot go back to %.',
      order_id, lower(v_current::text), lower(next_status::text)
      using errcode = 'check_violation';
  end if;

  if next_status = 'DELIVERED' and v_payment is distinct from 'PAID' then
    raise exception
      'Order % has not been paid. Record the payment before confirming delivery.',
      order_id
      using errcode = 'check_violation';
  end if;

  update public."Order"
     set status = next_status,
         "updatedAt" = now()
   where id = order_id;

  insert into public."OrderStatusEvent" ("orderId", status)
  values (order_id, next_status);

  if next_status = 'DELIVERED' then
    perform public.activate_discovery_credits(order_id);
  end if;

  if next_status in ('CANCELLED', 'REFUNDED') then
    perform public.restock_order(order_id);
    perform public.cancel_discovery_credits(order_id);
    perform public.reverse_credit_redemption(order_id);
    perform public.reverse_discount_redemption(order_id);
    perform public.reverse_offer_redemption(order_id);
    perform public.reverse_purchase_points(order_id);
  end if;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Restated because both functions were just re-created, and a
-- `create or replace` restores the default `execute` grant to `public`.

revoke all on function public.place_order(jsonb) from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
