# Draft gallery on new product creation

## Goal
Reuse `ProductImageEditor` on the new-product screen in draft mode. Gallery rows remain client-side until the product and its initial stock are created, then save to the new slug before redirect. Keep the edit page's immediate-save behavior unchanged.

## Skills read
- None required beyond the repository instructions; this is existing React/Next.js/Supabase code with no schema change.

## Existing code inspected
- `src/components/admin/ProductImageEditor.tsx`
- `src/components/admin/ProductForm.tsx`
- `src/actions/admin/catalog.ts` (`createProduct`, `saveProductImages`, `saveProductImagesSchema` use)
- `src/app/[locale]/admin/products/new/page.tsx`
- `src/app/[locale]/admin/products/[slug]/page.tsx`
- EN/AR dictionaries and the existing `AdminNotice`/i18n provider patterns

## Decisions and assumptions
- No migration is needed: `ProductImage` and `saveProductImages()` already support this workflow.
- Keep one `ProductImageEditor` with optional draft props (`draft`, `onChange`, validation errors); omit these on edit so current immediate-save behavior remains.
- Keep the editor mounted inside the parent create form and outside nested forms. Its buttons must be `type="button"`; only the product's Create button submits.
- Product create and initial stock stay transactional as already implemented. Gallery save is a subsequent operation and failure must preserve the product.
- Communicate a gallery save failure through a query flag on the redirect and render a localized notice on the edit page.
- Include draft rows in the `useUnsavedGuard` payload while explicitly excluding them from `createProduct` input. The guard's leave-dialog path calls `persist()`, which must save the gallery as well.
- Confirm `saveProductImagesSchema` is client-safe to import. Reuse it for draft validation; if its dependency graph is not client-safe, extract only the shared validation pieces into a pure module.
- Apply the existing image schema's URL, alt-text, count, and primary constraints before product creation. In draft mode, make the first image primary by default and restore a primary to the first remaining row if the current primary is removed.

## Files likely to change
- `src/components/admin/ProductImageEditor.tsx`
- `src/components/admin/ProductForm.tsx`
- `src/app/[locale]/admin/products/new/page.tsx`
- `src/app/[locale]/admin/products/[slug]/page.tsx`
- `src/lib/i18n/dictionaries/en.ts`
- `src/lib/i18n/dictionaries/ar.ts`

## Implementation requirements
1. Read the currently approved implementation state in the files above before editing.
2. Add optional draft mode to `ProductImageEditor`: no action call or Save button, report rows to `onChange`, but keep add URL, alt text, primary radio, ordering, remove, appearance, and edit mode unchanged.
3. Reuse the exact Gallery heading/helper/section markup from edit page on the new page. Render `ProductImageEditor` in draft mode within `ProductForm` so one Create product button submits both data sets.
4. Before create, validate nonempty draft rows against the same rules as `saveProductImagesSchema` (allowed URL host/protocol, alt text length >= 3, max 12, one primary). Show field-level errors adjacent to the same URL/alt controls and block product creation. Ensure the first newly added image is primary; if a primary is removed in draft mode, assign the first remaining row as primary.
5. On valid create submit: call `createProduct` first; only after it succeeds, call `saveProductImages` with the resulting slug and draft rows if rows exist. If gallery save succeeds or rows are empty, keep the current successful redirect to the edit page.
6. If product creation succeeds but gallery save fails or throws, catch the error and do not retry product creation or roll it back. Redirect to the edit page with a clear query flag and show a localized EN/AR `AdminNotice` there: “Product created, but the photographs could not be saved. Add them here.”
7. Replace the new-page header description with localized EN/AR copy: “Photographs are optional here and can be added or changed later from the product page.”
8. Add every new user-facing string to both dictionaries. Use existing locale provider and RTL-compatible spacing conventions.
9. Do not touch unrelated behavior, routes, database schema, or migrations.

## Security requirements
- Keep `createProduct` and `saveProductImages` server actions and their `requireAdmin()` authorization unchanged.
- Only call `saveProductImages` after successful product creation; server-side schema validation remains authoritative.
- Do not trust client validation as a security boundary.
- Catch exceptions thrown by `saveProductImages` after create and handle them exactly like an `{ ok: false }` result.

## Acceptance criteria
- New product with multiple images can select primary, reorder, add alt text, and create; edit page shows the saved order/primary and storefront uses the primary.
- Empty gallery skips image save and product creation works.
- Invalid URL or alt text shows inline errors and prevents product creation.
- Gallery save failure leaves product and stock intact, redirects to edit, and shows localized notice.
- Existing edit gallery remains visually and behaviorally unchanged, including immediate save.
- EN and AR copy render correctly with RTL layout.

## Checks to run
- Run `npm run lint -- --no-cache`, `npx tsc --noEmit`, and `git diff --check`.
- No SQL migration is needed or should be created.

## Manual test steps
1. Create a product with two valid images; set the second primary, reorder, and verify edit gallery order/primary and storefront card primary image.
2. Create a product with no images and verify it redirects normally.
3. Create with initial stock and images; verify stock history and gallery.
4. Submit a bad or blank URL, or missing alt text; verify inline error and no product row is created.
5. Force `saveProductImages` to fail after create; verify the product remains and the edit page shows the warning.
6. Edit an existing product gallery; verify Save gallery still persists immediately.
7. Verify new header and failure notice in English and Arabic, including RTL.
