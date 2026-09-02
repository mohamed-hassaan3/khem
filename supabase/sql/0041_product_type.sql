-- KHEM — the product type, as a typed column.
-- Applied by `npm run db:migrate`, after `0001_catalog.sql` (which creates
-- `"Product"`). Every statement is idempotent.
--
-- ## What this is
--
-- `BODY CARE` and `HOME FRAGRANCES` are ranges, and each holds goods of more
-- than one kind: a Body Mist today, a Body Cream tomorrow; a Room Spray today,
-- a Candle tomorrow. This column is what makes that distinction addressable —
-- it is what `/collections/body-mist` selects on, and what the Nav's two new
-- disclosures point at.
--
-- ## Why not new collections
--
-- The `MerchPage` and `ScentProfile` argument, a third time: a product points at
-- exactly one collection (`"Product"."collectionSlug"`), so seeding "Body Mist"
-- as a collection would take those four products *out* of Body Care and leave
-- the parent range empty. A type is an attribute of the object, not the shelf it
-- sits on, so it belongs on the product.
--
-- ## Why not `format`
--
-- `"Product".format` already carries "Body Mist" and "Room Spray" — and also
-- "6 × 3 ML Vials" and "Room Spray · Candle · Incense". It is **display copy**,
-- free text, translated in `format_ar`, and written to be read on a product
-- page. Routing and filtering on it would mean matching prose, and would put a
-- gift set that merely *mentions* a room spray onto the Room Spray page. So this
-- column is derived from `format` once, here, and the two then serve different
-- jobs: `format` says what the object is like, `"productType"` says what it is.
--
-- ## Why an enum
--
-- The same reason `"Concentration"`, `"CollectionKind"` and `"OrderChannel"` are
-- enums. A new type is never *only* a database change: it also needs a route in
-- `src/lib/product-types.ts`, a Nav entry in `src/constants/navigation-pages.ts`
-- and copy in both dictionaries. Requiring `alter type ... add value` puts that
-- work behind a migration where it is visible, instead of letting a typo in a
-- text column silently create a page nobody can reach.
--
-- ## Null is meaningful
--
-- Fragrances, discovery sets and gift sets have no type and must keep none. The
-- column is nullable and the check constraint below enforces the other
-- direction: only BODY and HOME goods may carry one, so a typed gift set cannot
-- exist.

-- ── The type ──────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ProductType') then
    create type public."ProductType" as enum ('BODY_MIST', 'ROOM_SPRAY');
  end if;
end
$$;

-- ── The column ────────────────────────────────────────────────

alter table public."Product"
  add column if not exists "productType" public."ProductType";

-- ── Backfill, from `format`, exactly once ─────────────────────
--
-- Constrained by collection as well as by string: `temple-hearth-set` is a gift
-- set whose `format` reads "Room Spray · Candle · Incense", and it must not be
-- swept onto the Room Spray page. Matching the collection *and* the exact
-- string is what keeps this from being a prose search.
--
-- `where "productType" is null` makes a re-run a no-op rather than an overwrite
-- of an editor's later correction.

update public."Product" p
   set "productType" = 'BODY_MIST'
  from public."Collection" c
 where c.slug = p."collectionSlug"
   and c.kind = 'BODY'
   and p.format = 'Body Mist'
   and p."productType" is null;

update public."Product" p
   set "productType" = 'ROOM_SPRAY'
  from public."Collection" c
 where c.slug = p."collectionSlug"
   and c.kind = 'HOME'
   and p.format = 'Room Spray'
   and p."productType" is null;

-- ── Only ranges carry a type ──────────────────────────────────
--
-- Written as a trigger rather than a check constraint because the rule spans two
-- tables: the kind lives on `"Collection"`. A check constraint cannot subquery,
-- and a generated column would duplicate `kind` onto every product row.

create or replace function public.product_type_matches_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public."CollectionKind";
begin
  if new."productType" is null then
    return new;
  end if;

  select kind into v_kind
    from public."Collection"
   where slug = new."collectionSlug";

  if v_kind is null then
    raise exception 'Product %: collection % does not exist.',
      new.slug, new."collectionSlug";
  end if;

  if new."productType" = 'BODY_MIST' and v_kind <> 'BODY' then
    raise exception 'Product %: BODY_MIST belongs to a BODY collection, not %.',
      new.slug, v_kind;
  end if;

  if new."productType" = 'ROOM_SPRAY' and v_kind <> 'HOME' then
    raise exception 'Product %: ROOM_SPRAY belongs to a HOME collection, not %.',
      new.slug, v_kind;
  end if;

  return new;
end;
$$;

drop trigger if exists product_type_matches_kind on public."Product";

create trigger product_type_matches_kind
  before insert or update of "productType", "collectionSlug"
  on public."Product"
  for each row
  execute function public.product_type_matches_kind();

-- ── Index ─────────────────────────────────────────────────────
--
-- `/collections/body-mist` filters on this column and nothing else, alongside
-- the two publication predicates every card query already carries.

create index if not exists product_product_type_idx
  on public."Product" ("productType")
  where "productType" is not null;
