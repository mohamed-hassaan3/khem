-- KHEM — Arabic content columns.
--
-- Applied by `npm run db:migrate`, which runs every `supabase/sql/NNNN_*.sql` in
-- filename order inside one transaction. Every statement is `add column if not
-- exists` / `create index if not exists`, so a second run is a no-op.
--
-- ── What this file is for ───────────────────────────────────
--
-- `0001`–`0003` landed the catalog, the editorial content, and the directory as
-- English-only tables. The site itself is bilingual — `src/lib/i18n/` and the
-- `[locale]` route tree serve an Arabic chrome — but every *record* rendered
-- inside that chrome was English, which is what left `/ar` half-translated.
--
-- ── Storage: sibling `_ar` columns ──────────────────────────
--
-- Each translatable column `foo` gains a nullable `foo_ar` of the same type
-- beside it. Not a `Product_i18n` join table, and not `jsonb` per field:
--
--   * Non-translatable attributes (`id`, `slug`, `sku`, urls, enums, numbers,
--     dates, booleans, `sortOrder`) stay single-sourced on one row, so the two
--     language trees cannot drift in identity, price, or order — the failure a
--     duplicated-row-per-locale design invites.
--   * Column-level typing survives, which `jsonb` would cost, and the generated
--     search columns below can read the Arabic text directly.
--
-- The trade is that a third language means another column sweep. Accepted.
--
-- ── Nullable, and deliberately not backfilled ───────────────
--
-- Every column here is nullable with no default, and none is seeded with a copy
-- of its English value. `src/lib/i18n/resolve.ts` falls back to English when the
-- Arabic value is null or blank, so a null renders correctly; backfilling would
-- make a real translation indistinguishable from a missing one and leave
-- `npm run db:verify` unable to report coverage.
--
-- ── What is NOT translated, and why ─────────────────────────
--
--   * `Product.name`, and house range names (`Signature`, `Noir`, `Egyptica`) —
--     proper nouns, kept in Latin script on `/ar` by luxury-house convention.
--     `Collection.name_ar` exists all the same because some collections are
--     categories rather than ranges (`Body Care`, `Gift Sets`); those get Arabic
--     and the ranges stay null.
--   * `Ingredient.latinName` — a botanical binomial is Latin in every language.
--   * `slug`, `sku`, `id` — identity. Localizing a slug would fork the URL space
--     and break `localeAlternates()`.
--   * `href`, `phoneHref`, `mapsUrl`, `url` — targets, never display text. A
--     localized value reaching an href is the thing this design rules out
--     structurally rather than by review.
--   * `EnquirySubject.label` — the primary key *and* the value validated in the
--     contact Server Action against `src/constants/contact.ts` before it lands
--     in a mail header. `label_ar` is the `<option>` text only; the submitted
--     value stays the English key. See `0003_directory.sql`.
--   * `IngredientFamily.name` and `Article.category` — filter predicates, and in
--     the family's case the target of `assert_ingredient_families()`. The key
--     stays English and `label_ar` / `category_ar` carry the display text, so a
--     translation typo cannot create an unfilterable eighth family.
--   * Enums, `priceInCents`, `volumeMl`, dates, `readTimeMinutes`, `sortOrder` —
--     data, formatted at render by `src/lib/format.ts` (Western digits, per the
--     `ar-EG-u-nu-latn` decision already implemented there).

-- ── Catalog (0001) ──────────────────────────────────────────

alter table public."Collection"
  add column if not exists name_ar        text,
  add column if not exists description_ar text,
  add column if not exists "bannerAlt_ar" text;

alter table public."Product"
  add column if not exists subtitle_ar    text,
  add column if not exists description_ar text,
  add column if not exists story_ar       text,
  add column if not exists format_ar      text,
  add column if not exists badge_ar       text,
  add column if not exists includes_ar    text[],
  add column if not exists "topNotes_ar"   text[],
  add column if not exists "heartNotes_ar" text[],
  add column if not exists "baseNotes_ar"  text[];

alter table public."ProductImage"
  add column if not exists alt_ar text;

