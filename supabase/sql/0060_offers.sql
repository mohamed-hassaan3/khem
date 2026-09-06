-- KHEM — Offers & Bundles.
--
-- Applied by `npm run db:migrate` after `0059_rewards.sql`. The order it prices
-- is written by `place_order()` in `0061_benefit_resolution.sql`, which is the
-- only caller of `resolve_offer()` that can change what a customer is charged —
-- the same split `0026`/`0027` used for credits, and for the same reason:
-- nothing in *this* file can move money on its own.
--
-- ── Not "Buy 2 Get 1" ───────────────────────────────────────
--
-- The first campaign is Buy 2 Get 1. The table is not. An offer here is a
-- trigger (how many, of what) and a reward (how many, of what, chosen how), so
-- Buy 3 Get 1, Buy X Get Y, buy-two-for-a-percentage, a gift with purchase, and
-- "buy from Signature, receive from Noir" are all configurations rather than
-- migrations.
--
-- ── How many groups an order earns ──────────────────────────
--
-- The one piece of real arithmetic in this file, and it is worth stating before
-- the tables because every column below exists to feed it.
--
-- A unit can serve one role: it is either paid for as part of a trigger, or it
-- is the reward. Sort the order's eligible units into three pools —
--
--   T  units matching the trigger set only
--   R  units matching the reward set only
--   B  units matching both
--
-- — and the number of complete groups is
--
--   k = min( ⌊(T+B) / triggerQty⌋,
--            ⌊(R+B) / rewardQty⌋,
--            ⌊(T+R+B) / (triggerQty + rewardQty)⌋ )
--
-- The third term is what makes the common case right. For Buy 2 Get 1 over one
-- collection, T and R are empty and every unit is in B, so k = ⌊N/3⌋: three
-- bottles in the bag, one free. Without it the first term alone would say
-- ⌊N/2⌋ and give a free bottle to somebody who bought two.
--
-- For a genuinely cross-set offer — buy 2 from Signature, receive 1 from Noir —
-- B is empty and the expression collapses to the obvious `min(T/2, R/1)`.
--
-- ── Which unit is free ──────────────────────────────────────
--
-- The cheapest, by default. A customer who puts two 890 bottles and one 2,200
-- bottle in a bag must not receive the 2,200 for free — that is the whole point
-- of `rewardSelection`, and `LOWEST_PRICED` is its default because the opposite
-- is a pricing mistake rather than a marketing decision.
--
-- Prices are read from the order's own lines, which are post-promotion: an offer
-- reduces what a campaign already reduced, never the list price.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- `offers` and its target sets are readable by the public roles while they are
-- **live**, exactly as `promotions` is — the storefront prints "Choose 3, pay
-- for 2" on a collection page, and hiding the row would mean the badge came from
-- a constant instead. `offer_grants` and `offer_redemptions` name people and are
-- not readable by anyone: same posture as `discount_grants`.

-- ── Enums ───────────────────────────────────────────────────

-- What the customer receives. A free unit, or a percentage off the units the
-- offer selected. `"DiscountKind"` is deliberately not reused: neither member of
-- it describes "one of these is free".
do $$ begin
  create type public."OfferRewardKind" as enum ('FREE_ITEM', 'PERCENTAGE');
exception when duplicate_object then null; end $$;

-- Reuses `"PromotionScope"`'s shape rather than `"DiscountScope"`: an offer must
-- name products or collections, because "buy two of anything" is a house-wide
-- price change rather than a campaign.
do $$ begin
  create type public."OfferScope" as enum ('PRODUCTS', 'COLLECTIONS');
exception when duplicate_object then null; end $$;

-- Which unit becomes free.
do $$ begin
  create type public."OfferSelection" as enum ('LOWEST_PRICED', 'HIGHEST_PRICED');
exception when duplicate_object then null; end $$;

-- Who may use it. Every member is answerable from a table this schema already
-- has: orders for the first two, `"NewsletterSubscriber"` for the third,
-- `offer_grants` for the fourth.
do $$ begin
  create type public."OfferAudience" as enum (
    'EVERYONE',
    'NEW_CUSTOMERS',
    'EXISTING_CUSTOMERS',
    'SUBSCRIBERS',
    'INVITED'
  );
exception when duplicate_object then null; end $$;

-- ── offers ──────────────────────────────────────────────────

