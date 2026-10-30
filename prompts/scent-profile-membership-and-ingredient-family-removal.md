# Direct scent-profile membership and ingredient-family removal

## Goal

Move scent-profile membership from ingredient-family inference to explicit product assignments. Add admin pages to edit the five fixed profiles and reorder their products. Remove ingredient scent families from app code and public cards, while keeping “Printed on” ingredients as a separate product ↔ ingredient relation.

## Skills read

- `.agents/skills/supabase/SKILL.md`: RLS, explicit public grants, and PostgREST schema cache requirements. No database operation will be run as part of this implementation.

## Existing code inspected

- `AGENTS.md`: implementation approval flow, database practices, routing and revalidation rules.
- Working tree status: previous ingredient-picker/product-type changes are present as uncommitted edits. Build on them and preserve them; do not redo that picker work.
- `src/lib/product-types.ts`: `ProductType`, `isScentItem`, and admin product type labels.
- `src/lib/scent-profiles.ts`: fixed `SCENT_PROFILE_SLUGS`, current ingredient-family mapping and legacy derived-product helper.
- `src/services/products.ts`: `getScentProfile()` and current family-overlap product lookup.
- `src/components/admin/ProductForm.tsx`, product create/edit routes, `src/actions/admin/catalog.ts`, and `src/schemas/admin.ts`: product form state, Zod validation, admin writes, collection-kind resolution, and revalidation.
- `src/app/[locale]/admin/categories/page.tsx`, category editor routes/actions, and `supabase/sql/0047_reserved_slugs.sql`: category list and reserved slugs.
- `src/components/admin/CollectionForm.tsx` and `MerchPageForm.tsx`: existing validated banner URL input pattern. There is no Cloudinary upload widget in the admin; Cloudinary is currently delivery-only. Per user clarification, reuse the validated URL field.
- `src/components/ingredients/IngredientExplorer.tsx`, `src/components/home/IngredientRail.tsx`, product detail page, and `ProductScentProfile.tsx`: public ingredient cards, current family chips, “Found in” products, and product-page profile chips.
- `src/schemas/content.ts`, `src/schemas/db/content.ts`, `src/types/content.ts`, ingredient admin pages/actions, `supabase/seed/content.json`, `scripts/db-seed.ts`, `scripts/db-dump.ts`, and `scripts/db-verify.ts`: ingredient family read/write/export paths.
- `supabase/sql/0002_content.sql` and `0020_scent_profile.sql`: exact family indexes, triggers, RLS/grants, and profile columns; `IngredientFamily` is a separate table and remains.

## Decisions and assumptions

- Product/profile membership is authoritative in `ScentProfileProduct`; one product may belong to several profiles.
- Use the existing exact `isScentItem({ productType, collectionKind })` rule from `src/lib/product-types.ts`. Set types and DISCOVERY/GIFT collections are never eligible; null type is eligible only in FRAGRANCE/BODY/HOME collections.
- Profile slugs remain the fixed `SCENT_PROFILE_SLUGS` set. No create/delete profile UI.
- Product profile chips on the PDP remain visible and link to the assigned profile pages; the source becomes direct product membership instead of ingredient inference.
- “Printed on” remains `IngredientUsage` and continues to power only the ingredient card’s “Found in” list. It does not assign profiles.
- The existing `IngredientFamily` table and taxonomy seed rows remain because the request explicitly keeps that table. Remove family arrays/reads/writes from Ingredient and ScentProfile app data, seed exports, and scripts.
- To preserve clean database restores after family columns are removed, include the editable `ScentProfile` copy and explicit profile-product membership in content seed/dump round-tripping. Do not edit `supabase/seed/catalog.json` or old product slugs in migration `0013`.
- `0072a` creates/backfills the relation and adds `scent-families` to database reserved category slugs. `0072b` is a separate later SQL file; its header must say to run only after the new code is deployed and verified. Neither SQL file is executed by this task.
- Reuse the existing validated `AdminInput type="url"` banner URL pattern; do not add a Cloudinary uploader or dependency.
- Found-in ordering groups Perfumes, Body Mists, and Room Sprays; legacy null-type rows use their collection kind to join the corresponding group. Initially show six products, then an accessible “Show all N” / “Show less” control when there are more than six.

## Files likely to change

### Product membership and storefront

- `src/lib/product-types.ts`
- `src/lib/scent-profiles.ts`
- `src/services/products.ts`
- `src/services/admin/catalog.ts`
- `src/schemas/db/catalog.ts`
- `src/types/catalog.ts`
- `src/components/admin/ProductForm.tsx`
- `src/app/[locale]/admin/products/[slug]/page.tsx`
- `src/actions/admin/catalog.ts`
- `src/schemas/admin.ts`
- `src/app/[locale]/perfume/[slug]/page.tsx`
- `src/components/ecommerce/ProductScentProfile.tsx`
- `src/lib/admin/revalidate.ts`

