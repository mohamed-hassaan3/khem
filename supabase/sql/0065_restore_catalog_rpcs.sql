-- KHEM — restore the two catalogue RPCs broken by the cost-column grant.
--
-- Fixes finding **F15** (`src/docs/SECURITY-AUDIT-STAGE-3.md`): since `0062`,
-- `related_products()` and `hybrid_search_products()` have answered
--
--     42501  permission denied for table Product
--
-- to the `anon` role. The consequences were invisible because both call sites
-- degrade quietly: the "you may also like" rail renders empty on every product
-- page, and search has been running permanently on its in-memory lexical
-- fallback (`src/services/search.ts:146`) — so pgvector, `npm run embed` and the
-- AI Gateway have contributed nothing to production results.
--
--
-- ## Why they broke
--
-- `0062_sales_ledger.sql` added `"Product"."costInCents"` and correctly decided
-- the browser must not read it. Because Postgres will not let a column-level
-- revoke undercut a table-level grant, it took the table grant back and re-granted
-- every column except that one.
--
-- Both functions `return setof public."Product"` and are `security invoker`. An
-- invoker function returning the whole row type must read **every** column as
-- the calling role — so the moment `anon` lost one column, the functions stopped
-- returning anything at all. The grant was right; the row type was the casualty.
--
--
-- ## Why the obvious fix is wrong
--
-- Marking them `security definer` makes them run again — and **leaks the cost**.
-- Measured, not assumed: with a `security definer` probe of the same shape,
-- inside a rolled-back transaction, as `anon`:
--
--     select slug, "costInCents" from probe()
--     → {"slug":"sunlit-citrine","costInCents":60000}
--
-- Column privileges apply to *tables*, not to a function's output rows, so
-- PostgREST's `?select=costInCents` would read the margin straight back out.
-- That would undo the whole point of `0062`.
--
-- Narrowing the return type to an explicit column list avoids the leak but
-- breaks the callers a different way: `PRODUCT_CARD_COLUMNS`
-- (`src/schemas/db/catalog.ts:514`) relies on PostgREST *embedding* —
-- `collection:Collection!inner(...)` and `images:ProductImage(...)` — and
-- embedding needs a real table type so PostgREST can follow the foreign keys.
--
--
-- ## What this does instead
--
-- Keep `setof public."Product"` (so embedding still works), take `security
-- definer` (so the function can read the row), and **strip the cost from the
-- rows on the way out**:
--
--     jsonb_populate_record(null::public."Product", to_jsonb(p) - 'costInCents')
--
-- The row is rebuilt from its own JSON with that one key removed, so
-- `costInCents` comes back `null` for every caller of these two functions,
-- whatever they ask for. Verified as `anon` against the one product that
-- actually carries a cost:
--
--     {"slug":"sunlit-citrine","priceInCents":147000,"costInCents":null}
--
-- **By name, not by position.** A future `alter table "Product" add column`
-- flows through untouched and only `costInCents` is ever dropped — the same
-- property `0062` was careful to give its grant list, and for the same reason:
-- a positional column list here would turn every future migration into a silent
-- breakage.
--
-- ⚠ `security definer` means these two run as the owner and therefore **bypass
-- RLS**. That is safe here only because both bodies filter
-- `"isArchived" = false and "deletedAt" is null` themselves, in every branch —
-- which they already did, and which is why the storefront never showed an
-- archived product through them. **If you edit either body, keep those
-- predicates.** They are now load-bearing rather than belt-and-braces.
--
-- `search_path` stays pinned to `''`; every reference below is schema-qualified.


-- ── related_products ────────────────────────────────────────
-- Body unchanged from `0014_ritual_detail_parity.sql` except the final
-- projection and the two lines of function attributes.

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
  select (pg_catalog.jsonb_populate_record(
            null::public."Product",
            pg_catalog.to_jsonb(p) - 'costInCents'
         )).*
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


-- ── hybrid_search_products ──────────────────────────────────
-- Body unchanged from `0008_i18n_content.sql` except the final projection and
-- the two lines of function attributes.

create or replace function public.hybrid_search_products(
  query_text        text,
  query_embedding   extensions.vector,
  match_limit       int    default 20,
  rrf_k             int    default 60,
  full_text_weight  float  default 1,
  semantic_weight   float  default 1,
  similarity_floor  float  default 0.28,
  search_locale     text   default 'en'
)
returns setof public."Product"
language sql
stable
security definer
set search_path = ''
as $$
  with config as (
    select
      case when search_locale = 'ar' then 'simple' else 'english' end::regconfig
        as ts_config,
      search_locale = 'ar' as is_ar
  ),
  full_text as (
    select
      p.id,
      row_number() over (
        order by ts_rank_cd(
          case when c.is_ar then p.search_vector_ar else p.search_vector end,
          websearch_to_tsquery(c.ts_config, query_text)
        ) desc
      ) as rank
    from public."Product" p
    cross join config c
    where (case when c.is_ar then p.search_vector_ar else p.search_vector end)
            @@ websearch_to_tsquery(c.ts_config, query_text)
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
  select (pg_catalog.jsonb_populate_record(
            null::public."Product",
            pg_catalog.to_jsonb(p) - 'costInCents'
         )).*
  from full_text
  full outer join semantic on full_text.id = semantic.id
  join public."Product" p on p.id = coalesce(full_text.id, semantic.id)
  order by
    coalesce(full_text_weight / (rrf_k + full_text.rank), 0) +
    coalesce(semantic_weight / (rrf_k + semantic.rank), 0) desc,
    p.id
  limit match_limit;
$$;


-- ── Grants ──────────────────────────────────────────────────
-- Restated because `create or replace` on a function whose signature is
-- unchanged keeps its grants, but a signature that ever drifts would not.
-- These two are deliberately callable by the public roles: they are the
-- storefront's search and its related-products rail.

grant execute on function public.related_products(
  text, int, public."CollectionKind"[]
) to anon, authenticated;

grant execute on function public.hybrid_search_products(
  text, extensions.vector, int, int, float, float, float, text
) to anon, authenticated;
