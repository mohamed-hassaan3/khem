-- KHEM — hybrid product search (full-text + pgvector), for Postgres/Supabase.
--
-- ⚠ NOT A MIGRATION. This is the reviewed *design* of the search schema, kept
-- here so that landing it later is a review rather than a fresh design session.
-- Migration filenames are generated, never invented — see ../README.md for the
-- exact command sequence.
--
-- It is the destination for four files that exist today:
--
--   src/lib/search/text.ts     → `search_document` / `search_vector` below
--   src/lib/search/lexical.ts  → the weighted tsvector (A/B/C classes)
--   src/lib/search/semantic.ts → the `<=>` operator and the HNSW index
--   src/lib/search/fuse.ts     → hybrid_search_products(), verbatim RRF
--
-- Keep the two sides in step. If a field's weight changes in one, change it in
-- the other — the whole point of running the same algorithm on both sides is
-- that relevance does not visibly shift on migration day.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ── Columns ─────────────────────────────────────────────────
--
-- `search_document` is the SQL twin of `productEmbeddingSource()`: the text
-- that gets embedded, materialised so the embedding job and the full-text index
-- read the same string. Stored (not virtual) because both consumers want it
-- indexed.

alter table "Product"
  add column if not exists search_document text
    generated always as (
      coalesce(name, '') || '. ' ||
      coalesce(subtitle, '') || '. ' ||
      coalesce(array_to_string("topNotes", ', '), '') || ' ' ||
      coalesce(array_to_string("heartNotes", ', '), '') || ' ' ||
      coalesce(array_to_string("baseNotes", ', '), '') || '. ' ||
      coalesce(description, '') || ' ' ||
      coalesce(story, '')
    ) stored,

  -- Must match EMBEDDING_DIMENSIONS in src/lib/search/config.ts. Changing the
  -- model to one of a different width is an ALTER plus a full re-embed.
  add column if not exists embedding vector(1536),

  add column if not exists search_vector tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
      setweight(to_tsvector('english',
        coalesce(array_to_string("topNotes" || "heartNotes" || "baseNotes", ' '), '')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) stored;

create index if not exists product_search_vector_idx
  on "Product" using gin (search_vector);

-- Trigram index for the prefix/typo tolerance `fold()` provides client-side.
create index if not exists product_name_trgm_idx
  on "Product" using gin (name gin_trgm_ops);

-- HNSW over cosine distance — the index that replaces the brute-force loop in
-- rankSemantic(). `vector_cosine_ops` because the vectors are normalised and
-- cosineSimilarity() is what the TypeScript side compares with.
create index if not exists product_embedding_idx
  on "Product" using hnsw (embedding vector_cosine_ops);

-- ── Hybrid search ───────────────────────────────────────────
--
-- Reciprocal Rank Fusion, identical to src/lib/search/fuse.ts:
--
--     score(d) = Σ over rankings  weight / (K + rank(d))
--
-- Ranks rather than scores, because a ts_rank and a cosine distance share no
-- scale and any normalisation between them would be invented.
--
-- `security invoker` so the caller's RLS applies (a `security definer` function
-- would hand every caller the owner's visibility), and `search_path = ''` so a
-- crafted schema on the caller's path cannot shadow the objects named inside.

create or replace function hybrid_search_products(
  query_text text,
  query_embedding vector(1536),
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
      row_number() over (order by embedding <=> query_embedding) as rank
    from public."Product"
    where embedding is not null
      -- `<=>` is cosine *distance*; similarity is 1 - distance.
      and 1 - (embedding <=> query_embedding) >= similarity_floor
      and "isArchived" = false
      and "deletedAt" is null
    order by embedding <=> query_embedding
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

-- ── Row Level Security ──────────────────────────────────────
--
-- `public` is exposed through the Data API, so RLS is not optional. The catalog
-- is public *reading*; writes stay with the service role, which bypasses RLS.

alter table "Product" enable row level security;

create policy "Public catalog is readable"
  on "Product" for select
  to anon, authenticated
  using ("isArchived" = false and "deletedAt" is null);

-- ── Keeping embeddings fresh ────────────────────────────────
--
-- Editing a product invalidates its vector. The trigger nulls it; a scheduled
-- job re-embeds the nulls in batches. Same shape as `npm run embed -- --check`,
-- which is the guard against exactly this drift today.

create or replace function invalidate_product_embedding()
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

create trigger product_embedding_invalidation
  before update on "Product"
  for each row
  execute function invalidate_product_embedding();

-- select cron.schedule('embed-products', '*/5 * * * *', $$ … edge function … $$);
