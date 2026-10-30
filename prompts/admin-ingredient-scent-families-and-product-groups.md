# Ingredient scent-family preview and grouped product picker

## Goal

Improve `/admin/content/ingredients/[slug]` with a live preview of the scent profile pages implied by an ingredient’s families, and a searchable, grouped product picker that keeps selections intact while filtering and collapsing groups.

## Skills read

- None. This is an admin UI and pure-helper change; no database or schema work.

## Existing code inspected

- `AGENTS.md`: implementation requires an approved prompt first.
- `src/components/admin/IngredientForm.tsx`: local `families` state is part of the existing form payload; family toggles currently sit inside “The material”.
- `src/components/admin/IngredientProductsPanel.tsx`: selection state, dirty comparison, save/notice flow, product type labels.
- `src/app/[locale]/admin/content/ingredients/[slug]/page.tsx`: current live product options.
- `src/lib/scent-profiles.ts`: `SCENT_PROFILE_SLUGS` order and `SCENT_PROFILE_FAMILIES` mapping.
- `src/lib/product-types.ts`: product types and `adminTypeLabel`.
- Existing scripts use `node:test` and `tsx`.

## Decisions and assumptions

- Extract and export `profilesForFamilies(families)` from `src/lib/scent-profiles.ts`. It returns profile slugs whose configured families intersect the input, in `SCENT_PROFILE_SLUGS` order.
- The preview label is exactly “Default profile pages:”. Empty state: “No profile page yet”. The preview is read-only and does not change save or validation behavior.
- Search is case-insensitive over product names. Repeated-name detection compares trimmed, lowercased names across the full product list.
- `groupProductOptions(options, query, selectedOnly)` returns groups with filtered visible options plus selected and total counts computed from the complete options before filtering. Query and selected-only filtering affect visibility only.
- Group order: Perfumes, Body Mists, Room Sprays, then a neutral “Other products” group to keep non-matching types visible during this first task. Do not add the removed “Sets & gifts” group. “Other products” starts collapsed; Perfumes starts expanded; a group with a selection starts expanded; while a query is active, every group with matches is expanded.
- This task does not apply product eligibility or remove boxes. That is task two, in `prompts/admin-ingredient-box-eligibility.md`.

## Files likely to change

- `src/components/admin/IngredientForm.tsx`
- `src/components/admin/IngredientProductsPanel.tsx`
- `src/lib/scent-profiles.ts`
- A pure grouping helper under `src/lib/`, likely `src/lib/admin/ingredient-product-groups.ts`
- Focused test files under `scripts/`

## Implementation requirements

### Scent families

- Put the “Olfactive families” controls in their own block titled “Scent families”.
- Show “Default profile pages:” followed by the labels for `profilesForFamilies(families)` in canonical order. Empty state: “No profile page yet”.
- Do not change family validation, payload, or save behavior.

### Product picker

- Keep “Scent families” and “Printed on” separate, each with its own heading. Use “products” in helper text and count/save copy.
- Add case-insensitive product-name search and a “Selected only” toggle with `aria-pressed`.
- Show selected products as removable chips. Removing a chip updates the existing `chosen` state.
- Add collapsible groups in order Perfumes, Body Mists, Room Sprays, Other products. The last group contains all other and null types during this first task, so no product is hidden before task two implements eligibility.
- Group buttons use `aria-expanded` and show labels such as “Perfumes 3/15”. Counts always use the complete product set and are unaffected by query or selected-only filtering.
- Perfumes starts expanded, any group with a selection starts expanded, and while a query is active every group with visible matches is expanded.
- Detect repeated names using `name.trim().toLocaleLowerCase()` and show the product type below each repeated name. Use the existing admin type label/fallback helper.
- Filtered and collapsed options remain in `chosen` and remain included in the save payload. Preserve dirty check, save/pending/notice behavior and the payload shape.
- Use existing admin tokens and ensure mobile layouts wrap without overflow.

## Security requirements

- Keep server-derived product identity and the existing `{ ingredientId, productSlugs }` action payload.
- Search, grouping, chips, and counts are display-only and do not add fields to the action.
- No schema, migrations, dependencies, or `any`.

## Tests

- Test `profilesForFamilies`: empty families, canonical ordering with reverse-ordered input, and multiple configured families mapping to one profile.
- Test `groupProductOptions`: grouping by product type, null type in Other products, case-insensitive search, selected-only filtering without changing full selection, repeated same-name items, and that each group’s `selectedCount` and `total` do not change with query or selected-only filtering.
- Use `node:test` in `scripts/`; no new dependency.

## Acceptance criteria

- Family changes immediately update the default profile-page preview in canonical order.
- Search, selected chips, grouped options, group expansion, and counts behave as specified.
- Hidden options remain selected and are still saved.
- Existing save/dirty states are unchanged; the storefront ingredient “Found in” list is untouched.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npx tsx --test <new test files>`
- Attempt local visual inspection of family preview, picker behavior, persistence, storefront “Found in”, and mobile width. Mark any visual/dev-server check not performed as “for me to check”.

## Exact manual test steps

1. Open an ingredient editor page in the local dev server.
2. Change families and confirm the “Default profile pages” preview updates in canonical order; clear families and confirm “No profile page yet”.
3. Search by mixed-case text and confirm matching options appear in their groups, which expand while the query is active.
4. Toggle Selected only and remove a selected chip; confirm hidden selections remain in the complete selection.
5. Save and reload; confirm selected products persist and the storefront “Found in” list remains consistent.
6. At mobile width, confirm search, chips, group headers, and options wrap without overflow.
