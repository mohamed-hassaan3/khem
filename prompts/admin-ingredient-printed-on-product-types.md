# Admin ingredient “Printed on” product type labels

## Goal

Make the admin ingredient editor’s “Printed on” picker distinguish products that share a name by showing the product type below each name. Use the same type vocabulary as the admin product editor, fall back to the collection slug when the type is null, and never show a blank label.

## Skills read

- None. This is a focused UI change with no database, authentication, or AI SDK work.

## Existing code inspected

- `src/app/[locale]/admin/content/ingredients/[slug]/page.tsx`: filters archived products and maps product slug, name, and collection slug into the picker.
- `src/components/admin/IngredientProductsPanel.tsx`: client-side selection state, dirty state, save action, and current “perfumes” labels.
- `src/components/ingredients/IngredientExplorer.tsx`: storefront “Found in” list renders product name plus type below it.
- `src/lib/product-types.ts`: `PRODUCT_TYPE_LABELS` and `ProductType` definitions.
- `src/services/admin/catalog.ts` and `src/schemas/db/admin.ts`: admin product listing uses the typed product record.
- Existing tests use `node:test` and `tsx`; no tests currently cover `IngredientProductsPanel` or product type labels.

## Decisions and assumptions

- Use `PRODUCT_TYPE_LABELS[productType]` when a type is present; when `productType` is null, use `collectionSlug` as the visible fallback.
- Add a small focused test for resolving labels for a same-named Perfume, Body Mist, and Room Spray, plus the null-type collection-slug fallback. Follow the repository’s existing `node:test`/`tsx` pattern without adding dependencies.
- Keep current selection, save, refresh, pending, and dirty-state behavior unchanged.
- Keep the action contract, schema, and database untouched.

## Files likely to change

- `src/app/[locale]/admin/content/ingredients/[slug]/page.tsx`
- `src/components/admin/IngredientProductsPanel.tsx`
- `src/lib/product-types.ts` only if a small exported pure label helper is needed for a direct unit test.
- One small test file following the existing `scripts/*.test.ts` convention.

## Implementation requirements

- Include `productType: product.productType` in the options mapping in the ingredient page.
- Add `productType: ProductType | null` to `ProductOption` and import the type and `PRODUCT_TYPE_LABELS` from `src/lib/product-types.ts`.
- Render each picker button’s name and resolved label as two left-aligned lines. Match the storefront type line’s `block text-[9px] uppercase tracking-[0.18em] text-ground-accent/50` styling; make the label a little stronger when the option is active. Ensure narrow layouts wrap without horizontal overflow.
- Never render an empty label. A null type displays `collectionSlug`.
- Rename “Save perfumes” to “Save products”, and use “Printed on no products” / “Printed on N product(s)” wording.
- Update the helper copy under “Printed on” to refer to products rather than perfumes.
- Do not modify `setIngredientProducts`, database schema, migrations, or dependencies. Do not use `any`.

## Security requirements

- Preserve server-derived product identity and the existing server action payload, which submits only selected slugs.
- Do not let the client supply product names, type labels, or collection data to the action.

## Acceptance criteria

- Same-named perfume, body mist, and room spray rows are distinguishable by their displayed labels.
- Products with null `productType` show their collection slug, never a blank line.
- Labels remain readable for active and inactive options, and the picker wraps at mobile widths.
- Selection, “Save products”, pending state, and the dirty / “No unsaved changes” state behave as before.
- Saved links remain reflected by both the admin picker and storefront “Found in” list after refresh.
- No schema, database, action, or dependency changes.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint` with no new warnings
- Run the focused `node:test` file using `npx tsx --test <test-file>`.
- Run the development server and inspect an ingredient page at desktop and mobile widths.

## Exact manual test steps

1. Start `npm run dev` and open an ingredient editor page containing linked products.
2. Confirm every picker option shows its name with a product type beneath it; confirm same-named perfume, mist, and spray rows have distinct labels.
3. Confirm a product with a null type shows its collection slug beneath the name.
4. Toggle an option and confirm the dirty state appears; save and confirm “Save products” works and the state returns to “No unsaved changes”.
5. Reload the ingredient page and confirm the saved selection persists.
6. Open the storefront ingredient view and confirm “Found in” reflects the same saved products and labels.
7. At mobile width, confirm buttons wrap and no horizontal overflow occurs.
