-- KHEM — why a result matched (prompts/ai-search-redesign.md).
--
-- For each product a meaning-based search returned, the notes *that product
-- really contains* that are closest to what the visitor asked for: compared
-- through the bilingual glossary's embeddings (0075), plus any note the query
-- names outright. A note is claimed only if it clears `note_floor` AND sits
-- within `note_window` of that product's best note — so "oud" names Black Oud,
-- not the labdanum beside it. A weak result shows no "Matches" line at all
-- rather than a stretched one. Floor and window were calibrated on 2026-11-18
-- against real queries (src/lib/search/config.ts, NOTE_MATCH_FLOOR).
--
-- Only called when the semantic pass ran (`mode = 'hybrid'`); the query vector
-- never leaves the server — the app passes it straight from `semantic.ts`.
--
-- Idempotent. Applied directly with psql, like 0073–0075.

-- An earlier draft of this file (same day) had no window parameter.
drop function if exists public.search_match_notes(extensions.vector, text, text[], text, integer, double precision);

create or replace function public.search_match_notes(
  query_embedding extensions.vector,
  query_text      text,
  product_ids     text[],
  search_locale   text default 'en',
  per_product     integer default 3,
  note_floor      double precision default 0.22,
  note_window     double precision default 0.12
)
returns table (product_id text, notes text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select pg_catalog.lower(coalesce(query_text, '')) as en,
           public.ar_fold(coalesce(query_text, ''))    as ar
  ),
  product_notes as (
    select p.id as product_id, n.name as name_en, n.ord
      from public."Product" p,
           unnest(p."topNotes" || p."heartNotes" || p."baseNotes") with ordinality as n(name, ord)
     where p.id = any(product_ids)
       and p."isArchived" = false
       and p."deletedAt" is null
  ),
  scored as (
    select pn.product_id,
           case when search_locale = 'ar' then coalesce(f.name_ar, pn.name_en) else pn.name_en end as label,
           -- The query names the note outright, in either language.
           (q.en like '%' || pg_catalog.lower(pn.name_en) || '%'
             or (f.name_ar is not null
                 and pg_catalog.length(public.ar_fold(f.name_ar)) >= 2
                 and q.ar like '%' || public.ar_fold(f.name_ar) || '%')) as literal,
           case when f.embedding is null or query_embedding is null then 0
                else 1 - (f.embedding OPERATOR(extensions.<=>) query_embedding) end as similarity,
           pn.ord
      from product_notes pn
      join public.fragrance_notes f on f.name_en = pn.name_en
      cross join q
  ),
  best as (
    select product_id, label, literal, similarity, ord,
           max(similarity) over (partition by product_id) as top
      from scored
  ),
  kept as (
    select product_id, label, literal, similarity, ord,
           row_number() over (
             partition by product_id
             order by literal desc, similarity desc, ord
           ) as rnk
      from best
     where literal
        or (similarity >= note_floor and similarity >= top - note_window)
  )
  select product_id, array_agg(label order by rnk) as notes
    from kept
   where rnk <= least(greatest(per_product, 1), 5)
   group by product_id;
$$;

revoke execute on function public.search_match_notes(extensions.vector, text, text[], text, integer, double precision, double precision)
  from public;
grant execute on function public.search_match_notes(extensions.vector, text, text[], text, integer, double precision, double precision)
  to anon, authenticated, service_role;
