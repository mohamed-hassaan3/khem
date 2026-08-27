-- KHEM — spending a Discovery Credit.
--
-- Applied by `npm run db:migrate` after `0026_discovery_credits.sql`, which
-- created the ledger this now writes `USED` and `REFUNDED` rows into.
--
-- 0026 could not change what a customer is charged. **This file can**, and it is
-- the only one in the credit feature that does.
--
-- ── Where the validation lives, and why ─────────────────────
--
-- Inside `place_order()`, in the same transaction as the order and the stock
-- movement. Not in `src/actions/checkout.ts`, and not in the intent route.
--
-- The reason is the one `0015_orders.sql` opens with. A service that read a
-- credit's balance, decided it was spendable, and then wrote the order would
-- leave a gap; two requests in that gap both see an available credit and both
-- spend it. The row lock below closes it, and it can only be taken by the
-- statement that also writes the order.
--
-- The second reason is `src/app/api/checkout/intent/route.ts`. That endpoint
-- charges `"totalInCents"` off the order row and refuses to accept an amount
-- from anybody — its header explains why at length. Because the credit is
-- applied *when the order is written*, Stripe charges the reduced total with no
-- change to that route and **no new trust boundary**. A credit applied later,
-- at payment time, would have required one.
--
-- ── What the client may say ─────────────────────────────────
--
-- One thing: a credit id. Not an amount, not a customer, not an eligibility
-- verdict. The owner is compared against `payload->>'clerkUserId'`, which
-- `src/actions/checkout.ts` fills from `getUserId()` — a verified session,
-- never a form field. Policy 13 and 14 are that sentence.
--
-- ── Voucher, not a wallet ───────────────────────────────────
--
-- The credit is consumed **whole**. Against a 3,500 bottle a 1,200 credit takes
-- 1,200 off; against a 900 bottle it covers the 900 and the remaining 300 is
-- forfeited — the `USED` row is written for the full balance either way, and
-- only the amount *applied to the order* is capped. That asymmetry is the
-- policy ("no cash value", "each Set generates its own credit"), and it is why
-- the two numbers below are computed separately.
--
-- ── Delivery is not paid for by a credit ────────────────────
--
-- The credit reduces merchandise, not the courier: it is applied against the
-- subtotal, so a customer redeeming one still pays delivery. `"totalInCents"`
-- therefore never falls below `"shipInCents"`, and never below zero.

-- ── Columns ─────────────────────────────────────────────────

alter table public."Order"
  -- Which credit paid part of this order. `on delete set null` rather than
  -- cascade: deleting a credit must never delete the order it was spent on.
  add column if not exists "creditId" text
    references public.customer_credits(id) on delete set null,

  -- What it actually took off. Distinct from the credit's face value, because a
  -- credit larger than the subtotal is capped here and forfeits the rest.
  add column if not exists "creditAppliedInCents" int not null default 0
    check ("creditAppliedInCents" >= 0);

create index if not exists order_credit_idx
  on public."Order" ("creditId")
  where "creditId" is not null;

-- **Deliberately not unique.** A refunded redemption restores the credit
-- (policy 9), and the customer may then spend it on a different order — while
-- the refunded order keeps its `"creditId"` as the historical record of what
-- happened. A unique index would make that restoration unusable. The guard
-- against double-spending is the balance, checked under a lock below.

