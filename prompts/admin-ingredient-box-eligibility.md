# Exclude non-scent products from ingredient links and scent profiles

## Goal

Use one shared `isScentItem({ productType, collectionKind })` rule to keep boxes and other non-scent objects out of ingredient links and scent-profile collection pages, including when stale ingredient usage rows remain.

## Skills read

- None. No database or schema changes are in scope.

## Existing code inspected

- `src/lib/product-types.ts`: ProductType vocabulary and admin label helper.
- `src/types/catalog.ts`: CollectionKind vocabulary.
- `src/services/admin/catalog.ts`: `listAdminProducts()` and `listAdminCollections()`.
- `src/app/[locale]/admin/content/ingredients/[slug]/page.tsx`: server-projected picker options.
- `src/actions/admin/content.ts`: `setIngredientProducts` currently accepts the validated slug list and fetches names for new links.
- `src/services/products.ts`: `getProductCardsByScentProfile` uses product card projections with `collectionKind` but no `productType`.
- `src/schemas/db/catalog.ts`: explicit card projection and parsing schema.
- `src/lib/admin/revalidate.ts`: ingredient writes revalidate the ingredient index and affected detail pages; scent profile pages also derive from ingredient families/usages and need revalidation after those writes.

## Decisions and assumptions

- `isScentItem` rejects `DISCOVERY` and `GIFT` collection kinds first, even if a row has a mismatched scent product type. It then accepts `PERFUME`, `BODY_MIST`, and `ROOM_SPRAY`; null types are accepted only for `FRAGRANCE`, `BODY`, or `HOME`. All other combinations return false.
- The admin page builds a collection slug → kind map from `listAdminCollections()` and only passes eligible products to the picker. The current group UI remains intact for eligible products; there is no Sets & gifts or “Linked, not a perfume” group.
- `ProductCardData` already has `collectionKind` but not `productType`, so add only `productType` to `productCardRowSchema` and `PRODUCT_CARD_COLUMNS`, plus its output type if needed.
- For the server action, look up submitted product facts from the database, verify submitted slugs still exist, partition eligible and ineligible slugs with a pure helper, and save only eligible slugs. Existing ineligible links fall out of the wanted set and are removed by the normal diff. Return a clear message reporting dropped ineligible submissions while saving the eligible set.
- Keep the action payload `{ ingredientId, productSlugs }`; product identity, type, and kind are derived server-side.
- Do not change the storefront ingredient “Found in” list.

## Files likely to change

- `src/lib/product-types.ts`
- `src/app/[locale]/admin/content/ingredients/[slug]/page.tsx`
- `src/actions/admin/content.ts`
- `src/services/products.ts`
- `src/schemas/db/catalog.ts`
- `src/types/catalog.ts` if needed for `ProductCardData`
- A pure helper for partitioning submitted slugs, if needed for unit coverage
- Focused `node:test` file(s) under `scripts/`

## Implementation requirements

- Implement the exact `isScentItem` rule in `src/lib/product-types.ts` using existing `ProductType` and `CollectionKind` types.
- Filter admin picker options using server-loaded collection kinds before rendering.
- Filter `getProductCardsByScentProfile()` results with `isScentItem`, even when matching ingredient usage rows exist.
- In `setIngredientProducts`, ignore ineligible submitted slugs, save only eligible ones, preserve the existing diff/revalidation behavior, and clearly report dropped slugs. Do not accept new browser-supplied facts.
- Ensure ingredient writes revalidate the five scent-profile collection paths, since their product lists derive from ingredient families and usage links.
- Preserve grouped picker search, chips, counts, labels, family preview, and all other task-one UI behavior.
- Leave storefront “Found in” unchanged.

## Security requirements

- `setIngredientProducts` remains admin-protected and performs authoritative database lookups for product type and collection kind.
- The action payload remains exactly `{ ingredientId, productSlugs }`.
- No schema, migrations, dependencies, or `any`.

## Tests

- Test eligible combinations: PERFUME/FRAGRANCE, BODY_MIST/BODY, ROOM_SPRAY/HOME, null/FRAGRANCE.
- Test ineligible combinations: BOX/DISCOVERY, GIFT/GIFT, ANTIQUE, DECORATIVE, null/GIFT, null/DISCOVERY.
- Test grouped picker never returns an ineligible option.
- Test pure server-side slug partitioning if practical: eligible slugs remain and ineligible submitted slugs are reported as dropped.
- Use `node:test`; do not add dependencies or database-backed tests.

## Acceptance criteria

- No boxes/non-scent items can be selected or newly linked through a crafted action submission.
- Scent-profile pages omit ineligible products even when usage rows still reference them.
- Legacy null-type scent products remain eligible only in fragrance/body/home collections.
- “Found in” remains unchanged.
- No schema or migration changes.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npx tsx --test <new test files>`
- Run manual checks if possible; list any visual or dev-server checks that could not run as “for me to check”.

## Exact manual test steps

1. Open an ingredient page and confirm no discovery or gift set appears in the picker.
2. Visit `/collections/oriental`, `/collections/floral`, `/collections/fresh`, `/collections/woody`, and `/collections/gourmand`; confirm no sets appear.
3. Save an ingredient selection, reload, and confirm it persists and matches the unchanged storefront “Found in” list.
