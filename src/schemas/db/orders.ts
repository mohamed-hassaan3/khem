/**
 * Row schemas for orders and the sales reports.
 *
 * Same rules as `schemas/db/admin.ts`: explicit column lists, rows parsed
 * rather than asserted, one malformed row dropped rather than a blanked
 * screen. What differs is who may read them — nothing in `supabase/sql/0015`
 * is readable with the publishable key, so every consumer of this module runs
 * on the server behind `requireAdmin()` or behind a verified Clerk session.
 *
 * The types live in `src/types/order.ts` rather than being inferred here,
 * because unlike the dashboard-only shapes in `schemas/db/admin.ts` these are
 * read by two surfaces — the desk and the customer portal — which makes them
 * part of the site's vocabulary rather than one screen's projection.
 */

import { z } from "zod";

import type {
  AdminOrderDetail,
  AdminOrderLine,
  AdminOrderSummary,
  ChannelSplitRow,
  ProductSalesRow,
  SalesPoint,
} from "@/src/types/order";

import { parseList } from "./catalog";

export const orderStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const paymentStatusSchema = z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED"]);

export const orderChannelSchema = z.enum(["ONLINE", "OFFLINE"]);

/**
 * Added by `supabase/sql/0016_checkout.sql`.
 *
 * `.catch("CASH")` rather than a bare enum: the column has a `not null default
 * 'CASH'`, so a row can only be one of the two — but a *stale deployment*
 * reading a database that has moved ahead would otherwise blank the whole
 * order screen over one unrecognised value. The house rule is one malformed row
 * dropped, never a blanked screen; this applies it to one field.
 */
export const paymentMethodSchema = z.enum(["CARD", "CASH"]).catch("CASH");

// ── Order ─────────────────────────────────────────────────────

/**
 * Never `select('*')` on `"Order"`: the row carries the customer's email,
 * phone and the desk's private note, and a list screen has no business
 * shipping any of the three into a page payload.
 */
export const ORDER_SUMMARY_COLUMNS =
  'id, orderNumber, customerName, status, paymentStatus, channel, ' +
  'totalInCents, placedAt, items:OrderItem(quantity)';

export const ORDER_DETAIL_COLUMNS =
  'id, orderNumber, customerName, customerEmail, customerPhone, note, ' +
  'status, paymentStatus, paymentMethod, channel, locale, ' +
  'subtotalInCents, shipInCents, totalInCents, stockReleasedAt, placedAt, ' +
  'trackingCode, stripePaymentIntentId, paidAt, ' +
  'shipLine1, shipLine2, shipCity, shipState, shipPostalCode, shipCountry, ' +
  'items:OrderItem(id, productSlug, productName, quantity, priceInCents)';

const orderLineRowSchema = z.object({
  id: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  quantity: z.number(),
  priceInCents: z.number(),
});

/**
 * The embedded `items` array is the only place the count comes from.
 *
 * PostgREST can return an aggregate count of an embedded resource, but only
 * through a syntax that changes shape between versions; summing an array of
 * `{ quantity }` is two lines here and cannot silently start returning
 * something else.
 */
const orderSummaryRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  channel: orderChannelSchema,
  totalInCents: z.number(),
  placedAt: z.string(),
  items: z.array(z.object({ quantity: z.number() })).default([]),
});

const orderDetailRowSchema = orderSummaryRowSchema
  .omit({ items: true })
  .extend({
    customerEmail: z.string().nullable().default(null),
    customerPhone: z.string().nullable().default(null),
    note: z.string().nullable().default(null),
    subtotalInCents: z.number(),
    shipInCents: z.number(),
    stockReleasedAt: z.string().nullable().default(null),
    paymentMethod: paymentMethodSchema,
    // Same defensive `.catch` as the method, and the same reason: a third
    // locale arriving before this deployment knows about it must not blank the
    // desk's screen.
    locale: z.enum(["en", "ar"]).catch("en"),
    trackingCode: z.string().nullable().default(null),
    stripePaymentIntentId: z.string().nullable().default(null),
    paidAt: z.string().nullable().default(null),
    shipLine1: z.string().nullable().default(null),
    shipLine2: z.string().nullable().default(null),
    shipCity: z.string().nullable().default(null),
    shipState: z.string().nullable().default(null),
    shipPostalCode: z.string().nullable().default(null),
    shipCountry: z.string().nullable().default(null),
    items: z.array(orderLineRowSchema).default([]),
  });

function countItems(items: readonly { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function toAdminOrderSummary(row: unknown): AdminOrderSummary | null {
  const parsed = orderSummaryRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { items, ...order } = parsed.data;
  return { ...order, itemCount: countItems(items) };
}

export function toAdminOrderDetail(row: unknown): AdminOrderDetail | null {
  const parsed = orderDetailRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    items,
    shipLine1,
    shipLine2,
    shipCity,
    shipState,
    shipPostalCode,
    shipCountry,
    ...order
  } = parsed.data;

  // Lines print in the order they were sold; the database has no sort column
  // for them because an order is not an editorial sequence.
  const lines: AdminOrderLine[] = [...items].sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );

  return {
    ...order,
    itemCount: countItems(items),
    lines,
    // Gathered into one object rather than six flat fields, so a component can
    // ask "is there an address?" once instead of six times.
    shipping: {
      line1: shipLine1,
      line2: shipLine2,
      city: shipCity,
      state: shipState,
      postalCode: shipPostalCode,
      country: shipCountry,
    },
  };
}

/**
 * The customer's own view of their order.
 *
 * Narrower than the desk's on purpose: no email, no phone, and above all no
 * `note` — that column is the boutique talking to itself. Exported as a schema
 * rather than a `to…()` helper because `src/services/account.ts` maps the
 * embedded lines into `OrderSummary.lines` in the same pass.
 */
export const customerOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  placedAt: z.string(),
  status: orderStatusSchema,
  totalInCents: z.number(),
  trackingCode: z.string().nullable().default(null),
  items: z
    .array(z.object({ productName: z.string(), quantity: z.number() }))
    .default([]),
});

// ── Reports ───────────────────────────────────────────────────

const salesPointRowSchema = z.object({
  day: z.string(),
  orderCount: z.number(),
  units: z.number(),
  // `bigint` comes back from PostgREST as a string once it exceeds the safe
  // integer range, and as a number below it. Coerce, so a boutique that has a
  // very good year does not blank its own chart.
  revenueInCents: z.coerce.number(),
});

export function toSalesPoint(row: unknown): SalesPoint | null {
  const parsed = salesPointRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const productSalesRowSchema = z.object({
  productSlug: z.string(),
  productName: z.string(),
  units: z.number(),
  revenueInCents: z.coerce.number(),
});

export function toProductSalesRow(row: unknown): ProductSalesRow | null {
  const parsed = productSalesRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const channelSplitRowSchema = z.object({
  channel: orderChannelSchema,
  orderCount: z.number(),
  revenueInCents: z.coerce.number(),
});

export function toChannelSplitRow(row: unknown): ChannelSplitRow | null {
  const parsed = channelSplitRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
