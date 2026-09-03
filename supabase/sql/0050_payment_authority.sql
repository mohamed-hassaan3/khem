-- KHEM — one authority for an order's payment state.
--
-- Applied after `0028_discounts.sql`, whose `set_order_status()` body this file
-- re-declares with one guard added, and after `0026_discovery_credits.sql`,
-- whose `issue_discovery_credits()` it re-declares with one call added.
--
-- ── What was wrong ──────────────────────────────────────────
--
-- `settle_order_payment()` — the Stripe path — issued Discovery Credits. The
-- desk's path did not: `updatePaymentStatus()` wrote `"Order"."paymentStatus"`
-- with a plain update, no function behind it. So a cash Discovery Set was PAID
-- with a null `paidAt` and no credit, and had been since the ledger shipped.
-- The fingerprint was visible on the row: a PAID order that had never been
-- through the only function that stamps `paidAt`.
--
-- The fix is not a second issuance path. It is a *function* behind the desk's
-- button, so that "this order has been paid" means the same thing and does the
-- same work whoever says it — the same relationship `set_order_status()`
-- already has with `restock_order()`.
--
-- ── The second defect: order of events ──────────────────────
--
-- `activate_discovery_credits()` stamps credits that already exist. An order
-- delivered *before* it was marked paid therefore activated nothing, and the
-- credit issued afterwards would sit PENDING_DELIVERY forever, because nothing
-- re-runs activation. Rather than teach every caller to check, issuance itself
-- now activates when the order it is issuing against is already delivered. One
-- change, and both the cash and the card path inherit it.
--
-- ── Delivery requires payment ───────────────────────────────
--
-- A parcel is not handed over unpaid, and DELIVERED is the state a customer's
-- sixty-day credit window is measured from — so an unpaid order reaching it
-- both misstates the till and starts a clock that no money justifies. The rule
-- lives here rather than only in the action, because a Server Action is one
-- door into this and `psql` is another.
--
-- ── PAID is one-way from the desk ───────────────────────────
--
-- Once an order is PAID the only payment state it may take is REFUNDED. A desk
-- that could un-tick PAID could silently withdraw a credit the customer has
-- already been shown, and "I clicked the wrong button" and "we gave the money
-- back" are not the same event and must not be the same click. Correcting a
-- genuine mistake is a deliberate act with a refund behind it.

-- ── issue_discovery_credits ─────────────────────────────────
--
-- The 0026 body, plus the activation call. Everything else is unchanged: one
-- credit per unit at that line's price, idempotent through
-- `customer_credit_unit_idx` rather than through a prior check.

