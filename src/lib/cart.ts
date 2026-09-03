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

/*
 * ── Buy Now ─────────────────────────────────────────────────
 *
 * A direct purchase: one product, straight to `/checkout`, with the bag left
 * exactly as it was.
 *
 * Buy Now used to add its line to the cart on the way past. That made a bag
 * that already held the product hold two of it — `addLine()` increments rather
 * than replaces, correctly, since adding a fragrance you already have should not
 * open a second line for the same SKU. It also made the button mean something it
 * does not say: "add this, then check out everything".
 *
 * So the item travels in the URL instead, and the bag is not involved at all.
 *
 * ## Why a query parameter and not a second store
 *
 * A client store for "the thing being bought right now" is state that can go
 * stale, survive a refresh it should not survive, and disagree with the page in
 * front of the customer. `?buy=…&qty=…` is already the shape of "this
 * navigation is about this product", it is inspectable, and it dies with the
 * navigation.
 *
 * ## Nothing here is trusted
 *
 * The server has never priced from the client's numbers: `checkoutSchema`
 * re-validates every item and `place_order()` reprices under a lock against
 * `"Product"`. A line carried in a URL is exactly as trusted as one carried from
 * `localStorage` — which is to say, not at all. The clamping below is a courtesy
 * to the customer, so they are shown the quantity the server would enforce
 * rather than a total it is about to refuse.
 */

export const BUY_NOW_PRODUCT_PARAM = "buy";
export const BUY_NOW_QUANTITY_PARAM = "qty";

/**
 * The checkout address for a direct purchase, locale-agnostic.
 *
 * `localizePath()` prefixes it at the call site, exactly as it did when this
 * was a bare `/checkout`.
 */
export function buyNowPath(productId: string, quantity: number): string {
  const params = new URLSearchParams({
    [BUY_NOW_PRODUCT_PARAM]: productId,
    [BUY_NOW_QUANTITY_PARAM]: String(Math.max(1, Math.trunc(quantity))),
  });

  return `/checkout?${params.toString()}`;
}

/** What a direct-purchase URL asks for, before it has been matched to a product. */
export interface BuyNowRequest {
  productId: string;
  quantity: number;
}

/**
 * Read a direct purchase off the URL, or `null` if there is not one.
 *
 * `null` is the ordinary case — most arrivals at `/checkout` are cart
 * checkouts — and it is also what a malformed request produces, so a shared or
 * hand-typed link degrades to "check out my bag" rather than to an error.
 *
 * The quantity is *not* clamped here: stock is a fact about a product this
 * function has not resolved yet. The caller clamps once it has one, with
 * {@link clampQuantity}.
 */
export function parseBuyNow(
  params: Pick<URLSearchParams, "get">,
): BuyNowRequest | null {
  const productId = params.get(BUY_NOW_PRODUCT_PARAM)?.trim();
  if (!productId) return null;

  const raw = Number(params.get(BUY_NOW_QUANTITY_PARAM));
  // Anything unreadable means one: the customer pressed a button that meant
  // "this bottle", and refusing the whole request over a mangled number would
  // send them back to a bag they were not shopping from.
  const quantity =
    Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 1;

  return { productId, quantity };
}