### Profile administration

- New `/admin/categories/scent-families` list route and `/admin/categories/scent-families/[profile]` edit route.
- New admin profile form/member-order component(s) and actions for `updateScentProfile` and `setScentProfileOrder`.
- `src/app/[locale]/admin/categories/page.tsx` for the pinned profile link.
- Category slug validation and the reserved-slug SQL function in `supabase/sql/0047_reserved_slugs.sql` or the additive SQL file, without rewriting unrelated historical migrations.

### Remove ingredient family data and compact public list

- `src/components/admin/IngredientForm.tsx`
- `src/app/[locale]/admin/content/ingredients/page.tsx`
- `src/schemas/content.ts`, `src/schemas/db/content.ts`, `src/types/content.ts`
- `src/actions/admin/content.ts`
- `src/components/ingredients/IngredientExplorer.tsx`
- `src/components/home/IngredientRail.tsx` if it renders family data
- `src/lib/i18n/dictionaries/en.ts` and `ar.ts`
- `supabase/seed/content.json`
- `scripts/seed-types.ts`, `scripts/db-seed.ts`, `scripts/db-dump.ts`, `scripts/db-verify.ts`
- New pure helpers and focused tests under `scripts/`

### SQL files to write, never execute here

- `supabase/sql/0072a_scent_profile_product.sql`
- `supabase/sql/0072b_drop_ingredient_families.sql`

## Implementation requirements

### Shared eligibility and product assignments

- Implement/retain the shared pure `isScentItem` helper with the exact approved rule and test eligible/ineligible cases.
- Add a five-checkbox “Scent profiles” field to `ProductForm`, initialized from server-loaded existing memberships. Show it only when the form’s current product type and selected collection kind are eligible. When ineligible (including BOX/GIFT), submit `scentProfiles: []` and clear the memberships after save.
- Add `scentProfiles` to create/update product Zod schemas, validated against `SCENT_PROFILE_SLUGS`, with duplicate slugs removed or rejected consistently.
- After the product write, diff requested profile slugs against stored rows. Append additions at `max(sortOrder) + 1` within each profile and delete removed rows. If the saved product is no longer scent-eligible, delete all its memberships.
- Derive product type and collection kind from the parsed request and server-loaded collection, never trust client eligibility. Do not change the Product database columns or product action contracts beyond adding the profile-slug field.
- Preserve the existing partial-success behavior when Product saves but profile-link persistence fails: report a clear message that does not invite a duplicate create, and revalidate the product/profile state appropriately.
- Revalidate affected `/collections/<profile>` pages and both profile admin screens in both locales whenever membership or profile copy/order changes.

### Scent-profile admin pages

- List exactly the five `SCENT_PROFILE_SLUGS`, with assigned-member counts, edit links, and locale-aware storefront links.
- Add a pinned Scent Families link/row on `/admin/categories`; reserve `scent-families` in app validation and database slug reservation so a real category cannot shadow the static admin section.
- Detail route validates `profile` against the fixed slug set. Edit name, description, banner URL, banner alt, and Arabic siblings through an admin-only Zod action updating the existing `ScentProfile` row. Do not create or delete profile rows.
- Show linked products as a read-only list linking to admin product pages, with move-up/move-down controls. `setScentProfileOrder({ profileSlug, productSlugs })` may update only the sort order of existing members; it must not insert/delete or trust new member slugs.
- Use the existing URL field pattern for banners, not an invented upload API.

### Storefront profile and product pages

- `getProductCardsByScentProfile` accepts a profile slug, reads explicit membership rows ordered by membership `sortOrder` then product name, and keeps the existing published/non-archived product filtering plus `isScentItem` defense in depth.
- Remove the family-overlap `scentProfileProductSlugs` logic and stop passing families from `/collections/[slug]`. Preserve dictionary/banner fallback and the existing empty state if profile data is unavailable or membership is empty.
- Keep PDP scent-profile chips, now sourced from direct membership and linked to `/collections/<profile>`; order them by the fixed profile order.

### Remove ingredient families and update “Found in”

- Remove Ingredient family state, validation, schema/type/read/write fields, admin list column, and public family text/chips. Remove ScentProfile family reads/types and the old family-derived product helpers. Keep the `IngredientFamily` table and taxonomy rows, but no app behavior depends on them.
- Keep `IngredientUsage` and the admin “Printed on” selector unchanged as the product list for “Found in”; it has no profile membership behavior.
- Filter “Found in” with `isScentItem`, sort by Perfumes → Body Mists → Room Sprays (legacy null-type rows by collection kind), and render name plus type label.
- On public ingredient cards, show two columns from `sm`, first six products initially, and “Show all {N}” / “Show less” with `aria-expanded` when more than six exist. Keep locale-aware product links and RTL direction helpers.
- Add the new show-all/show-less dictionary strings to both English and Arabic dictionaries.

