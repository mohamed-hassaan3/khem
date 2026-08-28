-- KHEM — the three marketing surfaces: announcements, house marketing settings,
-- and promotional pricing.
--
-- Applied by `npm run db:migrate` after `0034_campaign_dispatch.sql`. It reads
-- `"Product"` and `"Collection"` from 0001, `discounts`/`discount_grants` from
-- 0028, `"NewsletterSubscriber"` from 0025, and re-declares `place_order()` from
-- 0028 together with the three subtotal helpers 0028/0029 left behind.
--
-- ── Three systems, deliberately not one ─────────────────────
--
-- The specification is blunt about this and the schema says it back:
--
--   `"Announcement"`     — sentences the house prints at the top of the site.
--   `"MarketingSetting"` — how those rotate, and how the offer popup behaves.
--   `promotions`         — a **price**, for a campaign like Black Friday.
--
-- None of them is a discount *code*. `discounts` (0028) stays exactly as it was:
-- a string somebody types, gated by grants, counted in a ledger. A promotion is
-- not typed, not granted, not counted — it is what a bottle costs this week.
-- Collapsing the two would mean the welcome offer and Black Friday share a
-- redemption ledger, and neither figure would mean anything afterwards.
--
-- ── The pricing rule, in one place ──────────────────────────
--
-- 1. **One promotion per product.** `active_product_promotions` picks it:
--    product-targeted beats collection-targeted, then higher `priority`, then
--    the larger reduction, then the newest row. Promotions never stack with
--    each other — there is no arrangement of overlapping campaigns that
--    compounds, because the view returns one row per slug by construction.
--
-- 2. **A code applies on top only when the promotion says so.** A line under a
--    promotion is excluded from a code's eligible subtotal unless that
--    promotion carries `stacksWithCodes`. The default is false, which is the
--    safe direction: the house opts *into* compounding rather than discovering
--    it on an invoice.
--
-- 3. **A Discovery Credit still cannot be combined with a code** (0028's rule,
--    untouched) and applies to whatever remains.
--
-- 4. **Delivery is never reduced** (0028's rule, untouched).
--
-- The rule lives here because this is the only place it can be enforced.
-- `place_order()` prices each line from the view inside the transaction that
-- writes the order, so what the storefront displays is a *quotation of* the
-- charge rather than an input to it.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Announcements, marketing settings and promotions are **public marketing** —
-- they are printed on the storefront — so unlike `discounts` they carry read
-- policies for `anon`. Those policies are narrow rather than `using (true)`:
-- only rows that are active *and inside their window* are readable, so a
-- campaign scheduled for next month is not visible to anyone holding the
-- publishable key. Every write is service-role, behind `requireAdmin()`.

-- ── Enums ───────────────────────────────────────────────────

/*
 * A fourth evidence of consent, beside `HOME_FORM`, `SIGN_UP` and `ADMIN`
 * (0025). Somebody who typed their address into the offer popup did something
 * different from somebody who filled in the footer form — they were interrupted
 * and said yes anyway — and the desk should be able to tell those apart when it
 * looks at the list.
 *
 * `add value if not exists` is transactional from Postgres 12 onward provided
 * the new value is not *used* in the same transaction, which nothing in this
 * file does: the first row carrying it is written by a Server Action long after
 * the migration has committed.
 */
alter type public."NewsletterSource" add value if not exists 'POPUP';

do $$ begin
  create type public."AnnouncementMode" as enum ('STATIC', 'MARQUEE', 'CAROUSEL');
exception when duplicate_object then null; end $$;

-- `promotions` reuses `"DiscountKind"` from 0028 rather than declaring a second
-- two-member enum saying the same thing. A percentage is a percentage.
--
-- The scope is its own type: a promotion must name products or collections, so
-- there is no `ALL` member — a house-wide sale is a collection selection, and
-- "everything, forever" is a price change rather than a campaign.
do $$ begin
  create type public."PromotionScope" as enum ('PRODUCTS', 'COLLECTIONS');
exception when duplicate_object then null; end $$;

-- ── Announcement ────────────────────────────────────────────
--
-- One sentence, in both languages, with an optional destination.
--
-- `sortOrder` is also the priority. The specification lists "display order" and
-- "optional priority" as separate fields; they are one question — which comes
-- first — and two columns answering it would disagree the first week somebody
-- edited only one of them.

create table if not exists public."Announcement" (
  id           text primary key default gen_random_uuid()::text,

  message      text not null check (char_length(btrim(message)) between 1 and 160),
  -- Nullable, like every `_ar` column in the content tables: `resolveText()`
  -- falls back to English rather than printing an empty bar.
  message_ar   text check (char_length(message_ar) <= 160),

  -- An app path (`/collections/noir`), never an absolute URL. The check is the
  -- boundary: an announcement is written at a desk and rendered into an anchor,
  -- and a stored `javascript:` or an off-site host would be a stored redirect.
  href         text check (href is null or href ~ '^/[A-Za-z0-9/_-]*$'),

  "ctaLabel"    text check (char_length("ctaLabel") <= 40),
  "ctaLabel_ar" text check (char_length("ctaLabel_ar") <= 40),

  "isActive"   boolean not null default true,
  "sortOrder"  int not null default 0,

  -- Both nullable; an always-on announcement is legitimate. The window is
  -- enforced by the read policy and the service query, so a lapsed row stops
  -- printing without anybody switching it off.
  "startsAt"   timestamptz,
  "endsAt"     timestamptz,
  constraint announcement_window check (
    "startsAt" is null or "endsAt" is null or "endsAt" > "startsAt"
  ),

  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists announcement_live_idx
  on public."Announcement" ("isActive", "sortOrder", "createdAt");

-- ── MarketingSetting ────────────────────────────────────────
--
-- One row, like `"BoutiqueSetting"`. Deliberately *not* that row: those are the
-- three addresses the house publishes and the fragrance it features, read on
-- every contact page and in every email signature. This is campaign chrome, it
-- changes on a different rhythm, and folding it in would mean the contact page
-- re-renders because somebody edited a popup delay.
--
-- The popup's **percentage is not stored here**. It is whatever the live
-- welcome offer is worth (`discounts."isWelcome"`, 0030), read at render time —
-- so the number in the popup and the number the checkout honours cannot differ.

create table if not exists public."MarketingSetting" (
  id text primary key default 'default' check (id = 'default'),

  -- ── The announcement bar ──
  "announcementsEnabled"   boolean not null default true,
  "announcementMode"       public."AnnouncementMode" not null default 'CAROUSEL',
  -- Milliseconds between carousel steps. Bounded rather than free: under a
  -- second is unreadable and over fifteen is a static bar with extra machinery.
  "announcementIntervalMs" int not null default 5000
    check ("announcementIntervalMs" between 1500 and 15000),

  -- ── The offer popup ──
  "offerPopupEnabled"      boolean not null default true,
  -- How long a visitor browses before it appears. The specification asks for
  -- 10–30 seconds; the bound is wider so the desk can be gentler, never
  -- instant.
  "offerPopupDelayMs"      int not null default 18000
    check ("offerPopupDelayMs" between 3000 and 120000),
  -- Or how far down a page they have read, whichever comes first. 0 disables
  -- the engagement trigger and leaves the timer alone.
  "offerPopupScrollPercent" int not null default 25
    check ("offerPopupScrollPercent" between 0 and 100),
  -- How long a dismissal is honoured for.
  "offerPopupSnoozeDays"   int not null default 30
    check ("offerPopupSnoozeDays" between 1 and 365),

  "offerPopupEyebrow"      text check (char_length("offerPopupEyebrow") <= 60),
  "offerPopupEyebrow_ar"   text check (char_length("offerPopupEyebrow_ar") <= 60),
  "offerPopupHeading"      text not null default 'Enter the World of KHEM'
    check (char_length(btrim("offerPopupHeading")) between 1 and 90),
  "offerPopupHeading_ar"   text check (char_length("offerPopupHeading_ar") <= 90),
  "offerPopupBody"         text check (char_length("offerPopupBody") <= 300),
  "offerPopupBody_ar"      text check (char_length("offerPopupBody_ar") <= 300),

  "offerPopupImageUrl"     text not null
    default 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900&h=1200&fit=crop&auto=format',
  "offerPopupImageAlt"     text not null default 'A KHEM flacon in low gold light'
    check (char_length(btrim("offerPopupImageAlt")) between 1 and 160),
  "offerPopupImageAlt_ar"  text check (char_length("offerPopupImageAlt_ar") <= 160),

  "updatedAt"              timestamptz not null default now()
);

-- The row must exist for the storefront to read anything; the defaults above
-- are a working configuration, so this is a complete setup and not a stub.
insert into public."MarketingSetting" (id) values ('default')
on conflict (id) do nothing;

-- ── promotions ──────────────────────────────────────────────

create table if not exists public.promotions (
  id            text primary key default gen_random_uuid()::text,

  -- What the desk calls it. Never printed to a customer — `label` is.
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  description   text check (char_length(description) <= 300),

  -- The customer-facing campaign line: "BLACK FRIDAY", "RAMADAN OFFER". Null
  -- for a quiet price reduction that should carry no banner at all.
  label         text check (char_length(label) <= 40),
  label_ar      text check (char_length(label_ar) <= 40),

  kind          public."DiscountKind" not null,
  value         int not null check (value > 0),
  constraint promotion_percentage_range check (
    kind <> 'PERCENTAGE' or value between 1 and 100
  ),

  "appliesTo"   public."PromotionScope" not null,

  "isActive"    boolean not null default true,
  "startsAt"    timestamptz,
  "endsAt"      timestamptz,
  constraint promotion_window check (
    "startsAt" is null or "endsAt" is null or "endsAt" > "startsAt"
  ),

  /*
   * Whether a discount code may also come off a line this promotion has already
   * reduced.
   *
   * False by default, and that default is the whole of "do not accidentally
   * stack": with it off, `discount_eligible_*_subtotal()` treats a promoted line
   * as ineligible, so a 20%-off code on a Black Friday bag reduces only the
   * bottles Black Friday did not touch. Turning it on is a deliberate act with a
   * visible switch in the dashboard.
   */
  "stacksWithCodes" boolean not null default false,

  -- Tie-break between two promotions that both name the same product. Higher
  -- wins; the reduction breaks a tie after that.
  priority      int not null default 0,

  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

create index if not exists promotion_live_idx
  on public.promotions ("isActive", "startsAt", "endsAt");

-- Two junctions rather than array columns, for 0028's reason: a target is a
-- foreign key that cannot name a product which does not exist.

create table if not exists public.promotion_products (
  "promotionId" text not null
    references public.promotions(id) on delete cascade,
  "productSlug" text not null
    references public."Product"(slug) on update cascade on delete cascade,
  primary key ("promotionId", "productSlug")
);

create table if not exists public.promotion_collections (
  "promotionId"    text not null
    references public.promotions(id) on delete cascade,
  "collectionSlug" text not null
    references public."Collection"(slug) on update cascade on delete cascade,
  primary key ("promotionId", "collectionSlug")
);

create index if not exists promotion_product_slug_idx
  on public.promotion_products ("productSlug");
create index if not exists promotion_collection_slug_idx
  on public.promotion_collections ("collectionSlug");

-- ── active_product_promotions ───────────────────────────────
--
-- **The** answer to "what does this product cost today", and the only one.
--
-- One row per promoted slug. `distinct on` with the ordering below is what makes
-- "promotions never stack" a structural fact rather than a rule somebody has to
-- remember at four call sites: there is no second row to add.
--
-- `security_invoker = true` so the row policies below actually apply. Without
-- it the view would run as its owner and happily publish a campaign that has not
-- started — which is exactly the leak the policies exist to prevent. The
-- `security definer` functions further down read it as `postgres` and see
-- everything, which is correct: they are pricing an order, not answering a
-- browser.
--
-- Rounding is *down* on a percentage, matching `resolve_discount()`: the house
-- never gives away a piastre it did not mean to. A fixed amount is clamped so a
-- price can never go negative.

create or replace view public.active_product_promotions
with (security_invoker = true) as
select distinct on (p.slug)
  p.slug                as "productSlug",
  pr.id                 as "promotionId",
  pr.name               as "promotionName",
  pr.label,
  pr.label_ar,
  pr.kind,
  pr.value,
  pr."stacksWithCodes",
  pr."endsAt",
  p."priceInCents"      as "listPriceInCents",
  greatest(
    p."priceInCents" - case
      when pr.kind = 'PERCENTAGE' then (p."priceInCents" * pr.value) / 100
      else least(pr.value, p."priceInCents")
    end,
    0
  )::int                as "priceInCents"
from public."Product" p
join public.promotions pr
  on pr."isActive"
 and (pr."startsAt" is null or pr."startsAt" <= now())
 and (pr."endsAt"   is null or pr."endsAt"   >  now())
 -- A promotion that takes nothing off is not a promotion; it must not put a
 -- struck-through price on a card for no reduction.
 and (case
        when pr.kind = 'PERCENTAGE' then (p."priceInCents" * pr.value) / 100
        else least(pr.value, p."priceInCents")
      end) > 0
 and (
   (pr."appliesTo" = 'PRODUCTS' and exists (
      select 1 from public.promotion_products pp
       where pp."promotionId" = pr.id and pp."productSlug" = p.slug))
   or
   (pr."appliesTo" = 'COLLECTIONS' and exists (
      select 1 from public.promotion_collections pc
       where pc."promotionId" = pr.id and pc."collectionSlug" = p."collectionSlug"))
 )
where not p."isArchived" and p."deletedAt" is null
order by
  p.slug,
  -- Specific beats general: a price set on this bottle outranks one set on the
  -- shelf it stands on.
  (pr."appliesTo" = 'PRODUCTS') desc,
  pr.priority desc,
  (case
     when pr.kind = 'PERCENTAGE' then (p."priceInCents" * pr.value) / 100
     else least(pr.value, p."priceInCents")
   end) desc,
  pr."createdAt" desc,
  pr.id;

-- ── OrderItem: what was charged, and what it would have been ─
--
-- `priceInCents` keeps its meaning — the unit price actually charged — so every
-- existing sum over `"OrderItem"` stays correct. The two new columns are the
-- audit trail §25 asks for: an order printed a year later can still say the
-- bottle listed at 1,800 and sold at 1,440 under Black Friday, even if that
-- campaign has since been deleted.
--
-- `listPriceInCents` is null on every historical row, which reads correctly as
-- "nothing was reduced".

alter table public."OrderItem"
  add column if not exists "listPriceInCents" int
    check ("listPriceInCents" is null or "listPriceInCents" >= 0),
  add column if not exists "promotionId" text
    references public.promotions(id) on delete set null;

-- ── discount_cart_subtotal ──────────────────────────────────
--
-- The 0029 body, priced from the promotion view.
--
-- What a bag is worth *as it will be charged*. A minimum-order rule judged on
-- list prices would honour a code on a bag that never reaches the threshold at
-- the till, which is the wrong direction to be wrong in.

create or replace function public.discount_cart_subtotal(items jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
           greatest(coalesce((item->>'quantity')::int, 0), 0)
             * coalesce(promo."priceInCents", p."priceInCents")
         ), 0)::int
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
    join public."Product" p on p.slug = item->>'slug'
    left join public.active_product_promotions promo on promo."productSlug" = p.slug
   where not p."isArchived";
$$;

-- ── discount_eligible_cart_subtotal ─────────────────────────
--
-- The 0029 body plus the stacking rule.
--
-- Two changes, both of them the pricing rule in this file's header:
--   1. lines are worth their promotional price;
--   2. a line under a promotion that does not carry `stacksWithCodes` is not
--      eligible at all — the campaign has already reduced it.
--
-- The second is why a 20%-off code on a Black Friday bag can come off nothing
-- and be refused with "does not apply to anything in your bag". That refusal is
-- correct and is the point.

create or replace function public.discount_eligible_cart_subtotal(
  items       jsonb,
  discount_id text
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
           greatest(coalesce((item->>'quantity')::int, 0), 0)
             * coalesce(promo."priceInCents", p."priceInCents")
         ), 0)::int
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
    join public."Product" p on p.slug = item->>'slug'
    join public.discounts d on d.id = discount_id
    left join public.active_product_promotions promo on promo."productSlug" = p.slug
   where not p."isArchived"
     and (promo."promotionId" is null or promo."stacksWithCodes")
     and (
       d."appliesTo" = 'ALL'
       or (
         d."appliesTo" = 'PRODUCTS'
         and exists (
           select 1 from public.discount_products dp
            where dp."discountId" = d.id and dp."productSlug" = p.slug
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

-- ── discount_eligible_subtotal ──────────────────────────────
--
-- The order-side twin, with the same stacking rule.
--
-- Prices still come from the line's own snapshot (`"OrderItem"."priceInCents"`),
-- which `place_order()` has already written as the promotional price — so there
-- is nothing to re-derive here and no way for the two to disagree. What is new
-- is the exclusion, and it reads the promotion *the order recorded*, not the one
-- running now: a campaign that ended between the order and a later read must not
-- change what that order's code was allowed to touch.

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
       i."promotionId" is null
       or exists (
         select 1 from public.promotions pr
          where pr.id = i."promotionId" and pr."stacksWithCodes"
       )
     )
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

-- ── place_order ─────────────────────────────────────────────
--
-- The 0028 body with one change: the unit price of a line is read from
-- `active_product_promotions` rather than from `"Product"."priceInCents"`.
--
-- This is the sentence in the specification that everything else in this file
-- serves — "the frontend must never be the source of truth for calculating
-- final prices". The browser sends slugs and quantities. What each of those
-- costs is decided here, from rows this transaction has locked, a few
-- statements before the money is written.
--
-- The promotion is looked up **after** the `for update` on the product, so a
-- price edit and a campaign edit racing this order serialise behind the same
-- lock rather than half-landing.

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
  v_code       text := upper(btrim(coalesce(payload->>'discountCode', '')));
  v_discount   jsonb;
  v_disc_id    text;
  v_disc_code  text;
  v_disc_amt   int := 0;
  v_email      text := lower(nullif(payload->>'customerEmail', ''));
  -- Promotional pricing, added by 0035.
  v_promo      record;
  v_unit       int;
  v_promo_id   text;
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

    -- ── The price ─────────────────────────────────────────
    --
    -- One row or none. The `found` check below is load-bearing: `select into`
    -- leaves the previous iteration's row in `v_promo` when it matches nothing,
    -- so reading `v_promo` unconditionally would price a second bottle at the
    -- first one's campaign. `v_promo_id` is cleared for the same reason.
    v_promo_id := null;

    select *
      into v_promo
      from public.active_product_promotions
     where "productSlug" = v_product.slug;

    if found then
      v_unit     := v_promo."priceInCents";
      v_promo_id := v_promo."promotionId";
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

    update public."Product"
       set inventory = inventory - v_qty,
           "updatedAt" = now()
     where slug = v_product.slug;

    v_subtotal := v_subtotal + (v_qty * v_unit);
  end loop;

  -- ── Discount ──────────────────────────────────────────────
  --
  -- Unchanged from 0028 except in what it now sees: the subtotal it judges the
  -- minimum against is the promoted one, and `discount_eligible_subtotal()`
  -- excludes lines a non-stacking campaign has already reduced.

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
        using errcode = 'check_violation';
    end if;

    v_disc_id   := v_discount->>'discountId';
    v_disc_code := v_discount->>'code';
    v_disc_amt  := (v_discount->>'amountInCents')::int;

    insert into public.discount_redemptions
      ("discountId", "orderId", email, "clerkUserId", "amountInCents")
    values (v_disc_id, v_order_id, v_email, v_owner, v_disc_amt);

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

    if v_disc_id is not null then
      raise exception 'A Discovery Credit cannot be combined with a promotional discount.'
        using errcode = 'check_violation';
    end if;

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

-- ── claim_subscriber_offer ──────────────────────────────────
--
-- The welcome offer, issued to an address that subscribed rather than to one
-- that registered.
--
-- `claim_welcome()` (0030) already does this for a Clerk account. The popup
-- reaches people who have not made one — the specification's "subscribe and earn
-- XX% off" — and this is the parallel door, deliberately written to the **same**
-- `discount_grants` table with the same sixty-day window. There is no second
-- discount system: the code a subscriber receives is the same row a new account
-- receives, gated by the same grant, redeemed through the same
-- `resolve_discount()`.
--
-- Idempotent by the unique index on `("discountId", email)`. A second submission
-- of the same address issues nothing and returns the grant that already exists,
-- which is what "prevent the same user from repeatedly receiving the offer"
-- means when the person may genuinely have lost the email.
--
-- Returns `{ code, expiresAt, issued }`. `code` is null when the house is
-- running no welcome offer, or when the address already spent its grant — a
-- privilege already used is not one to advertise again.

create or replace function public.claim_subscriber_offer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(btrim(nullif(payload->>'email', '')));
  v_clerk    text := nullif(payload->>'clerkUserId', '');
  v_discount record;
  v_expires  timestamptz;
  v_issued   boolean := false;
  v_code     text;
begin
  if v_email is null then
    return jsonb_build_object('code', null, 'expiresAt', null, 'issued', false);
  end if;

  -- Judged exactly as `resolve_discount()` judges any code. A campaign that
  -- would be refused at checkout must not be promised in a popup.
  select * into v_discount
    from public.discounts
   where "isWelcome"
     and "isActive"
     and ("startsAt" is null or "startsAt" <= now())
     and ("endsAt" is null or "endsAt" > now());

  if not found then
    return jsonb_build_object('code', null, 'expiresAt', null, 'issued', false);
  end if;

  v_expires := least(
    now() + interval '60 days',
    coalesce(v_discount."endsAt", now() + interval '60 days')
  );

  insert into public.discount_grants
    ("discountId", email, "clerkUserId", "expiresAt")
  values (v_discount.id, v_email, v_clerk, v_expires)
  on conflict ("discountId", email) do nothing;

  v_issued := found;

  select g."expiresAt" into v_expires
    from public.discount_grants g
   where g."discountId" = v_discount.id
     and g.email = v_email
     and g."usedAt" is null;

  if found then
    v_code := v_discount.code;
  else
    v_expires := null;
  end if;

  return jsonb_build_object(
    'code', v_code,
    'expiresAt', v_expires,
    'issued', v_issued
  );
end;
$$;

-- ── welcome_offer() ─────────────────────────────────────────
--
-- What the offer popup is allowed to promise: two columns of one row.
--
-- ## Why a function, and not a view
--
-- This was a view for about an hour, and it was wrong twice over.
--
-- A view over `discounts` has to run with **definer** rights to see anything —
-- `discounts` has RLS with no policy — and Supabase's own advisor flags exactly
-- that shape (`security_definer_view`): a view that quietly runs as its owner is
-- a permission boundary nobody reading the view definition can see. The advisor
-- is right, and a security-definer *function* is the answer it points at: the
-- elevated rights are declared on the object, `search_path` is pinned, and the
-- projection is the function body rather than whatever a later `select *` picks
-- up.
--
-- ## Why it is granted to anon at all
--
-- Every other function in this schema revokes `execute` from the public roles,
-- and the exception is deliberate. This one **reads two numbers the site prints
-- to every visitor** — the percentage in the popup — and it is read by the
-- prerendered root layout, on every page. The alternative was
-- `getSupabaseAdmin()` in that layout, which put a secret-key client and the
-- Realtime socket `createClient()` opens with it into the render path of all 196
-- static pages. Trading a secret key for two public integers is not a trade.
--
-- ## What it deliberately does not return
--
-- The **code**. Not the grants, not the caps, not the redemption ledger, not the
-- id. A visitor may know the house offers 10% to new subscribers — that is the
-- offer — and may not know the string that redeems it until they have
-- subscribed and `claim_subscriber_offer()` has written a grant in their name.
-- That distinction is the whole reason `discounts."requiresGrant"` exists
-- (0028); returning the code here would undo it.
--
-- The window is judged exactly as `resolve_discount()` judges it, so the popup
-- cannot advertise a campaign the checkout would refuse.

drop view if exists public.welcome_offer;

create or replace function public.welcome_offer()
returns table (kind public."DiscountKind", value int)
language sql
stable
security definer
set search_path = public
as $$
  select d.kind, d.value
    from public.discounts d
   where d."isWelcome"
     and d."isActive"
     and (d."startsAt" is null or d."startsAt" <= now())
     and (d."endsAt"   is null or d."endsAt"   >  now());
$$;

-- ── Row Level Security ──────────────────────────────────────
--
-- Public *reading*, and only of what is live. Every write is service-role, which
-- bypasses RLS — which is why no insert/update/delete policy exists here and
-- none should be added.
--
-- The predicates are the access control, not a second copy of a service query's
-- `where` clause: a query that forgets the window must still not be able to
-- publish next month's campaign.

alter table public."Announcement"       enable row level security;
alter table public."MarketingSetting"   enable row level security;
alter table public.promotions           enable row level security;
alter table public.promotion_products   enable row level security;
alter table public.promotion_collections enable row level security;

drop policy if exists "Live announcements are readable" on public."Announcement";
create policy "Live announcements are readable"
  on public."Announcement" for select
  to anon, authenticated
  using (
    "isActive"
    and ("startsAt" is null or "startsAt" <= now())
    and ("endsAt"   is null or "endsAt"   >  now())
  );

-- The whole row is chrome the storefront prints. Nothing on it names a person.
drop policy if exists "Marketing settings are readable" on public."MarketingSetting";
create policy "Marketing settings are readable"
  on public."MarketingSetting" for select
  to anon, authenticated
  using (true);

drop policy if exists "Live promotions are readable" on public.promotions;
create policy "Live promotions are readable"
  on public.promotions for select
  to anon, authenticated
  using (
    "isActive"
    and ("startsAt" is null or "startsAt" <= now())
    and ("endsAt"   is null or "endsAt"   >  now())
  );

-- A target is visible exactly when its promotion is. Without the subquery, the
-- membership of an unstarted campaign would still be listable — which is the
-- interesting half of it.
drop policy if exists "Targets of live promotions" on public.promotion_products;
create policy "Targets of live promotions"
  on public.promotion_products for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.promotions pr
       where pr.id = public.promotion_products."promotionId"
         and pr."isActive"
         and (pr."startsAt" is null or pr."startsAt" <= now())
         and (pr."endsAt"   is null or pr."endsAt"   >  now())
    )
  );

drop policy if exists "Collection targets of live promotions"
  on public.promotion_collections;
create policy "Collection targets of live promotions"
  on public.promotion_collections for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.promotions pr
       where pr.id = public.promotion_collections."promotionId"
         and pr."isActive"
         and (pr."startsAt" is null or pr."startsAt" <= now())
         and (pr."endsAt"   is null or pr."endsAt"   >  now())
    )
  );

