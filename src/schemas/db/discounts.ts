/**
 * Row schemas for the discount engine.
 *
 * Same rules as its neighbours: explicit column lists, rows parsed rather than
 * asserted, one malformed row dropped rather than a blanked screen. Everything
 * reads with the secret key — `supabase/sql/0028_discounts.sql` grants the
 * public roles nothing, and a grant row names a person's email.
 */

import { z } from "zod";

import type {
  Discount,
  DiscountGrant,
  DiscountRedemption,
} from "@/src/types/discount";

import { parseList } from "./catalog";

export const discountKindSchema = z.enum(["PERCENTAGE", "FIXED"]);
export const discountScopeSchema = z.enum(["ALL", "PRODUCTS", "COLLECTIONS"]);

export const DISCOUNT_COLUMNS =
  "id, code, kind, value, isActive, startsAt, endsAt, totalUseLimit, " +
  "perCustomerLimit, minimumOrderInCents, appliesTo, requiresGrant, " +
  "description, createdAt";

const discountRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: discountKindSchema,
  value: z.coerce.number(),
  isActive: z.boolean().default(true),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  totalUseLimit: z.coerce.number().nullable().default(null),
  perCustomerLimit: z.coerce.number().nullable().default(null),
  minimumOrderInCents: z.coerce.number().default(0),
  appliesTo: discountScopeSchema.catch("ALL"),
  requiresGrant: z.boolean().default(false),
  description: z.string().nullable().default(null),
  createdAt: z.string(),
});

export function toDiscount(row: unknown): Discount | null {
  const parsed = discountRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const DISCOUNT_GRANT_COLUMNS =
  "id, discountId, email, clerkUserId, issuedAt, expiresAt, usedAt, usedOrderId";

const grantRowSchema = z.object({
  id: z.string(),
  discountId: z.string(),
  email: z.string(),
  clerkUserId: z.string().nullable().default(null),
  issuedAt: z.string(),
  expiresAt: z.string().nullable().default(null),
  usedAt: z.string().nullable().default(null),
  usedOrderId: z.string().nullable().default(null),
});

export function toDiscountGrant(row: unknown): DiscountGrant | null {
  const parsed = grantRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** The embedded order number gives the desk something to click through to. */
export const DISCOUNT_REDEMPTION_COLUMNS =
  "id, orderId, email, amountInCents, redeemedAt, releasedAt, " +
  "order:Order(orderNumber, totalInCents)";

const redemptionRowSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  email: z.string().nullable().default(null),
  amountInCents: z.coerce.number(),
  redeemedAt: z.string(),
  releasedAt: z.string().nullable().default(null),
  // PostgREST renders a to-one embed as an object on some versions and a
  // single-element array on others — the union `catalog.ts` uses, same reason.
  order: z
    .union([
      z.object({ orderNumber: z.string(), totalInCents: z.coerce.number() }),
      z
        .array(z.object({ orderNumber: z.string(), totalInCents: z.coerce.number() }))
        .min(1),
    ])
    .nullable()
    .default(null),
});

export function toDiscountRedemption(row: unknown): DiscountRedemption | null {
  const parsed = redemptionRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { order, ...redemption } = parsed.data;
  const resolved = Array.isArray(order) ? order[0] : order;

  return { ...redemption, orderNumber: resolved?.orderNumber ?? null };
}

/** The order total that came with a redemption, for the revenue figure. */
export function redemptionOrderTotal(row: unknown): number {
  const parsed = redemptionRowSchema.safeParse(row);
  if (!parsed.success) return 0;

  const order = Array.isArray(parsed.data.order)
    ? parsed.data.order[0]
    : parsed.data.order;

  return order?.totalInCents ?? 0;
}

export { parseList };
