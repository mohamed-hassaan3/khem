/**
 * The order vocabulary, shared by the dashboard and the customer portal.
 *
 * `OrderStatus` is *not* redeclared here — it already exists in
 * `src/types/account.ts`, keyed by the account dictionary, and a second copy
 * would be a second thing to keep in step with `supabase/sql/0015_orders.sql`.
 * This file adds only what the desk needs and the portal does not.
 *
 * Money is in piastres throughout, the same minor unit as
 * `Product.priceInCents`. Nothing here is ever a float.
 */

import type { OrderStatus } from "./account";
import type { PaymentMethod } from "./checkout";

/** Where a sale came from. Both draw stock from the same website inventory. */
export type OrderChannel = "ONLINE" | "OFFLINE";

/** Mirrors the §9 `PaymentStatus` enum and the Postgres type of the same name. */
export type PaymentStatus = "UNPAID" | "PAID" | "FAILED" | "REFUNDED";

/**
 * How the money is taken. Added by `supabase/sql/0016_checkout.sql`.
 *
 * Distinct from {@link PaymentStatus}, and the distinction matters at the desk:
 * a cash order is PROCESSING and UNPAID for as long as it takes a courier to
 * reach the door, which is a healthy state and not a failed payment.
 *
 * Re-exported from `src/types/checkout.ts` rather than declared twice.
 */
export type { PaymentMethod };

/** One line of an order as the desk prints it — name and price are snapshots. */
export interface AdminOrderLine {
  id: string;
  productSlug: string;
  productName: string;
  quantity: number;
  /** The unit price actually charged — the promotional one where a campaign ran. */
  priceInCents: number;
  /**
   * What it would have cost without a campaign, when one applied — `null`
   * otherwise.
   *
   * A snapshot like `productName`, and for the same reason: a promotion deleted
   * next spring must not change what this order says it charged, or what it says
   * it took off. See `supabase/sql/0035_marketing.sql`.
   */
  listPriceInCents: number | null;
}

/** An order in the dashboard's list. No lines: a list does not read them. */
export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: OrderChannel;
  totalInCents: number;
  placedAt: string;
  itemCount: number;
  /**
   * When somebody at the desk first opened this order's own screen. `null`
   * means nobody has — which is what the order book marks "New".
   *
   * Deliberately not a status: `status` records what has been *done* to an
   * order, and an untouched order and a much-discussed one are
   * otherwise the same row. See `supabase/sql/0023_order_opened.sql`.
   */
  firstOpenedAt: string | null;
}

/**
 * A delivery address as it was at the moment of sale.
 *
 * Denormalised onto `"Order"`, not a pointer into an address book: a shipping
 * address is a snapshot of where a parcel went, and a customer correcting their
 * saved address later must not rewrite the label on a parcel already sent.
 *
 * Every field is nullable because a walk-in carries their own bottle home.
 */
export interface OrderShippingAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

/** An order on its own screen — everything the list omits. */
export interface AdminOrderDetail extends AdminOrderSummary {
  customerEmail: string | null;
  customerPhone: string | null;
  note: string | null;
  subtotalInCents: number;
  shipInCents: number;
  /** Set once the units went back on the shelf; the restock guard. */
  stockReleasedAt: string | null;
  /** `CARD` or `CASH`. Every pre-checkout row reads `CASH`, correctly. */
  paymentMethod: PaymentMethod;
  /** Which language this customer is written to in. */
  locale: "en" | "ar";
  /** Printed on the parcel. Empty of everything for a walk-in. */
  shipping: OrderShippingAddress;
  /** Stripe's id for the intent that paid this, when one did. */
  stripePaymentIntentId: string | null;
  /** When the money actually landed. Null for an unpaid order. */
  paidAt: string | null;
  /** Set once the parcel is with the courier. */
  trackingCode: string | null;
  /** The Discovery Credit spent on this order, if one was. */
  creditId: string | null;
  /**
   * What that credit took off the total.
   *
   * Distinct from the credit's face value: a credit larger than the subtotal is
   * capped here and forfeits the difference. Zero on every order that spent none.
   */
  creditAppliedInCents: number;
  /** The discount code spent on this order, if one was. */
  discountId: string | null;
  /**
   * The code **as it was at the time**, snapshotted like `OrderItem.productName`
   * — a code renamed or deleted later must still print correctly here.
   */
  discountCode: string | null;
  /** What that code took off. Zero on every order that used none. */
  discountInCents: number;
  lines: readonly AdminOrderLine[];
}

/**
 * One day on a chart.
 *
 * `day` is `YYYY-MM-DD` because that is the only string form
 * lightweight-charts accepts for a business-day scale, and `value` is already
 * in the unit the axis prints — pounds for revenue, units for volume — so the
 * client component performs no arithmetic on money.
 */
export interface SalesPoint {
  day: string;
  orderCount: number;
  units: number;
  revenueInCents: number;
}

/** A product ranked by what it sold in the window. */
export interface ProductSalesRow {
  productSlug: string;
  productName: string;
  units: number;
  revenueInCents: number;
}

/** Online versus offline, for the window. */
export interface ChannelSplitRow {
  channel: OrderChannel;
  orderCount: number;
  revenueInCents: number;
}

/** The headline figures above the charts. */
export interface SalesTotals {
  revenueInCents: number;
  orderCount: number;
  units: number;
  /** `PROCESSING` — what the desk still owes somebody. */
  awaitingFulfilment: number;
  /**
   * Orders nobody has opened yet. A state rather than a window, exactly like
   * {@link SalesTotals.awaitingFulfilment}: it counts every unopened order
   * however old, because an order forgotten three weeks ago is the one that
   * most needs saying out loud.
   */
  unopened: number;
}

/** A row of the inventory screen: what is on the shelf, and how fast it leaves. */
export interface InventoryRow {
  slug: string;
  name: string;
  sku: string;
  collectionSlug: string;
  priceInCents: number;
  /** The maintained total, kept by trigger at online + offline. */
  inventory: number;
  /** What the website may sell. A visitor sees "sold out" when this is 0. */
  inventoryOnline: number;
  /** What the counter may sell. Never drawn on by the storefront. */
  inventoryOffline: number;
  isArchived: boolean;
  unitsSoldRecently: number;
}

/** The stock counter an operation addresses. Mirrors `"OrderChannel"`. */
export type InventoryChannel = "ONLINE" | "OFFLINE";

/** What kind of event a stock movement records. Mirrors `"InventoryAction"`. */
export type InventoryAction =
  | "SALE"
  | "RESTOCK"
  | "RECEIPT"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

/**
 * One line of the stock ledger.
 *
 * `previousQuantity + quantity = newQuantity` is enforced by a check constraint
 * in `supabase/sql/0042_inventory_channels.sql`, so a row can be read as an
 * explanation rather than merely a description.
 */
export interface InventoryMovement {
  id: string;
  productSlug: string;
  channel: InventoryChannel;
  action: InventoryAction;
  /** Signed: negative took units away. */
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  actor: string | null;
  orderId: string | null;
  createdAt: string;
}
