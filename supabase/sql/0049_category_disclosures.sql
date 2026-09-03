-- KHEM — a category disclosure prints its own shelf.
-- Applied by `npm run db:migrate`, after `0048_navigation.sql`. Every statement
-- is idempotent.
--
-- ## What was still manual
--
-- 0048 made the menu editable: a collection could be linked without a deploy.
-- It did not make it *automatic*. Creating "Body Cream" under Body Care still
-- meant a second act — opening Navigation and adding a row — and a menu that has
-- to be told about a collection is a menu that will eventually be out of date
-- about one.
--
-- The three disclosures in the Collections column were `GROUP` rows: a heading
-- from the dictionary, over a hand-kept list of children. That is the right
-- shape for "Scent Profiles", which names five pages the code owns and the
-- database knows nothing about. It is the wrong shape for "Body Care", which
-- names a shelf the database knows the contents of exactly.
--
-- So those three become `CATEGORY` rows. A category disclosure resolves its
-- children as: the entries an editor placed by hand, then every remaining
-- collection assigned to that category (`resolveNavigation()` in
-- `src/schemas/db/navigation.ts`). Assign a collection to Home Fragrances and it
-- is in the menu and the footer on the next render, in catalogue order, in both
-- languages.
--
-- ## Nothing visible changes today
--
-- Each heading keeps its wording because a category's `name` and `name_ar` are
-- already what the dictionary said: "Fragrances" / العطور, "Body Care" /
-- العناية بالجسم, "Home Fragrances" / عطور المنزل. And the existing children are
-- left exactly where they are — "Signature Collection" keeps the wording and the
-- description the menu has always printed, because an explicit row outranks the
-- automatic pass. The automatic entries fill in *behind* them.
--
-- `scentProfiles` is deliberately untouched. It is not a category and has no
-- shelf to read.

-- ── The three headings become their categories ────────────────
--
-- Guarded on `"targetType" = 'GROUP'`, so a second apply matches nothing, and on
-- the id, so a heading an editor has since replaced is left alone.
--
-- `"groupKey"` is cleared in the same statement: the check constraint
-- `nav_link_target_matches_type` requires exactly one target, so a row claiming
-- to be a CATEGORY while still carrying a group key is refused — which is the
-- constraint doing its job rather than an obstacle to work around.

update public."NavLink"
   set "targetType"   = 'CATEGORY',
       "categorySlug" = 'fragrances',
       "groupKey"     = null,
       "updatedAt"    = now()
 where id = 'nav-fragrances'
   and "targetType" = 'GROUP';

update public."NavLink"
   set "targetType"   = 'CATEGORY',
       "categorySlug" = 'body-care',
       "groupKey"     = null,
       "updatedAt"    = now()
 where id = 'nav-body-care'
   and "targetType" = 'GROUP';

update public."NavLink"
   set "targetType"   = 'CATEGORY',
       "categorySlug" = 'home-fragrance',
       "groupKey"     = null,
       "updatedAt"    = now()
 where id = 'nav-home-fragrance'
   and "targetType" = 'GROUP';

-- ── The explicit range rows are no longer needed ──────────────
--
-- `nav-body-mist` and `nav-room-spray` named the one collection each of those
-- two categories held. The automatic pass now prints exactly those rows, from
-- the collections themselves — so keeping them would mean the two ranges were
-- hand-listed while every collection added later was automatic, which is the
-- half-and-half state this file exists to remove.
--
-- Their descriptions go with them, and that is the honest trade: "The accords,
-- worn closer and lighter" was written for a menu row, and a menu that lists
-- what is on the shelf prints names. An editor who wants that line back adds a
-- row and gets it — an explicit entry still wins.
--
-- `nav-body-care-all` and `nav-home-fragrance-all` stay: "All Body Care" is the
-- category's own page, which no collection can stand in for.

delete from public."NavLink" where id in ('nav-body-mist', 'nav-room-spray');

-- ── Verification ──────────────────────────────────────────────
--
-- The three rows must be categories pointing at categories that exist. A
-- disclosure whose target vanished is dropped by the resolver rather than drawn
-- broken, so this would not break the header — it would silently shorten the
-- menu, which is worse to discover later than now.

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
    from public."NavLink" n
   where n.id in ('nav-fragrances', 'nav-body-care', 'nav-home-fragrance')
     and (n."targetType" <> 'CATEGORY'
       or not exists (
         select 1 from public."Category" c where c.slug = n."categorySlug"
       ));

  if v_bad > 0 then
    raise exception '0049: % category disclosure(s) did not convert.', v_bad;
  end if;
end
$$;
