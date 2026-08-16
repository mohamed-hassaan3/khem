-- KHEM — editorial content: testimonials, ingredients, journal, heritage,
-- craftsmanship, about.
--
-- Applied by `npm run db:migrate`. Idempotent, like every file here.
--
-- These are the records `src/types/content.ts` describes and AGENTS.md §9 does
-- not: no Prisma model was ever written for them. The table names are the ones
-- `src/services/content.ts` already names in its migration comments, so the
-- service bodies become the queries their doc comments promised.
--
-- Text ids again (see `0001_catalog.sql`), and `"sortOrder"` on everything the
-- UI renders as a sequence — the seed arrays are curated running order, which
-- alphabetical ordering would destroy.

-- ── Testimonial ─────────────────────────────────────────────

create table if not exists public."Testimonial" (
  id            text primary key,
  quote         text not null,
  author        text not null,
  -- Role and city, e.g. "Perfume Critic, Cairo".
  "authorTitle" text not null,
  "isPublished" boolean not null default true,
  "sortOrder"   int not null default 0
);

-- ── Ingredient ──────────────────────────────────────────────
--
-- The seven olfactive families are a fixed vocabulary the filter bar is written
-- against. They live in their own table so the bar reads a deliberate taxonomy
-- order rather than whichever ingredient happened to be listed first.

create table if not exists public."IngredientFamily" (
  name        text primary key,
  "sortOrder" int not null default 0
);

create table if not exists public."Ingredient" (
  id           text primary key,
  name         text not null,
  slug         text not null unique,
  -- Botanical or zoological binomial, e.g. "Aquilaria malaccensis".
  "latinName"  text not null,
  origin       text not null,

  -- An array rather than a " · "-joined display string, so filtering is a
  -- predicate and not a substring match. Membership of the closed vocabulary is
  -- enforced by the trigger below — a `check` cannot reach another table, and a
  -- junction table would force every read to aggregate.
  families     text[] not null default '{}',

  rarity       text not null,
  -- Relative cost, 1 (least) to 5 (most). Rendered as "$"×n.
  "priceTier"  int not null check ("priceTier" between 1 and 5),
  description  text not null,
  -- Short provenance notes shown in the detail panel.
  facts        text[] not null default '{}',
  "imageUrl"   text not null,
  "imageAlt"   text not null,
  "sortOrder"  int not null default 0
);

create index if not exists ingredient_families_idx
  on public."Ingredient" using gin (families);

create or replace function public.assert_ingredient_families()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  unknown_family text;
begin
  select f
    into unknown_family
    from unnest(new.families) as f
   where not exists (
     select 1 from public."IngredientFamily" v where v.name = f
   )
   limit 1;

  if unknown_family is not null then
    raise exception 'unknown olfactive family: %', unknown_family;
  end if;

  return new;
end;
$$;

drop trigger if exists ingredient_families_valid on public."Ingredient";
create trigger ingredient_families_valid
  before insert or update on public."Ingredient"
  for each row
  execute function public.assert_ingredient_families();

-- The perfumes a material appears in. A child table rather than a jsonb column
-- so `getIngredientsForProduct()` is an inner join on a real foreign key — the
-- query its doc comment has always described.
create table if not exists public."IngredientUsage" (
  id             text primary key,
  "ingredientId" text not null
    references public."Ingredient"(id) on delete cascade,
  "productSlug"  text not null
    references public."Product"(slug) on delete cascade on update cascade,
  -- Display name snapshot, so rendering the link never needs the product row.
  name           text not null,
  "sortOrder"    int not null default 0,
  unique ("ingredientId", "productSlug")
);

create index if not exists ingredient_usage_product_idx
  on public."IngredientUsage" ("productSlug");

-- ── Article (the journal) ───────────────────────────────────

create table if not exists public."Article" (
  id                 text primary key,
  slug               text not null unique,
  title              text not null,
  category           text not null,
  excerpt            text not null,
  -- A date, never a formatted display string — `formatArticleDate()` owns that.
  "publishedAt"      date not null,
  -- Estimated reading time in minutes. Formatted at render, never stored as "8 min".
  "readTimeMinutes"  int not null check ("readTimeMinutes" > 0),
  -- Promoted to the large card at the top of `/journal`.
  "isFeatured"       boolean not null default false,
  "isPublished"      boolean not null default true,
  "imageUrl"         text not null,
  "imageAlt"         text not null
);

create index if not exists article_published_idx
  on public."Article" ("publishedAt" desc)
  where "isPublished";

-- ── Heritage and About ──────────────────────────────────────

