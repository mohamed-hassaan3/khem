-- KHEM — checkout: how an order reaches the boutique from the storefront.
--
-- Applied by `npm run db:migrate` after `0015_orders.sql`, whose tables,
-- enums and functions this file extends rather than replaces. Everything here
-- is idempotent: the migrate script re-applies every file on every run, inside
-- one transaction.
--
-- `src/actions/checkout.ts` writes through `place_order()`;
-- `src/app/api/webhooks/stripe/route.ts` writes through `settle_order_payment()`;
-- `src/app/api/cron/sweep-unpaid-orders/route.ts` writes through
-- `expire_unpaid_orders()`. `src/services/orders.ts` reads.
--
-- ── What checkout needed that 0015 did not have ──────────────
--
-- 0015 was built for the desk: a walk-in has a name, maybe a phone, and the
-- units leave the shelf across a counter. An order placed on the website has
-- three things a walk-in does not.
--
--  1. **A method.** Card or cash on delivery, and the two settle at different
--     moments — which is the whole reason `"paymentMethod"` is a column and not
--     an inference from `"paymentStatus"`. A cash order is PROCESSING and
--     UNPAID for as long as it takes a courier to reach Heliopolis, and that is
--     not the same state as a card order whose payment failed.
--  2. **An address.** Denormalised onto the order as six columns rather than a
--     foreign key into an address book, because a shipping address is a
--     snapshot of where a parcel went. A customer who later corrects their
--     saved address must not silently rewrite the label on a parcel that has
--     already shipped.
--  3. **A language.** `"locale"` exists because a status email is sent days
--     after the request that created the order, from a dashboard that is
--     English by construction. Without a column, an Arabic customer is told in
--     English that their parcel shipped — which is the exact failure the
--     bilingual work exists to prevent.
--
-- ── The stock model, restated for the web ───────────────────
--
-- Unchanged: stock moves inside `place_order()`, under a row lock, or it does
-- not move. Checkout gets no exception. A card order is therefore created
-- **before** the visitor pays — PENDING and UNPAID, with its units already off
-- the shelf — and is promoted by the webhook. The alternative, creating the
-- order after payment succeeds, sells the last bottle twice and loses the sale
-- entirely if a webhook is dropped.
--
-- The cost of reserving early is abandoned baskets holding stock, and
-- `expire_unpaid_orders()` is what pays it: anything left PENDING + UNPAID +
-- CARD past the cutoff is cancelled through `set_order_status()`, which
-- restocks through `restock_order()`, which is idempotent by
-- `"stockReleasedAt"`. Three functions that already existed, composed.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Identical to 0015 and re-asserted at the bottom: RLS on, no policy, no grant
-- to `anon` or `authenticated`, `execute` revoked on every function. These rows
-- now hold a street address as well as a name and a phone number, so the case
-- for the publishable key never reaching them is stronger than it was, not
-- weaker.

-- ── Enum ────────────────────────────────────────────────────

do $$ begin
  create type public."PaymentMethod" as enum ('CARD', 'CASH');
exception when duplicate_object then null; end $$;

-- ── Columns ─────────────────────────────────────────────────
--
-- `add column if not exists` rather than a fresh `create table`: 0015's table
-- already exists in every environment this runs against.

alter table public."Order"
  -- 'CASH' is the right default for the rows that predate this file: they are
  -- walk-ins, and money changed hands at the counter. It is also what
  -- `place_order()` falls back to, so `src/actions/admin/orders.ts` keeps
  -- working without being taught a new key.
  add column if not exists "paymentMethod" public."PaymentMethod" not null default 'CASH',

  -- Where the parcel goes. Nullable throughout: a walk-in carries their own
  -- bottle home. Lengths mirror the Zod maxima in `src/schemas/checkout.ts`,
  -- which is the boundary that actually refuses a bad value — these are the
  -- backstop for anything that reaches the table by another path.
  add column if not exists "shipLine1"      text check (char_length("shipLine1") <= 200),
  add column if not exists "shipLine2"      text check (char_length("shipLine2") <= 200),
  add column if not exists "shipCity"       text check (char_length("shipCity") <= 80),
  add column if not exists "shipState"      text check (char_length("shipState") <= 80),
  add column if not exists "shipPostalCode" text check (char_length("shipPostalCode") <= 20),
  add column if not exists "shipCountry"    text check (char_length("shipCountry") <= 80),

  -- Which language this customer is owed. Constrained to the locales
  -- `src/lib/i18n/config.ts` ships, so a third language is a deliberate edit
  -- here rather than a silent English fallback three emails later.
  add column if not exists locale text not null default 'en'
    check (locale in ('en', 'ar')),

  -- Stripe's id for the intent that paid this order. Null for cash, and null
  -- for a card order that has not reached the payment step yet.
  add column if not exists "stripePaymentIntentId" text
    check (char_length("stripePaymentIntentId") <= 120),

  -- Stamped once, by `settle_order_payment()`. Distinct from `"updatedAt"`,
  -- which moves every time the desk touches the row.
  add column if not exists "paidAt" timestamptz;

