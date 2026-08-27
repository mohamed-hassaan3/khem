-- KHEM — the discount engine.
--
-- Applied by `npm run db:migrate` after `0027_credit_redemption.sql`, whose
-- `place_order()` and `set_order_status()` bodies this re-declares.
--
-- ── What the client may say ─────────────────────────────────
--
-- A **code string**. Not a percentage, not an amount, not a verdict on whether
-- it applies. `supabase/AGENTS.md` §12 ends with "never calculate final order
-- prices on the client", and this file is where that stops being a slogan: the
-- amount is computed here, from rows, inside the transaction that writes the
-- order.
--
-- 0027 left a placeholder for exactly this moment — the credit block refused an
-- order carrying `payload->>'discountInCents'`, a number the client would have
-- had to name. That check is replaced below by one that reads a *resolved*
-- discount, which is the difference between trusting an input and computing one.
--
-- ── A ledger, not a counter ─────────────────────────────────
--
-- `discounts` carries no `timesUsed` column. Both caps count rows in
-- `discount_redemptions`, for the reason `0026_discovery_credits.sql` gives at
-- length: a counter and a list of uses are two records of one fact, and the day
-- they disagree there is no way to tell which is lying. It also makes "revenue
-- generated" (§12) a join rather than a number nobody can audit.
--
-- ── Restricted codes discount eligible lines only ───────────
--
-- A 20%-off-Noir code on a bag holding one Noir bottle and one Signature
-- reduces the Noir line alone. The alternative — any qualifying item unlocking
-- a discount on the whole order — lets a cheap qualifying item leverage a
-- discount onto an expensive unrestricted one.
--
-- ── Delivery is never discounted ────────────────────────────
--
-- `src/lib/cart.ts` already has a free-delivery threshold. A code that could
-- also reduce shipping would put two rules in charge of one number.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Same posture as `"Order"` and the credit tables: RLS on, no policy, no grant
-- to the public roles, `execute` revoked on every function. A grant row names a
-- person's email address.

-- ── Enums ───────────────────────────────────────────────────

