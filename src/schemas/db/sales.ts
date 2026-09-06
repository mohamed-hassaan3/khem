/**
 * Row schemas for the sales & profitability ledger.
 *
 * House rules, unchanged from `./orders.ts`: an explicit column list rather
 * than `select('*')`, rows parsed rather than asserted, and one malformed row
 * dropped instead of a blanked screen.
 *
 * The `.default(…)` and `.nullable()` scattered through here are the same
 * defensive posture the order schemas take — a deployment running ahead of
 * `supabase/sql/0062_sales_ledger.sql` must degrade to a missing figure, not to
 * an empty Items Sold table with no explanation on it.
 */

import { z } from "zod";

import type {
  SalesLedgerProductRow,
  SalesLedgerRow,
  SalesLedgerSummary,
} from "@/src/types/sales";

import { parseList } from "./catalog";
import { orderChannelSchema, orderStatusSchema, paymentStatusSchema } from "./orders";

/**
 * Everything the Items Sold table prints or filters on.
 *
 * Written out rather than `*` for the reason every projection in this codebase
 * is: a column added to the view later should reach a screen because somebody
 * decided it should, not because a wildcard swept it up.
 */
export const SALES_LEDGER_COLUMNS =
  "id, orderId, orderItemId, orderNumber, channel, soldAt, " +
  "productSlug, productName, sku, collectionSlug, collectionName, quantity, " +
  "originalUnitPriceInCents, originalLineTotalInCents, " +
  "promotionDiscountInCents, offerDiscountInCents, couponDiscountInCents, " +
  "pointsDiscountInCents, creditDiscountInCents, totalDiscountInCents, " +
  "paidInCents, freeUnits, isFree, discountSources, " +
  "promotionId, offerId, offerLabel, discountId, discountCode, creditId, " +
  "unitCostInCents, totalCostInCents, grossProfitInCents, " +
  "orderStatus, paymentStatus, customerName, saleStatus, countsAsRevenue";

export const saleStatusSchema = z.enum(["SOLD", "PAID", "REFUNDED", "CANCELLED"]);

export const discountSourceSchema = z.enum([
  "PROMOTION",
  "OFFER",
  "COUPON",
  "REWARDS",
  "DISCOVERY_CREDIT",
]);

/**
 * `bigint` and `numeric` come back from PostgREST as strings once they leave
 * the safe integer range, and as numbers below it. Coerced throughout, so a
 * boutique that has a very good year does not blank its own report.
 */
const money = z.coerce.number();

const salesLedgerRowSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderItemId: z.string(),
  orderNumber: z.string(),
  channel: orderChannelSchema,
  soldAt: z.string(),

  productSlug: z.string(),
  productName: z.string(),
  sku: z.string().nullable().default(null),
  collectionSlug: z.string().nullable().default(null),
  collectionName: z.string().nullable().default(null),

  quantity: z.coerce.number(),

  originalUnitPriceInCents: money,
  originalLineTotalInCents: money,

  promotionDiscountInCents: money.default(0),
  offerDiscountInCents: money.default(0),
  couponDiscountInCents: money.default(0),
  pointsDiscountInCents: money.default(0),
  creditDiscountInCents: money.default(0),
  totalDiscountInCents: money.default(0),

  paidInCents: money,
  freeUnits: z.coerce.number().default(0),
  isFree: z.boolean().default(false),
  /*
   * A Postgres `text[]`, which PostgREST returns as a JSON array. Unknown
   * members are dropped rather than rejected: a sixth instrument added to the
   * database before this deployment knows about it must not take the row with
   * it.
   */
  discountSources: z
    .array(z.string())
    .default([])
    .transform((values) =>
      values.filter(
        (value): value is z.infer<typeof discountSourceSchema> =>
          discountSourceSchema.safeParse(value).success,
      ),
    ),

  promotionId: z.string().nullable().default(null),
  offerId: z.string().nullable().default(null),
  offerLabel: z.string().nullable().default(null),
  discountId: z.string().nullable().default(null),
  discountCode: z.string().nullable().default(null),
  creditId: z.string().nullable().default(null),

  // Nullable and *not* defaulted to zero. Null means the cost was never
  // stated, and the screens say so — see `src/types/sales.ts`.
  unitCostInCents: money.nullable().default(null),
  totalCostInCents: money.nullable().default(null),
  grossProfitInCents: money.nullable().default(null),

  orderStatus: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  customerName: z.string(),
  saleStatus: saleStatusSchema,
  countsAsRevenue: z.boolean(),
});

export function toSalesLedgerRow(row: unknown): SalesLedgerRow | null {
  const parsed = salesLedgerRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const salesLedgerSummarySchema = z.object({
  orderCount: z.coerce.number().default(0),
  lineCount: z.coerce.number().default(0),
  units: z.coerce.number().default(0),
  originalInCents: money.default(0),
  discountInCents: money.default(0),
  revenueInCents: money.default(0),
  costInCents: money.nullable().default(null),
  profitInCents: money.nullable().default(null),
  costedRevenueInCents: money.default(0),
  linesMissingCost: z.coerce.number().default(0),
  refundedOrderCount: z.coerce.number().default(0),
  refundedRevenueInCents: money.default(0),
  freeLineCount: z.coerce.number().default(0),
});

export function toSalesLedgerSummary(row: unknown): SalesLedgerSummary | null {
  const parsed = salesLedgerSummarySchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** A window with no sales in it. Rendered, never thrown. */
export const EMPTY_SALES_SUMMARY: SalesLedgerSummary = {
  orderCount: 0,
  lineCount: 0,
  units: 0,
  originalInCents: 0,
  discountInCents: 0,
  revenueInCents: 0,
  costInCents: null,
  profitInCents: null,
  costedRevenueInCents: 0,
  linesMissingCost: 0,
  refundedOrderCount: 0,
  refundedRevenueInCents: 0,
  freeLineCount: 0,
};

const salesLedgerProductRowSchema = z.object({
  productSlug: z.string(),
  productName: z.string(),
  sku: z.string().nullable().default(null),
  collectionName: z.string().nullable().default(null),
  units: z.coerce.number().default(0),
  orderCount: z.coerce.number().default(0),
  originalInCents: money.default(0),
  discountInCents: money.default(0),
  revenueInCents: money.default(0),
  costInCents: money.nullable().default(null),
  profitInCents: money.nullable().default(null),
  costedRevenueInCents: money.default(0),
  linesMissingCost: z.coerce.number().default(0),
});

export function toSalesLedgerProductRow(
  row: unknown,
): SalesLedgerProductRow | null {
  const parsed = salesLedgerProductRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
