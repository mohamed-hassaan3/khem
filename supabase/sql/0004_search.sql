-- KHEM — hybrid product search and vector-based related products.
--
-- Applied by `npm run db:migrate`. This is the file `sql/product-search.sql`
-- described as a design; it is now the applied schema, with two changes:
--
--   1. `vector` and `pg_trgm` install into `extensions`, not `public` — the
--      Supabase advisor flags extensions in an API-exposed schema. Because the
--      functions below run with `search_path = ''`, the type is written
--      `extensions.vector` and the cosine operator `OPERATOR(extensions.<=>)`.
--      Verbose, and the alternative is a function whose meaning depends on the
--      caller's search path.
--   2. The `"Product"` RLS policy is not repeated here — `0001_catalog.sql`
--      owns it, and two files creating the same policy is two places to
--      forget.
--
-- It is the destination for four TypeScript modules:
--
--   src/lib/search/text.ts     → `search_document` / `search_vector` below
--   src/lib/search/lexical.ts  → the weighted tsvector (A/B/C classes)
--   src/lib/search/semantic.ts → the `<=>` operator and the HNSW index
--   src/lib/search/fuse.ts     → hybrid_search_products(), verbatim RRF
--
-- Keep the two sides in step. If a field's weight changes in one, change it in
-- the other — the whole point of running the same algorithm on both sides is
-- that relevance does not visibly shift.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ── An immutable join ───────────────────────────────────────
--
-- `array_to_string()` is declared STABLE, not IMMUTABLE, because in general it
-- calls the element type's output function and that function may itself be
-- stable. A stored generated column may only call immutable functions, so both
-- expressions below would be rejected with "generation expression is not
-- immutable".
--
-- For `text[]` the concern does not apply: `text`'s output function is the
-- identity and cannot vary with session state, locale, or time. This wrapper
-- narrows the argument to `text[]` and declares what is true at that narrower
-- type. It is the standard workaround, and it is honest — unlike marking a
-- genuinely stable function immutable to get past the check.

create or replace function public.join_text(parts text[], separator text)
returns text
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select array_to_string(parts, separator);
$$;

-- ── Columns ─────────────────────────────────────────────────
--
-- `search_document` is the SQL twin of `productEmbeddingSource()`: the text
-- that gets embedded, materialised so the embedding job and the full-text index
-- read the same string. Stored (not virtual) because both consumers want it
-- indexed.

alter table public."Product"
  add column if not exists search_document text
    generated always as (
      coalesce(name, '') || '. ' ||
      coalesce(subtitle, '') || '. ' ||
      coalesce(public.join_text("topNotes", ', '), '') || ' ' ||
      coalesce(public.join_text("heartNotes", ', '), '') || ' ' ||
      coalesce(public.join_text("baseNotes", ', '), '') || '. ' ||
      coalesce(description, '') || ' ' ||
      coalesce(story, '')
    ) stored;

-- Must match EMBEDDING_DIMENSIONS in `src/lib/search/config.ts`. Changing the
-- model to one of a different width is an ALTER plus a full re-embed.
alter table public."Product"
  add column if not exists embedding extensions.vector(1536);

alter table public."Product"
  add column if not exists search_vector tsvector
    generated always as (
      -- `'english'::regconfig` rather than a bare literal: the two-argument
      -- `to_tsvector(regconfig, text)` is immutable and so may build a stored
      -- generated column, while the one-argument form reads the session's
      -- `default_text_search_config` and is merely stable. Postgres rejects the
      -- latter here with "generation expression is not immutable".
      setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english'::regconfig, coalesce(subtitle, '')), 'B') ||
      setweight(to_tsvector('english'::regconfig,
        coalesce(public.join_text("topNotes" || "heartNotes" || "baseNotes", ' '), '')), 'B') ||
      setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
    ) stored;

create index if not exists product_search_vector_idx
  on public."Product" using gin (search_vector);

-- Trigram index for the prefix/typo tolerance `fold()` provides client-side.
create index if not exists product_name_trgm_idx
  on public."Product" using gin (name extensions.gin_trgm_ops);

-- HNSW over cosine distance — the index that replaces the brute-force loop in
-- `rankSemantic()`. `vector_cosine_ops` because the vectors are normalised and
-- cosine similarity is what the TypeScript side compared with.
create index if not exists product_embedding_idx
  on public."Product" using hnsw (embedding extensions.vector_cosine_ops);