create table if not exists public.offers (
  id            text primary key default gen_random_uuid()::text,

  -- What the desk calls it. Never printed to a customer — `label` is.
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  description   text check (char_length(description) <= 300),

  -- The customer-facing line: "Choose 3, Pay for 2". Null for an offer that
  -- should apply quietly with no banner.
  label         text check (char_length(label) <= 60),
  label_ar      text check (char_length(label_ar) <= 60),

  "isActive"    boolean not null default true,
  "startsAt"    timestamptz,
  "endsAt"      timestamptz,
  constraint offer_window check (
    "startsAt" is null or "endsAt" is null or "endsAt" > "startsAt"
  ),

  -- ── Trigger ──
  "triggerQuantity" int not null default 2 check ("triggerQuantity" >= 1),
  "triggerScope"    public."OfferScope" not null default 'COLLECTIONS',

  -- ── Reward ──
  "rewardQuantity"  int not null default 1 check ("rewardQuantity" >= 1),
  "rewardKind"      public."OfferRewardKind" not null default 'FREE_ITEM',
  "rewardScope"     public."OfferScope" not null default 'COLLECTIONS',
  "rewardSelection" public."OfferSelection" not null default 'LOWEST_PRICED',

  -- Only meaningful for `PERCENTAGE`, and required for it. One column with a
  -- check per kind rather than two nullable ones, exactly as `discounts.value`
  -- is: a row can only ever mean one thing.
  "rewardValue"     int check ("rewardValue" is null or "rewardValue" between 1 and 100),
  constraint offer_percentage_value check (
    "rewardKind" <> 'PERCENTAGE' or "rewardValue" is not null
  ),

  -- ── Eligibility ──
  audience          public."OfferAudience" not null default 'EVERYONE',

  /*
   * The offer applies only to an order carrying this code.
   *
   * Not a foreign key to `discounts.code`: a campaign may be built before its
   * code is, and a renamed code should break the offer loudly at resolution
   * rather than silently at migration time. Stored uppercased, like the codes
   * themselves.
   */
  "requiresCode"    text check (
    "requiresCode" is null
    or ("requiresCode" = upper("requiresCode")
        and char_length("requiresCode") between 3 and 40)
  ),

  -- ── Limits ──
  "totalUseLimit"    int check ("totalUseLimit" is null or "totalUseLimit" > 0),
  "perCustomerLimit" int check ("perCustomerLimit" is null or "perCustomerLimit" > 0),

  -- ── Stacking ──
  --
  -- Both false, which is the policy: one promotional mechanism per order.
  -- Turning either on is a deliberate act with a visible switch behind it, the
  -- same shape `promotions."stacksWithCodes"` already has.
  "stacksWithCodes"  boolean not null default false,
  "stacksWithCredit" boolean not null default false,

  -- Tie-break between two offers that both apply. Higher wins; the larger
  -- reduction breaks a tie after that — `active_product_promotions`'s rule.
  priority      int not null default 0,

  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now(),

  /*
   * An offer gated on a discount code that refuses to run beside one could never
   * apply. Refused here rather than left to be discovered by a customer whose
   * basket silently failed to earn what the banner promised.
   */
  constraint offer_code_gate_stacks check (
    "requiresCode" is null or "stacksWithCodes"
  )
);

create index if not exists offer_live_idx
  on public.offers ("isActive", "startsAt", "endsAt");

-- ── Target sets ─────────────────────────────────────────────
--
-- Four junctions rather than array columns, for `0028`'s reason: a target is a
-- foreign key that cannot name a product which does not exist.
--
-- Trigger and reward are separate sets even when a campaign points both at the
-- same collection. Collapsing them into one would make "buy from Signature,
-- receive from Noir" unrepresentable, which is one of the shapes the feature was
-- asked for.

create table if not exists public.offer_trigger_products (
  "offerId"     text not null references public.offers(id) on delete cascade,
  "productSlug" text not null
    references public."Product"(slug) on update cascade on delete cascade,
  primary key ("offerId", "productSlug")
);

create table if not exists public.offer_trigger_collections (
  "offerId"        text not null references public.offers(id) on delete cascade,
  "collectionSlug" text not null
    references public."Collection"(slug) on update cascade on delete cascade,
  primary key ("offerId", "collectionSlug")
);

create table if not exists public.offer_reward_products (
  "offerId"     text not null references public.offers(id) on delete cascade,
  "productSlug" text not null
    references public."Product"(slug) on update cascade on delete cascade,
  primary key ("offerId", "productSlug")
);