-- ── Editorial content (0002) ────────────────────────────────

alter table public."Testimonial"
  add column if not exists quote_ar         text,
  add column if not exists author_ar        text,
  add column if not exists "authorTitle_ar" text;

-- Display label only. `name` remains the key the trigger validates against.
alter table public."IngredientFamily"
  add column if not exists label_ar text;

alter table public."Ingredient"
  add column if not exists name_ar        text,
  add column if not exists origin_ar      text,
  add column if not exists rarity_ar      text,
  add column if not exists description_ar text,
  add column if not exists facts_ar       text[],
  add column if not exists "imageAlt_ar"  text;

-- `body_ar` pairs with the `body` column `0009_journal.sql` adds for the article
-- detail page. Nullable here rather than `not null default ''` like its English
-- twin: an untranslated essay must fall back to the English body, and `''` would
-- render a detail page with a hero and no essay under it.
alter table public."Article"
  add column if not exists title_ar      text,
  add column if not exists category_ar   text,
  add column if not exists excerpt_ar    text,
  add column if not exists body_ar       text,
  add column if not exists "imageAlt_ar" text;

-- `year` is display text ("3000 BC"), not a date — so it translates ("3000 ق.م")
-- while keeping Western digits.
alter table public."TimelineEvent"
  add column if not exists year_ar        text,
  add column if not exists title_ar       text,
  add column if not exists description_ar text;

alter table public."BrandValue"
  add column if not exists title_ar       text,
  add column if not exists description_ar text;

alter table public."MissionStatement"
  add column if not exists label_ar text,
  add column if not exists title_ar text,
  add column if not exists text_ar  text;

-- `number` ("01") is an ordinal in Western digits in both trees.
alter table public."CraftPillar"
  add column if not exists title_ar       text,
  add column if not exists description_ar text;

alter table public."CraftStep"
  add column if not exists title_ar      text,
  add column if not exists subtitle_ar   text,
  add column if not exists body_ar       text,
  add column if not exists "imageAlt_ar" text;

-- `value_ar` is for the figures that carry a word; "300+" and "100%" stay null
-- and fall back, because they read identically in both scripts.
alter table public."CraftStat"
  add column if not exists value_ar text,
  add column if not exists label_ar text;

alter table public."CraftQuote"
  add column if not exists quote_ar         text,
  add column if not exists author_ar        text,
  add column if not exists "authorTitle_ar" text;

-- ── Directory (0003) ────────────────────────────────────────

alter table public."Stockist"
  add column if not exists name_ar       text,
  add column if not exists city_ar       text,
  add column if not exists country_ar    text,
  add column if not exists address_ar    text,
  add column if not exists hours_ar      text,
  add column if not exists "imageAlt_ar" text;

-- `href` is untouched: it is a `mailto:` / `tel:` target, not display text.
alter table public."ContactChannel"
  add column if not exists label_ar text,
  add column if not exists value_ar text;

-- `<option>` text only — see the header. `label` remains the primary key and the
-- value the Server Action validates.
alter table public."EnquirySubject"
  add column if not exists label_ar text;

alter table public."LegalDocument"
  add column if not exists eyebrow_ar     text,
  add column if not exists title_ar       text,
  add column if not exists lede_ar        text,
  add column if not exists "bannerAlt_ar" text,
  add column if not exists sections_ar    jsonb;

-- Same shape guarantee the English column carries. Written as a separate
-- statement with a guard because `add constraint if not exists` does not exist.
do $$ begin
  alter table public."LegalDocument"
    add constraint legal_sections_ar_is_array
    check (sections_ar is null or jsonb_typeof(sections_ar) = 'array');
exception when duplicate_object then null; end $$;

