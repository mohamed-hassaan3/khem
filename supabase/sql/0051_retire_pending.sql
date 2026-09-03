-- KHEM — retiring PENDING, and making fulfilment move forward only.
--
-- Applied after `0050_payment_authority.sql`, whose `set_order_status()` body
-- this file re-declares with one guard added, and after
-- `0042_inventory_channels.sql`, whose `place_order()` body it re-declares with
-- one literal changed.
--
-- ── Why PENDING goes ────────────────────────────────────────
--
-- It described a moment that does not exist. An order arrives and the house
-- begins work on it; there is no interval in which it has been placed and is
-- not being processed. What PENDING actually marked was the gap between the
-- order row and the desk noticing it — and `"Order"."firstOpenedAt"` (0023)
-- measures that honestly, without spending a fulfilment stage on it.
--
-- The customer never gained anything from it either: PENDING and PROCESSING
-- shared one letter (`order-copy.ts`), so the confirmation a customer receives
-- is unchanged by this file. Only its trigger is renamed.
--
-- ── How far the removal goes ────────────────────────────────
--
-- Postgres cannot drop an enum label while a column or a function signature
-- still names the type. `public."OrderStatus"` is named by `set_order_status()`,
-- by the customer projection in `0024`, and by two columns — so dropping the
-- label means recreating the type and every dependent function, inside a file
-- that re-runs on every migrate, after those functions were created earlier in
-- the same run. That is a real failure mode in exchange for a cosmetic gain.
--
-- So the label is **forbidden rather than deleted**: every row is migrated off
-- it, the default changes, and a check constraint on both tables refuses it.
-- Nothing can write it, nothing reads it, and no code path in the repository
-- names it any more. What survives is an unreferenced symbol in `pg_enum`.
--
-- ── Fulfilment moves forward only ───────────────────────────
--
-- `SHIPPED → PROCESSING` was allowed on the reasoning that a desk mis-clicks.
-- But every one of these states is something a customer has been *told*: the
-- shipping notice has gone, the tracking code is in their inbox. Moving back
-- unsends nothing, and it makes the status trail in `"OrderStatusEvent"` lie
-- about the parcel's history. A mistake is corrected by moving forward or by
-- cancelling, both of which are honest records.
--
-- Enforced here as a rank ladder rather than only in `schemas/orders.ts`,
-- for the reason 0050's delivery gate gives: the Server Action is one door.

-- ── The data, first ─────────────────────────────────────────
--
-- Before the constraint, or it would refuse the rows already here.
--
-- The events need more care than the orders. An order that went PENDING →
-- PROCESSING has both rows, and rewriting the first would leave two identical
-- PROCESSING events an hour apart, which reads as the desk doing something
-- twice. So a PENDING event is *dropped* where a PROCESSING one already
-- follows it, and rewritten only where it stood alone.

delete from public."OrderStatusEvent" e
 where e.status = 'PENDING'
   and exists (
     select 1
       from public."OrderStatusEvent" p
      where p."orderId" = e."orderId"
        and p.status = 'PROCESSING'
   );

update public."OrderStatusEvent"
   set status = 'PROCESSING'
 where status = 'PENDING';

update public."Order"
   set status = 'PROCESSING',
       "updatedAt" = now()
 where status = 'PENDING';

alter table public."Order"
  alter column status set default 'PROCESSING';

-- ── The constraint ──────────────────────────────────────────
--
-- `not valid` is deliberately *not* used: the rows are already migrated above,
-- so the check validates against a clean table, and a constraint that has never
-- been validated is one nobody can trust.

do $$ begin
  alter table public."Order"
    add constraint order_status_not_pending check (status <> 'PENDING');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public."OrderStatusEvent"
    add constraint order_status_event_not_pending check (status <> 'PENDING');
exception when duplicate_object then null; end $$;

-- ── The sweeper's index ─────────────────────────────────────
--
-- Partial on `status = 'PENDING'`, so after this file it indexes nothing. Both
-- the index and the sweep move to PROCESSING together; leaving one behind would
-- mean a sequential scan over every order ever placed, once an hour, silently.

drop index if exists public.order_unpaid_card_idx;

create index if not exists order_unpaid_card_idx
  on public."Order" ("placedAt")
  where status = 'PROCESSING'
    and "paymentStatus" = 'UNPAID'
    and "paymentMethod" = 'CARD';

