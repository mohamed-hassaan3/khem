/**
 * Row schemas for the customer directory.
 *
 * Same rules as `schemas/db/orders.ts`: explicit column lists, rows parsed
 * rather than asserted, one malformed row dropped rather than a blanked screen.
 * And the same authority — `supabase/sql/0024_customers.sql` grants the public
 * roles nothing on `"User"` or `"Address"`, so every consumer runs on the
 * server behind `requireAdmin()` or behind a verified Clerk session.
 *
 * The types live in `src/types/customer.ts` rather than being inferred here,
 * because the customer vocabulary is read by two surfaces — the desk and the
 * account portal — which makes it part of the site's language rather than one
 * screen's projection.
 */

import { z } from "zod";

import type {
  AdminCustomerOrder,
  AdminCustomerSummary,
  CustomerAddress,
} from "@/src/types/customer";

import { parseList } from "./catalog";
import {
  orderChannelSchema,
  orderStatusSchema,
  paymentStatusSchema,
} from "./orders";

/**
 * `bigint` comes back from PostgREST as a *string* once it exceeds the safe
 * integer range and as a number below it — the same coercion
 * `salesPointRowSchema` needs, and for the same reason: a boutique that has a
 * very good year must not blank its own customer list.
 */
const money = z.coerce.number();

const customerRowSchema = z.object({
  id: z.string(),
  clerkId: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  name: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  hasAccount: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
  marketingOptInAt: z.string().nullable().default(null),
  orderCount: z.coerce.number().default(0),
  lifetimeSpendInCents: money.default(0),
  lastOrderAt: z.string().nullable().default(null),
  joinedAt: z.string().nullable().default(null),
});

/**
 * The paged variant.
 *
 * `customer_summary()` carries the pre-limit match count on every row — a
 * window function rather than a second query, so the pager cannot disagree with
 * the list it is paging.
 */
const customerSummaryRowSchema = customerRowSchema.extend({
  totalCount: z.coerce.number().default(0),
});

export function toAdminCustomer(row: unknown): AdminCustomerSummary | null {
  const parsed = customerRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** Returns the row *and* the total, since the total arrives attached to it. */
export function toAdminCustomerWithTotal(
  row: unknown,
): { customer: AdminCustomerSummary; total: number } | null {
  const parsed = customerSummaryRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { totalCount, ...customer } = parsed.data;
  return { customer, total: totalCount };
}

// ── Addresses ─────────────────────────────────────────────────

/**
 * Never `select('*')` on `"Address"`: the row is somebody's home, and a screen
 * that needs a city has no business shipping the timestamps with it.
 */
export const ADDRESS_COLUMNS =
  'id, label, recipient, line1, line2, city, state, postalCode, country, isDefault';

/**
 * Exported because `src/services/account.ts` parses the customer's own
 * addresses with it. `SavedAddress` and `CustomerAddress` are structurally
 * identical — see the note on `CustomerAddress` for why they remain two named
 * types — so one row schema serves both, and the embedded `user` join the
 * account query adds is stripped by Zod rather than needing its own shape.
 */
export const savedAddressSchema = z.object({
  id: z.string(),
  label: z.string(),
  recipient: z.string(),
  line1: z.string(),
  line2: z.string().nullable().default(null),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  isDefault: z.boolean().default(false),
});

export function toCustomerAddress(row: unknown): CustomerAddress | null {
  const parsed = savedAddressSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Orders on a customer's record ─────────────────────────────

const customerOrderRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  placedAt: z.string(),
  status: orderStatusSchema,
  paymentStatus: paymentStatusSchema,
  channel: orderChannelSchema,
  totalInCents: z.coerce.number(),
  firstOpenedAt: z.string().nullable().default(null),
});

export function toAdminCustomerOrder(row: unknown): AdminCustomerOrder | null {
  const parsed = customerOrderRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
