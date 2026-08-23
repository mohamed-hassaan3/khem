-- KHEM — catalog schema: collections, products, product images.
--
-- Applied by `npm run db:migrate`, which runs every `supabase/sql/NNNN_*.sql`
-- in filename order inside one transaction. Every statement here is idempotent,
-- so a second run is a no-op rather than an error.
--
-- ── Two deliberate deviations from AGENTS.md §9 ──────────────
--
-- 1. Primary keys are `text` holding the slug-shaped ids the app already uses
--    ("signature", "onyx-night"), not `uuid`. The cart persists *product ids*
--    in `localStorage` (`src/providers/cart-provider.tsx`), so
--    generated uuids would silently empty every returning visitor's bag on
--    deploy day. The ids are already stable, unique, and opaque to the app.
--
-- 2. A product points at its collection by `"collectionSlug"`, a foreign key
--    onto `"Collection"(slug)` rather than onto its primary key. That is the
--    field name `src/types/catalog.ts` exposes and the column every query in
--    `src/services/products.ts` filters on; `slug` is unique, so the constraint
--    is exactly as strong as one onto `id`.
--
-- Column names are quoted camelCase throughout, matching the TypeScript types
-- and `0004_search.sql`, which alters `"Product"."topNotes"` by that name.

-- ── Enums ───────────────────────────────────────────────────
--
-- Mirrors of the closed unions in `src/types/catalog.ts`. `do $$ … $$` rather
-- than `create type if not exists`, which Postgres does not have.

do $$ begin
  create type public."Concentration" as enum (
    'PARFUM', 'EXTRAIT_DE_PARFUM', 'EAU_DE_PARFUM', 'ATTAR_OIL'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."CollectionKind" as enum (
    'FRAGRANCE', 'BODY', 'HOME', 'DISCOVERY', 'GIFT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."ProductTag" as enum ('NEW_ARRIVAL', 'LIMITED_EDITION');
exception when duplicate_object then null; end $$;

-- ── Collection ──────────────────────────────────────────────

create table if not exists public."Collection" (
  id           text primary key,
  name         text not null,
  slug         text not null unique,
  description  text not null,
  "bannerUrl"  text not null,
  "bannerAlt"  text not null,
  "isFeatured" boolean not null default false,
  kind         public."CollectionKind" not null,

  -- Display order. Carried explicitly rather than ordering by `name`, because
  -- the seed arrays are curated: Signature reads before Noir on the home page
  -- for editorial reasons, not alphabetical ones.
  "sortOrder"  int not null default 0,

  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists collection_kind_idx
  on public."Collection" (kind, "sortOrder");

-- ── Product ─────────────────────────────────────────────────

create table if not exists public."Product" (
  id               text primary key,
  name             text not null,
  slug             text not null unique,
  subtitle         text,
  description      text not null,

  -- Editorial background story; null for goods that have no detail page.
  story            text,

  -- Null for anything that is not a fragrance — a room spray has no eau de
  -- parfum strength. Those rows carry `format` instead, and every display site
  -- prints one or the other. The check keeps that invariant in the database
  -- rather than only in the seed data.
  concentration    public."Concentration",
  format           text,
  constraint product_strength_or_format
    check (concentration is not null or format is not null),

  -- What a set contains, one line per item. Free text rather than a join: a
  -- discovery vial is not a sellable SKU, so there is nothing to point at.
  includes         text[] not null default '{}',

  -- Free editorial badge ("Most Popular"), distinct from the machine-readable
  -- `tags` the facet chips filter on.
  badge            text,
  tags             public."ProductTag"[] not null default '{}',

  -- Three notes per tier for a fragrance, empty for body/home/discovery goods.
  -- Ordering is load-bearing: the card grids render `topNotes[1]`.
  "topNotes"       text[] not null default '{}',
  "heartNotes"     text[] not null default '{}',
  "baseNotes"      text[] not null default '{}',

  "volumeMl"       int not null check ("volumeMl" > 0),

  -- Smallest unit of the base currency — Egyptian piastres (147000 = EGP
  -- 1,470.00). "Cents" means "minor units"; see `src/lib/currency.ts`.
  "priceInCents"   int not null check ("priceInCents" >= 0),

  sku              text not null unique,
  inventory        int not null default 0 check (inventory >= 0),
  "isBestseller"   boolean not null default false,

  "collectionSlug" text not null
    references public."Collection"(slug) on update cascade,

  "sortOrder"      int not null default 0,

  -- Server-managed columns the TypeScript type omits because nothing in the UI
  -- reads them. Every read policy and every query filters on the first two.
  "isArchived"     boolean not null default false,
  "deletedAt"      timestamptz,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);

create index if not exists product_collection_idx
  on public."Product" ("collectionSlug", "sortOrder");

create index if not exists product_bestseller_idx
  on public."Product" ("isBestseller")
  where "isArchived" = false and "deletedAt" is null;

create index if not exists product_tags_idx
  on public."Product" using gin (tags);

-- ── ProductImage ────────────────────────────────────────────

create table if not exists public."ProductImage" (
  id            text primary key,
  "productSlug" text not null
    references public."Product"(slug) on delete cascade on update cascade,
  url           text not null,
  alt           text not null,
  "isPrimary"   boolean not null default false,
  "sortOrder"   int not null default 0
);

create index if not exists product_image_product_idx
  on public."ProductImage" ("productSlug", "sortOrder");

-- At most one primary image per product. The card projection resolves exactly
-- one, and two would make which photograph a grid shows depend on row order.
create unique index if not exists product_image_one_primary_idx
  on public."ProductImage" ("productSlug")
  where "isPrimary";

-- ── Row Level Security ──────────────────────────────────────
--
-- `public` is exposed through the Data API, so RLS is not optional. The catalog
-- is public *reading*; every write goes through the service role, which
-- bypasses RLS — which is why no insert/update/delete policy exists here for
-- `anon` or `authenticated`, and why none should be added.
--
-- The predicates are the access control, not a second copy of the query's
-- `where` clause: a service function that forgets `.eq('isArchived', false)`
-- must still not be able to publish an archived product.

alter table public."Collection"   enable row level security;
alter table public."Product"      enable row level security;
alter table public."ProductImage" enable row level security;

drop policy if exists "Collection is publicly readable" on public."Collection";
create policy "Collection is publicly readable"
  on public."Collection" for select
  to anon, authenticated
  using (true);

drop policy if exists "Public catalog is readable" on public."Product";
create policy "Public catalog is readable"
  on public."Product" for select
  to anon, authenticated
  using ("isArchived" = false and "deletedAt" is null);

-- An image is visible exactly when its product is. Without the subquery an
-- archived product's photography would still be listable.
drop policy if exists "Images of readable products" on public."ProductImage";
create policy "Images of readable products"
  on public."ProductImage" for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public."Product" p
      where p.slug = "ProductImage"."productSlug"
        and p."isArchived" = false
        and p."deletedAt" is null
    )
  );

grant select on public."Collection"   to anon, authenticated;
grant select on public."Product"      to anon, authenticated;
grant select on public."ProductImage" to anon, authenticated;