create table if not exists public.offer_reward_collections (
  "offerId"        text not null references public.offers(id) on delete cascade,
  "collectionSlug" text not null
    references public."Collection"(slug) on update cascade on delete cascade,
  primary key ("offerId", "collectionSlug")
);

create index if not exists offer_trigger_product_slug_idx
  on public.offer_trigger_products ("productSlug");
create index if not exists offer_trigger_collection_slug_idx
  on public.offer_trigger_collections ("collectionSlug");
create index if not exists offer_reward_product_slug_idx
  on public.offer_reward_products ("productSlug");
create index if not exists offer_reward_collection_slug_idx
  on public.offer_reward_collections ("collectionSlug");

-- ── offer_grants ────────────────────────────────────────────
--
-- Who is entitled to an `INVITED` offer. `discount_grants`'s shape, because it
-- is the same fact about a different instrument — and the unique index is
-- likewise the whole of "cannot be invited twice".

create table if not exists public.offer_grants (
  id            text primary key default gen_random_uuid()::text,

  "offerId"     text not null references public.offers(id) on delete cascade,

  -- Lowercased on write, like every other email column in this schema, so one
  -- address cannot hold two invitations by changing case.
  email         text not null check (char_length(email) <= 254),

  "clerkUserId" text,

  "issuedAt"    timestamptz not null default now(),
  "expiresAt"   timestamptz,

  unique ("offerId", email)
);

create index if not exists offer_grant_email_idx
  on public.offer_grants (email);

-- ── offer_redemptions ───────────────────────────────────────
--
-- Every use, and the only thing the two caps count. `releasedAt` rather than a
-- delete, exactly as `discount_redemptions` has it: a refunded order returns its
-- use to both caps, and the history of it having happened is worth keeping.

create table if not exists public.offer_redemptions (
  id              text primary key default gen_random_uuid()::text,

  "offerId"       text not null references public.offers(id) on delete cascade,

  -- One offer per order, enforced rather than assumed.
  "orderId"       text not null unique
    references public."Order"(id) on delete cascade,

  email           text,
  "clerkUserId"   text,

  "amountInCents" int not null check ("amountInCents" >= 0),

  -- Which unit was actually given, and what it was worth. The audit trail for
  -- "why was this bottle free" — a question the desk will be asked, and one the
  -- order lines alone cannot answer, because the line keeps its real price.
  "rewardProductSlug"      text,
  "rewardUnitPriceInCents" int,

  "redeemedAt"    timestamptz not null default now(),
  "releasedAt"    timestamptz
);

create index if not exists offer_redemption_counting_idx
  on public.offer_redemptions ("offerId")
  where "releasedAt" is null;

create index if not exists offer_redemption_customer_idx
  on public.offer_redemptions ("offerId", email)
  where "releasedAt" is null;

-- ── Order columns ───────────────────────────────────────────
--
-- The label is snapshotted beside the id, exactly as `"discountCode"` sits
-- beside `"discountId"`: a campaign renamed next season must not rewrite what an
-- old confirmation said.

alter table public."Order"
  add column if not exists "offerId" text
    references public.offers(id) on delete set null,
  add column if not exists "offerLabel" text,
  add column if not exists "offerDiscountInCents" int not null default 0
    check ("offerDiscountInCents" >= 0);

create index if not exists order_offer_idx
  on public."Order" ("offerId")
  where "offerId" is not null;

-- ── The unit sources ────────────────────────────────────────
--
-- An offer reasons about **bottles**, not about lines: a line of quantity 3
-- becomes three units, because Buy 2 Get 1 on a single line of three is still
-- Buy 2 Get 1.
--
-- Two sources, because the same offer has to be answerable twice — once for the
-- bag a visitor is looking at, and once for the order being written. Both hand
-- back the same jsonb shape, so the arithmetic below has exactly one
-- implementation and the figure the cart shows cannot drift from the figure the
-- checkout charges.
--
--   [{ "slug": …, "price": …, "t": true|false, "r": true|false }, …]
--
-- `t` and `r` are membership of the trigger and reward sets. A unit may be in
-- both, in one, or in neither.