### SQL and seed/dump/verify

- `0072a` is additive and idempotent: create `ScentProfileProduct(profileSlug, productSlug, sortOrder)` with composite primary key, cascading FKs to `ScentProfile.slug` and `Product.slug`, public read-only RLS/grants matching the existing readable-product policy, and service-role-only writes. Backfill today's family-derived memberships using current Ingredient/IngredientUsage data while excluding BOX/GIFT/ANTIQUE/DECORATIVE and DISCOVERY/GIFT collections. Use deterministic ordering. Include commented verification queries comparing derived “before” counts with stored “after” counts per profile. Add the reserved category slug rule. Signal `notify pgrst, 'reload schema'` after API-visible schema changes.
- `0072b` must begin with a prominent “Run only after the new code is deployed and verified” header. Drop exact family-related Ingredient/ScentProfile triggers, constraints, indexes and the now-unused validator function before dropping both `families` columns. Do not drop `IngredientFamily`. Signal the PostgREST schema reload.
- Remove ingredient/profile `families` data from seed/dump/verify code while retaining the `IngredientFamily` taxonomy table. Round-trip the editable profile copy and explicit `ScentProfileProduct` memberships so a fresh seed/restore does not lose membership after the family derivation is gone. Seed profile-product rows only after catalog products and skip any membership whose product slug is absent from the seeded catalog.
- In `0072b`, first check that no trigger other than the two named family-validation triggers uses the validator; after removing those triggers, confirm no trigger still uses it. Drop the validator with plain `drop function` and no `CASCADE`.
- Update `db-verify` to assert every `ScentProfileProduct` row points to an eligible product. Do not touch `catalog.json` or migration `0013` product slugs.
- Write SQL files only. Do not apply SQL, run `npm run db:migrate`, or mutate the database.

## Security requirements

- All new profile actions call `requireAdmin()` and validate input with Zod.
- Product membership action payloads carry profile slugs only; the action reads current membership and catalog eligibility from the database.
- The reorder action updates only existing join rows.
- Public roles receive SELECT only on the new relation, with RLS enabled and readable-product filtering; no public write policy.
- No dependencies, no `any`, no database operations executed by the agent.

## Tests

- Test `isScentItem` for PERFUME/signature, BODY_MIST, ROOM_SPRAY, null/signature as eligible; BOX/discovery-sets, GIFT/gift-sets, ANTIQUE, DECORATIVE, and null/gift-sets as ineligible.
- Test a pure membership diff helper for added, removed, unchanged, and non-scent-item clearing all.
- Test that the profile reorder helper rejects lists with any missing or extra stored member.
- Test that app category validation rejects the reserved `scent-families` slug.
- Test create/update product Zod schemas reject unknown profile slugs.
- Test “Found in” ordering and limit for six items, seven items collapsed, and seven expanded.
- Use `node:test` + `tsx` under `scripts/`; do not add dependencies.

## Acceptance criteria

- Product assignments are the sole source of scent-profile membership; product may appear in several profiles.
- Non-scent products cannot carry profile memberships, and profile public pages exclude them.
- Scent profiles have an admin list/editor/order screen but no create/delete option.
- Ingredient records no longer carry or render olfactive families. “Printed on” still feeds “Found in” only.
- Found-in list is grouped, compact, localized, expandable, and still links every selected scent product.
- Profile copy and memberships survive seed/dump/restore.
- Both SQL files are written and reviewed but not executed.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npx tsx --test scripts/<new test files>`
- Do not run migrations or database commands.

## Exact manual test steps

1. Create a new scent product with two profiles and confirm it appears on both profile pages. Create a BOX/GIFT or switch an eligible product to one; confirm profile controls are hidden and its membership rows are removed.
2. Open `/admin/categories/scent-families`, confirm all five profiles, member counts, edit links, and storefront links. Edit copy/banner/Arabic text, save, reload, and confirm the public page updates.
3. Reorder profile members and confirm the public profile page follows the new order; ensure nonmembers cannot be added by the reorder action.
4. Confirm an ingredient editor no longer has family controls, and “Printed on” remains independent.
5. Confirm ingredient cards have no family chips and “Found in” contains only eligible products, ordered by type, with six initially and working Show all/Show less controls. Confirm RTL behavior in Arabic.
6. Confirm PDP scent-profile chips reflect explicit product memberships and the product page still renders.
7. Run SQL files manually only in the user's planned sequence. After 0072a, verify per-profile counts against the derived counts; after deployment and verification, run 0072b and confirm no code reads either dropped family column.
