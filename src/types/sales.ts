/**
 * The sales & profitability vocabulary.
 *
 * The shapes `supabase/sql/0062_sales_ledger.sql` hands back: one sold line,
 * one window's totals, and one product's contribution. Read by the dashboard
 * and by nothing else — a ledger row carries the house's cost and margin, and
 * no storefront surface has any business with either.
 *
 * Money is in piastres throughout, the same minor unit as
 * `Product.priceInCents`. Nothing here is ever a float, and no percentage is
 * stored: a margin is derived at the moment it is printed, from two integers
 * and an explicit zero guard.
 */

import type { OrderChannel, PaymentStatus } from "./order";
import type { OrderStatus } from "./account";

/**
 * What happened to the money, as the reports read it.
 *
 * Derived in `"SalesLedgerRow"` from the order's own status and payment status
 * rather than stored: a refund happens after a sale, and a snapshot of "sold"
 * would be wrong the moment the money went back. There is one refund system —
 * `set_order_status()` — and this reads its answer.
 *
 * `SOLD` is an order that has happened and is not yet settled: a cash parcel
 * with a courier. It is a healthy state, not a failed payment.
 */
export type SaleStatus = "SOLD" | "PAID" | "REFUNDED" | "CANCELLED";

/**
 * Which instrument gave money away.
 *
 * A row may carry several at once — a promoted bottle in a bag that also used
 * a coupon — which is why the ledger stores five amounts rather than one amount
 * and a type. This union is the *filter* vocabulary, derived from those
 * amounts in the database so a chip and a column can never disagree.
 */
export type DiscountSource =
  | "PROMOTION"
  | "OFFER"
  | "COUPON"
  | "REWARDS"
  | "DISCOVERY_CREDIT";

/** One sold line, as it was at the moment of sale. */
export interface SalesLedgerRow {
  id: string;
  orderId: string;
  orderItemId: string;
  orderNumber: string;
  channel: OrderChannel;
  /** The order's `placedAt`, snapshotted so the table can sort and filter on it. */
  soldAt: string;

  productSlug: string;
  /** A snapshot. A product renamed next season still prints as it was sold. */
  productName: string;
  sku: string | null;
  collectionSlug: string | null;
  collectionName: string | null;

  quantity: number;

  /** The **list** price — before a promotion, not after it. */
  originalUnitPriceInCents: number;
  originalLineTotalInCents: number;

  promotionDiscountInCents: number;
  offerDiscountInCents: number;
  couponDiscountInCents: number;
  pointsDiscountInCents: number;
  creditDiscountInCents: number;
  totalDiscountInCents: number;

  /** What the customer actually paid for these goods. Delivery is not in it. */
  paidInCents: number;
  /** How many units of this line an offer gave away outright. */
  freeUnits: number;
  isFree: boolean;
  discountSources: DiscountSource[];

  promotionId: string | null;
  offerId: string | null;
  offerLabel: string | null;
  discountId: string | null;
  discountCode: string | null;
  creditId: string | null;

  /**
   * The cost of one unit at the moment of sale, or `null` when the desk had
   * not stated one.
   *
   * Null is not zero and must never be rendered as zero: a sale with an unknown
   * cost is not a sale with no cost. `totalCostInCents` and
   * `grossProfitInCents` are null alongside it.
   */
  unitCostInCents: number | null;
  totalCostInCents: number | null;
  grossProfitInCents: number | null;

  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  saleStatus: SaleStatus;
  /** False for a cancelled or refunded order. Every total below excludes those. */
  countsAsRevenue: boolean;
}

/**
 * One window's headline figures.
 *
 * **Actual revenue is not profit.** The two are separate fields and are labelled
 * separately everywhere they are printed: revenue is what customers paid for
 * merchandise, profit is what is left after the goods cost.
 */
export interface SalesLedgerSummary {
  orderCount: number;
  lineCount: number;
  units: number;

  /** Before anything came off — the list value of what was sold. */
  originalInCents: number;
  /** Everything given away, across all five instruments. */
  discountInCents: number;
  /** What was actually paid for merchandise. Delivery excluded. */
  revenueInCents: number;

  /**
   * The cost of the lines that had one, and the profit that leaves.
   *
   * `null` when nothing in the window carried a cost. Zero would read as "these
   * sales were pure profit", which is the most misleading number this screen
   * could print.
   */
  costInCents: number | null;
  profitInCents: number | null;
  /**
   * Revenue of the costed lines only.
   *
   * The honest denominator for a margin when part of the catalogue has no cost
   * on it: dividing profit by *total* revenue would understate every margin by
   * the share of sales nobody has costed yet.
   */
  costedRevenueInCents: number;
  linesMissingCost: number;

  refundedOrderCount: number;
  refundedRevenueInCents: number;
  freeLineCount: number;
}

/** One product's contribution over a window. */
export interface SalesLedgerProductRow {
  productSlug: string;
  productName: string;
  sku: string | null;
  collectionName: string | null;
  units: number;
  orderCount: number;
  originalInCents: number;
  discountInCents: number;
  revenueInCents: number;
  costInCents: number | null;
  profitInCents: number | null;
  costedRevenueInCents: number;
  linesMissingCost: number;
}