-- Partial, so the null-for-cash rows cost nothing and cannot collide with one
-- another. One intent settles at most one order.
create unique index if not exists order_stripe_intent_idx
  on public."Order" ("stripePaymentIntentId")
  where "stripePaymentIntentId" is not null;

-- The sweeper's query, and only the sweeper's query. Partial on all three
-- predicates so the index holds the handful of rows actually at risk rather
-- than every order ever placed.
create index if not exists order_unpaid_card_idx
  on public."Order" ("placedAt")
  where status = 'PENDING'
    and "paymentStatus" = 'UNPAID'
    and "paymentMethod" = 'CARD';

-- ── place_order, extended ───────────────────────────────────
--
-- Same function, same guarantees. The loop below is unchanged from 0015 —
-- slug-ordered `for update` locks so two concurrent orders queue instead of
-- deadlocking, the archived check, the stock check, the price and name
-- snapshot, the subtotal recomputed from what was actually locked. What is new
-- is only what gets written into the `"Order"` row alongside it.
--
-- Every new key is optional and falls back to the pre-checkout behaviour, so
-- the dashboard's `createOrder` action calls this unchanged.

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

  -- Guarded here as well as by the column check: a locale that is not one of
  -- ours must not become a row that no email template can render.
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

-- ── settle_order_payment ────────────────────────────────────
--
-- The webhook's only write, and the idempotency boundary for the whole card
-- flow.
--
-- Returns **true exactly once per order**. Stripe retries a webhook until it
-- gets a 2xx, and it can deliver the same event more than once even after one;
-- the caller sends the customer's confirmation email only when this returns
-- true, so the retry is silent instead of being a second receipt in somebody's
-- inbox. Putting that guard in TypeScript would mean reading, deciding, and
-- then writing — the same gap `place_order` exists to close.
--
-- The status promotion is deliberately conditional on PENDING. A desk that has
-- already shipped an order must not have it dragged back to PROCESSING by a
-- late webhook delivery; the payment half still lands, because that half is
-- always true.

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
  v_status  public."OrderStatus";
  v_payment public."PaymentStatus";
begin
  select status, "paymentStatus"
    into v_status, v_payment
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
     set "paymentStatus"        = 'PAID',
         "paidAt"               = now(),
         "stripePaymentIntentId" = intent_id,
         status                 = case when v_status = 'PENDING'
                                       then 'PROCESSING'::public."OrderStatus"
                                       else v_status end,
         "updatedAt"            = now()
   where id = order_id;

  return true;
end;
$$;

-- ── expire_unpaid_orders ────────────────────────────────────
--
-- The other half of reserving stock before payment. Called on a schedule by
-- `/api/cron/sweep-unpaid-orders`.
--
-- Routes through `set_order_status()` rather than updating `status` directly,
-- which is the rule 0015 sets and the reason this is four lines: that function
-- already calls `restock_order()`, which is already idempotent by
-- `"stockReleasedAt"`. Running the sweep twice cancels once and restocks once.
--
-- Only CARD orders are swept, and this filter carries more weight since
-- `0017_order_events.sql`: a cash order now *stays* PENDING and UNPAID until
-- the courier collects, so without `"paymentMethod" = 'CARD'` this job would
-- cancel every cash sale an hour after it was placed. A walk-in left PENDING
-- by the desk is the desk's business, not a scheduled job's.

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
     where status = 'PENDING'
       and "paymentStatus" = 'UNPAID'
       and "paymentMethod" = 'CARD'
       and "placedAt" < now() - make_interval(mins => older_than_minutes)
  loop
    perform public.set_order_status(v_order.id, 'CANCELLED');
    return next v_order."orderNumber";
  end loop;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Re-asserted rather than inherited. `0006_privileges.sql` altered the default
-- privileges, but these functions are created here, after it ran, and a
-- `security definer` function the anon role may execute is a write path with
-- the door left open — `settle_order_payment` marks an order paid.

revoke all on function public.place_order(jsonb) from public, anon, authenticated;
revoke all on function public.settle_order_payment(text, text) from public, anon, authenticated;
revoke all on function public.expire_unpaid_orders(int) from public, anon, authenticated;

revoke all on public."Order" from anon, authenticated;
revoke all on public."OrderItem" from anon, authenticated;
