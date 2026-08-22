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

/** Where a sale came from. Both draw stock from the same website inventory. */
export type OrderChannel = "ONLINE" | "OFFLINE";

/** Mirrors the §9 `PaymentStatus` enum and the Postgres type of the same name. */
export type PaymentStatus = "UNPAID" | "PAID" | "FAILED" | "REFUNDED";

/** One line of an order as the desk prints it — name and price are snapshots. */
export interface AdminOrderLine {
  id: string;
  productSlug: string;
  productName: string;
  quantity: number;
  priceInCents: number;
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
  /** `PENDING` + `PROCESSING` — what the desk still owes somebody. */
  awaitingFulfilment: number;
}

/** A row of the inventory screen: what is on the shelf, and how fast it leaves. */
export interface InventoryRow {
  slug: string;
  name: string;
  sku: string;
  collectionSlug: string;
  priceInCents: number;
  inventory: number;
  isArchived: boolean;
  unitsSoldRecently: number;
}
