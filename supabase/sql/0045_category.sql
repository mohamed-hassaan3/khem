-- KHEM — the category, as a real entity.
-- Applied by `npm run db:migrate`, after `0001_catalog.sql` (which creates
-- `"Collection"` and `"CollectionKind"`). Every statement is idempotent.
--
-- ## What this is
--
-- The house has always had categories. It has never had a *row* for one:
-- `"Collection".kind` is a five-value enum, and Fragrances, Body Care, Home
-- Fragrances, Discovery and Gift Sets existed only as its members. An enum has
-- no name to translate, no photograph, no page and no editor — a new category
-- meant `alter type … add value` plus four code edits, which is not something a
-- merchandiser can do.
--
-- This gives a category the same standing a collection already has: a slug it
-- is addressed by, copy in both languages, a banner, an order, and a row the
-- dashboard can create. The hierarchy the brief asks for —
-- **Category → Collection → Product** — is then a foreign key rather than a
-- convention.
--
-- ## Why `kind` stays
--
-- `"Collection".kind` is read in a dozen places: `productHref()` routes on it,
-- `/perfume/[slug]` refuses a non-fragrance with it, `categoryMeta()` picks a
-- dictionary section from it, and `product_type_matches_kind()`
-- (`0041_product_type.sql`) enforces an invariant with it. Dropping it in the
-- same change as everything else would put the catalogue at risk for no
-- user-visible gain.
--
-- So `kind` becomes **derived**: it lives on `"Category"`, and the trigger below
-- copies it down onto every collection that points at one. A collection cannot
-- disagree with its category about what it sells, because nothing writes the
-- column by hand any more.
--
-- ## Why the foreign key is onto the slug
--
-- The same deviation `0001_catalog.sql` documents for
-- `"Product"."collectionSlug"`: `slug` is unique, `on update cascade` makes a
-- rename safe, and it is the field the TypeScript types and every query already
-- carry. A constraint onto `slug` is exactly as strong as one onto `id`.
--
-- ## What this file does *not* do
--
-- No collection moves and no product moves. `body-care` is still a collection
-- holding four body mists after this file runs; `0046` is what changes that.
-- Splitting them keeps this file reversible on its own.

-- ── Category ──────────────────────────────────────────────────

create table if not exists public."Category" (
  id             text primary key,
  name           text not null,
  -- Null means "deliberately untranslated" — the same contract as
  -- `"Collection".name_ar` (`0008_i18n_content.sql`); `resolveText()` falls back
  -- to the Latin name rather than printing an empty heading.
  name_ar        text,
  slug           text not null unique,
  description    text not null,
  description_ar text,

  "bannerUrl"    text not null,
  "bannerAlt"    text not null,
  "bannerAlt_ar" text,

  -- What the collections beneath this category sell. The single source of the
  -- value; every collection's own `kind` is copied down from here.
  kind           public."CollectionKind" not null,

  -- A category that is switched off keeps its row, its collections and its
  -- products — it simply stops being offered as a destination. Retiring a
  -- season is not the same act as deleting it.
  "isEnabled"    boolean not null default true,

  -- Curated, like `"Collection"."sortOrder"`: Fragrances reads before Body Care
  -- for editorial reasons, not alphabetical ones.
  "sortOrder"    int not null default 0,

  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now()
);

create index if not exists category_order_idx
  on public."Category" ("sortOrder");

-- ── The edge ──────────────────────────────────────────────────
--
-- Nullable for exactly as long as the backfill below takes. It is set `not
-- null` at the end of this file, so a collection with no category cannot exist
-- once this has run.

alter table public."Collection"
  add column if not exists "categorySlug" text;

do $$ begin
  alter table public."Collection"
    add constraint "Collection_categorySlug_fkey"
    foreign key ("categorySlug")
    references public."Category"(slug)
    on update cascade;
exception when duplicate_object then null; end $$;

create index if not exists collection_category_idx
  on public."Collection" ("categorySlug", "sortOrder");

-- ── The five categories the house already had ─────────────────
--
-- One per `"CollectionKind"` member, which is what a category *was*. Four of
-- them take the slug of the collection that stood in for them
-- (`body-care`, `home-fragrance`, `discovery`, `gift-set`) — deliberately, so
-- that `/collections/body-care` keeps answering after `0046` retires those
-- collection rows, and the four legacy 308s in `next.config.ts` keep landing on
-- a live page. `fragrances` is the one new URL: the Nav has printed a
-- "Fragrances" heading with nothing behind it since it was written.
--
-- Copy and photography are lifted from the collection each one replaces, so no
-- category launches with placeholder text. `on conflict do nothing` — a re-run
-- must not overwrite an editor's later wording.

