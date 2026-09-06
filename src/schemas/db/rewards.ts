/**
 * Row schemas for the points ledger.
 *
 * Same rules as `./credits.ts`, and the same authority:
 * `supabase/sql/0059_rewards.sql` grants the public roles nothing, because these
 * rows name a customer and something worth money.
 */

import { z } from "zod";

import type {
  PointsPreview,
  PointsTransaction,
  RewardBalance,
} from "@/src/types/rewards";

import { parseList } from "./catalog";

export const pointsSourceSchema = z.enum([
  "PURCHASE",
  "SIGNUP",
  "FIRST_PURCHASE",
  "REVIEW",
  "REFERRAL",
  "ADMIN_ADJUSTMENT",
  "REFUND_REVERSAL",
  "REDEMPTION",
  "EXPIRATION",
]);

export const pointsRefusalCodeSchema = z.enum([
  "DISABLED",
  "NOT_SIGNED_IN",
  "BELOW_MINIMUM",
  "INSUFFICIENT",
  "NOTHING_TO_REDUCE",
  "INVALID",
  "UNKNOWN",
]);

export const POINTS_TRANSACTION_COLUMNS =
  "id, clerkUserId, amount, source, orderId, referenceId, note, actor, " +
  "occurredAt, expiresAt";

const pointsTransactionRowSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  amount: z.coerce.number(),
  source: pointsSourceSchema,
  orderId: z.string().nullable().default(null),
  referenceId: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  actor: z.string().nullable().default(null),
  occurredAt: z.string(),
  expiresAt: z.string().nullable().default(null),
});

export function toPointsTransaction(row: unknown): PointsTransaction | null {
  const parsed = pointsTransactionRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** Read from `reward_balances`, never summed in TypeScript. */
export const REWARD_BALANCE_COLUMNS =
  "clerkUserId, balancePoints, lifetimeEarned, lifetimeRedeemed, " +
  "expiredPoints, adjustedPoints, lastMovementAt";

const rewardBalanceRowSchema = z.object({
  clerkUserId: z.string(),
  // A `sum()` comes back as a string once it leaves the safe integer range.
  balancePoints: z.coerce.number().default(0),
  lifetimeEarned: z.coerce.number().default(0),
  lifetimeRedeemed: z.coerce.number().default(0),
  expiredPoints: z.coerce.number().default(0),
  adjustedPoints: z.coerce.number().default(0),
  lastMovementAt: z.string().nullable().default(null),
});

export function toRewardBalance(row: unknown): RewardBalance | null {
  const parsed = rewardBalanceRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** What `resolve_points_redemption()` answers with. */
const pointsPreviewSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    points: z.coerce.number(),
    amountInCents: z.coerce.number(),
  }),
  z.object({
    ok: z.literal(false),
    reasonCode: pointsRefusalCodeSchema.catch("UNKNOWN"),
    reason: z.string(),
  }),
]);

export function toPointsPreview(row: unknown): PointsPreview | null {
  const parsed = pointsPreviewSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
