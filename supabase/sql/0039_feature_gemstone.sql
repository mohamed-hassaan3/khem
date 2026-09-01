-- 0039 — Gemstone joins the featured collections
--
-- The home page's collections section is not a hardcoded list: it renders
-- whatever `getFeaturedCollections()` returns, which is every `"Collection"`
-- row with `isFeatured = true`, in `sortOrder`. Signature and Noir carried the
-- flag; Gemstone did not, which is the only reason it was missing from the
-- section — the collection, its banner and its products already exist.
--
-- So this is a data correction, not a schema change. No table, column, policy,
-- grant or function is touched. It is idempotent: re-running it sets a true
-- value to true.
--
-- The same flag is editable by the desk at `/admin/collections` (see
-- `CollectionForm`), so this file is the floor, not the authority — an editor
-- who un-features Gemstone tomorrow is making a merchandising decision, and
-- re-running this migration would silently overrule it. Run it once.

update public."Collection"
   set "isFeatured" = true
 where slug = 'gemstone';
