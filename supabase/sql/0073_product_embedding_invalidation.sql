-- KHEM — product embeddings that persist.
--
-- ## The defect this replaces (0004_search.sql)
--
-- `product_embedding_invalidation` was a BEFORE UPDATE trigger:
--
--     if new.search_document is distinct from old.search_document then
--       new.embedding := null;
--
-- `search_document` is a STORED generated column, and Postgres computes those
-- *after* BEFORE triggers run. Inside the trigger `new.search_document` was
-- therefore always NULL, the test was always true, and every UPDATE nulled the
-- vector — including the UPDATE that wrote it. No product embedding ever
-- persisted (0 of 29 on Tokyo, 0 of 28 on Frankfurt), so product search has
-- only ever been lexical.
--
-- ## Why not the article fix (0009_journal.sql)
--
-- The article trigger keeps the BEFORE timing and adds a guard: do not null
-- when this statement changed the embedding. That is enough for articles, which
-- nothing but an editor updates. Product rows are updated by every sale,
-- restock and stock movement (0015, 0016, 0042, 0071, …). Those statements do
-- not touch the embedding, so the guard would still null the vector, and every
-- sale would silently drop that product back to lexical search.
--
-- ## The fix: AFTER UPDATE, gated on the real text
--
-- In an AFTER trigger `NEW.search_document` holds the computed value, so the
-- WHEN clause compares the actual text before and after. Stock, price, image
-- and status updates never reach the function at all. When the text did change
-- and the same statement did not also store a fresh vector, the function nulls
-- the stale one with a nested UPDATE; that UPDATE leaves `search_document`
-- unchanged, so the WHEN clause is false for it and nothing recurses.
--
-- Idempotent: safe to apply directly now and again later through
-- `npm run db:migrate` (see supabase/README.md, "Migrations applied out of order").

create or replace function public.invalidate_product_embedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  embedding_changed boolean;
begin
  /*
   * Null-safe and schema-qualified, for the same reason as in 0009: the empty
   * search_path cannot find pgvector's `=`, which lives in `extensions`.
   */
  embedding_changed :=
    (new.embedding is null) <> (old.embedding is null)
    or (
      new.embedding is not null
      and old.embedding is not null
      and not (new.embedding OPERATOR(extensions.=) old.embedding)
    );

  -- The statement changed the text *and* stored a vector for it: keep it.
  if embedding_changed or new.embedding is null then
    return null;
  end if;

  update public."Product"
     set embedding = null
   where id = new.id;

  return null;
end;
$$;

drop trigger if exists product_embedding_invalidation on public."Product";
create trigger product_embedding_invalidation
  after update on public."Product"
  for each row
  when (old.search_document is distinct from new.search_document)
  execute function public.invalidate_product_embedding();
