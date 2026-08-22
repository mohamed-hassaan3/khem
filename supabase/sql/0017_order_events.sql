-- KHEM — the trail an order leaves as it moves, and the lifecycle starting at
-- PENDING.
--
-- Applied by `npm run db:migrate` after `0015_orders.sql` (the table and the
-- functions this extends) and `0016_checkout.sql` (which last re-declared
-- `place_order` and `settle_order_payment` — the bodies below are copied from
-- there, not from 0015, so nothing that file added is silently dropped).
--
-- ── Why a second table ──────────────────────────────────────
--
-- `"Order"` records where an order *is*: one `status`, one `updatedAt`. The
-- customer portal now draws that as a rail of stations, and a station without
-- a date is a claim with nothing behind it — "Shipped", but never when. The
-- house rule is that the UI displays stored data only, so the dates have to be
-- stored, which is this table.
--
-- Append-only. A row is written the moment a status is set and never updated,
-- so the trail is a record of what happened rather than a second copy of the
-- current state that can disagree with the first.
--
-- ── Written in SQL, never in TypeScript ─────────────────────
--
-- The event is inserted inside the same function that performs the status
-- change, in the same transaction. A service that changed the status and then
-- wrote the event would leave orders with a status and no station whenever the
-- second statement failed — the same reasoning that put stock movement in
-- `place_order()` rather than in an action.
--
-- ── The lifecycle now starts at PENDING ─────────────────────
--
-- `settle_order_payment` no longer promotes a paid order to PROCESSING. A
-- cleared card says money moved; it says nothing about whether anybody has
-- begun wrapping the bottle. Conflating the two meant every online order
-- appeared to skip its first station before the desk had touched it. PROCESSING
-- is now what the desk sets when work actually starts, and the customer is told
-- about PENDING instead of being left in silence — see `mailKindForStatus()` in
-- `src/lib/email/send-order-mail.ts`.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Identical to `"Order"` in 0015, and for the same reason: identity is Clerk's,
-- `auth.uid()` is always null, so no RLS policy here could express "this order
-- is mine". RLS on, **no policy of any kind**, no grant to the public roles.
-- The `clerkUserId` filter in `src/services/account.ts` is the access control,
-- and it runs behind the secret key.

-- ── OrderStatusEvent ────────────────────────────────────────

create table if not exists public."OrderStatusEvent" (
  id           text primary key default gen_random_uuid()::text,

  "orderId"    text not null
    references public."Order"(id) on delete cascade,

  status       public."OrderStatus" not null,

  -- When the station was reached. Not `createdAt`: the backfill below stamps
  -- rows with the time the thing happened, which is older than the row.
  "occurredAt" timestamptz not null default now()
);

-- The one access pattern: every event for one order, in order. The customer's
-- rail reads it as an embedded resource off `"Order"`, so the index is on the
-- foreign key first.
create index if not exists order_event_order_idx
  on public."OrderStatusEvent" ("orderId", "occurredAt");

alter table public."OrderStatusEvent" enable row level security;

revoke all on public."OrderStatusEvent" from public, anon, authenticated;

-- ── Backfill ────────────────────────────────────────────────
--
-- Orders that existed before this file would otherwise render an empty rail.
-- Each gets the two events that can be known for certain: it was placed, and it
-- is now in whatever state it is in. The middle of the journey is not invented.
--
-- Both statements are guarded by `not exists`, so `npm run db:migrate` is safe
-- to run again — which it is, every deploy.

insert into public."OrderStatusEvent" ("orderId", status, "occurredAt")
select o.id, 'PENDING', o."placedAt"
  from public."Order" o
 where not exists (
   select 1 from public."OrderStatusEvent" e
    where e."orderId" = o.id and e.status = 'PENDING'
 );

insert into public."OrderStatusEvent" ("orderId", status, "occurredAt")
select o.id, o.status, o."updatedAt"
  from public."Order" o
 where o.status <> 'PENDING'
   and not exists (
     select 1 from public."OrderStatusEvent" e
      where e."orderId" = o.id and e.status = o.status
   );

-- ── place_order ─────────────────────────────────────────────
--
-- The 0016 body, unchanged but for the one `insert` that records the order's
-- first station. Everything else — the slug-ordered `for update` locks, the
-- archived check, the stock check, the price snapshot — is verbatim.

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

  update public."Order"
     set "subtotalInCents" = v_subtotal,
         "totalInCents"    = v_subtotal + v_ship,
         "updatedAt"       = now()
   where id = v_order_id;

  return v_number;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The 0015 body plus the event. The insert sits after the update and before
-- the restock, so a failed restock rolls back the station too — one event, one
-- status, or neither.
--
-- No uniqueness is enforced on `("orderId", status)`. A desk that corrects
-- SHIPPED back to PROCESSING and forward again has genuinely done both, and the
-- rail shows the *earliest* event per station (see `src/services/account.ts`),
-- which is the date the customer was first told.

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

  if next_status in ('CANCELLED', 'REFUNDED') then
    perform public.restock_order(order_id);
  end if;
end;
$$;

-- ── settle_order_payment ────────────────────────────────────
--
-- The 0016 body **minus the status promotion**.
--
-- It still returns true exactly once per order — Stripe retries until it gets a
-- 2xx and can deliver the same event twice, and the caller sends the customer's
-- receipt only on the first true, so a retry is silent rather than a second
-- receipt in somebody's inbox. That guard is unchanged and is the reason this
-- is a function rather than an update in TypeScript.
--
-- What is gone is `status = case when v_status = 'PENDING' then 'PROCESSING'`.
-- A cleared card is a payment fact. Promoting on it meant an order announced
-- itself as "being prepared" seconds after checkout, before anybody in Cairo
-- had seen it, and the customer's rail lit a station nobody had reached. The
-- order now waits at PENDING for the desk, and writes no event here, because
-- paying is not a fulfilment step.
--
-- `v_status` is still selected `for update`: the row lock is what makes the
-- read-then-write of `paymentStatus` safe against a concurrent delivery.

create or replace function public.settle_order_payment(
  order_id  text,
  intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public."PaymentStatus";
begin
  select "paymentStatus"
    into v_payment
    from public."Order"
   where id = order_id
     for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_payment = 'PAID' then
    return false;
  end if;

  update public."Order"
     set "paymentStatus"         = 'PAID',
         "paidAt"                = now(),
         "stripePaymentIntentId" = intent_id,
         "updatedAt"             = now()
   where id = order_id;

  return true;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Re-stated because all three functions were just re-created, and a
-- `security definer` function the anon role may execute is a write path with
-- the door left open. Same closing stanza as 0016.

revoke all on function public.place_order(jsonb) from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
revoke all on function public.settle_order_payment(text, text)
  from public, anon, authenticated;