do $$ begin
  create type public."DiscountKind" as enum ('PERCENTAGE', 'FIXED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."DiscountScope" as enum ('ALL', 'PRODUCTS', 'COLLECTIONS');
exception when duplicate_object then null; end $$;

-- ── discounts ───────────────────────────────────────────────

create table if not exists public.discounts (
  id                    text primary key default gen_random_uuid()::text,

  -- Stored uppercased so `welcome10` and `WELCOME10` are one code rather than
  -- two. The unique index is on the stored value, which is why the write path
  -- must upper() rather than relying on a case-insensitive comparison later.
  code                  text not null unique
    check (code = upper(code) and char_length(code) between 3 and 40),

  kind                  public."DiscountKind" not null,

  -- A percentage 1–100, or an amount in piastres. One column with a check per
  -- kind rather than two nullable ones: a row can only ever mean one thing.
  value                 int not null check (value > 0),
  constraint discount_percentage_range check (
    kind <> 'PERCENTAGE' or value between 1 and 100
  ),

  "isActive"            boolean not null default true,

  -- Both nullable. An always-on code is a legitimate campaign.
  "startsAt"            timestamptz,
  "endsAt"              timestamptz,
  constraint discount_window check (
    "startsAt" is null or "endsAt" is null or "endsAt" > "startsAt"
  ),

  -- Null means unlimited, for both.
  "totalUseLimit"       int check ("totalUseLimit" is null or "totalUseLimit" > 0),
  "perCustomerLimit"    int check ("perCustomerLimit" is null or "perCustomerLimit" > 0),

  -- Judged on the subtotal **before** any reduction. Judging it after would let
  -- a discount disqualify itself.
  "minimumOrderInCents" int not null default 0 check ("minimumOrderInCents" >= 0),

  "appliesTo"           public."DiscountScope" not null default 'ALL',

  /*
   * Whether redemption requires a grant addressed to this person.
   *
   * False for an ordinary campaign code that anybody may type. True for the
   * welcome offer, where the code string is shared but the *entitlement* is
   * not — which is what stops a shared string leaking into a permanent public
   * discount the moment one subscriber posts it. See `discount_grants`.
   */
  "requiresGrant"       boolean not null default false,

  description           text check (char_length(description) <= 300),

  "createdAt"           timestamptz not null default now(),
  "updatedAt"           timestamptz not null default now()
);

create index if not exists discount_active_idx
  on public.discounts ("isActive", "createdAt" desc);

-- ── Restriction sets ────────────────────────────────────────
--
-- Two junctions rather than an array column, so a restriction is a foreign key
-- that cannot name a product which does not exist.

create table if not exists public.discount_products (
  "discountId"  text not null
    references public.discounts(id) on delete cascade,
  "productSlug" text not null
    references public."Product"(slug) on update cascade on delete cascade,
  primary key ("discountId", "productSlug")
);

create table if not exists public.discount_collections (
  "discountId"     text not null
    references public.discounts(id) on delete cascade,
  "collectionSlug" text not null
    references public."Collection"(slug) on update cascade on delete cascade,
  primary key ("discountId", "collectionSlug")
);

-- ── discount_grants ─────────────────────────────────────────
--
-- Who is entitled to a grant-gated code.
--
-- The unique index is the whole of §11's "prevent the same user from repeatedly
-- receiving the offer": issuing twice is refused by the database rather than by
-- a check somebody has to remember to write.

create table if not exists public.discount_grants (
  id            text primary key default gen_random_uuid()::text,

  "discountId"  text not null
    references public.discounts(id) on delete cascade,

  -- Lowercased on write, like `"NewsletterSubscriber"."email"`, so one address
  -- cannot hold two grants by changing case.
  email         text not null check (char_length(email) <= 254),

  -- Filled in when the person has an account. Not required: somebody may
  -- subscribe with an email long before they ever register.
  "clerkUserId" text,

  "issuedAt"    timestamptz not null default now(),

  -- Sixty days from issue for the welcome offer, set by the caller so a
  -- different campaign can choose a different window.
  "expiresAt"   timestamptz,

  -- Single use. Stamped on redemption, cleared again if that order is refunded.
  "usedAt"      timestamptz,
  "usedOrderId" text references public."Order"(id) on delete set null,

  unique ("discountId", email)
);

create index if not exists discount_grant_email_idx
  on public.discount_grants (email);

-- ── discount_redemptions ────────────────────────────────────
--
-- Every use, and the only thing the two caps count.
--
-- `releasedAt` rather than a delete: a refunded order returns its use to both
-- caps, and the history of it having happened is worth keeping.

create table if not exists public.discount_redemptions (
  id              text primary key default gen_random_uuid()::text,

  "discountId"    text not null
    references public.discounts(id) on delete cascade,

  -- One discount per order, enforced rather than assumed.
  "orderId"       text not null unique
    references public."Order"(id) on delete cascade,

  -- Who used it, for the per-customer cap. Email is the fallback identity for a
  -- guest checkout, which has no Clerk id.
  email           text,
  "clerkUserId"   text,

  "amountInCents" int not null check ("amountInCents" >= 0),

  "redeemedAt"    timestamptz not null default now(),
  "releasedAt"    timestamptz
);

create index if not exists discount_redemption_counting_idx
  on public.discount_redemptions ("discountId")
  where "releasedAt" is null;

create index if not exists discount_redemption_customer_idx
  on public.discount_redemptions ("discountId", email)
  where "releasedAt" is null;

-- ── discount_eligible_subtotal ──────────────────────────────
--
-- What a discount is allowed to come off, for one order.
--
-- One definition, used by `resolve_discount()` and readable by the dashboard, so
-- the estimate the checkout shows and the amount actually charged differ only in
-- freshness — never in what the rule *is*.

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
    join public."Product" p on p.slug = i."productSlug"
    join public.discounts d on d.id = discount_id
   where i."orderId" = order_id
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

-- ── resolve_discount ────────────────────────────────────────
--
-- The whole of the validation, and the only place an amount is computed.
--
-- Returns `{ ok, discountId, code, amountInCents, reason }` rather than raising,
-- so the caller decides how a refusal surfaces — `place_order()` raises with the
-- reason, and a future "check this code" endpoint could show it without
-- attempting an order.
--
-- Takes a `for update` lock on the discount row before counting. That lock is
-- what makes the caps real: two checkouts racing for the last use of a code
-- serialise here, and the second counts a row the first has already written.

create or replace function public.resolve_discount(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     text := upper(btrim(coalesce(payload->>'code', '')));
  v_order_id text := payload->>'orderId';
  v_email    text := lower(nullif(payload->>'email', ''));
  v_user     text := nullif(payload->>'clerkUserId', '');
  v_subtotal int  := coalesce((payload->>'subtotalInCents')::int, 0);
  v_d        record;
  v_grant    record;
  v_eligible int;
  v_used     int;
  v_amount   int;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'No code was given.');
  end if;

  select * into v_d from public.discounts where code = v_code for update;

  -- An unknown code and an inactive one are told apart, because an editor
  -- testing a code they just deactivated needs to know which it was. Both are
  -- refusals either way.
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That code is not recognised.');
  end if;

  if not v_d."isActive" then
    return jsonb_build_object('ok', false, 'reason', 'That code is no longer active.');
  end if;

  if v_d."startsAt" is not null and v_d."startsAt" > now() then
    return jsonb_build_object('ok', false, 'reason', 'That code is not available yet.');
  end if;

  if v_d."endsAt" is not null and v_d."endsAt" <= now() then
    return jsonb_build_object('ok', false, 'reason', 'That code has expired.');
  end if;

  -- Judged on the subtotal before any reduction. See the header.
  if v_subtotal < v_d."minimumOrderInCents" then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That code needs a larger order.'
    );
  end if;

  -- ── The grant gate ──────────────────────────────────────
  --
  -- For a code whose string is shared but whose entitlement is not. Without
  -- this, `WELCOME10` would work for anybody who ever saw it.
  if v_d."requiresGrant" then
    if v_email is null then
      return jsonb_build_object('ok', false, 'reason', 'That code is not available on this order.');
    end if;

    select * into v_grant
      from public.discount_grants g
     where g."discountId" = v_d.id and g.email = v_email
       for update;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'That code is not available on this order.');
    end if;

    if v_grant."usedAt" is not null then
      return jsonb_build_object('ok', false, 'reason', 'That code has already been used.');
    end if;

    if v_grant."expiresAt" is not null and v_grant."expiresAt" <= now() then
      return jsonb_build_object('ok', false, 'reason', 'That code has expired.');
    end if;
  end if;

  -- ── The caps, counted from the ledger ───────────────────

  if v_d."totalUseLimit" is not null then
    select count(*) into v_used
      from public.discount_redemptions r
     where r."discountId" = v_d.id and r."releasedAt" is null;

    if v_used >= v_d."totalUseLimit" then
      return jsonb_build_object('ok', false, 'reason', 'That code has been fully redeemed.');
    end if;
  end if;

  if v_d."perCustomerLimit" is not null then
    -- Identity is the Clerk id when there is one and the email otherwise, so a
    -- guest cannot reset their own count by not signing in.
    select count(*) into v_used
      from public.discount_redemptions r
     where r."discountId" = v_d.id
       and r."releasedAt" is null
       and (
         (v_user is not null and r."clerkUserId" = v_user)
         or (v_user is null and v_email is not null and r.email = v_email)
       );

    if v_used >= v_d."perCustomerLimit" then
      return jsonb_build_object('ok', false, 'reason', 'You have already used that code.');
    end if;
  end if;

  -- ── The amount ──────────────────────────────────────────

  v_eligible := public.discount_eligible_subtotal(v_order_id, v_d.id);

  if v_eligible <= 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That code does not apply to anything in your bag.'
    );
  end if;

  if v_d.kind = 'PERCENTAGE' then
    -- Rounded down, so the house never gives away a piastre it did not mean to.
    v_amount := (v_eligible * v_d.value) / 100;
  else
    -- Capped at what it may come off, so an order can never go negative.
    v_amount := least(v_d.value, v_eligible);
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'That code takes nothing off this order.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'discountId', v_d.id,
    'code', v_d.code,
    'amountInCents', v_amount
  );
