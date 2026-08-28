/**
 * What a product costs right now.
 *
 * One definition, read by the cards, the detail page, the bag, the drawer, the
 * checkout review and the sorting on `/collections`. Nothing here decides
 * anything: it reads the promotion `active_product_promotions` already chose and
 * `src/services/products.ts` already attached, so every surface quotes the same
 * figure `place_order()` will charge.
 *
 * ## Why a helper rather than replacing `priceInCents`
 *
 * The obvious shortcut is to let the service layer overwrite `priceInCents` with
 * the promotional figure. That reads well for two days and then the list price
 * is gone — there is nothing to strike through, an order cannot say what the
 * bottle was worth before the campaign, and a bug in the promotion join becomes
 * invisible because both numbers agree. Keeping `priceInCents` as *the list
 * price* and carrying the reduction beside it means the pair can always be
 * compared, and the comparison is what the UI is for.
 *
 * No React, no server imports: this module is read on both sides of the
 * boundary, the same constraint `src/lib/cart.ts` documents.
 */

import type { ProductPromotion } from "@/src/types/marketing";

/** The minimum a caller must carry to be priced. */
export interface PricedProduct {
  /** The list price — `"Product"."priceInCents"`, always. */
  priceInCents: number;
  /** The winning campaign, or null. */
  promotion: ProductPromotion | null;
}

/**
 * What the customer pays for one unit.
 *
 * The only figure that may be multiplied by a quantity, summed into a subtotal,
 * or compared against the free-delivery threshold.
 */
export function unitPriceInCents(product: PricedProduct): number {
  return product.promotion?.priceInCents ?? product.priceInCents;
}

/**
 * What it costs when no campaign is running — the struck-through figure.
 *
 * Returns the promotion's own record of the list price when there is one, rather
 * than `priceInCents` directly: the two are the same today, and reading the
 * promotion's copy means a card cannot print a "was" price from a newer catalog
 * row beside a "now" price computed from an older one.
 */
export function listPriceInCents(product: PricedProduct): number {
  return product.promotion?.listPriceInCents ?? product.priceInCents;
}

/** Whether this product is currently reduced. */
export function isPromoted(product: PricedProduct): boolean {
  return product.promotion !== null;
}

/** One bag line, for {@link cartPricing}. */
export interface CartPricingLine {
  product: PricedProduct;
  quantity: number;
}

/**
 * What a bag is worth, before and after the campaigns running on it.
 *
 * Three figures rather than one, because a summary that prints only the final
 * number cannot show what was taken off — and a reduction the customer cannot
 * see is a reduction that does not persuade anybody.
 */
export interface CartPricing {
  /**
   * The sum of **list** prices × quantity — what a "Subtotal" row prints.
   *
   * Deliberately the pre-reduction figure, so the rows beneath it can subtract
   * from something. It is *not* what the order records: `place_order()` stores
   * the promoted subtotal, because that is what was charged.
   */
  listSubtotalInCents: number;
  /** What running campaigns take off that subtotal. Zero when none apply. */
  promotionSavingsInCents: number;
  /**
   * What the merchandise actually comes to — `listSubtotal - promotionSavings`.
   *
   * The figure every other calculation must use: the delivery threshold, the
   * credit cap, and the total. It is the same number `place_order()` sums from
   * the same view, which is what keeps the quote and the charge in step.
   */
  subtotalInCents: number;
}

/**
 * Price a bag, once, for every surface that shows one.
 *
 * The cart, the cart drawer and the checkout review all call this rather than
 * each summing lines their own way — the failure this prevents is not an
 * arithmetic slip but a *drift*, where two screens quietly disagree about what
 * "subtotal" means and the customer notices at the moment they are asked to pay.
 */
export function cartPricing(lines: readonly CartPricingLine[]): CartPricing {
  let listSubtotalInCents = 0;
  let subtotalInCents = 0;

  for (const { product, quantity } of lines) {
    listSubtotalInCents += listPriceInCents(product) * quantity;
    subtotalInCents += unitPriceInCents(product) * quantity;
  }

  return {
    listSubtotalInCents,
    // Derived, never accumulated separately: two running totals that are meant
    // to differ by a third are three chances to be inconsistent.
    promotionSavingsInCents: listSubtotalInCents - subtotalInCents,
    subtotalInCents,
  };
}
