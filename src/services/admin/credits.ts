import "server-only";

/**
 * Discovery Credit reads for the dashboard.
 *
 * Uses {@link getSupabaseAdmin} for the same reason `./customers.ts` does:
 * `supabase/sql/0026_discovery_credits.sql` grants the public roles nothing,
 * because a credit row names a customer and an amount of money. Every caller
 * sits behind `requireAdmin()`.
 *
 * ## Everything reads `credit_balances`, never `customer_credits`
 *
 * The status and the balance are derived there, once. A service that summed the
 * transactions itself would be a second definition of "available", and the two
 * would disagree the first time the policy changed.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  CREDIT_COLUMNS,
  CREDIT_TRANSACTION_COLUMNS,
  parseList,
  toCredit,
  toCreditTransaction,
} from "@/src/schemas/db/credits";
import type {
  Credit,
  CreditDetail,
  CreditPage,
  CreditStatus,
  CreditTotals,
} from "@/src/types/credit";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

export const CREDITS_PER_PAGE = 50;

export interface CreditListFilter {
  status?: CreditStatus;
  offset?: number;
  limit?: number;
}

const EMPTY_PAGE: CreditPage = { credits: [], total: 0 };

/** One page of the ledger, newest first. */
export async function listCredits(
  filter: CreditListFilter = {},
): Promise<CreditPage> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_PAGE;

  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? CREDITS_PER_PAGE;

  let query = supabase
    .from("credit_balances")
    .select(CREDIT_COLUMNS, { count: "exact" })
    .order("earnedAt", { ascending: false })
    .range(offset, offset + limit - 1);

  // `.eq` binds its value; `status` is an enum member validated before it
  // arrives here, never a string built into a filter.
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error, count } = await query;

  if (error) {
    logFailure("listCredits", error.message);
    return EMPTY_PAGE;
  }

  return { credits: parseList(data, toCredit), total: count ?? 0 };
}

/**
 * One credit, its full trail, and who it belongs to.
 *
 * The customer's name comes from the source order rather than from `"User"`:
 * the order is what the credit was earned on, and it carries a name even for a
 * customer whose Clerk webhook has not landed yet.
 */
export async function getCredit(id: string): Promise<CreditDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("credit_balances")
    .select(CREDIT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getCredit", error.message);
    return null;
  }

  const credit = toCredit(data);
  if (!credit) return null;

  const [transactions, order] = await Promise.all([
    (async () => {
      const { data: rows, error: trailError } = await supabase
        .from("credit_transactions")
        .select(CREDIT_TRANSACTION_COLUMNS)
        .eq("creditId", id)
        .order("occurredAt", { ascending: true });

      if (trailError) {
        logFailure("getCredit.transactions", trailError.message);
        return [];
      }

      return parseList(rows, toCreditTransaction);
    })(),

    (async () => {
      const { data: row, error: orderError } = await supabase
        .from("Order")
        .select("orderNumber, customerName, customerEmail")
        .eq("id", credit.sourceOrderId)
        .maybeSingle();

      if (orderError) {
        logFailure("getCredit.order", orderError.message);
        return null;
      }

      return row;
    })(),
  ]);

  return {
    ...credit,
    transactions,
    sourceOrderNumber:
      order && typeof order.orderNumber === "string" ? order.orderNumber : null,
    customerName:
      order && typeof order.customerName === "string" ? order.customerName : null,
    customerEmail:
      order && typeof order.customerEmail === "string" ? order.customerEmail : null,
  };
}

/**
 * The figures above the list.
 *
 * One pass over the view rather than six counting queries. The ledger is small —
 * one row per Discovery Set unit ever sold — and six round trips to print six
 * numbers is the shape `supabase/AGENTS.md` §23 warns about.
 */
export async function getCreditTotals(): Promise<CreditTotals> {
  const empty: CreditTotals = {
    issuedCount: 0,
    issuedInCents: 0,
    availableCount: 0,
    availableInCents: 0,
    redeemedCount: 0,
    redeemedInCents: 0,
    expiredCount: 0,
    cancelledCount: 0,
    pendingDeliveryCount: 0,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("credit_balances")
    .select("amountInCents, balanceInCents, status");

  if (error) {
    logFailure("getCreditTotals", error.message);
    return empty;
  }

  const rows = parseList(data, (row) => {
    const parsed = row as {
      amountInCents?: unknown;
      balanceInCents?: unknown;
      status?: unknown;
    };

    const amount = Number(parsed.amountInCents);
    const balance = Number(parsed.balanceInCents);
    const status = String(parsed.status);

    return Number.isFinite(amount) && Number.isFinite(balance)
      ? { amount, balance, status }
      : null;
  });

  const totals = { ...empty };

  for (const row of rows) {
    totals.issuedCount += 1;
    totals.issuedInCents += row.amount;

    switch (row.status) {
      case "AVAILABLE":
        totals.availableCount += 1;
        totals.availableInCents += row.balance;
        break;
      case "REDEEMED":
        totals.redeemedCount += 1;
        // What the credit was worth when it was spent, not its zero balance.
        totals.redeemedInCents += row.amount;
        break;
      case "EXPIRED":
        totals.expiredCount += 1;
        break;
      case "CANCELLED":
        totals.cancelledCount += 1;
        break;
      case "PENDING_DELIVERY":
        totals.pendingDeliveryCount += 1;
        break;
    }
  }

  return totals;
}

/** Every credit belonging to one customer, for their record. */
export async function creditsForClerkUser(
  clerkUserId: string,
): Promise<readonly Credit[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("credit_balances")
    .select(CREDIT_COLUMNS)
    .eq("clerkUserId", clerkUserId)
    .order("earnedAt", { ascending: false });

  if (error) {
    logFailure("creditsForClerkUser", error.message);
    return [];
  }

  return parseList(data, toCredit);
}