-- ── Arabic full-text search (extends 0004) ──────────────────
--
-- `0004_search.sql` says "keep the two sides in step" about the SQL index and
-- `src/lib/search/`. There are now three artefacts, and this is the third.
--
-- ⚠ Two honest limits of Arabic search here:
--
--   1. Postgres ships no Arabic stemmer or stop-word list, so the configuration
--      is `simple`: tokens are lowercased and indexed verbatim, with no
--      stemming. An Arabic query matches on surface form. `english` would be
--      actively wrong — it would stem Arabic tokens against English rules.
--   2. The pgvector `embedding` column stays English-sourced. Semantic search
--      on `/ar` therefore rides on the English document, and only the lexical
--      pass is genuinely Arabic. Re-embedding the catalog per locale is a
--      separate job with its own provider cost; it is not silently pretended to
--      here, and `hybrid_search_products` still fuses whatever both passes
--      return.
--
-- Every source column coalesces Arabic over English, mirroring
-- `resolveText()`: a product with no Arabic copy stays findable on `/ar` by its
-- English text rather than dropping out of the index.

alter table public."Product"
  add column if not exists search_document_ar text
    generated always as (
      coalesce(name, '') || '. ' ||
      coalesce(subtitle_ar, subtitle, '') || '. ' ||
      coalesce(public.join_text(coalesce("topNotes_ar", "topNotes"), ', '), '') || ' ' ||
      coalesce(public.join_text(coalesce("heartNotes_ar", "heartNotes"), ', '), '') || ' ' ||
      coalesce(public.join_text(coalesce("baseNotes_ar", "baseNotes"), ', '), '') || '. ' ||
      coalesce(description_ar, description, '') || ' ' ||
      coalesce(story_ar, story, '')
    ) stored;

-- Same A/B/C weighting as `search_vector`, so relevance does not visibly shift
-- between the two trees. `'simple'::regconfig` for the immutability reason
-- `0004_search.sql` documents at length.
alter table public."Product"
  add column if not exists search_vector_ar tsvector
    generated always as (
      setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple'::regconfig,
        coalesce(subtitle_ar, subtitle, '')), 'B') ||
      setweight(to_tsvector('simple'::regconfig,
        coalesce(public.join_text(
          coalesce("topNotes_ar", "topNotes") ||
          coalesce("heartNotes_ar", "heartNotes") ||
          coalesce("baseNotes_ar", "baseNotes"), ' '), '')), 'B') ||
      setweight(to_tsvector('simple'::regconfig,
        coalesce(description_ar, description, '')), 'C')
    ) stored;

create index if not exists product_search_vector_ar_idx
  on public."Product" using gin (search_vector_ar);

-- ── Locale-aware hybrid search ──────────────────────────────
--
-- `hybrid_search_products` gains a trailing `search_locale` argument. Dropped
-- and recreated rather than overloaded: two functions differing only by a
-- defaulted trailing parameter make a seven-argument call ambiguous, and
-- PostgREST resolves overloads by argument *name*, which would pick one
-- unpredictably.
--
-- The body is otherwise `0004_search.sql`'s verbatim — same RRF, same weights,
-- same degradation behaviour. Only which tsvector and which configuration the
-- full-text CTE reads depends on the locale.

drop function if exists public.hybrid_search_products(
  text, extensions.vector, int, int, float, float, float
);

create or replace function public.hybrid_search_products(
  query_text text,
  query_embedding extensions.vector(1536),
  match_limit int default 20,
  rrf_k int default 60,
  full_text_weight float default 1,
  semantic_weight float default 1,
  similarity_floor float default 0.28,
  -- 'en' or 'ar'. Anything else is treated as 'en' rather than erroring: this is
  -- a relevance input, and a bad value should degrade the ranking, not 500 the
  -- search page.
  search_locale text default 'en'
)
returns setof public."Product"
language sql
stable
security invoker
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

grant execute on function public.hybrid_search_products(
  text, extensions.vector, int, int, float, float, float, text
) to anon, authenticated;

-- ── Row Level Security ──────────────────────────────────────
--
-- Nothing to do. This file adds columns to tables that already have RLS
-- enabled and a select policy; a new column inherits the row's visibility.
-- `0006_privileges.sql` remains the sole owner of grants on these tables, and
-- the column-level grants there are `grant select on <table>`, which covers
-- columns added later.
