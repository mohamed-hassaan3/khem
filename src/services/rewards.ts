import "server-only";

/**
 * A customer's own KHEM Points.
 *
 * Split from `src/services/admin/rewards.ts` because the authorisation is
 * different: that file sits behind `requireAdmin()` and may read anybody's
 * balance, this one is reached by the customer whose points they are.
 *
 * **`clerkUserId` must arrive from `await auth()` on the server** — never a
 * route param, a search param, or a form field. Same obligation as
 * `creditsForUser()` and for the same reason: `supabase/sql/0059_rewards.sql`
 * grants the public roles nothing, so the filter *is* the access control.
 *
 * Note that a balance returned here is not a permission to spend it.
 * Eligibility is decided inside `place_order()`, under an advisory lock, against
 * the order actually being written — a figure rendered seconds ago is a
 * suggestion, not an entitlement.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  POINTS_TRANSACTION_COLUMNS,
  REWARD_BALANCE_COLUMNS,
  parseList,
  toPointsPreview,
  toPointsTransaction,
  toRewardBalance,
} from "@/src/schemas/db/rewards";
import { getBenefitSettings } from "@/src/services/benefits";
import type { BenefitSettings } from "@/src/types/benefits";
import type {
  CustomerRewards,
  PointsPreview,
  RewardBalance,
  RewardLedgerEntry,
} from "@/src/types/rewards";
import { EMPTY_BALANCE } from "@/src/types/rewards";

/** What a balance is worth, at the rate currently configured. */
export function pointsToCents(
  points: number,
  settings: Pick<BenefitSettings, "redeemPoints" | "redeemValueInCents">,
): number {
  if (points <= 0 || settings.redeemPoints <= 0) return 0;

  // Floored, matching `resolve_points_redemption()`. A figure a customer is
  // shown must never be larger than the one the checkout will honour.
  return Math.floor((points * settings.redeemValueInCents) / settings.redeemPoints);
}

/** The balance row, or a zeroed one for somebody who has never held a point. */
export async function rewardBalanceForUser(
  clerkUserId: string,
): Promise<RewardBalance> {
  const empty: RewardBalance = { clerkUserId, ...EMPTY_BALANCE };

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("reward_balances")
    .select(REWARD_BALANCE_COLUMNS)
    .eq("clerkUserId", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error(`[rewards] rewardBalanceForUser failed: ${error.message}`);
    return empty;
  }

  return toRewardBalance(data) ?? empty;
}

/**
 * Everything the account panel says about points, in one read.
 *
 * Two round trips, not one per figure: the balance, then the movements, then the
 * order numbers those movements name. `points_transactions` stores an order
 * *uuid*, and "Order KHEM-2026-1042" is the only form of it a customer has ever
 * been shown — the same substitution `creditLedgerForUser()` makes.
 *
 * The conversion figures are computed here rather than in the component. A
 * number the customer is told is money, and money is worked out where the rows
 * and the rate are.
 */
export async function rewardsForUser(
  clerkUserId: string,
): Promise<CustomerRewards> {
  const settings = await getBenefitSettings();

  const blank: CustomerRewards = {
    enabled: settings.rewardsEnabled,
    balancePoints: 0,
    valueInCents: 0,
    minRedeemPoints: settings.minRedeemPoints,
    pointsToNextReward: settings.minRedeemPoints,
    nextRewardInCents: pointsToCents(settings.minRedeemPoints, settings),
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    expiredPoints: 0,
    entries: [],
  };

  if (!settings.rewardsEnabled) return blank;

  const supabase = getSupabaseAdmin();
  if (!supabase) return blank;

  const balance = await rewardBalanceForUser(clerkUserId);

  const { data, error } = await supabase
    .from("points_transactions")
    .select(POINTS_TRANSACTION_COLUMNS)
    .eq("clerkUserId", clerkUserId)
    .order("occurredAt", { ascending: false })
    .limit(100);

  if (error) {
    console.error(`[rewards] rewardsForUser failed: ${error.message}`);
  }

  const movements = parseList(data, toPointsTransaction);

  const orderIds = [
    ...new Set(
      movements
        .map((movement) => movement.orderId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const numbers = new Map<string, string>();

  if (orderIds.length > 0) {
    const { data: orders, error: orderError } = await supabase
      .from("Order")
      .select("id, orderNumber")
      .in("id", orderIds);

    if (orderError) {
      // A missing order number costs the row its reference and nothing else.
      console.error(`[rewards] order numbers failed: ${orderError.message}`);
    }

    for (const row of orders ?? []) {
      const id = (row as { id?: unknown }).id;
      const number = (row as { orderNumber?: unknown }).orderNumber;
      if (typeof id === "string" && typeof number === "string") {
        numbers.set(id, number);
      }
    }
  }

  const entries: RewardLedgerEntry[] = movements.map((movement) => ({
    id: movement.id,
    amount: movement.amount,
    source: movement.source,
    orderNumber:
      movement.orderId === null ? null : (numbers.get(movement.orderId) ?? null),
    note: movement.note,
    occurredAt: movement.occurredAt,
    expiresAt: movement.expiresAt,
  }));

  /*
   * "60 points away from your next reward."
   *
   * Below the minimum, the next reward *is* the minimum — that is the number the
   * customer is working toward. Above it, the next step is the next whole
   * multiple of the conversion, so the sentence stays true as the balance grows
   * rather than only being true once.
   */
  const step = settings.redeemPoints;
  const balancePoints = balance.balancePoints;

  const nextTarget =
    balancePoints < settings.minRedeemPoints
      ? settings.minRedeemPoints
      : (Math.floor(balancePoints / step) + 1) * step;

  return {
    enabled: true,
    balancePoints,
    valueInCents: pointsToCents(balancePoints, settings),
    minRedeemPoints: settings.minRedeemPoints,
    pointsToNextReward: Math.max(0, nextTarget - balancePoints),
    nextRewardInCents: pointsToCents(nextTarget, settings),
    lifetimeEarned: balance.lifetimeEarned,
    lifetimeRedeemed: balance.lifetimeRedeemed,
    expiredPoints: balance.expiredPoints,
    entries,
  };
}

/**
 * What redeeming this many points would be worth, before there is an order.
 *
 * A thin pair over `resolve_points_redemption()`, which does all the deciding.
 * Resolved **without a lock**, because it consumes nothing and must not hold one
 * while somebody reads their screen. The same request is resolved again, under
 * the advisory lock, inside the transaction `place_order()` runs — and that is
 * what the customer is charged. If the two ever disagree, the order is right.
 *
 * A TypeScript re-implementation of these rules would be a second definition of
 * what a customer is owed, and it would agree with the first only until somebody
 * edited one of them.
 */
export async function previewPointsRedemption(request: {
  clerkUserId: string;
  points: number;
  remainingInCents: number;
}): Promise<PointsPreview> {
  const unavailable: PointsPreview = {
    ok: false,
    reasonCode: "UNKNOWN",
    reason: "Those points could not be checked just now.",
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[rewards] SUPABASE_SECRET_KEY is not set; no preview.");
    return unavailable;
  }

  const { data, error } = await supabase.rpc("resolve_points_redemption", {
    payload: {
      clerkUserId: request.clerkUserId,
      points: request.points,
      remainingInCents: request.remainingInCents,
    },
  });

  if (error) {
    console.error(`[rewards] previewPointsRedemption failed: ${error.message}`);
    return unavailable;
  }

  return toPointsPreview(data) ?? unavailable;
}