insert into public."Category"
  (id, name, name_ar, slug, description, description_ar,
   "bannerUrl", "bannerAlt", "bannerAlt_ar", kind, "sortOrder")
select
  'fragrances',
  'Fragrances',
  'العطور',
  'fragrances',
  c.description,
  c.description_ar,
  c."bannerUrl",
  c."bannerAlt",
  c."bannerAlt_ar",
  'FRAGRANCE',
  0
from public."Collection" c
where c.slug = 'signature'
on conflict (slug) do nothing;

insert into public."Category"
  (id, name, name_ar, slug, description, description_ar,
   "bannerUrl", "bannerAlt", "bannerAlt_ar", kind, "sortOrder")
select
  c.slug,
  c.name,
  c.name_ar,
  c.slug,
  c.description,
  c.description_ar,
  c."bannerUrl",
  c."bannerAlt",
  c."bannerAlt_ar",
  c.kind,
  case c.slug
    when 'body-care'      then 1
    when 'home-fragrance' then 2
    when 'discovery'      then 3
    when 'gift-set'       then 4
    else 5
  end
from public."Collection" c
where c.slug in ('body-care', 'home-fragrance', 'discovery', 'gift-set')
on conflict (slug) do nothing;

-- ── Point every existing collection at one ────────────────────
--
-- By `kind`, which is the fact these rows were carrying all along. The four
-- range collections point at the category that replaced them; the three
-- fragrance houses point at `fragrances`.
--
-- `where "categorySlug" is null` makes a re-run a no-op rather than an
-- overwrite of an editor's later move.

update public."Collection" c
   set "categorySlug" = 'fragrances'
 where c.kind = 'FRAGRANCE'
   and c."categorySlug" is null;

update public."Collection" c
   set "categorySlug" = c.slug
 where c.slug in ('body-care', 'home-fragrance', 'discovery', 'gift-set')
   and c."categorySlug" is null;

-- Anything a later hand added: matched on kind, and only when exactly one
-- category claims that kind — otherwise there is no correct answer to guess and
-- the `not null` below will say so loudly rather than filing it wrongly.
update public."Collection" c
   set "categorySlug" = (
     select cat.slug from public."Category" cat
      where cat.kind = c.kind
      group by cat.slug
     having count(*) = 1
      limit 1
   )
 where c."categorySlug" is null
   and (select count(*) from public."Category" cat where cat.kind = c.kind) = 1;

alter table public."Collection"
  alter column "categorySlug" set not null;

-- ── `kind` follows the category ───────────────────────────────
--
-- A trigger rather than a generated column, because the value lives in another
-- table and a generated column may only read its own row. `before insert or
-- update` so the copy is in place for `product_type_matches_kind()`, which
-- reads `"Collection".kind` when a product is written.

create or replace function public.collection_kind_from_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public."CollectionKind";
begin
  select kind into v_kind
    from public."Category"
   where slug = new."categorySlug";

  if v_kind is null then
    raise exception 'Collection %: category % does not exist.',
      new.slug, new."categorySlug";
  end if;

  new.kind := v_kind;
  return new;
end;
$$;

drop trigger if exists collection_kind_from_category on public."Collection";
create trigger collection_kind_from_category
  before insert or update of "categorySlug" on public."Collection"
  for each row
  execute function public.collection_kind_from_category();

-- A category may not change what it sells out from under its collections: the
-- trigger above only fires on the collection side, so a `kind` edited here
-- would leave them stale. Rewriting them is the honest completion of the edit.
create or replace function public.category_kind_cascade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind is distinct from old.kind then
    update public."Collection"
       set kind = new.kind, "updatedAt" = now()
     where "categorySlug" = new.slug;
  end if;

  return new;
end;
$$;

drop trigger if exists category_kind_cascade on public."Category";
create trigger category_kind_cascade
  after update of kind on public."Category"
  for each row
  execute function public.category_kind_cascade();

-- ── Row Level Security ────────────────────────────────────────
--
-- Page structure, not customer data: readable by everyone, written only by the
-- service role behind `requireAdmin()`. No insert/update/delete policy exists
-- for `anon` or `authenticated`, and none should be added — the same posture as
-- `"Collection"` in `0001_catalog.sql`.
--
-- A disabled category is still *readable*. Hiding it is the storefront's job
-- (`getCategories()` filters), and a policy that hid the row would also hide it
-- from the dashboard, which is the one place it must still be visible.

alter table public."Category" enable row level security;

drop policy if exists "Category is publicly readable" on public."Category";
create policy "Category is publicly readable"
  on public."Category" for select
  to anon, authenticated
  using (true);

revoke all on public."Category" from public;
grant select on public."Category" to anon, authenticated;
grant all on public."Category" to service_role;