-- ── place_order ─────────────────────────────────────────────
--
-- The 0017 body, unchanged, plus one block after the line loop. Everything
-- before it — the slug-ordered `for update` locks, the archived check, the stock
-- check, the price snapshot, the PENDING event — is verbatim.

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
  -- Redemption, added by 0027.
  v_credit_id  text := nullif(payload->>'creditId', '');
  v_owner      text := nullif(payload->>'clerkUserId', '');
  v_credit     record;
  v_applied    int := 0;
  v_eligible   int := 0;
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

  -- The first station. Same transaction as the row it describes, so an order
  -- cannot exist without one.
  insert into public."OrderStatusEvent" ("orderId", status)
  values (v_order_id, 'PENDING');

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

    select slug, name, "priceInCents", inventory, "isArchived"
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

    if v_product.inventory < v_qty then
      raise exception '% has only % in stock.', v_product.name, v_product.inventory
        using errcode = 'check_violation';
    end if;

    insert into public."OrderItem" (
      "orderId", "productSlug", "productName", quantity, "priceInCents"
    ) values (
      v_order_id, v_product.slug, v_product.name, v_qty, v_product."priceInCents"
    );

    update public."Product"
       set inventory = inventory - v_qty,
           "updatedAt" = now()
     where slug = v_product.slug;

    v_subtotal := v_subtotal + (v_qty * v_product."priceInCents");
  end loop;

  -- ── Redemption ────────────────────────────────────────────
  --
  -- After the loop, because two of the checks need the order's lines: the
  -- eligibility test reads them, and the cap needs the subtotal.

  if v_credit_id is not null then
    -- Policy 6, first half. A credit belongs to an account; a guest checkout
    -- has no owner to compare against and cannot spend one.
    if v_owner is null then
      raise exception 'A Discovery Credit belongs to an account. Sign in to use it.'
        using errcode = 'check_violation';
    end if;

    /*
     * The lock, and the reason this whole block is here rather than in
     * TypeScript. It goes on `customer_credits` — `for update` cannot be
     * applied to the aggregating `credit_balances` view (Postgres refuses it
     * outright) — and it serialises two checkouts racing for one credit: the
     * second waits here, then reads a balance of zero and is refused below.
     */
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

    -- Policy 6, second half. Compared against the *session's* user id, which
    -- `src/actions/checkout.ts` fills from `getUserId()` and never from a form.
    if v_credit."clerkUserId" is distinct from v_owner then
      raise exception 'That credit belongs to another account.'
        using errcode = 'check_violation';
    end if;

    -- Policy 3. Each refusal says which of the states it is in, because "this
    -- credit cannot be used" tells a customer nothing they can act on.
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

    -- Policy 2. At least one full-size fragrance on the order; the kind is read
    -- from the catalog, never from the request.
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

    /*
     * Policy 4. Nothing sets a discount today — the discount engine is not
     * built — so this is a guard written now for the phase that builds it,
     * rather than a check that can currently fail. When a discount does arrive
     * it must be refused here, not remembered later.
     */
    if coalesce((payload->>'discountInCents')::int, 0) <> 0 then
      raise exception 'A Discovery Credit cannot be combined with a promotional discount.'
        using errcode = 'check_violation';
    end if;

    -- Applied against merchandise only, so the customer still pays delivery,
    -- and capped so the order can never go negative.
    v_applied := least(v_credit."balanceInCents", v_subtotal);

    /*
     * The ledger row is written for the credit's **whole** balance, not for the
     * amount applied. That difference is the forfeit: a 1,200 credit spent on a
     * 900 subtotal takes 900 off and closes at zero, because a credit has no
     * cash value and does not carry a remainder.
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
  end if;

  update public."Order"
     set "subtotalInCents"      = v_subtotal,
         "creditId"             = v_credit_id,
         "creditAppliedInCents" = v_applied,
         "totalInCents"         = v_subtotal + v_ship - v_applied,
         "updatedAt"            = now()
   where id = v_order_id;

  return v_number;
end;
$$;

-- ── reverse_credit_redemption ───────────────────────────────
--
-- Policy 9: refunding a full-size order restores the credit it was paid with.
--
-- Restores it **at its original expiry**, not with a fresh sixty days — the
-- window belongs to the Discovery Set's delivery, and a refund is not a new
-- purchase. If that window has already closed the credit is restored and then
-- immediately expired, which looks redundant and is not: the ledger has to show
-- that the money came back and then lapsed, rather than quietly never returning.
--
-- Idempotent: the `not exists` guard means a second refund of the same order
-- writes nothing, and `set_order_status()` can move CANCELLED → REFUNDED
-- without paying twice.

create or replace function public.reverse_credit_redemption(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id text;
  v_used      int;
  v_expires   timestamptz;
begin
  select o."creditId"
    into v_credit_id
    from public."Order" o
   where o.id = order_id;

  if v_credit_id is null then
    return 0;
  end if;

  -- Serialise against a concurrent redemption of the same credit.
  perform 1 from public.customer_credits where id = v_credit_id for update;

  -- Already reversed — a redelivered webhook, or CANCELLED followed by
  -- REFUNDED on the same order.
  if exists (
    select 1 from public.credit_transactions t
     where t."orderId" = order_id
       and t."creditId" = v_credit_id
       and t.kind = 'REFUNDED'
  ) then
    return 0;
  end if;

  -- What was actually taken off the credit, which is the `USED` row's amount
  -- rather than the order's `creditAppliedInCents` — those differ whenever a
  -- credit was larger than the subtotal it paid.
  select -t."amountInCents"
    into v_used
    from public.credit_transactions t
   where t."orderId" = order_id
     and t."creditId" = v_credit_id
     and t.kind = 'USED'
   order by t."occurredAt"
   limit 1;

  if v_used is null or v_used <= 0 then
    return 0;
  end if;

  insert into public.credit_transactions
    ("creditId", kind, "amountInCents", "orderId", note)
  values (v_credit_id, 'REFUNDED', v_used, order_id, 'Order refunded');

  -- Restored into a window that has already closed: say so in the ledger rather
  -- than handing back something that cannot be spent.
  select c."expiresAt" into v_expires
    from public.customer_credits c
   where c.id = v_credit_id;

  if v_expires is not null and v_expires <= now() then
    insert into public.credit_transactions
      ("creditId", kind, "amountInCents", note)
    values (v_credit_id, 'EXPIRED', -v_used, 'Window had already closed');
  end if;

  return 1;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The 0026 body plus one call. Two different credits can be touched by one
-- refund and they are unrelated:
--
--   cancel_discovery_credits  — credits this order *earned* (policy 8)
--   reverse_credit_redemption — the credit this order *spent* (policy 9)
--
-- An order can do both: a basket containing a Discovery Set and a fragrance
-- paid for with an earlier credit earns one and spends another.

create or replace function public.set_order_status(
  order_id text,
  next_status public."OrderStatus"
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
  end if;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Re-stated because the functions above were just re-created, and a
-- `create or replace` restores the default `execute` grant to `public`.

revoke all on function public.place_order(jsonb)              from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
revoke all on function public.reverse_credit_redemption(text) from public, anon, authenticated;
