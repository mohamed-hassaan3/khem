/**
 * The discount vocabulary.
 *
 * Mirrors `supabase/sql/0028_discounts.sql`. Money is in piastres throughout.
 *
 * Nothing here is ever assembled from a browser. The client sends a **code
 * string**; the amount, the eligibility and the caps are decided in SQL, inside
 * the transaction that writes the order.
 */

/** A percentage of the eligible lines, or a fixed amount off them. */
export type DiscountKind = "PERCENTAGE" | "FIXED";

/**
 * What a discount may come off.
 *
 * A restricted discount reduces **eligible lines only** — a 20%-off-Noir code on
 * a bag holding one Noir and one Signature reduces the Noir line alone.
 */
export type DiscountScope = "ALL" | "PRODUCTS" | "COLLECTIONS";

export interface Discount {
  id: string;
  /** Stored uppercased, so `welcome10` and `WELCOME10` are one code. */
  code: string;
  kind: DiscountKind;
  /** A percentage 1–100, or an amount in piastres. Read with `kind`. */
  value: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Null means unlimited. */
  totalUseLimit: number | null;
  /** Null means unlimited. */
  perCustomerLimit: number | null;
  /** Judged on the subtotal *before* any reduction. */
  minimumOrderInCents: number;
  appliesTo: DiscountScope;
  /**
   * Whether redemption needs a grant addressed to this customer.
   *
   * True for the welcome offer, whose code string is shared but whose
   * entitlement is not — which is what stops a shared string leaking into a
   * permanent public discount.
   */
  requiresGrant: boolean;
  description: string | null;
  createdAt: string;
}

/** A discount with the figures §12 asks for, counted from the redemption ledger. */
export interface DiscountWithUsage extends Discount {
  /** Live redemptions — released ones do not count against either cap. */
  timesUsed: number;
  /** Null when there is no total cap. */
  remainingUses: number | null;
  /** What the house has given away through this code. */
  discountedInCents: number;
  /** Revenue on the orders that used it, after the discount. */
  revenueInCents: number;
}

/** The restriction sets, as the editor renders them. */
export interface DiscountRestrictions {
  productSlugs: readonly string[];
  collectionSlugs: readonly string[];
}

/** One entitlement to a grant-gated code. */
export interface DiscountGrant {
  id: string;
  discountId: string;
  email: string;
  clerkUserId: string | null;
  issuedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedOrderId: string | null;
}

/** One use, live or released. */
export interface DiscountRedemption {
  id: string;
  orderId: string;
  orderNumber: string | null;
  email: string | null;
  amountInCents: number;
  redeemedAt: string;
  /** Set when the order was refunded and the use returned to both caps. */
  releasedAt: string | null;
}

/** A discount on its own screen. */
export interface DiscountDetail extends DiscountWithUsage {
  restrictions: DiscountRestrictions;
  grants: readonly DiscountGrant[];
  redemptions: readonly DiscountRedemption[];
}
