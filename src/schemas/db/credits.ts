/**
 * Row schemas for the Discovery Credit ledger.
 *
 * Same rules as its neighbours: explicit column lists, rows parsed rather than
 * asserted, one malformed row dropped rather than a blanked screen. And the
 * same authority — `supabase/sql/0026_discovery_credits.sql` grants the public
 * roles nothing, because these rows name a customer and an amount of money.
 */

import { z } from "zod";

import type { Credit, CreditTransaction } from "@/src/types/credit";

import { parseList } from "./catalog";

export const creditStatusSchema = z.enum([
  "PENDING_DELIVERY",
  "AVAILABLE",
  "REDEEMED",
  "EXPIRED",
  "CANCELLED",
]);

export const creditTransactionKindSchema = z.enum([
  "EARNED",
  "USED",
  "REFUNDED",
  "EXPIRED",
  "ADJUSTED",
]);

/** Read from `credit_balances`, never from `customer_credits` directly. */
export const CREDIT_COLUMNS =
  "id, clerkUserId, sourceOrderId, sourceOrderItemId, unitIndex, " +
  "amountInCents, earnedAt, deliveredAt, expiresAt, cancelledAt, " +
  "balanceInCents, status";

const creditRowSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  sourceOrderId: z.string(),
  sourceOrderItemId: z.string(),
  unitIndex: z.coerce.number().default(0),
  amountInCents: z.coerce.number(),
  earnedAt: z.string(),
  deliveredAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  cancelledAt: z.string().nullable().default(null),
  // A `sum()` comes back as a string once it leaves the safe integer range.
  balanceInCents: z.coerce.number().default(0),
  status: creditStatusSchema,
});

export function toCredit(row: unknown): Credit | null {
  const parsed = creditRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CREDIT_TRANSACTION_COLUMNS =
  "id, creditId, kind, amountInCents, orderId, note, actor, occurredAt";

const creditTransactionRowSchema = z.object({
  id: z.string(),
  creditId: z.string(),
  kind: creditTransactionKindSchema,
  amountInCents: z.coerce.number(),
  orderId: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  actor: z.string().nullable().default(null),
  occurredAt: z.string(),
});

export function toCreditTransaction(row: unknown): CreditTransaction | null {
  const parsed = creditTransactionRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