create or replace function public.offer_units_for_order(order_id text, offer_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug',  i."productSlug",
           'price', i."priceInCents",
           't', (o."triggerScope" = 'PRODUCTS' and exists (
                   select 1 from public.offer_trigger_products x
                    where x."offerId" = o.id and x."productSlug" = i."productSlug"))
                or (o."triggerScope" = 'COLLECTIONS' and exists (
                   select 1 from public.offer_trigger_collections x
                    where x."offerId" = o.id and x."collectionSlug" = p."collectionSlug")),
           'r', (o."rewardScope" = 'PRODUCTS' and exists (
                   select 1 from public.offer_reward_products x
                    where x."offerId" = o.id and x."productSlug" = i."productSlug"))
                or (o."rewardScope" = 'COLLECTIONS' and exists (
                   select 1 from public.offer_reward_collections x
                    where x."offerId" = o.id and x."collectionSlug" = p."collectionSlug"))
         )), '[]'::jsonb)
    from public."OrderItem" i
    join public."Product" p on p.slug = i."productSlug"
    join public.offers o on o.id = offer_id
    cross join lateral generate_series(1, i.quantity) as unit(n)
   where i."orderId" = order_id;
$$;

-- The bag's twin. Prices come from `active_product_promotions` where a campaign
-- is running and from `"Product"` otherwise — the same precedence
-- `place_order()` applies, so an offer on a promoted bottle is worth the same
-- before and after the customer commits.
--
-- Takes `[{ "slug": …, "quantity": … }]`. No price ever arrives from a browser.
create or replace function public.offer_units_for_cart(items jsonb, offer_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug',  p.slug,
           'price', coalesce(promo."priceInCents", p."priceInCents"),
           't', (o."triggerScope" = 'PRODUCTS' and exists (
                   select 1 from public.offer_trigger_products x
                    where x."offerId" = o.id and x."productSlug" = p.slug))
                or (o."triggerScope" = 'COLLECTIONS' and exists (
                   select 1 from public.offer_trigger_collections x
                    where x."offerId" = o.id and x."collectionSlug" = p."collectionSlug")),
           'r', (o."rewardScope" = 'PRODUCTS' and exists (
                   select 1 from public.offer_reward_products x
                    where x."offerId" = o.id and x."productSlug" = p.slug))
                or (o."rewardScope" = 'COLLECTIONS' and exists (
                   select 1 from public.offer_reward_collections x
                    where x."offerId" = o.id and x."collectionSlug" = p."collectionSlug"))
         )), '[]'::jsonb)
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as line
    join public."Product" p on p.slug = line.value->>'slug'
    join public.offers o on o.id = offer_id
    left join public.active_product_promotions promo on promo."productSlug" = p.slug
    cross join lateral generate_series(
      1, greatest(1, least(50, coalesce((line.value->>'quantity')::int, 1)))
    ) as unit(n)
   where not p."isArchived";
$$;

-- ── offer_value_of ──────────────────────────────────────────
--
-- What one offer is worth against one set of units: the group arithmetic from
-- this file's header, then the selection rule, then the reward kind.
--
-- **The only implementation of the rule.** Both unit sources above feed it, so
-- the badge on a collection page, the line in the bag and the reduction on the
-- order are one calculation seen at three moments.
--
-- Returns zero rather than null when nothing qualifies, so callers compare
-- amounts rather than handling an absence.

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
  o        public.offers;
  v_t      int;
  v_r      int;
  v_b      int;
  v_groups int;
  v_free   int;
  v_sum    int := 0;
  v_slug   text;
  v_unit   int;
begin
  select * into o from public.offers where id = offer_id;

  if not found then
    return query select 0, null::text, null::int;
    return;
  end if;

  select
    count(*) filter (where (u.value->>'t')::boolean and not (u.value->>'r')::boolean),
    count(*) filter (where (u.value->>'r')::boolean and not (u.value->>'t')::boolean),
    count(*) filter (where (u.value->>'t')::boolean and (u.value->>'r')::boolean)
    into v_t, v_r, v_b
    from jsonb_array_elements(coalesce(units, '[]'::jsonb)) as u;

  -- The closed form from this file's header. All three terms, always: dropping
  -- the last one is what would hand a free bottle to somebody who bought two.
  v_groups := least(
    (v_t + v_b) / o."triggerQuantity",
    (v_r + v_b) / o."rewardQuantity",
    (v_t + v_r + v_b) / (o."triggerQuantity" + o."rewardQuantity")
  );

  if v_groups <= 0 then
    return query select 0, null::text, null::int;
    return;
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
  select
    coalesce(sum(c.price), 0)::int,
    (array_agg(c.slug))[1],
    (array_agg(c.price))[1]
    into v_sum, v_slug, v_unit
    from chosen c;

  if o."rewardKind" = 'PERCENTAGE' then
    -- Rounded down, matching `resolve_discount()` and
    -- `active_product_promotions`: the house never gives away a piastre it did
    -- not mean to.
    v_sum := (v_sum::bigint * o."rewardValue" / 100)::int;
  end if;

  return query select greatest(0, v_sum), v_slug, v_unit;
