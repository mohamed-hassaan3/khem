-- KHEM — journal article bodies and vector-ranked related reading.
--
-- Applied by `npm run db:migrate`. Idempotent, like every file here.
--
-- Two things `0002_content.sql` left out, because until now the journal had no
-- detail page to need them:
--
--   1. `body` — the article itself. `excerpt` is the card's passage, not the
--      essay, and a detail page that renders only an excerpt is a card with
--      more whitespace.
--   2. An embedding, and the function that ranks against it. `related_articles()`
--      is the twin of `related_products()` in `0004_search.sql`: same extension
--      schema, same cosine operator, same "degrade to an editorial ordering
--      when no vector exists" contract.
--
-- The vector extension is installed by `0004_search.sql`, which runs first.
-- This file names `extensions.vector` on the same reasoning stated there: the
-- functions run with `search_path = ''`, so every type and operator is written
-- out in full rather than resolved against whatever the caller's path happens
-- to be.

-- ── Body ────────────────────────────────────────────────────
--
-- One `text` column, not a block table. The storefront parses it in
-- `src/lib/journal/body.ts`: blank lines separate blocks, `## ` opens a
-- subheading, `> ` opens a pull quote. Deliberately not HTML — nothing stored
-- here is ever injected as markup, so an editor cannot put a script tag on the
-- storefront by typing one into the dashboard.
--
-- `default ''` rather than nullable: "no body yet" and "an empty body" are the
-- same state to every reader of this column, and one of them would otherwise
-- need a null check at every call site.

alter table public."Article"
  add column if not exists body text not null default '';

-- ── Search document and embedding ───────────────────────────
--
-- The article's twin of `"Product".search_document`. Title and category carry
-- the most signal per word, the excerpt states the thesis, the body supplies
-- the vocabulary — all four are what a reader means by "another essay like this
-- one", so all four are embedded.

alter table public."Article"
  add column if not exists search_document text
    generated always as (
      coalesce(title, '') || '. ' ||
      coalesce(category, '') || '. ' ||
      coalesce(excerpt, '') || ' ' ||
      coalesce(body, '')
    ) stored;

-- Must match EMBEDDING_DIMENSIONS in `src/lib/search/config.ts`, exactly as the
-- product column must. Changing the model to one of a different width is an
-- ALTER on both columns plus a full re-embed.
alter table public."Article"
  add column if not exists embedding extensions.vector(1536);

create index if not exists article_embedding_idx
  on public."Article" using hnsw (embedding extensions.vector_cosine_ops);

-- ── Related articles ────────────────────────────────────────
--
-- The "Continue Reading" rail at the foot of `/journal/[slug]`, ranked by what
-- an essay is actually about rather than by which category tab it was filed
-- under — so the piece on sourcing oud can surface the piece on sourcing
-- saffron even though one is filed under Ingredients and the other under
-- Heritage.
--
-- Degrades rather than empties, the same way `related_products()` does. Until
-- `npm run embed` has run, every vector is null and the ordering falls through
-- to same-category-first, newest-first — a perfectly reasonable editorial rail,
-- which is what keeps the section full on a fresh database.
--
-- `security invoker` so the caller's RLS decides what is visible: a
-- `security definer` function here would serve unpublished drafts to anonymous
-- readers. The explicit `"isPublished"` predicates say the same thing a second
-- time, on purpose — the rail must not depend on a policy staying unchanged.

create or replace function public.related_articles(
  article_slug text,
  match_limit int default 3
)
returns setof public."Article"
language sql
stable
security invoker
set search_path = ''
as $$
  with source as (
    select slug, embedding, category
    from public."Article"
    where slug = article_slug
      and "isPublished"
  )
  select a.*
  from public."Article" a
  cross join source s
  where a.slug <> s.slug
    and a."isPublished"
  order by
    -- Rows with a comparable vector first (false sorts before true), then by
    -- cosine distance, then by the editorial fallback.
    (a.embedding is null or s.embedding is null),
    case
      when a.embedding is not null and s.embedding is not null
      then a.embedding OPERATOR(extensions.<=>) s.embedding
    end nulls last,
    (a.category <> s.category),
    a."publishedAt" desc,
    a.slug
  limit match_limit;
$$;

-- ── Keeping embeddings fresh ────────────────────────────────
--
-- Editing an article invalidates its vector: the trigger nulls it, and
-- `npm run embed` re-embeds the nulls in batches.
--
-- ⚠ Note the second condition, which the product trigger in `0004_search.sql`
-- does not have. Postgres computes STORED generated columns *after* BEFORE
-- triggers, so `new.search_document` is NULL inside a BEFORE UPDATE trigger and
-- `is distinct from old.search_document` is therefore always true. Without the
-- guard, the statement that writes a freshly computed embedding would have that
-- embedding nulled out again before the row was stored, and no vector could
-- ever persist. Comparing the embeddings themselves is what distinguishes "the
-- editor changed the text" from "we are storing the vector for that text".
--
-- The product trigger has the same defect and is deliberately left alone here;
-- fixing it is a change to the catalog's behaviour and belongs in its own pass.

create or replace function public.invalidate_article_embedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  embedding_changed boolean;
begin
  /*
   * Written out rather than `new.embedding is distinct from old.embedding`,
   * which cannot be used here at all: `is distinct from` resolves the type's
   * equality operator through the search path, this function runs with an empty
   * one, and pgvector's `=` lives in `extensions`. The bare form fails at
   * runtime with "operator does not exist: extensions.vector =
   * extensions.vector" — on the seed, on every admin save, on anything that
   * updates an article.
   */
  embedding_changed :=
    (new.embedding is null) <> (old.embedding is null)
    or (
      new.embedding is not null
      and old.embedding is not null
      and not (new.embedding OPERATOR(extensions.=) old.embedding)
    );

  if new.search_document is distinct from old.search_document
     and not embedding_changed then
    new.embedding := null;
  end if;

  return new;
end;
$$;

drop trigger if exists article_embedding_invalidation on public."Article";
create trigger article_embedding_invalidation
  before update on public."Article"
  for each row
  execute function public.invalidate_article_embedding();

-- Reads the articles the caller can already read; writes nothing. No new grant
-- on `"Article"` itself — `0002_content.sql` owns that, and the publication
-- policy it created is what keeps drafts out of the rail.
grant execute on function public.related_articles(text, int) to anon, authenticated;
