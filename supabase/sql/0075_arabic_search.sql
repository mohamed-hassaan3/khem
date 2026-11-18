-- KHEM — Arabic search that finds Arabic words (prompts/arabic-search-fix.md).
--
-- ## What was wrong (measured 2026-11-18)
--
-- `search_vector_ar` (0008) tokenises the Arabic copy with the `simple`
-- configuration, which keeps every word whole. The copy writes notes with the
-- article — «العود», «العنبر», «الورد» — so a visitor typing the bare word
-- «عود» never matched it: 0 keyword hits for «عود» although it appears in three
-- products, 0 for «ورد» although it appears eighteen times.
--
-- ## What this does
--
-- 1. `ar_fold(text)`: one normaliser, applied to the index AND the query, so
--    the two always agree. It strips diacritics (tashkeel) and tatweel, unifies
--    the alef forms, «ى» → «ي» and «ة» → «ه», and removes a leading article
--    from each word — «ال», «وال» «فال» «بال» «كال», and «لل».
-- 2. `search_vector_ar` is rebuilt from folded text. A generated column's
--    expression cannot be altered in place, so the column and its index are
--    dropped and re-added; the rest of the row is untouched.
-- 3. `hybrid_search_products` picks the Arabic index whenever the *query* is
--    written in Arabic, not only on `/ar`, and folds the query the same way.
--    Signature, security and grants are unchanged (0065's definer + the
--    `costInCents` projection are kept verbatim).
-- 4. `fragrance_notes`: one bilingual glossary of every note the catalogue
--    uses, seeded from the brand's own English/Arabic pairs on each product.
--    It feeds the AI search redesign's "Matches" lines and is embedded by
--    `npm run embed`.
--
-- Idempotent. Applied directly with psql (the gated 0072b stays unrun — see
-- supabase/README.md, "Migrations applied out of order").

-- ── 1. The normaliser ───────────────────────────────────────

create or replace function public.ar_fold(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(
             pg_catalog.translate(
               pg_catalog.regexp_replace(coalesce(input, ''), '[ً-ْٰـ]', '', 'g'),
               'أإآٱىة',
               'اااايه'
             ),
             -- «لل» + word ("for the …") → the word.
             '(^|[^ء-ي])لل(?=[ء-ي]{2})', '\1', 'g'
           ),
           -- «ال», optionally preceded by و ف ب ك, at the start of a word.
           '(^|[^ء-ي])[وفبك]?ال(?=[ء-ي]{2})', '\1', 'g'
         );
$$;

-- ── 2. Rebuild the Arabic keyword index from folded text ────

drop index if exists public.product_search_vector_ar_idx;
alter table public."Product" drop column if exists search_vector_ar;

alter table public."Product"
  add column search_vector_ar tsvector
    generated always as (
      setweight(to_tsvector('simple'::regconfig, public.ar_fold(coalesce(name, ''))), 'A') ||
      setweight(to_tsvector('simple'::regconfig,
        public.ar_fold(coalesce(subtitle_ar, subtitle, ''))), 'B') ||
      setweight(to_tsvector('simple'::regconfig,
        public.ar_fold(coalesce(public.join_text(
          coalesce("topNotes_ar", "topNotes") ||
          coalesce("heartNotes_ar", "heartNotes") ||
          coalesce("baseNotes_ar", "baseNotes"), ' '), ''))), 'B') ||
      setweight(to_tsvector('simple'::regconfig,
        public.ar_fold(coalesce(description_ar, description, ''))), 'C')
    ) stored;

create index if not exists product_search_vector_ar_idx
  on public."Product" using gin (search_vector_ar);

-- ── 3. Script-aware, folded hybrid search ───────────────────

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

-- ── 4. The bilingual notes glossary ─────────────────────────

create table if not exists public.fragrance_notes (
  -- Exactly as products spell it ("Black Oud").
  name_en     text primary key check (char_length(name_en) between 1 and 80),
  -- The brand's Arabic for it («العود الأسود»); null until someone names it.
  name_ar     text check (name_ar is null or char_length(name_ar) between 1 and 80),
  aliases_ar  text[] not null default '{}',
  -- "name_en · name_ar", embedded by `npm run embed` (cohere/embed-v4.0, 1536 d).
  embedding   extensions.vector(1536),
  updated_at  timestamptz not null default now()
);

alter table public.fragrance_notes enable row level security;

-- Public catalogue copy, like the notes on the product pages themselves.
drop policy if exists "Fragrance notes are public" on public.fragrance_notes;
create policy "Fragrance notes are public"
  on public.fragrance_notes for select to anon, authenticated using (true);

revoke insert, update, delete, truncate, references, trigger on public.fragrance_notes
  from public, anon, authenticated;
grant select on public.fragrance_notes to anon, authenticated;
grant all on public.fragrance_notes to service_role;

-- Seed from the brand's own pairs: position i of `topNotes` ↔ `topNotes_ar`,
-- and the same for heart and base, where both arrays are the same length. The
-- most frequent Arabic rendering of a note wins; an existing name is kept.
with pairs as (
  select en, ar
    from public."Product" p,
         lateral (
           select t.en, t.ar from unnest(p."topNotes", p."topNotes_ar") as t(en, ar)
            where cardinality(p."topNotes") = cardinality(coalesce(p."topNotes_ar", '{}'))
           union all
           select t.en, t.ar from unnest(p."heartNotes", p."heartNotes_ar") as t(en, ar)
            where cardinality(p."heartNotes") = cardinality(coalesce(p."heartNotes_ar", '{}'))
           union all
           select t.en, t.ar from unnest(p."baseNotes", p."baseNotes_ar") as t(en, ar)
            where cardinality(p."baseNotes") = cardinality(coalesce(p."baseNotes_ar", '{}'))
         ) x
   where en is not null and ar is not null and btrim(ar) <> ''
),
ranked as (
  select en, ar, row_number() over (partition by en order by count(*) desc, ar) as r
    from pairs group by en, ar
)
insert into public.fragrance_notes (name_en, name_ar)
select en, ar from ranked where r = 1
on conflict (name_en) do update
  set name_ar = coalesce(public.fragrance_notes.name_ar, excluded.name_ar);

-- Every other note any product uses, unnamed for now.
insert into public.fragrance_notes (name_en)
select distinct n
  from public."Product" p,
       unnest(p."topNotes" || p."heartNotes" || p."baseNotes") as n
 where n is not null and btrim(n) <> ''
on conflict (name_en) do nothing;
