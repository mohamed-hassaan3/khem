-- KHEM — stock in two channels, with a movement ledger.
-- Applied by `npm run db:migrate`, after `0040_discount_refusal_detail.sql`
-- (whose `place_order()` body this re-declares). Every statement is idempotent.
--
-- ## What changes
--
-- `"Product".inventory` was one number serving two counters. The website and the
-- desk both drew from it, so a walk-in sale could put the storefront into its
-- low-stock warning and a web order could empty the shelf the counter was
-- selling from. This file splits it into `"inventoryOnline"` and
-- `"inventoryOffline"`, which move **independently**:
--
--   * an ONLINE order decrements online, and nothing else;
--   * an OFFLINE order — one recorded at the desk — decrements offline;
--   * online never draws from offline. Online at 0 is *sold out* on the
--     storefront even with fifty on the shelf, because those fifty are promised
--     to the counter. Moving them is a decision someone makes, not something the
--     checkout does silently — see `transfer_stock()`.
--
-- ## Why `"inventory"` survives
--
-- Dropping it here would break every reader in the same deploy — the product
-- form, the cart, the analytics view, the admin table. It stays, and a trigger
-- keeps it equal to online + offline, so anything still reading it sees a
-- truthful total rather than a frozen number. It is now **derived**: writing to
-- it directly has no effect, because the trigger recomputes it. Retire it in a
-- later migration once nothing reads it.
--
-- ## Why the ledger
--
-- "Do not simply overwrite stock quantities without recording the movement."
-- Every path that changes a count writes an `"InventoryMovement"` row in the
-- same transaction as the change — the sale, the restock, the receipt, the
-- correction, both halves of a transfer. A count and its explanation cannot come
-- apart, for the same reason an order and the stock it consumes are one event.
--
-- ## Why `"OrderChannel"` is reused rather than twinned
--
-- A second enum with the same two values would be a second answer to one
-- question, and the two would part company the first time a third channel
-- appeared. An order's channel *is* the counter it draws from.

-- ── The ledger's vocabulary ───────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'InventoryAction') then
    create type public."InventoryAction" as enum (
      'SALE',          -- an order consumed units
      'RESTOCK',       -- a cancelled or refunded order returned them
      'RECEIPT',       -- new stock arrived
      'ADJUSTMENT',    -- someone counted the shelf and corrected the figure
      'TRANSFER_IN',   -- the receiving half of a channel transfer
      'TRANSFER_OUT'   -- the giving half
    );
  end if;
end
$$;

-- ── The two counters ──────────────────────────────────────────

alter table public."Product"
  add column if not exists "inventoryOnline"  int not null default 0
    check ("inventoryOnline" >= 0),
  add column if not exists "inventoryOffline" int not null default 0
    check ("inventoryOffline" >= 0);

-- Backfill once. The existing figure goes to **online**, because that is what
-- the storefront has been selling against and continuity there is what a
-- visitor would notice. The offline counter opens at zero and is filled by the
-- opening-balance step, which is a separate, approved operation.
--
-- Guarded so a re-run cannot double-count.
update public."Product"
   set "inventoryOnline" = inventory
 where "inventoryOnline" = 0
   and "inventoryOffline" = 0
   and inventory > 0;

-- ── `"inventory"` becomes the total ───────────────────────────

create or replace function public.sync_inventory_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.inventory := new."inventoryOnline" + new."inventoryOffline";
  return new;
end;
$$;

drop trigger if exists sync_inventory_total on public."Product";

create trigger sync_inventory_total
  before insert or update of "inventoryOnline", "inventoryOffline", inventory
  on public."Product"
  for each row
  execute function public.sync_inventory_total();

-- Bring existing rows into line with the rule the trigger now enforces.
update public."Product"
   set "updatedAt" = "updatedAt"
 where inventory is distinct from ("inventoryOnline" + "inventoryOffline");

-- ── The ledger ────────────────────────────────────────────────

create table if not exists public."InventoryMovement" (
  id            text primary key default gen_random_uuid()::text,

  "productSlug" text not null
    references public."Product"(slug) on delete cascade on update cascade,

  channel       public."OrderChannel"   not null,
  action        public."InventoryAction" not null,

  -- Signed: negative takes units away. `previous + quantity = new` always, which
  -- is what makes the ledger auditable rather than merely descriptive.
  quantity      int not null check (quantity <> 0),
  "previousQuantity" int not null check ("previousQuantity" >= 0),
  "newQuantity"      int not null check ("newQuantity" >= 0),

  reason        text,
  actor         text,

  "orderId"     text references public."Order"(id) on delete set null,

  "createdAt"   timestamptz not null default now(),

  constraint inventory_movement_arithmetic
    check ("previousQuantity" + quantity = "newQuantity")
);