-- ── place_order ─────────────────────────────────────────────
--
-- The 0042 body — the current one; 0035 and 0040 are older and re-declaring
-- from either would drop the inventory channels. One literal differs: the
-- opening status event.

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
  v_credit_id  text := nullif(payload->>'creditId', '');
  v_owner      text := nullif(payload->>'clerkUserId', '');
  v_credit     record;
  v_applied    int := 0;
  v_eligible   int := 0;
  -- Discounts, added by 0028.
  v_code       text := upper(btrim(coalesce(payload->>'discountCode', '')));
  v_discount   jsonb;
  v_disc_id    text;
  v_disc_code  text;
  v_disc_amt   int := 0;
  v_email      text := lower(nullif(payload->>'customerEmail', ''));
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

  -- The opening event. `PROCESSING` since 0051: an order is worked on from the
  -- moment it is placed, and the state that used to sit in front of it said
  -- nothing the confirmation letter did not already say.
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

    insert into public."OrderItem" (
      "orderId", "productSlug", "productName", quantity, "priceInCents"
    ) values (
      v_order_id, v_product.slug, v_product.name, v_qty, v_product."priceInCents"
    );

    /*
     * The decrement, the shortfall check and the ledger row are one call, and
     * they draw from the counter this order belongs to: an ONLINE order never
     * touches the offline shelf. `move_stock()` re-locks the row this loop has
     * already locked (re-entrant within the transaction), raises the same
     * '% has only % in stock.' the previous body raised, and writes the
     * movement — so a sale and its explanation land together or not at all.
     */
    perform public.move_stock(
      v_product.slug, v_channel, 'SALE', -v_qty,
      'Order ' || v_number, nullif(payload->>'clerkUserId', ''), v_order_id
    );

    v_subtotal := v_subtotal + (v_qty * v_product."priceInCents");
  end loop;

  -- ── Discount ──────────────────────────────────────────────
  --
  -- After the loop, because the eligible-line rule reads the order's items and
  -- the minimum needs the subtotal. `resolve_discount()` holds the lock that
  -- makes the caps real for the rest of this transaction.

  if v_code <> '' then
    v_discount := public.resolve_discount(jsonb_build_object(
      'code', v_code,
      'orderId', v_order_id,
      'email', v_email,
      'clerkUserId', v_owner,
      'subtotalInCents', v_subtotal
    ));

    if not coalesce((v_discount->>'ok')::boolean, false) then
      /*
       * The reason is written for the customer; the caller passes it through.
       * 0040 sends the reason *code* alongside it in `hint`, so a bilingual
       * caller can show the same translated sentence the code field shows
       * rather than this English one.
       */
      raise exception '%', coalesce(v_discount->>'reason', 'That code cannot be used.')
        using errcode = 'check_violation',
              hint = 'DISCOUNT:' || coalesce(v_discount->>'reasonCode', 'UNKNOWN');
    end if;

    v_disc_id   := v_discount->>'discountId';
    v_disc_code := v_discount->>'code';
    v_disc_amt  := (v_discount->>'amountInCents')::int;

    insert into public.discount_redemptions
      ("discountId", "orderId", email, "clerkUserId", "amountInCents")
    values (v_disc_id, v_order_id, v_email, v_owner, v_disc_amt);

    -- Consume the grant, if this code is gated by one.
    update public.discount_grants
       set "usedAt" = now(),
           "usedOrderId" = v_order_id
     where "discountId" = v_disc_id
       and email = v_email
       and "usedAt" is null;
  end if;

  -- ── Redemption ────────────────────────────────────────────

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

    /*
     * Policy 4, now a real check. 0027 could only look for an amount the client
     * claimed; this reads a discount the server resolved a few statements ago.
     */
    if v_disc_id is not null then
      raise exception 'A Discovery Credit cannot be combined with a promotional discount.'
        using errcode = 'check_violation';
    end if;

    -- Against what is left after any discount, so the two can never together
    -- take off more than the merchandise is worth.
    v_applied := least(v_credit."balanceInCents", v_subtotal - v_disc_amt);

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
         "discountId"           = v_disc_id,
         "discountCode"         = v_disc_code,
         "discountInCents"      = v_disc_amt,
         "totalInCents"         = v_subtotal + v_ship - v_disc_amt - v_applied,
         "updatedAt"            = now()
   where id = v_order_id;

  return v_number;