end;
$$;

-- ── reverse_discount_redemption ─────────────────────────────
--
-- A refunded order returns its use to both caps, and gives back a grant it
-- consumed. Idempotent: `releasedAt is null` is the guard, so CANCELLED
-- followed by REFUNDED releases once.

create or replace function public.reverse_discount_redemption(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released int;
begin
  update public.discount_redemptions
     set "releasedAt" = now()
   where "orderId" = order_id
     and "releasedAt" is null;

  get diagnostics v_released = row_count;

  if v_released = 0 then
    return 0;
  end if;

  -- The grant, if this order consumed one.
  update public.discount_grants
     set "usedAt" = null,
         "usedOrderId" = null
   where "usedOrderId" = order_id;

  return v_released;
end;
$$;

-- ── place_order ─────────────────────────────────────────────
--
-- The 0027 body plus a discount block, placed **before** the credit block so
-- the credit's mutual-exclusion check reads a resolved discount rather than a
-- number the client claimed. Everything else is verbatim.

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
      -- The reason is written for the customer; the caller passes it through.
      raise exception '%', coalesce(v_discount->>'reason', 'That code cannot be used.')
        using errcode = 'check_violation';
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

-- ── Order columns ───────────────────────────────────────────
--
-- Added after `place_order()` only for readability; `alter table` and
-- `create or replace function` are independent statements in one transaction.
--
-- `discountCode` is a **snapshot**, like `"OrderItem"."productName"`: a code
-- renamed or deleted later must still print correctly on the order it was used
-- on.

alter table public."Order"
  add column if not exists "discountId" text
    references public.discounts(id) on delete set null,
  add column if not exists "discountCode" text,
  add column if not exists "discountInCents" int not null default 0
    check ("discountInCents" >= 0);

-- ── set_order_status ────────────────────────────────────────
--
-- The 0027 body plus one call. A refund now releases three things, all
-- independent: the stock, the credits this order earned, the credit it spent,
-- and the discount it consumed.

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
    perform public.reverse_discount_redemption(order_id);
  end if;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────

alter table public.discounts              enable row level security;
alter table public.discount_products      enable row level security;
alter table public.discount_collections   enable row level security;
alter table public.discount_grants        enable row level security;
alter table public.discount_redemptions   enable row level security;

revoke all on public.discounts            from public, anon, authenticated;
revoke all on public.discount_products    from public, anon, authenticated;
revoke all on public.discount_collections from public, anon, authenticated;
revoke all on public.discount_grants      from public, anon, authenticated;
revoke all on public.discount_redemptions from public, anon, authenticated;

revoke all on function public.discount_eligible_subtotal(text, text)
  from public, anon, authenticated;
revoke all on function public.resolve_discount(jsonb)          from public, anon, authenticated;
revoke all on function public.reverse_discount_redemption(text) from public, anon, authenticated;
revoke all on function public.place_order(jsonb)               from public, anon, authenticated;
revoke all on function public.set_order_status(text, public."OrderStatus")
  from public, anon, authenticated;