-- ── Hybrid search ───────────────────────────────────────────
--
-- Reciprocal Rank Fusion, identical to `src/lib/search/fuse.ts`:
--
--     score(d) = Σ over rankings  weight / (K + rank(d))
--
-- Ranks rather than scores, because a ts_rank and a cosine distance share no
-- scale and any normalisation between them would be invented.
--
-- `security invoker` so the caller's RLS applies (a `security definer` function
-- would hand every caller the owner's visibility), and `search_path = ''` so a
-- crafted schema on the caller's path cannot shadow the objects named inside.

create or replace function public.hybrid_search_products(
  query_text text,
  query_embedding extensions.vector(1536),
  match_limit int default 20,
  rrf_k int default 60,
  full_text_weight float default 1,
  semantic_weight float default 1,
  -- Mirrors SIMILARITY_FLOOR: nearest-neighbour search always returns a
  -- neighbour, so without a floor "no results" is unreachable.
  similarity_floor float default 0.28
)
returns setof public."Product"
language sql
stable
security invoker
set search_path = ''
as $$
  with full_text as (
    select
      id,
      row_number() over (
        order by ts_rank_cd(search_vector, websearch_to_tsquery('english', query_text)) desc
      ) as rank
    from public."Product"
    where search_vector @@ websearch_to_tsquery('english', query_text)
      and "isArchived" = false
      and "deletedAt" is null
    limit least(match_limit * 4, 200)
  ),
  semantic as (
    select
      id,
      row_number() over (
        order by embedding OPERATOR(extensions.<=>) query_embedding
      ) as rank
    from public."Product"
    where query_embedding is not null
      and embedding is not null
      -- `<=>` is cosine *distance*; similarity is 1 - distance.
      and 1 - (embedding OPERATOR(extensions.<=>) query_embedding) >= similarity_floor
      and "isArchived" = false
      and "deletedAt" is null
    order by embedding OPERATOR(extensions.<=>) query_embedding
    limit least(match_limit * 4, 200)
  )
  select p.*
  from full_text
  full outer join semantic on full_text.id = semantic.id
  join public."Product" p on p.id = coalesce(full_text.id, semantic.id)
  order by
    coalesce(full_text_weight / (rrf_k + full_text.rank), 0) +
    coalesce(semantic_weight / (rrf_k + semantic.rank), 0) desc,
    p.id
  limit match_limit;
$$;

-- ── Related products ────────────────────────────────────────
--
-- The "You may also love" rail on a product detail page, ranked by how close
-- two fragrances actually smell rather than by which chapter they were filed
-- under. Both are the same `search_document` embedding the search uses, so a
-- resinous Signature scent can surface beside a resinous Noir one.
--
-- Fragrances only: the rail links to a detail page, and body care, home
-- fragrance, and sets have none.
--
-- Degrades rather than empties. Until `npm run embed` has run, every vector is
-- null and the ordering falls through to own-collection-first — exactly the
-- pre-migration behaviour, which is what keeps the rail full on a fresh
-- database.

create or replace function public.related_products(
  product_slug text,
  match_limit int default 3
)
returns setof public."Product"
language sql
stable
security invoker
set search_path = ''
as $$
  with source as (
    select slug, embedding, "collectionSlug"
    from public."Product"
    where slug = product_slug
      and "isArchived" = false
      and "deletedAt" is null
  )
  select p.*
  from public."Product" p
  join public."Collection" c on c.slug = p."collectionSlug"
  cross join source s
  where c.kind = 'FRAGRANCE'
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
    (p."collectionSlug" <> s."collectionSlug"),
    p."sortOrder",
    p.slug
  limit match_limit;
$$;

-- ── Keeping embeddings fresh ────────────────────────────────
--
-- Editing a product invalidates its vector. The trigger nulls it; `npm run
-- embed` re-embeds the nulls in batches. Same shape as `npm run embed --
-- --check`, which is the guard against exactly this drift.

create or replace function public.invalidate_product_embedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.search_document is distinct from old.search_document then
    new.embedding := null;
  end if;
  return new;
end;
$$;

drop trigger if exists product_embedding_invalidation on public."Product";
create trigger product_embedding_invalidation
  before update on public."Product"
  for each row
  execute function public.invalidate_product_embedding();

-- Both functions read the catalog the caller can already read; neither writes.
grant execute on function public.hybrid_search_products(
  text, extensions.vector, int, int, float, float, float
) to anon, authenticated;

grant execute on function public.related_products(text, int) to anon, authenticated;
