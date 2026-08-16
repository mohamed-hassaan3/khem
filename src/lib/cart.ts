/**
 * Cart arithmetic.
 *
 * Pure functions over the base currency's minor unit — Egyptian piastres, the
 * unit `Product.priceInCents` is stored in — with no React and no storage
 * dependency, so the same module serves the client cart today and the checkout
 * Server Action that will price the order server-side tomorrow. A total shown
 * to a visitor and a total charged to a card must come from one implementation.
 *
 * Nothing here ever sees a display currency: `formatPrice` converts at the edge
 * (`src/lib/format.ts`), so the free-shipping threshold is crossed at the same
 * real amount whichever currency the visitor is reading.
 */

/** Free delivery at or above this subtotal — EGP 2,000, the figure published in
 * `dict.product.trust.delivery`. Change both together. */
export const FREE_SHIPPING_THRESHOLD_IN_CENTS = 200_000;

/** Flat delivery fee below the threshold — EGP 90. */
export const SHIPPING_FEE_IN_CENTS = 9_000;

/** Per-order quantity cap, independent of stock. Mirrored by the PDP stepper. */
export const MAX_QUANTITY_PER_LINE = 10;

/** A priced cart line: identity plus the two numbers the arithmetic needs. */
export interface PricedLine {
  priceInCents: number;
  quantity: number;
}

export function lineTotalInCents(line: PricedLine): number {
  return line.priceInCents * line.quantity;
}

export function cartSubtotalInCents(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalInCents(line), 0);
}

export function cartCount(lines: readonly PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** An empty cart ships nothing, so it is never charged for delivery. */
export function shippingInCents(subtotalInCents: number): number {
  if (subtotalInCents <= 0) return 0;
  return subtotalInCents >= FREE_SHIPPING_THRESHOLD_IN_CENTS
    ? 0
    : SHIPPING_FEE_IN_CENTS;
}

export function cartTotalInCents(subtotalInCents: number): number {
  return subtotalInCents + shippingInCents(subtotalInCents);
}

/**
 * How much more the visitor must spend to earn free delivery, or `0` once the
 * threshold is met — which is the signal to hide the nudge entirely.
 */
export function amountToFreeShippingInCents(subtotalInCents: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD_IN_CENTS - subtotalInCents);
}

/**
 * The highest quantity one line may reach: whichever is smaller of the stock on
 * hand and the per-order cap, and never below 1 — a sold-out product is refused
 * at the button, not by handing the stepper a maximum of zero.
 *
 * The single definition behind the PDP stepper, the cart stepper, and both
 * store mutators, so no surface can accept a quantity another would reject.
 */
export function quantityCeiling(inventory: number): number {
  return Math.max(1, Math.min(inventory, MAX_QUANTITY_PER_LINE));
}

/** Clamp a requested quantity into `1..quantityCeiling(inventory)`. */
export function clampQuantity(quantity: number, inventory: number): number {
  return Math.min(Math.max(1, Math.trunc(quantity)), quantityCeiling(inventory));
}