create or replace function public.issue_discovery_credits(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created int := 0;
  v_owner   text;
  v_status  public."OrderStatus";
begin
  select nullif(o."clerkUserId", ''), o.status
    into v_owner, v_status
    from public."Order" o
   where o.id = order_id;

  -- A walk-in has no account, and a credit with no owner is a credit nobody can
  -- ever spend (policy 6). The desk sells Discovery Sets across the counter, so
  -- this is an ordinary outcome, not an error.
  if v_owner is null then
    return 0;
  end if;

  with issued as (
    insert into public.customer_credits (
      "clerkUserId", "sourceOrderId", "sourceOrderItemId",
      "unitIndex", "amountInCents"
    )
    select
      v_owner,
      order_id,
      i.id,
      unit.n - 1,
      i."priceInCents"
    from public."OrderItem" i
    join public."Product" p on p.slug = i."productSlug"
    join public."Collection" col on col.slug = p."collectionSlug"
    cross join lateral generate_series(1, i.quantity) as unit(n)
    where i."orderId" = order_id
      and col.kind = 'DISCOVERY'
    on conflict ("sourceOrderItemId", "unitIndex") do nothing
    returning id, "amountInCents"
  ),
  logged as (
    -- The EARNED row is written in the same statement as the credit it
    -- describes. A credit without its opening transaction would have a balance
    -- of zero and read as REDEEMED — the ledger is not a second copy of the
    -- instrument, it is where the money is.
    insert into public.credit_transactions ("creditId", kind, "amountInCents", note)
    select i.id, 'EARNED', i."amountInCents", 'Discovery Set purchase'
    from issued i
    returning 1
  )
  select count(*)::int into v_created from logged;

  -- The parcel arrived before the money was recorded — a cash order marked
  -- delivered at the door and settled at the desk afterwards. The sixty days
  -- started at delivery either way (policy 3), so the credit is spendable now
  -- rather than waiting for a DELIVERED transition that has already happened.
  --
  -- Unconditional on `v_created`: a credit issued by an earlier call and left
  -- pending because *that* call predated this fix is exactly the row this is
  -- for. `activate_discovery_credits()` only touches a null `deliveredAt`, so
  -- it cannot extend a window that is already running.
  if v_status = 'DELIVERED' then
    perform public.activate_discovery_credits(order_id);
  end if;

  return v_created;
end;
$$;

-- ── set_order_payment_status ────────────────────────────────
--
-- The desk's half of the payment fact, and the counterpart to
-- `settle_order_payment()` rather than a copy of it. The card path keeps its
-- own function because it does two things this one must not: it records
-- Stripe's intent id, and it returns the boolean the webhook's idempotency is
-- built on. What the two share is `issue_discovery_credits()`, which is where
-- the credit rule actually lives.
--
-- Returns whether this call changed anything, so the caller can log something
-- true and a double-submit is silent rather than duplicated.

create or replace function public.set_order_payment_status(
  order_id    text,
  next_status public."PaymentStatus"
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public."PaymentStatus";
begin
  select "paymentStatus"
    into v_current
    from public."Order"
   where id = order_id
     for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_current = next_status then
    return false;
  end if;

  -- PAID is one-way. Refunding is the reversal; un-ticking is not.
  if v_current = 'PAID' and next_status <> 'REFUNDED' then
    raise exception
      'Order % has been paid. Refund it to reverse the payment — it cannot be marked % again.',
      order_id, lower(next_status::text)
      using errcode = 'check_violation';
  end if;

  if next_status = 'PAID' then
    update public."Order"
       set "paymentStatus" = 'PAID',
           -- `coalesce` rather than `now()`: a card order settled by the webhook
           -- and later corrected at the desk keeps the moment the money landed.
           "paidAt"        = coalesce("paidAt", now()),
           "updatedAt"     = now()
     where id = order_id;

    -- Money is real, so any Discovery Set on this order has earned its credit —
    -- and if the parcel has already arrived, earned it *available*.
    perform public.issue_discovery_credits(order_id);

    return true;
  end if;

  if next_status = 'REFUNDED' then
    update public."Order"
       set "paymentStatus" = 'REFUNDED',
           -- `paidAt` stands. The money did land; a refund is a later event,
           -- and erasing the first would lose the till's account of the day.
           "updatedAt"     = now()
     where id = order_id;

    -- Two unrelated credits can be touched by one refund, exactly as in
    -- `set_order_status()`: the ones this order *earned* (policy 8) and the one
    -- it *spent* (policy 9). Both are idempotent, so refunding the payment and
    -- then refunding the order does the work once.
    --
    -- Stock and discounts are deliberately not released here. Payment state and
    -- fulfilment state are separate controls on the order screen, and returning
    -- units to the shelf is what `set_order_status('REFUNDED')` is for.
    perform public.cancel_discovery_credits(order_id);
    perform public.reverse_credit_redemption(order_id);

    return true;
  end if;

  -- UNPAID and FAILED, reachable only from each other and from an unsettled
  -- order: ordinary corrections with no money and no credit behind them.
  update public."Order"
     set "paymentStatus" = next_status,
         "updatedAt"     = now()
   where id = order_id;

  return true;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The 0028 body plus the delivery gate. The four `perform` calls below are
-- unchanged and must stay: dropping back to an earlier body silently loses the
-- discount reversal, which is why this file copies from 0028 and not from 0026.

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
begin
  -- Checked before the write, under the same lock the payment function takes,
  -- so an order cannot be settled and delivered by two requests that each saw
  -- the other's precondition unmet.
  if next_status = 'DELIVERED' then
    select "paymentStatus"
      into v_payment
      from public."Order"
     where id = order_id
       for update;

    if not found then
      raise exception 'No order with the id %.', order_id
        using errcode = 'foreign_key_violation';
    end if;

    if v_payment is distinct from 'PAID' then
      raise exception
        'Order % has not been paid. Record the payment before confirming delivery.',
        order_id
        using errcode = 'check_violation';
    end if;
  end if;

  update public."Order"
     set status = next_status,
         "updatedAt" = now()
   where id = order_id;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

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
  end if;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- `create or replace` keeps whatever grants the previous definition had, and a
-- brand-new function inherits `0006`'s altered defaults. Both are taken back
-- explicitly, as every migration that touches these functions does: they move
-- money-shaped state and nothing reaches them without SUPABASE_SECRET_KEY.

revoke all on function public.issue_discovery_credits(text)
  from public, anon, authenticated;
revoke all on function public.set_order_payment_status(text, public."PaymentStatus")
  from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
