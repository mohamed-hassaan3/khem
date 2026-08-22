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
