-- KHEM — the product type, widened; the volume, made optional.
-- Applied by `npm run db:migrate`, after `0041_product_type.sql` (which creates
-- `public."ProductType"` and the trigger this file replaces). Every statement is
-- idempotent.
--
-- ## What this is
--
-- `0041` introduced `"productType"` for exactly one job — telling a Body Mist
-- from a Room Spray inside a range — and its header stated the general rule:
-- "`format` says what the object is *like*, `"productType"` says what it *is*."
--
-- The house now sells objects that are not fragrances at all: a Sphinx piece, a
-- Pyramid piece, a gift box. That is the same question this column already
-- answers, so it is answered here rather than in a second column. Five values
-- join the two that exist.
--
-- ## Why the volume follows from the type
--
-- `0001_catalog.sql` declared `"volumeMl" int not null check ("volumeMl" > 0)`,
-- which was true of everything the house sold when it was written. An alabaster
-- sphinx has no volume in millilitres, and a `0` or a `1` entered to satisfy a
-- constraint is a lie the storefront then prints on a card.
--
-- So the column becomes nullable and the requirement moves onto the type: the
-- three things measured in millilitres must carry one, and the four that are not
-- must be free to carry none. That rule cannot be a check constraint — it spans
-- two columns whose relationship is a policy, not an invariant of either — so it
-- joins the trigger that already polices this column.
--
-- ## What is deliberately unchanged
--
-- `product_strength_or_format` (`0001_catalog.sql`) still stands: every row needs
-- a concentration or a format line. A typed non-fragrance has no concentration,
-- so its `format` is what satisfies it — "Alabaster Sphinx", "Gift Box — 3
-- Vials". `src/schemas/admin.ts` says so in a sentence before the database has
-- to.
--
-- `BODY_MIST` and `ROOM_SPRAY` keep their collection-kind rules. Two real
-- `"Collection"` rows were built on them in `0046_range_collections.sql`, and
-- `/collections/body-mist` still selects on this column. The five new values are
-- unconstrained by kind: which shelf an antique is sold from is a merchandising
-- decision, not a schema one.

-- ── The new values ────────────────────────────────────────────
--
-- `alter type … add value` is permitted inside a transaction block on Postgres
-- 12+ — which matters, because `scripts/db-migrate.ts` wraps every file in one.
-- What is *not* permitted is using a new value in the same transaction, so
-- nothing below writes one, and the trigger compares `::text` rather than enum
-- literals. No backfill: a null type reads as "not stated", and a guess written
-- across the catalogue would be worse than a blank an editor can fill in.

alter type public."ProductType" add value if not exists 'PERFUME';
alter type public."ProductType" add value if not exists 'GIFT';
alter type public."ProductType" add value if not exists 'BOX';
alter type public."ProductType" add value if not exists 'ANTIQUE';
alter type public."ProductType" add value if not exists 'DECORATIVE';

-- ── The volume, made optional ─────────────────────────────────
--
-- The inline check from `0001_catalog.sql` is named `Product_volumeMl_check` by
-- Postgres. It is dropped and replaced by a named one that permits null and
-- still refuses zero and negatives: an optional measurement is optional, not
-- meaningless when present.

alter table public."Product"
  alter column "volumeMl" drop not null;

alter table public."Product"
  drop constraint if exists "Product_volumeMl_check";

alter table public."Product"
  drop constraint if exists product_volume_positive;

alter table public."Product"
  add constraint product_volume_positive
  check ("volumeMl" is null or "volumeMl" > 0);

-- ── The type's rules, in one place ────────────────────────────
--
-- Replaces the function of the same name from `0041_product_type.sql`, keeping
-- both of its rules and adding the volume one. The trigger is re-created because
-- its `update of` column list grows: a row whose volume is cleared must be
-- re-judged, and the old trigger would not have fired on that write.
--
-- Comparisons are against `::text` rather than enum literals. Postgres refuses
-- to resolve an enum value added in the *current* transaction, and on a fresh
-- database this file and the `add value` statements above are that transaction.

create or replace function public.product_type_matches_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public."CollectionKind";
  v_type text := new."productType"::text;
begin
  -- Measured in millilitres, and so required to say how many. A null type is
  -- read as "not stated" and keeps the original rule, which is what stops every
  -- product created before this migration from becoming invalid on the way in.
  if v_type is null or v_type in ('PERFUME', 'BODY_MIST', 'ROOM_SPRAY') then
    if new."volumeMl" is null then
      raise exception
        'Product %: a % needs a volume in millilitres.',
        new.slug, coalesce(v_type, 'fragrance');
    end if;
  end if;

  if v_type is null then
    return new;
  end if;

  -- The two range types are sold from a particular kind of shelf; the five
  -- others are not, so there is nothing further to check for them.
  if v_type not in ('BODY_MIST', 'ROOM_SPRAY') then
    return new;
  end if;

  select kind into v_kind
    from public."Collection"
   where slug = new."collectionSlug";

  if v_kind is null then
    raise exception 'Product %: collection % does not exist.',
      new.slug, new."collectionSlug";
  end if;

  if v_type = 'BODY_MIST' and v_kind <> 'BODY' then
    raise exception 'Product %: BODY_MIST belongs to a BODY collection, not %.',
      new.slug, v_kind;
  end if;

  if v_type = 'ROOM_SPRAY' and v_kind <> 'HOME' then
    raise exception 'Product %: ROOM_SPRAY belongs to a HOME collection, not %.',
      new.slug, v_kind;
  end if;

  return new;
end;
$$;

drop trigger if exists product_type_matches_kind on public."Product";

create trigger product_type_matches_kind
  before insert or update of "productType", "collectionSlug", "volumeMl"
  on public."Product"
  for each row
  execute function public.product_type_matches_kind();
