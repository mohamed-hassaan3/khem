import "server-only";

/**
 * Points reads for the dashboard.
 *
 * `getSupabaseAdmin()` for `./credits.ts`'s reason:
 * `supabase/sql/0059_rewards.sql` grants the public roles nothing, because these
 * rows name a customer and something worth money. Every caller sits behind
 * `requireAdmin()`.
 *
 * ## Everything reads `reward_balances`, never the ledger directly
 *
 * The balance and the lifetime figures are derived there, once. A service that
 * summed the transactions itself would be a second definition of "what this
 * customer holds", and the two would disagree the first time the policy changed.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  POINTS_TRANSACTION_COLUMNS,
  REWARD_BALANCE_COLUMNS,
  parseList,
  toPointsTransaction,
  toRewardBalance,
} from "@/src/schemas/db/rewards";
import type {
  AdminRewardPage,
  PointsTransaction,
  RewardBalance,
} from "@/src/types/rewards";
import { EMPTY_BALANCE } from "@/src/types/rewards";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

export const REWARD_CUSTOMERS_PER_PAGE = 50;

const EMPTY_PAGE: AdminRewardPage = { customers: [], total: 0 };

/**
 * One page of customer balances, largest first.
 *
 * The name and address come from `"User"`, joined here rather than in SQL
 * because `reward_balances` is keyed on a Clerk id and `"User"` is the only
 * table that maps one to a person. A balance whose customer has closed their
 * account still lists — the points are a liability whether or not anybody is
 * left to spend them, and hiding it would hide it from the desk too.
 */
export async function listRewardCustomers(filter: {
  search?: string;
  offset?: number;
  limit?: number;
} = {}): Promise<AdminRewardPage> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_PAGE;

  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? REWARD_CUSTOMERS_PER_PAGE;
  const search = filter.search?.trim() ?? "";

  /*
   * A search names a person, and people live in `"User"`. So a search resolves
   * addresses to Clerk ids first and filters the balances by them; without a
   * search the balances lead. Two shapes rather than one join, because
   * PostgREST cannot join a view to a table that has no declared relationship
   * with it.
   */
  let ids: string[] | null = null;

  if (search.length > 0) {
    const { data, error } = await supabase
      .from("User")
      .select("clerkId")
      .or(
        `email.ilike.%${search}%,firstName.ilike.%${search}%,lastName.ilike.%${search}%`,
      )
      .limit(200);

    if (error) {
      logFailure("listRewardCustomers/search", error.message);
      return EMPTY_PAGE;
    }

    ids = (data ?? [])
      .map((row) => (row as { clerkId?: unknown }).clerkId)
      .filter((id): id is string => typeof id === "string");

    if (ids.length === 0) return EMPTY_PAGE;
  }

  let query = supabase
    .from("reward_balances")
    .select(REWARD_BALANCE_COLUMNS, { count: "exact" })
    .order("balancePoints", { ascending: false })
    .range(offset, offset + limit - 1);

  if (ids !== null) query = query.in("clerkUserId", ids);

  const { data, error, count } = await query;

  if (error) {
    logFailure("listRewardCustomers", error.message);
    return EMPTY_PAGE;
  }

  const balances = parseList(data, toRewardBalance);
  const named = await namesFor(balances.map((b) => b.clerkUserId));

  return {
    customers: balances.map((balance) => ({
      ...balance,
      name: named.get(balance.clerkUserId)?.name ?? null,
      email: named.get(balance.clerkUserId)?.email ?? null,
    })),
    total: count ?? balances.length,
  };
}

/** Clerk id → who that is, for a page of balances. One round trip. */
async function namesFor(
  clerkIds: readonly string[],
): Promise<Map<string, { name: string | null; email: string | null }>> {
  const named = new Map<string, { name: string | null; email: string | null }>();

  const supabase = getSupabaseAdmin();
  if (!supabase || clerkIds.length === 0) return named;

  const { data, error } = await supabase
    .from("User")
    .select("clerkId, firstName, lastName, email")
    .in("clerkId", [...clerkIds]);

  if (error) {
    logFailure("namesFor", error.message);
    return named;
  }

  for (const row of data ?? []) {
    const record = row as {
      clerkId?: unknown;
      firstName?: unknown;
      lastName?: unknown;
      email?: unknown;
    };

    if (typeof record.clerkId !== "string") continue;

    const parts = [record.firstName, record.lastName].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );

    named.set(record.clerkId, {
      name: parts.length > 0 ? parts.join(" ") : null,
      email: typeof record.email === "string" ? record.email : null,
    });
  }

  return named;
}

/** One customer's balance, for the customer detail screen. */
export async function rewardBalanceForClerkUser(
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
    logFailure("rewardBalanceForClerkUser", error.message);
    return empty;
  }

  return toRewardBalance(data) ?? empty;
}

/** One customer's movements, newest first. The desk sees `actor`; the customer never does. */
export async function pointsLedgerForClerkUser(
  clerkUserId: string,
  limit = 100,
): Promise<readonly PointsTransaction[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("points_transactions")
    .select(POINTS_TRANSACTION_COLUMNS)
    .eq("clerkUserId", clerkUserId)
    .order("occurredAt", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("pointsLedgerForClerkUser", error.message);
    return [];
  }

  return parseList(data, toPointsTransaction);
}

/**
 * The figures above the list, over every customer.
 *
 * Summed from the view rather than from the ledger, so "outstanding" here and
 * "your balance" on a customer's screen are the same definition.
 */
export async function getRewardTotals(): Promise<{
  holders: number;
  outstandingPoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  expiredPoints: number;
}> {
  const empty = {
    holders: 0,
    outstandingPoints: 0,
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    expiredPoints: 0,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("reward_balances")
    .select(REWARD_BALANCE_COLUMNS);

  if (error) {
    logFailure("getRewardTotals", error.message);
    return empty;
  }

  const balances = parseList(data, toRewardBalance);

  return balances.reduce(
    (totals, balance) => ({
      holders: totals.holders + (balance.balancePoints > 0 ? 1 : 0),
      outstandingPoints: totals.outstandingPoints + Math.max(0, balance.balancePoints),
      lifetimeEarned: totals.lifetimeEarned + balance.lifetimeEarned,
      lifetimeRedeemed: totals.lifetimeRedeemed + balance.lifetimeRedeemed,
      expiredPoints: totals.expiredPoints + balance.expiredPoints,
    }),
    empty,
  );
}