end;
$$;

-- ── resolve_offer ───────────────────────────────────────────
--
-- Which offer applies, and what it takes off.
--
-- Chosen by the house, never named by the browser — the difference between an
-- offer and a coupon, and the reason nothing in the checkout payload mentions
-- one. Every candidate is weighed and the winner is the highest priority, the
-- larger reduction breaking a tie.
--
-- **One function, two questions.** Given `orderId` it prices the order being
-- written, with the caps read inside that transaction so two orders racing the
-- last permitted use serialise rather than both taking it. Given `items` it
-- prices a bag and binds nothing. The eligibility rules, the caps and the
-- arithmetic are shared by construction; only the unit source differs.
--
-- Takes `{ orderId | items, clerkUserId, email, discountCode, usingCredit }`
-- and answers `{ ok, offerId, label, labelAr, amountInCents, rewardProductSlug,
-- rewardUnitPriceInCents }`, or `{ ok: false }` when none applies.
--
-- **No refusal reason**, deliberately: an offer the customer never asked for and
-- does not qualify for is not a refusal to explain, it is simply an offer that
-- is not running for them.

create or replace function public.resolve_offer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   text := nullif(payload->>'orderId', '');
  v_items   jsonb := case when jsonb_typeof(payload->'items') = 'array'
                          then payload->'items' else '[]'::jsonb end;
  v_owner   text := nullif(payload->>'clerkUserId', '');
  v_email   text := lower(nullif(payload->>'email', ''));
  v_code    text := upper(btrim(coalesce(payload->>'discountCode', '')));
  v_credit  boolean := coalesce((payload->>'usingCredit')::boolean, false);
  v_best    record;
begin
  if v_order is null and jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('ok', false);
  end if;

  select o.id, o.label, o.label_ar, v.*
    into v_best
    from public.offers o
    cross join lateral public.offer_value_of(
      case when v_order is not null
           then public.offer_units_for_order(v_order, o.id)
           else public.offer_units_for_cart(v_items, o.id)
      end,
      o.id
    ) v
   where o."isActive"
     and (o."startsAt" is null or o."startsAt" <= now())
     and (o."endsAt"   is null or o."endsAt"   >  now())

     -- Stacking. Refused unless the campaign says otherwise, which is the
     -- policy: one promotional mechanism per order.
     and (v_code = '' or o."stacksWithCodes")
     and (not v_credit or o."stacksWithCredit")

     -- Gated on a specific code, when the campaign is.
     and (o."requiresCode" is null or o."requiresCode" = v_code)

     -- Audience.
     and (
       o.audience = 'EVERYONE'
       or (o.audience = 'NEW_CUSTOMERS' and not exists (
             select 1 from public."Order" x
              where x.id is distinct from v_order
                and x."paymentStatus" = 'PAID'
                and (
                  (v_owner is not null and nullif(x."clerkUserId", '') = v_owner)
                  or (v_email is not null and lower(x."customerEmail") = v_email)
                )))
       or (o.audience = 'EXISTING_CUSTOMERS' and exists (
             select 1 from public."Order" x
              where x.id is distinct from v_order
                and x."paymentStatus" = 'PAID'
                and (
                  (v_owner is not null and nullif(x."clerkUserId", '') = v_owner)
                  or (v_email is not null and lower(x."customerEmail") = v_email)
                )))
       or (o.audience = 'SUBSCRIBERS' and v_email is not null and exists (
             -- `lower(email)` because that is what `newsletter_email_idx` is on:
             -- the column stores the address as typed.
             select 1 from public."NewsletterSubscriber" n
              where lower(n.email) = v_email and n.status = 'SUBSCRIBED'))
       or (o.audience = 'INVITED' and v_email is not null and exists (
             select 1 from public.offer_grants g
              where g."offerId" = o.id
                and g.email = v_email
                and (g."expiresAt" is null or g."expiresAt" > now())))
     )

     -- Caps. Counted from live redemptions only, so a refunded order returns
     -- its use to both.
     and (o."totalUseLimit" is null or (
           select count(*) from public.offer_redemptions r
            where r."offerId" = o.id and r."releasedAt" is null
         ) < o."totalUseLimit")
     and (o."perCustomerLimit" is null or (
           select count(*) from public.offer_redemptions r
            where r."offerId" = o.id
              and r."releasedAt" is null
              and (
                (v_owner is not null and r."clerkUserId" = v_owner)
                or (v_email is not null and r.email = v_email)
              )
         ) < o."perCustomerLimit")

     -- An offer worth nothing against this bag is not an offer that applies.
     and v."amountInCents" > 0

   order by o.priority desc, v."amountInCents" desc, o."createdAt"
   limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'offerId', v_best.id,
    'label', v_best.label,
    'labelAr', v_best.label_ar,
    'amountInCents', v_best."amountInCents",
    'rewardProductSlug', v_best."rewardProductSlug",
    'rewardUnitPriceInCents', v_best."rewardUnitPriceInCents"
  );
