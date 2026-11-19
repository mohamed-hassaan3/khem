-- KHEM — catalogue RPCs: build the costless Product row once, not once per column.
--
-- ## What was wrong (measured 2026-11-19, production, 29 products)
--
-- `hybrid_search_products` (0075) and `related_products` (0065) end with
--
--     select (pg_catalog.jsonb_populate_record(null::public."Product",
--               pg_catalog.to_jsonb(p) - 'costInCents')).*
--
-- Postgres expands `(f(x)).*` by calling `f` once **per output column**.
-- "Product" has 43 columns, one of them a 1536-float embedding, so every result
-- row serialised the whole row to JSON 43 times. `EXPLAIN ANALYZE` of one
-- search: 460 ms of execution for 8 rows; through PostgREST, 350–730 ms per
-- search with a query vector — more than half of every search's server time.
--
-- ## What this does
--
-- The same projection through `cross join lateral … as r` and `select r.*`,
-- which evaluates it once per row. Bodies are otherwise verbatim from 0075
-- (`hybrid_search_products`) and 0065 (`related_products`), checked against the
-- live definitions with `pg_get_functiondef()` on 2026-11-19. Signatures,
-- `security definer`, the empty `search_path`, the archived/deleted predicates
-- and the `costInCents` strip are unchanged; CREATE OR REPLACE keeps grants.
-- Results are identical (verified in a rolled-back transaction: same ids, same
-- order, for EN, AR and vector/no-vector calls).
--
-- Idempotent. Apply directly with `psql --single-transaction`, like 0073–0077
-- (the gated 0072b stays unrun — see supabase/README.md). PostgREST needs no
-- schema reload: no signature changes.

-- ── related_products ────────────────────────────────────────

create or replace function public.related_products(
  product_slug text,
  match_limit  int default 3,
  kinds public."CollectionKind"[] default '{FRAGRANCE}'
)
returns setof public."Product"
language sql
stable
security definer
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
  select r.*
  from public."Product" p
  join public."Collection" c on c.slug = p."collectionSlug"
  cross join source s
  cross join lateral pg_catalog.jsonb_populate_record(
    null::public."Product",
    pg_catalog.to_jsonb(p) - 'costInCents'
  ) as r
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

-- ── hybrid_search_products ──────────────────────────────────

create or replace function public.hybrid_search_products(
  query_text text,
  query_embedding extensions.vector,
  match_limit integer default 20,
  rrf_k integer default 60,
  full_text_weight double precision default 1,
  semantic_weight double precision default 1,
  similarity_floor double precision default 0.20,
  search_locale text default 'en'
)
returns setof public."Product"
language sql
stable
security definer
set search_path = ''
as $$
  with config as (
    select
      -- Arabic page, or an Arabic query on any page.
      (search_locale = 'ar' or query_text ~ '[ء-ي]') as is_ar
  ),
  q as (
    select
      c.is_ar,
      case when c.is_ar then 'simple' else 'english' end::regconfig as ts_config,
      case when c.is_ar then public.ar_fold(query_text) else query_text end as text
    from config c
  ),
  full_text as (
    select
      p.id,
      row_number() over (
        order by ts_rank_cd(
          case when q.is_ar then p.search_vector_ar else p.search_vector end,
          websearch_to_tsquery(q.ts_config, q.text)
        ) desc
      ) as rank
    from public."Product" p
    cross join q
    where (case when q.is_ar then p.search_vector_ar else p.search_vector end)
            @@ websearch_to_tsquery(q.ts_config, q.text)
      and p."isArchived" = false
      and p."deletedAt" is null
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
      and 1 - (embedding OPERATOR(extensions.<=>) query_embedding) >= similarity_floor
      and "isArchived" = false
      and "deletedAt" is null
    order by embedding OPERATOR(extensions.<=>) query_embedding
    limit least(match_limit * 4, 200)
  )
  select r.*
  from full_text
  full outer join semantic on full_text.id = semantic.id
  join public."Product" p on p.id = coalesce(full_text.id, semantic.id)
  cross join lateral pg_catalog.jsonb_populate_record(
    null::public."Product",
    pg_catalog.to_jsonb(p) - 'costInCents'
  ) as r
  order by
    coalesce(full_text_weight / (rrf_k + full_text.rank), 0) +
    coalesce(semantic_weight / (rrf_k + semantic.rank), 0) desc,
    p.id
  limit match_limit;
$$;
