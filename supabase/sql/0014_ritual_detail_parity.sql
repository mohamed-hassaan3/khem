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
-- Superseded by the product rename. Live `IngredientUsage` data is managed
-- through the admin dashboard.
