-- KHEM — the `/collections/[slug]` namespace, defended.
-- Applied by `npm run db:migrate`, after `0046_range_collections.sql`. Every
-- statement is idempotent.
--
-- ## The hole this closes
--
-- `/collections/[slug]` is resolved against four sources, in order: a
-- `"Category"` row, a `"Collection"` row, `MERCH_PAGE_FACETS` (`best-sellers`)
-- and `SCENT_PROFILE_SLUGS` (`oriental`, `floral`, `fresh`, `woody`,
-- `gourmand`). The last two are code-owned pages with rows of their own for
-- their copy, and nothing stopped an editor creating a collection called
-- `woody`. The database row would win the race, and a page that had been live
-- for months would disappear with no error anywhere — the dashboard would show
-- a saved collection and the storefront would show it too, at an address that
-- used to be something else.
--
-- Two rules, and they are enforced here rather than only in
-- `src/schemas/admin.ts`, because a Zod schema guards one form and a constraint
-- guards the table: a seed, a dump restore, a `psql` session and a future
-- second form are all covered by this and none of them by that. The Zod rule
-- stays as well — it is what produces a readable message in the field instead
-- of a 500.
--
-- ## Rule 1 — code-owned slugs are reserved
--
-- The list is exactly what `src/lib/facets.ts` and `src/lib/scent-profiles.ts`
-- own. It is *not* generated: adding a scent profile is already a two-sided
-- edit (a `"ScentProfile"` row and `SCENT_PROFILE_SLUGS`), and this is the third
-- side, deliberately visible in a migration.
--
-- `body-mist` and `room-spray` are absent, and that is the point of 0046: they
-- are real collections now, so reserving them would forbid the rows that own
-- them.
--
-- ## Rule 2 — a category and a collection may not share a slug
--
-- They share one URL space, and the resolver tries categories first, so a
-- collection sitting behind a category of the same name would be unreachable
-- rather than wrong. Postgres has no cross-table unique constraint, so this is
-- a trigger on both sides.

-- ── Rule 1 ────────────────────────────────────────────────────

create or replace function public.slug_is_reserved(v_slug text)
returns boolean
language sql
immutable
as $$
  select v_slug in (
    -- Merchandising pages — `MERCH_PAGE_FACETS`.
    'best-sellers',
    -- Scent profiles — `SCENT_PROFILE_SLUGS`.
    'oriental', 'floral', 'fresh', 'woody', 'gourmand'
  );
$$;

alter table public."Collection"
  drop constraint if exists collection_slug_not_reserved;
alter table public."Collection"
  add constraint collection_slug_not_reserved
  check (not public.slug_is_reserved(slug));

alter table public."Category"
  drop constraint if exists category_slug_not_reserved;
alter table public."Category"
  add constraint category_slug_not_reserved
  check (not public.slug_is_reserved(slug));

-- ── Rule 2 ────────────────────────────────────────────────────

create or replace function public.slug_unique_across_namespace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'Category' then
    if exists (select 1 from public."Collection" where slug = new.slug) then
      raise exception
        'Slug % is already a collection. A category and a collection cannot share an address.',
        new.slug;
    end if;
  else
    if exists (select 1 from public."Category" where slug = new.slug) then
      raise exception
        'Slug % is already a category. A collection and a category cannot share an address.',
        new.slug;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists category_slug_unique_across_namespace on public."Category";
create trigger category_slug_unique_across_namespace
  before insert or update of slug on public."Category"
  for each row
  execute function public.slug_unique_across_namespace();

drop trigger if exists collection_slug_unique_across_namespace on public."Collection";
create trigger collection_slug_unique_across_namespace
  before insert or update of slug on public."Collection"
  for each row
  execute function public.slug_unique_across_namespace();

-- ── Verification ──────────────────────────────────────────────
--
-- The triggers guard writes from here on; nothing guarded the rows already
-- there. If 0046 did not run — or ran against a database somebody had already
-- edited by hand — this says so now rather than at the first 404.

do $$
declare
  v_clash int;
begin
  select count(*) into v_clash
    from public."Category" cat
    join public."Collection" col on col.slug = cat.slug;

  if v_clash > 0 then
    raise exception
      '0047: % slug(s) are both a category and a collection. Resolve before continuing.',
      v_clash;
  end if;
end
$$;