create index if not exists inventory_movement_product_idx
  on public."InventoryMovement" ("productSlug", "createdAt" desc);

create index if not exists inventory_movement_created_idx
  on public."InventoryMovement" ("createdAt" desc);

create index if not exists inventory_movement_order_idx
  on public."InventoryMovement" ("orderId")
  where "orderId" is not null;

-- ── One way to move stock ─────────────────────────────────────
--
-- Every caller below goes through this, so there is no path that changes a
-- count without leaving a row. It locks the product, so two concurrent sales
-- cannot both read the pre-sale figure.

create or replace function public.move_stock(
  p_slug     text,
  p_channel  public."OrderChannel",
  p_action   public."InventoryAction",
  p_quantity int,
  p_reason   text default null,
  p_actor    text default null,
  p_order_id text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous int;
  v_new      int;
  v_name     text;
begin
  if p_quantity = 0 then
    raise exception 'A stock movement of zero says nothing.'
      using errcode = 'check_violation';
  end if;

  select name,
         case when p_channel = 'ONLINE' then "inventoryOnline" else "inventoryOffline" end
    into v_name, v_previous
    from public."Product"
   where slug = p_slug
     for update;

  if not found then
    raise exception 'No product with the slug %.', p_slug
      using errcode = 'foreign_key_violation';
  end if;

  v_new := v_previous + p_quantity;

  if v_new < 0 then
    /*
     * The wording is a contract, not prose. `src/actions/checkout.ts` and
     * `src/actions/admin/orders.ts` both test the provider's message for the
     * substring "in stock" to tell a shortfall from a genuine failure, and turn
     * it into the sentence a customer reads. Naming the channel here — "in
     * online stock" — would break that substring and the shortfall would
     * surface as an unexplained error. The channel is already implied by the
     * order that hit it.
     */
    raise exception '% has only % in stock.', v_name, v_previous
      using errcode = 'check_violation';
  end if;

  if p_channel = 'ONLINE' then
    update public."Product"
       set "inventoryOnline" = v_new, "updatedAt" = now()
     where slug = p_slug;
  else
    update public."Product"
       set "inventoryOffline" = v_new, "updatedAt" = now()
     where slug = p_slug;
  end if;

  insert into public."InventoryMovement" (
    "productSlug", channel, action, quantity,
    "previousQuantity", "newQuantity", reason, actor, "orderId"
  ) values (
    p_slug, p_channel, p_action, p_quantity,
    v_previous, v_new, p_reason, p_actor, p_order_id
  );

  return v_new;
end;
$$;

-- ── Desk operations ───────────────────────────────────────────

-- An offline sale: units left the counter. Recorded at the end of the day.
create or replace function public.record_offline_sale(
  p_slug text, p_quantity int, p_reason text default null, p_actor text default null
)
returns int
language sql
security definer
set search_path = public
as $$
  select public.move_stock(
    p_slug, 'OFFLINE', 'SALE', -abs(p_quantity),
    coalesce(p_reason, 'Offline sale'), p_actor, null
  );
$$;

-- New stock arrived into one channel.
create or replace function public.receive_stock(
  p_slug text, p_channel public."OrderChannel", p_quantity int,
  p_reason text default null, p_actor text default null
)
returns int
language sql
security definer
set search_path = public
as $$
  select public.move_stock(
    p_slug, p_channel, 'RECEIPT', abs(p_quantity),
    coalesce(p_reason, 'Stock received'), p_actor, null
  );
$$;

-- Move units between channels. Two movements, one transaction: the ledger shows
-- where they went as well as that they left.
create or replace function public.transfer_stock(
  p_slug text,
  p_from public."OrderChannel",
  p_to   public."OrderChannel",
  p_quantity int,
  p_reason text default null,
  p_actor  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(
    p_reason,
    'Transfer ' || lower(p_from::text) || ' → ' || lower(p_to::text)
  );
begin
  if p_from = p_to then
    raise exception 'A transfer needs two different channels.'
      using errcode = 'check_violation';
  end if;

  if p_quantity <= 0 then
    raise exception 'A transfer needs a positive quantity.'
      using errcode = 'check_violation';
  end if;

  -- Out first: if the giving channel is short, nothing has moved yet.
  perform public.move_stock(p_slug, p_from, 'TRANSFER_OUT', -p_quantity, v_reason, p_actor, null);
  perform public.move_stock(p_slug, p_to,   'TRANSFER_IN',   p_quantity, v_reason, p_actor, null);
end;
$$;

-- The counted-shelf correction: absolute, as it has always been, because "set it
-- to what I counted" is the only instruction that stays correct on a page left
-- open while sales came in. The *delta* is computed here and recorded, so the
-- ledger explains the jump.
create or replace function public.set_channel_stock(
  p_slug text,
  p_channel public."OrderChannel",
  p_quantity int,
  p_reason text default null,
  p_actor  text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_delta   int;
begin
  if p_quantity < 0 then
    raise exception 'A counted figure cannot be negative.'
      using errcode = 'check_violation';
  end if;

  select case when p_channel = 'ONLINE' then "inventoryOnline" else "inventoryOffline" end
    into v_current
    from public."Product"
   where slug = p_slug
     for update;

  if not found then
    raise exception 'No product with the slug %.', p_slug
      using errcode = 'foreign_key_violation';
  end if;

  v_delta := p_quantity - v_current;

  -- Setting a figure to what it already is is not a movement, and writing a
  -- zero-quantity row would break the ledger's own check constraint.
  if v_delta = 0 then
    return v_current;
  end if;

  return public.move_stock(
    p_slug, p_channel, 'ADJUSTMENT', v_delta,
    coalesce(p_reason, 'Counted correction'), p_actor, null
  );
end;
$$;

-- ── place_order ─────────────────────────────────────────────
--
-- The 0040 body, with one change: the stock line. Re-emitted whole rather than
-- patched, which is how every previous migration has changed this function
-- (0015, 0016, 0017, 0027, 0028, 0035, 0040) — a `create or replace` cannot
-- edit a fragment, and a body assembled from pieces would be unreadable.
--
-- Everything else is byte-for-byte 0040: the discount resolution and its
-- `DISCOUNT:` hint, the Discovery Credit rules including the
-- credit-plus-discount refusal, the eligible-line count, the totals arithmetic.
-- Diff this against 0040 before trusting it.
--
-- The change: the per-line shortfall check and decrement are now one
-- `move_stock()` call against the order's own channel, which also writes the
-- ledger row.

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

-- ── restock_order ───────────────────────────────────────────
--
-- The 0015 body, made channel-aware and ledger-writing. Units go back to the
-- counter they came from: cancelling an offline order returns them to the desk,
-- not to the website.
--
-- Still idempotent by `stockReleasedAt`, which is what makes
-- CANCELLED → REFUNDED safe — and now also what stops a second call from
-- writing a second set of RESTOCK rows into the ledger.
--
-- `set_order_status()` is deliberately **not** re-emitted: it already delegates
-- here, so the 0028 body needs no change.

create or replace function public.restock_order(order_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released timestamptz;
  v_channel  public."OrderChannel";
  v_number   text;
  v_item     record;
begin
  select "stockReleasedAt", channel, "orderNumber"
    into v_released, v_channel, v_number
    from public."Order" where id = order_id for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_released is not null then
    return;
  end if;

  -- A loop rather than the previous set-update, because each line needs its own
  -- before/after pair in the ledger. Ordered by slug so two concurrent restocks
  -- take the row locks in the same sequence and cannot deadlock.
  for v_item in
    select "productSlug", quantity
      from public."OrderItem"
     where "orderId" = order_id
     order by "productSlug"
  loop
    perform public.move_stock(
      v_item."productSlug", v_channel, 'RESTOCK', v_item.quantity,
      'Released from ' || v_number, null, order_id
    );
  end loop;

  update public."Order"
     set "stockReleasedAt" = now(),
         "updatedAt" = now()
   where id = order_id;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Same posture as every order-path file since 0015: none of this is reachable
-- without SUPABASE_SECRET_KEY. The ledger is service-role only — it names what
-- the house holds off-site, which is not a visitor's business.

alter table public."InventoryMovement" enable row level security;

revoke all on public."InventoryMovement" from public, anon, authenticated;

revoke all on function public.move_stock(text, public."OrderChannel", public."InventoryAction", int, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_offline_sale(text, int, text, text)
  from public, anon, authenticated;
revoke all on function public.receive_stock(text, public."OrderChannel", int, text, text)
  from public, anon, authenticated;
revoke all on function public.transfer_stock(text, public."OrderChannel", public."OrderChannel", int, text, text)
  from public, anon, authenticated;
revoke all on function public.set_channel_stock(text, public."OrderChannel", int, text, text)
  from public, anon, authenticated;
revoke all on function public.place_order(jsonb)    from public, anon, authenticated;
revoke all on function public.restock_order(text)   from public, anon, authenticated;

grant all on public."InventoryMovement" to service_role;

grant execute on function public.move_stock(text, public."OrderChannel", public."InventoryAction", int, text, text, text)
  to service_role;
grant execute on function public.record_offline_sale(text, int, text, text)              to service_role;
grant execute on function public.receive_stock(text, public."OrderChannel", int, text, text) to service_role;
grant execute on function public.transfer_stock(text, public."OrderChannel", public."OrderChannel", int, text, text)
  to service_role;
grant execute on function public.set_channel_stock(text, public."OrderChannel", int, text, text) to service_role;
grant execute on function public.place_order(jsonb)  to service_role;
grant execute on function public.restock_order(text) to service_role;
