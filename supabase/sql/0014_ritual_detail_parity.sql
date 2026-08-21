-- KHEM — `/ritual/[slug]` reaches parity with `/perfume/[slug]`.
--
-- Applied by `npm run db:migrate`. Every statement is idempotent.
--
-- Two things the ritual detail page needs that the database was withholding:
-- a related rail that can see past the perfumes, and the ingredient usages
-- that make "Key Ingredients" appear at all.

-- ── Related products, across kinds ──────────────────────────
--
-- `related_products()` shipped with `c.kind = 'FRAGRANCE'` welded into its
-- `where` clause, because at the time the rail only ever rendered on a
-- fragrance page and the other kinds had no detail page to link to. Body care
-- and home fragrance have one now (`0013_product_image_caption.sql`), so the
-- filter becomes an argument.
--
-- A parameter rather than a deletion: the default keeps `/perfume/[slug]`
-- calling the function exactly as it did and getting exactly what it got. Only
-- the ritual page passes the wider set, and it passes a server-side constant —
-- there is no request path that lets a visitor widen their own rail.
--
-- Discovery and gift sets stay out of every caller's array. They sell from a
-- category grid and have no page of their own, so a card for one would drop a
-- visitor back into a listing from a rail that is otherwise all detail pages.
--
-- ## Why the old signature is dropped first
--
-- `create or replace` cannot change a function's argument list — it would leave
-- `related_products(text, int)` in place beside the new
-- `related_products(text, int, public."CollectionKind"[])`, and a two-argument
-- call would then be
-- ambiguous between the old function and the new one's default. Postgres
-- reports that at call time, on a page, which is the worst place to find it.
-- Dropping first means there is exactly one function with this name.
--
-- Degrades rather than empties, still: until `npm run embed` has run every
-- vector is null and the ordering falls through to the editorial terms, which
-- is what keeps the rail full on a fresh database.

drop function if exists public.related_products(text, int);

create or replace function public.related_products(
  product_slug text,
  match_limit int default 3,
  -- The enum array, not `text[]`: `"Collection".kind` is
  -- `public."CollectionKind"` (`0001_catalog.sql`), and comparing an enum to
  -- text has no operator — the first cut of this function failed to create for
  -- exactly that reason. Typing the parameter rather than casting the column
  -- also means a kind that is not in the enum is rejected at the call, instead
  -- of silently matching nothing and rendering an empty rail.
  --
  -- PostgREST casts the JSON string array supabase-js sends into this type, so
  -- the caller still passes `["FRAGRANCE","BODY","HOME"]`.
  kinds public."CollectionKind"[] default '{FRAGRANCE}'
)
returns setof public."Product"
language sql
stable
security invoker
set search_path = ''
as $$
  with source as (
    select p.slug, p.embedding, p."collectionSlug", c.kind
    from public."Product" p
    join public."Collection" c on c.slug = p."collectionSlug"
    where p.slug = product_slug
      and p."isArchived" = false
      and p."deletedAt" is null
  )
  select p.*
  from public."Product" p
  join public."Collection" c on c.slug = p."collectionSlug"
  cross join source s
  where c.kind = any(kinds)
    and p.slug <> s.slug
    and p."isArchived" = false
    and p."deletedAt" is null
  order by
    -- Rows with a comparable vector first (false sorts before true), then by
    -- cosine distance, then by the editorial fallback.
    (p.embedding is null or s.embedding is null),
    case
      when p.embedding is not null and s.embedding is not null
      then p.embedding OPERATOR(extensions.<=>) s.embedding
    end nulls last,
    -- Same kind before same collection: on a body mist's page the closest
    -- neighbour by smell may well be the eau de parfum it was drawn from, but
    -- a rail that opens with three perfumes reads as though the visitor
    -- wandered off the shelf they were standing at. Inert for a single-kind
    -- call, which is why `/perfume/[slug]`'s rail is unchanged.
    (c.kind <> s.kind),
    (p."collectionSlug" <> s."collectionSlug"),
    p."sortOrder",
    p.slug
  limit match_limit;
$$;

-- The new signature needs its own grant; the old one went with the function.
grant execute on function public.related_products(
  text, int, public."CollectionKind"[]
) to anon, authenticated;

-- ── Key Ingredients for the ritual goods ────────────────────
--
-- `<ProductIngredients>` renders from `"IngredientUsage"`, which had rows for
-- the fragrances only — so the section was silently absent on every ritual
-- page. These are not new editorial claims: each product's `description`
-- already names its accord, and these are the catalogued materials behind those
-- names. Ambergris carries the "red amber" and "white amber" bases; Black Iris
-- carries the "silver iris" and "blue iris" hearts.
--
-- `on conflict do nothing` against the `(ingredientId, productSlug)` unique
-- constraint, so a re-run cannot disturb an ordering an editor has changed.
-- Ids follow `db-seed.ts`'s scheme — `<ingredientId>-<productSlug>` — so
-- seeding a fresh database from `supabase/seed/content.json` converges on
-- exactly these rows.

-- `"sortOrder"` is the position within the *ingredient's* usage list, not
-- within the product's — that is what `db-seed.ts` writes from
-- `usedIn`'s array index, and these values are generated from the same
-- file so a later `npm run db:seed` is a no-op rather than a rewrite.
-- Nothing reads it here: `getIngredientsForProduct()` orders by the
-- ingredient's own `"sortOrder"`, so the taxonomy order is what a
-- product page prints.

insert into public."IngredientUsage" (id, "ingredientId", "productSlug", name, "sortOrder")
values
  ('frankincense-amber-body-mist',     'frankincense',    'amber-body-mist',      'Amber', 2),
  ('frankincense-amber-room-spray',    'frankincense',    'amber-room-spray',     'Amber', 3),
  ('neroli-turquoise-body-mist',       'neroli',          'turquoise-body-mist',  'Turquoise', 3),
  ('neroli-turquoise-room-spray',      'neroli',          'turquoise-room-spray', 'Turquoise', 4),
  ('ambergris-amber-body-mist',        'ambergris',       'amber-body-mist',      'Amber', 2),
  ('ambergris-amber-room-spray',       'ambergris',       'amber-room-spray',     'Amber', 3),
  ('ambergris-opal-body-mist',         'ambergris',       'opal-body-mist',       'Opal', 4),
  ('ambergris-opal-room-spray',        'ambergris',       'opal-room-spray',      'Opal', 5),
  ('ambergris-turquoise-body-mist',    'ambergris',       'turquoise-body-mist',  'Turquoise', 6),
  ('ambergris-turquoise-room-spray',   'ambergris',       'turquoise-room-spray', 'Turquoise', 7),
  ('haitian-vetiver-lapis-body-mist',  'haitian-vetiver', 'lapis-body-mist',      'Lapis', 3),
  ('haitian-vetiver-lapis-room-spray', 'haitian-vetiver', 'lapis-room-spray',     'Lapis', 4),
  ('black-iris-opal-body-mist',        'black-iris',      'opal-body-mist',       'Opal', 2),
  ('black-iris-opal-room-spray',       'black-iris',      'opal-room-spray',      'Opal', 3),
  ('black-iris-lapis-body-mist',       'black-iris',      'lapis-body-mist',      'Lapis', 4),
  ('black-iris-lapis-room-spray',      'black-iris',      'lapis-room-spray',     'Lapis', 5)
on conflict ("ingredientId", "productSlug") do nothing;
