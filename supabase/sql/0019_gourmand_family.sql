-- KHEM — "Fruity" becomes "Gourmand" in the olfactive vocabulary.
--
-- Applied by `npm run db:migrate` after `0002_content.sql` (which creates
-- `IngredientFamily`, `Ingredient`, and the trigger below) and
-- `0008_i18n_content.sql` (which added `IngredientFamily.label_ar`).
--
-- ── Why this is not one `update … set name = 'Gourmand'` ────
--
-- `IngredientFamily.name` is the primary key *and* the value stored in every
-- `Ingredient.families` element — there is no foreign key, because a `check`
-- cannot reach another table and a junction table would force every read to
-- aggregate. What holds the two in agreement is
-- `assert_ingredient_families()`, a before-insert/update trigger on
-- `Ingredient` that rejects any family the table does not list.
--
-- So the rename is three statements, and the order is load-bearing:
--
--   1. Insert 'Gourmand', inheriting the old row's `sortOrder` so the filter
--      bar does not reshuffle around the reader.
--   2. Rewrite the ingredient arrays *while both rows exist* — dropping
--      'Fruity' first would leave the trigger with nothing to validate the
--      old value against on the way through.
--   3. Delete 'Fruity', now unreferenced.
--
-- Idempotent: re-running finds nothing named 'Fruity' and changes nothing.
-- `label_ar` is left null, as it is for all seven families — the Arabic filter
-- bar shows the English family names today.

insert into public."IngredientFamily" (name, "sortOrder")
select 'Gourmand', "sortOrder"
  from public."IngredientFamily"
 where name = 'Fruity'
    on conflict (name) do nothing;

update public."Ingredient"
   set families = array_replace(families, 'Fruity', 'Gourmand')
 where 'Fruity' = any(families);

delete from public."IngredientFamily" where name = 'Fruity';
