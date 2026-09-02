import type { InventoryAction, InventoryChannel } from "@/src/types/order";

/**
 * What "low stock" means, in one place.
 *
 * The threshold used to be a local constant inside
 * `src/components/ecommerce/ProductPurchase.tsx`, which made it a fact only the
 * product detail page knew. The dashboard now has an inventory screen that must
 * flag the same rows the storefront is warning visitors about, and two numbers
 * drifting apart would mean the desk is told everything is fine while the PDP
 * says "Only 2 remaining".
 *
 * Pure, no imports, no React — the storefront, the admin, and any server-side
 * report can all read it.
 */

/**
 * Below this count the storefront stops saying "in stock" and starts naming
 * the number — so 1 and 2 warn, 3 does not. High enough to be a warning
 * rather than an epitaph, low enough that it is not shouted on every
 * mid-sized product.
 */
export const LOW_STOCK_THRESHOLD = 3;

/** The three states any stock count is in. */
export type StockState = "out" | "low" | "in";

export function stockState(inventory: number): StockState {
  if (inventory <= 0) return "out";
  return inventory < LOW_STOCK_THRESHOLD ? "low" : "in";
}

/**
 * What each movement is called on screen.
 *
 * The vocabulary is the house's, not the enum's, and the two differ in one
 * place on purpose: `RESTOCK` is what a **cancelled order** returns, and reads
 * as "Returned to stock", while `RECEIPT` is a **delivery arriving** and reads
 * as "Restock". Those are the two words the desk uses for two genuinely
 * different events, and collapsing them would make the ledger's most common
 * pair of rows indistinguishable.
 *
 * Keyed by the union, so a seventh action is a compile error here rather than a
 * raw SCREAMING_SNAKE string appearing in the table.
 */
export const INVENTORY_ACTION_LABEL: Record<InventoryAction, string> = {
  SALE: "Sale",
  RESTOCK: "Returned to stock",
  RECEIPT: "Restock",
  ADJUSTMENT: "Adjustment",
  TRANSFER_IN: "Transferred in",
  TRANSFER_OUT: "Transferred out",
};

/** The filter row on the history screen, in the order it is printed. */
export const INVENTORY_ACTIONS: readonly InventoryAction[] = [
  "SALE",
  "RESTOCK",
  "RECEIPT",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
];

/** Narrow an untrusted `?action=` value. */
export function parseInventoryAction(value: string): InventoryAction | null {
  return INVENTORY_ACTIONS.find((action) => action === value) ?? null;
}

/** Narrow an untrusted `?channel=` value. */
export function parseInventoryChannel(value: string): InventoryChannel | null {
  return value === "ONLINE" || value === "OFFLINE" ? value : null;
}