create table if not exists public."TimelineEvent" (
  id          text primary key,
  -- Display year, e.g. "3000 BC" — not a date, so it stays text.
  year        text not null,
  title       text not null,
  description text not null,
  "sortOrder" int not null default 0
);

create table if not exists public."BrandValue" (
  id          text primary key,
  title       text not null,
  description text not null,
  "sortOrder" int not null default 0
);

create table if not exists public."MissionStatement" (
  id          text primary key,
  -- Section label, e.g. "Mission".
  label       text not null,
  title       text not null,
  text        text not null,
  "sortOrder" int not null default 0
);

-- ── Craftsmanship ───────────────────────────────────────────

create table if not exists public."CraftPillar" (
  id          text primary key,
  -- Display ordinal, e.g. "01".
  number      text not null,
  title       text not null,
  description text not null,
  "sortOrder" int not null default 0
);

create table if not exists public."CraftStep" (
  id          text primary key,
  number      text not null,
  title       text not null,
  -- Italic gold line under the title.
  subtitle    text not null,
  body        text not null,
  "imageUrl"  text not null,
  "imageAlt"  text not null,
  "sortOrder" int not null default 0
);

create table if not exists public."CraftStat" (
  id          text primary key,
  -- Display figure, e.g. "300+" or "100%". Mixed units, nothing computes on
  -- them — same reasoning as `TimelineEvent.year`.
  value       text not null,
  label       text not null,
  "sortOrder" int not null default 0
);

-- Deliberately not a `Testimonial` despite the identical shape: that record set
-- is third-party press, and reusing it would put the head perfumer among the
-- critics.
create table if not exists public."CraftQuote" (
  id            text primary key,
  quote         text not null,
  author        text not null,
  "authorTitle" text not null,
  "isPublished" boolean not null default true,
  "sortOrder"   int not null default 0
);

-- ── Row Level Security ──────────────────────────────────────
--
-- Public read of published rows, select-only grants, no write policy for the
-- public roles anywhere. Same trust model as `0001_catalog.sql`.

alter table public."Testimonial"      enable row level security;
alter table public."IngredientFamily" enable row level security;
alter table public."Ingredient"       enable row level security;
alter table public."IngredientUsage"  enable row level security;
alter table public."Article"          enable row level security;
alter table public."TimelineEvent"    enable row level security;
alter table public."BrandValue"       enable row level security;
alter table public."MissionStatement" enable row level security;
alter table public."CraftPillar"      enable row level security;
alter table public."CraftStep"        enable row level security;
alter table public."CraftStat"        enable row level security;
alter table public."CraftQuote"       enable row level security;

drop policy if exists "Published testimonials are readable" on public."Testimonial";
create policy "Published testimonials are readable"
  on public."Testimonial" for select to anon, authenticated using ("isPublished");

drop policy if exists "Published articles are readable" on public."Article";
create policy "Published articles are readable"
  on public."Article" for select to anon, authenticated using ("isPublished");

drop policy if exists "Published craft quotes are readable" on public."CraftQuote";
create policy "Published craft quotes are readable"
  on public."CraftQuote" for select to anon, authenticated using ("isPublished");

-- A usage row is visible exactly when its product is — the same reasoning as
-- `"ProductImage"`.
drop policy if exists "Usages of readable products" on public."IngredientUsage";
create policy "Usages of readable products"
  on public."IngredientUsage" for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public."Product" p
      where p.slug = "IngredientUsage"."productSlug"
        and p."isArchived" = false
        and p."deletedAt" is null
    )
  );

-- The remainder are reference copy with no publication switch: every row is
-- meant to be on the page it belongs to.
do $$
declare
  t text;
begin
  foreach t in array array[
    'IngredientFamily', 'Ingredient', 'TimelineEvent', 'BrandValue',
    'MissionStatement', 'CraftPillar', 'CraftStep', 'CraftStat'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || ' is readable', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || ' is readable', t
    );
  end loop;
end $$;

grant select on public."Testimonial"      to anon, authenticated;
grant select on public."IngredientFamily" to anon, authenticated;
grant select on public."Ingredient"       to anon, authenticated;
grant select on public."IngredientUsage"  to anon, authenticated;
grant select on public."Article"          to anon, authenticated;
grant select on public."TimelineEvent"    to anon, authenticated;
grant select on public."BrandValue"       to anon, authenticated;
grant select on public."MissionStatement" to anon, authenticated;
grant select on public."CraftPillar"      to anon, authenticated;
grant select on public."CraftStep"        to anon, authenticated;
grant select on public."CraftStat"        to anon, authenticated;
grant select on public."CraftQuote"       to anon, authenticated;