end;
$$;

-- ── reverse_offer_redemption ────────────────────────────────
--
-- A refunded order returns its use to both caps. `releasedAt` rather than a
-- delete, and idempotent through the `is null` predicate: a second refund
-- updates nothing.

create or replace function public.reverse_offer_redemption(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released int;
begin
  update public.offer_redemptions
     set "releasedAt" = now()
   where "orderId" = order_id
     and "releasedAt" is null;

  get diagnostics v_released = row_count;

  return v_released;
end;
$$;

-- ── Row Level Security ──────────────────────────────────────
--
-- Public reading of what is **live**, and only that — the storefront prints an
-- offer's label on a collection page, and a badge built from a constant instead
-- would be a second definition of the campaign.
--
-- The predicates are the access control, not a copy of a service query's `where`
-- clause: a query that forgets the window must still not be able to publish next
-- month's campaign. `promotions` is governed exactly this way.

alter table public.offers                    enable row level security;
alter table public.offer_trigger_products    enable row level security;
alter table public.offer_trigger_collections enable row level security;
alter table public.offer_reward_products     enable row level security;
alter table public.offer_reward_collections  enable row level security;
alter table public.offer_grants              enable row level security;
alter table public.offer_redemptions         enable row level security;

drop policy if exists "Live offers are readable" on public.offers;
create policy "Live offers are readable"
  on public.offers for select
  to anon, authenticated
  using (
    "isActive"
    and ("startsAt" is null or "startsAt" <= now())
    and ("endsAt"   is null or "endsAt"   >  now())
  );

-- A target is visible exactly when its offer is. Without the subquery the
-- membership of an unstarted campaign would still be listable, which is the
-- interesting half of it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'offer_trigger_products', 'offer_trigger_collections',
    'offer_reward_products',  'offer_reward_collections'
  ] loop
    execute format('drop policy if exists "Targets of live offers" on public.%I', t);
    execute format($p$
      create policy "Targets of live offers"
        on public.%I for select
        to anon, authenticated
        using (exists (
          select 1 from public.offers o
           where o.id = public.%I."offerId"
             and o."isActive"
             and (o."startsAt" is null or o."startsAt" <= now())
             and (o."endsAt"   is null or o."endsAt"   >  now())))
    $p$, t, t);
  end loop;
end $$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Grants written out although `0006_privileges.sql` already leaves defaults that
-- would provide them: a grant that exists only by side effect is a grant nobody
-- reviewing this file can see. The two tables that name people are taken back
-- explicitly.

grant select on public.offers                    to anon, authenticated;
grant select on public.offer_trigger_products    to anon, authenticated;
grant select on public.offer_trigger_collections to anon, authenticated;
grant select on public.offer_reward_products     to anon, authenticated;
grant select on public.offer_reward_collections  to anon, authenticated;

revoke all on public.offer_grants      from public, anon, authenticated;
revoke all on public.offer_redemptions from public, anon, authenticated;

revoke all on function public.offer_units_for_order(text, text) from public, anon, authenticated;
revoke all on function public.offer_units_for_cart(jsonb, text) from public, anon, authenticated;
revoke all on function public.offer_value_of(jsonb, text)       from public, anon, authenticated;
revoke all on function public.resolve_offer(jsonb)             from public, anon, authenticated;
revoke all on function public.reverse_offer_redemption(text)   from public, anon, authenticated;