end;
$$;
-- ── expire_unpaid_orders ────────────────────────────────────
--
-- The 0016 body with one literal changed. The narrowing conditions are
-- untouched and they are what make this safe: UNPAID **and** CARD. A cash order
-- is never swept, however long it sits, because a cash order is meant to sit.

create or replace function public.expire_unpaid_orders(older_than_minutes int)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  for v_order in
    select id, "orderNumber"
      from public."Order"
     where status = 'PROCESSING'
       and "paymentStatus" = 'UNPAID'
       and "paymentMethod" = 'CARD'
       and "placedAt" < now() - make_interval(mins => older_than_minutes)
  loop
    perform public.set_order_status(v_order.id, 'CANCELLED');
    return next v_order."orderNumber";
  end loop;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The 0050 body — the delivery gate and all four refund calls — plus the
-- forward-only ladder.
--
-- The ranks are the fulfilment sequence, and the rule is `>`: strictly forward.
-- CANCELLED and REFUNDED sit outside it because they are not later stages, they
-- are exits — reachable from where `schemas/orders.ts` says they are reachable
-- from, and final once taken.

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

  -- A closed order is closed. Its units are back on the shelf and its customer
  -- has been told; reopening it would sell stock the desk has already promised
  -- elsewhere.
  if v_current in ('CANCELLED', 'REFUNDED') then
    raise exception
      'Order % is %. A closed order cannot be reopened — record a new one.',
      order_id, lower(v_current::text)
      using errcode = 'check_violation';
  end if;

  -- Forward only, among the three fulfilment stages.
  if v_rank ? next_status::text
     and (v_rank->>next_status::text)::int <= (v_rank->>v_current::text)::int then
    raise exception
      'Order % is already %. Fulfilment cannot go back to %.',
      order_id, lower(v_current::text), lower(next_status::text)
      using errcode = 'check_violation';
  end if;

  -- Delivery waits for the money (0050).
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
  end if;
end;
$$;

-- ── customer_notifications ──────────────────────────────────
--
-- The 0032 body with one literal changed, and the change keeps the behaviour
-- rather than altering it: the feed omits the *opening* event, because the
-- confirmation letter has already said the order was placed. That opening event
-- used to be PENDING and is now PROCESSING.

