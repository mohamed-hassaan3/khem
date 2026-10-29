# Initial stock and restock movements

## Goal
Fix admin stock entry so every stock addition is a positive movement, applied atomically to one channel counter and recorded in `InventoryMovement`. Add an Initial stock value to new product creation, using the same stock movement implementation as Inventory and committing creation plus initial movement as one database transaction.

## Skills read
- `.agents/skills/supabase/SKILL.md`

## Existing code inspected
- `src/app/[locale]/admin/products/new/page.tsx` and `src/components/admin/ProductForm.tsx`
- `src/actions/admin/catalog.ts` (`createProduct`)
- `src/actions/admin/inventory.ts` (`receiveStock`, `adjustInventory`)
- `src/components/admin/InventoryEditor.tsx`
- `src/app/[locale]/admin/inventory/page.tsx`
- `src/schemas/admin.ts`, `src/schemas/orders.ts`
- `supabase/sql/0042_inventory_channels.sql` and latest migration `0070_claim_guest_orders.sql`
- English and Arabic dictionaries under `src/lib/i18n/dictionaries/`

## Decisions and assumptions
- The current catalog model has one stock-bearing `Product` row per SKU, not a product variant table. Initial stock is therefore two integer inputs per product: online and offline, each defaulting to zero. Do not invent a variants schema.
- Counters are `Product.inventoryOnline` and `Product.inventoryOffline`; the database trigger derives legacy `Product.inventory` as their sum. A movement updates the selected counter, and the trigger updates the total.
- Keep a clearly separate Correct stock action reachable from Inventory. It remains an absolute correction and must use a logged movement (previous → signed delta → new), so editors can lower stock. The Add stock controls use positive-delta movement.
- Use migration `supabase/sql/0071_stock_movements.sql`, applied manually by the user in Supabase SQL Editor. Do not run migrations against a database.
- Product creation and its initial movement must be one Postgres RPC transaction. The RPC must invoke the shared internal stock movement function rather than duplicating its update/ledger logic.
- Existing movement rows and their display/query shape must remain compatible.

## Files likely to change
- `src/components/admin/ProductForm.tsx`
- `src/actions/admin/catalog.ts`
- `src/actions/admin/inventory.ts`
- `src/components/admin/InventoryEditor.tsx`
- `src/schemas/admin.ts` and `src/schemas/orders.ts`
- `src/lib/i18n/dictionaries/en.ts` and `src/lib/i18n/dictionaries/ar.ts` (and only the minimal dictionary typing/consumer wiring required)
- `supabase/sql/0071_stock_movements.sql`

## Implementation requirements
1. Add one shared server-side `addStockMovement` function that validates its input, calls the database stock movement RPC, logs failures safely, and accepts slug, channel, positive whole-number quantity, reason, and actor. Both Inventory restock and initial product creation must use this same function.
2. Database-side arithmetic must be atomic and concurrency-safe. Add a Postgres movement operation that updates `inventoryOnline` or `inventoryOffline` by `counter = counter + delta` and writes the matching previous/delta/new values in `InventoryMovement` within the same transaction. Reject non-positive movement quantities. Use the existing `RECEIPT` action for inventory restocks and a suitable existing action for initial stock unless adding an action is necessary; reasons must be exactly `restock` and `initial stock`.
3. Ensure the database RPC privilege model remains service-role-only, following `0042_inventory_channels.sql`. Use a fixed search path and do not expose privileged RPC execution to anon/authenticated.
4. Make new-product insertion and up to two optional initial movements atomic. A zero channel value creates no movement. Any insert or movement failure rolls back the product and both channel counts. Preserve embedding refresh and revalidation after successful commit only. Before finishing, compare the create RPC insert fields side-by-side with current createProduct insert, including Arabic copy and note arrays. Product images are currently saved by the separate `saveProductImages` flow after product creation, not by `createProduct`; preserve that existing flow and explicitly report this distinction.
5. Replace the inventory table's absolute-value editor with an “Add stock” positive delta control per channel. Label it “Add stock”, placeholder “Quantity to add”. Validate positive integers on both client and server; reject blank, zero, negative, decimal, and non-finite values with inline localized messages.
6. Initial stock must have separate online and offline whole-number inputs >= 0, both defaulting to 0. Render per-product inputs consistent with the actual schema; show inline validation. Display helper text exactly: “Initial stock is recorded in Stock History as the first movement. To add more later, use Inventory.”
7. After successful inventory addition, clear its input and refresh the table/history without a full page reload. Server refresh must re-evaluate low-stock filter/counts from the new database total.
8. Add all new labels, helper copy, and validation/errors to EN and AR dictionaries, and wire them into the UI without breaking RTL. Preserve existing luxury admin styling and accessible label/error relationships.
9. Do not alter existing historical rows, unrelated routes, or unrelated inventory actions.

## Security requirements
- Keep admin authorization in server actions via `requireAdmin()`.
- Never trust client-supplied actor identity; use the authenticated admin actor.
- Validate quantities at the action boundary and again in SQL.
- Do not expose service role credentials or grant RPC execution to browser roles.
- Never perform read-then-write arithmetic in the application.

## Acceptance criteria
- Adding 2 to a channel at 2 produces 4 and one history movement `2 → +2 → 4` with reason `restock`.
- Creating a product with initial online stock 5 and offline stock 2 commits product plus movements `0 → +5 → 5` and `0 → +2 → 2`, both reason `initial stock`; total `inventory` is 7.
- Initial stock 0 in both channels creates product with both counters 0 and no movement.
- Failed initial movement rolls back product creation.
- Low-stock state/counts are recomputed after add; adding enough stock removes the warning.
- Successful add clears the field and refreshes current table/history in place.
- Empty, zero, negative, decimal, and NaN inputs are rejected with localized inline messages.
- Existing stock history still renders unchanged.

## Checks to run
- Run the project typecheck and lint commands from `package.json` after implementation.
- Review the SQL function, grants, transaction behavior, and arithmetic constraints manually. Do not apply the SQL migration; the user applies it manually.

## Manual test steps
1. Apply `supabase/sql/0071_stock_movements.sql` in Supabase SQL Editor.
2. In English, create a product with initial online 5 and offline 2; verify Inventory shows online 5, offline 2, total 7 and history shows both `0 → +qty → qty` movements with `initial stock`.
3. On Inventory, add 3 online; verify online 8 and history `5 → +3 → 8` with `restock`, without a full page reload.
4. Create a product with initial stock 0; verify both counters are 0 and no movement exists.
5. For a product at online 2, add 5; verify online 7 and its low-stock warning/filter count updates. Use Correct stock to lower a count and verify a logged correction movement.
6. Try blank, 0, -1, 1.5, and non-numeric input for both forms; verify inline errors and no database changes.
7. Repeat the labels, validation, and RTL layout checks in Arabic.