-- ── Privileges ──────────────────────────────────────────────
--
-- `0006_privileges.sql` runs earlier in filename order and leaves default
-- privileges that already grant `select` on anything created afterwards. These
-- are written out anyway: a grant that exists by side effect is a grant nobody
-- reviewing this file can see.

grant select on public."Announcement"        to anon, authenticated;
grant select on public."MarketingSetting"    to anon, authenticated;
grant select on public.promotions            to anon, authenticated;
grant select on public.promotion_products    to anon, authenticated;
grant select on public.promotion_collections to anon, authenticated;
grant select on public.active_product_promotions to anon, authenticated;

-- The one function in this schema the public roles may call. See its header:
-- it returns two integers the storefront prints, and nothing else.
revoke all on function public.welcome_offer() from public;
grant execute on function public.welcome_offer() to anon, authenticated;

-- The functions stay unreachable without `SUPABASE_SECRET_KEY`, exactly as
-- 0028/0029 left them. `claim_subscriber_offer()` writes an entitlement and is
-- called by a rate-limited Server Action holding that key.
revoke all on function public.discount_cart_subtotal(jsonb)
  from public, anon, authenticated;
revoke all on function public.discount_eligible_cart_subtotal(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.discount_eligible_subtotal(text, text)
  from public, anon, authenticated;
revoke all on function public.place_order(jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_subscriber_offer(jsonb)
  from public, anon, authenticated;

-- ── Tell PostgREST the schema moved ─────────────────────────
--
-- Without this, the first request for a relation or function this file
-- introduced arrives before PostgREST knows it exists, and that request **blocks**
-- while the schema cache reloads rather than failing fast. On a schema this size
-- that stall is tens of seconds — long enough that the storefront's root layout,
-- which reads three of these on every render, sat behind it and served the
-- loading screen indefinitely.
--
-- `notify` is transactional: it fires when this migration commits, and is a
-- no-op on a database where PostgREST is not listening (a plain Postgres used
-- for tests).
notify pgrst, 'reload schema';