create or replace function public.customer_notification_feed(
  owner       text,
  owner_email text default null,
  max_items   int default 50
)
returns table (
  kind            text,
  "entityId"      text,
  label           text,
  detail          text,
  "amountInCents" int,
  "occurredAt"    timestamptz,
  "isRead"        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with owner_email_lc as (select lower(nullif(owner_email, '')) as email),
  items as (
    -- Where the parcel has got to. The opening event is omitted: the
    -- confirmation letter already said the order was placed, and repeating it
    -- here is noise. That opening event was PENDING until 0051 and is now
    -- PROCESSING — the omission is the same one, renamed.
    select
      'ORDER_STATUS'::text as kind,
      e.id                 as entity_id,
      o."orderNumber"      as label,
      e.status::text       as detail,
      null::int            as amount,
      e."occurredAt"       as occurred_at
      from public."OrderStatusEvent" e
      join public."Order" o on o.id = e."orderId"
     where o."clerkUserId" = owner
       and e.status <> 'PROCESSING'

    union all

    -- A Discovery Credit earned. Cancelled ones are not news.
    select
      'CREDIT_EARNED',
      c.id,
      coalesce(o."orderNumber", ''),
      null,
      c."amountInCents",
      c."earnedAt"
      from public.customer_credits c
      left join public."Order" o on o.id = c."sourceOrderId"
     where c."clerkUserId" = owner
       and c."cancelledAt" is null

    union all

    -- A privilege addressed to them. Matched by account *or* address, since a
    -- grant may have been issued before they ever registered.
    select
      'VOUCHER_GRANTED',
      g.id,
      d.code,
      null,
      null,
      g."issuedAt"
      from public.discount_grants g
      join public.discounts d on d.id = g."discountId"
     where g."clerkUserId" = owner
        or g.email = (select email from owner_email_lc)
  )
  select
    i.kind,
    i.entity_id,
    i.label,
    i.detail,
    i.amount,
    i.occurred_at,
    (r."clerkUserId" is not null) as is_read
    from items i
    left join public.customer_notification_reads r
           on r."clerkUserId" = owner
          and r.kind = i.kind
          and r."entityId" = i.entity_id
   order by i.occurred_at desc
   limit greatest(coalesce(max_items, 50), 1);
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Re-asserted for every function this file re-declares, as each of its
-- predecessors does. `create or replace` keeps the grants a function already
-- had, but stating them is what makes a missing one visible in review rather
-- than inherited silently.

revoke all on function public.place_order(jsonb)          from public, anon, authenticated;
revoke all on function public.expire_unpaid_orders(int)   from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
revoke all on function public.customer_notification_feed(text, text, int)
  from public, anon, authenticated;

-- ── Issuing an invitation ───────────────────────────────────
--
-- The gap this closes: `discounts."requiresGrant"` gates a code on a row in
-- `discount_grants`, and until now the only two writers of that table were
-- `claim_welcome()` (0030) and `claim_subscriber_offer()` (0035) — **both of
-- which issue only the single discount flagged `isWelcome`**. So any other
-- invitation-only code was unredeemable by construction: correctly refused
-- `NOT_GRANTED` for everybody, forever, with no way for the desk to fix it.
-- `/admin/discounts/[code]` even printed "No grants issued. Nobody can redeem
-- this code until one is." and offered no means of issuing one.
--
-- Nothing about eligibility changes. `resolve_discount()` is untouched: the same
-- ladder refuses the same accounts for the same reasons. What changes is that an
-- eligible account can now be brought into existence deliberately, by an admin,
-- one address at a time.
--
-- The address is normalised here rather than in TypeScript, because the unique
-- index and `resolve_discount()`'s lookup are both on the lowercased form, and a
-- grant issued to `Name@Example.com` that no checkout could ever match is worse
-- than no grant at all.

create or replace function public.issue_discount_grant(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text := upper(btrim(coalesce(payload->>'code', '')));
  v_email   text := lower(btrim(coalesce(payload->>'email', '')));
  v_days    int  := nullif(payload->>'expiresInDays', '')::int;
  v_expires timestamptz;
  v_d       record;
  v_id      text;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'That is not an email address.'
      using errcode = 'check_violation';
  end if;

  select * into v_d from public.discounts where code = v_code;

  if not found then
    raise exception 'No code called %.', v_code
      using errcode = 'foreign_key_violation';
  end if;

  if not v_d."requiresGrant" then
    raise exception
      '% is open to anybody who has the code. Only an invitation-only code needs a grant.',
      v_code
      using errcode = 'check_violation';
  end if;

  -- Capped at the campaign's own end date, exactly as `claim_welcome()` caps it:
  -- a grant outliving its discount is a code that stops working with no
  -- explanation the customer can see.
  if v_days is not null then
    v_expires := least(
      now() + make_interval(days => v_days),
      coalesce(v_d."endsAt", now() + make_interval(days => v_days))
    );
  else
    v_expires := v_d."endsAt";
  end if;

  -- `do nothing`, not an error: re-inviting an address that already holds a
  -- grant is an ordinary thing for a desk to do, and the honest answer is "they
  -- already have one" rather than a failure.
  insert into public.discount_grants ("discountId", email, "expiresAt")
  values (v_d.id, v_email, v_expires)
  on conflict ("discountId", email) do nothing
  returning id into v_id;

  return jsonb_build_object(
    'issued', v_id is not null,
    'code', v_d.code,
    'expiresAt', v_expires
  );
end;
$$;

-- ── Withdrawing one ─────────────────────────────────────────
--
-- Only an **unused** grant. A spent one is part of the redemption trail:
-- `discount_redemptions` points at the order, and deleting the grant beside it
-- would leave a redemption whose entitlement no longer appears to have existed.

create or replace function public.revoke_discount_grant(grant_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.discount_grants
   where id = grant_id
     and "usedAt" is null;

  get diagnostics v_deleted = row_count;

  return v_deleted > 0;
end;
$$;

revoke all on function public.issue_discount_grant(jsonb) from public, anon, authenticated;
revoke all on function public.revoke_discount_grant(text) from public, anon, authenticated;
