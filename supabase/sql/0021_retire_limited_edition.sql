-- KHEM — "Limited Edition" is withdrawn from the catalogue.
--
-- Applied by `npm run db:migrate` after `0001_catalog.sql` (the `ProductTag`
-- enum and the `Product` table) and `0012_merch_page.sql` (the `MerchPage`
-- table and its check constraint). Every statement is idempotent.
--
-- ── What is being removed ───────────────────────────────────
--
-- The cut, not just its label: the pill on the cards, the `?facet=` chip, the
-- `/collections/limited-edition` page, the dashboard tag, and the enum value
-- underneath all of them. `src/lib/facets.ts` no longer knows the facet exists,
-- so a `LIMITED_EDITION` left in a `tags` array would be a value nothing can
-- read and nothing can clear.
--
-- ── Why this file exists next to the edits in 0001 and 0012 ─
--
-- `scripts/db-migrate.ts` re-applies every file in filename order on every run
-- and keeps no history table, so a schema change is two things: an edit to the
-- file that created the thing, which is what a *fresh* database gets, and a
-- repair here, which is what an already-migrated one gets. Both guards below
-- make this file a no-op once it has done its work — including on the fresh
-- database, where `0001` has already created the narrowed enum.
--
-- ── Why the enum is recreated rather than altered ───────────
--
-- Postgres has no `alter type … drop value`. The type is renamed aside, a new
-- one created with the surviving value, and the column retyped through `text[]`
-- — which is why step 4 must have emptied the arrays first: the cast rejects
-- any element the new type does not list.

-- ── 1. The page ─────────────────────────────────────────────

delete from public."MerchPage" where slug = 'limited-edition';

alter table public."MerchPage"
  drop constraint if exists merch_page_known_slug;

alter table public."MerchPage"
  add constraint merch_page_known_slug check (slug in ('best-sellers'));

-- ── 2. The free-text badges ─────────────────────────────────
--
-- Three seeded products wear one. Matched by value rather than by slug so that
-- an editor's own copy — anything they have since typed into the field — is
-- left exactly as they typed it. Sapphire keeps the half of its badge that is
-- still true; the two Kyphi–Mendesian sets have nothing left to say.

update public."Product"
   set badge = 'New'
 where badge = 'New · Limited';

update public."Product"
   set badge_ar = 'جديد'
 where badge_ar = 'جديد · إصدار محدود';

update public."Product"
   set badge = null
 where badge = 'Limited';

update public."Product"
   set badge_ar = null
 where badge_ar = 'إصدار محدود';

-- ── 3. The tag, and the enum value under it ─────────────────
--
-- Both inside the guard: once the value is gone from the type, the array
-- literal in the `update` no longer casts and the statement is a syntax error
-- rather than a no-op. Nothing outside this block may name 'LIMITED_EDITION'
-- as a `ProductTag`, which is what makes the file safe to re-apply.

do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'ProductTag'
       and e.enumlabel = 'LIMITED_EDITION'
  ) then
    return;
  end if;

  update public."Product"
     set tags = array_remove(tags, 'LIMITED_EDITION'::public."ProductTag")
   where 'LIMITED_EDITION' = any(tags);

  alter table public."Product" alter column tags drop default;

  alter type public."ProductTag" rename to "ProductTag_old";

  create type public."ProductTag" as enum ('NEW_ARRIVAL');

  alter table public."Product"
    alter column tags type public."ProductTag"[]
    using tags::text[]::public."ProductTag"[];

  alter table public."Product" alter column tags set default '{}';

  drop type public."ProductTag_old";
end $$;
