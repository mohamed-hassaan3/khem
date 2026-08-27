import "server-only";

/**
 * A customer's own Discovery Credits.
 *
 * Split from `src/services/admin/credits.ts` because the authorisation is
 * different: that file sits behind `requireAdmin()` and may read anybody's
 * credits, this one is reached by the customer whose credits they are.
 *
 * **`clerkUserId` must arrive from `await auth()` on the server** — never a
 * route param, a search param, or a form field. Same obligation as
 * `getOrdersForUser()` in `src/services/account.ts` and for the same reason:
 * `supabase/sql/0026_discovery_credits.sql` grants the public roles nothing, so
 * the filter *is* the access control.
 *
 * Note that this returning a credit does not make it spendable. Eligibility is
 * decided inside `place_order()`, under a row lock, against the order actually
 * being written — a list rendered seconds ago is a suggestion, not a permission.
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
  CreditLedgerEntry,
  CustomerCredit,
  CustomerCreditLedger,
} from "@/src/types/credit";

/** Every credit this customer holds, newest first. */
export async function creditsForUser(
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
    console.error(`[credits] creditsForUser failed: ${error.message}`);
    return [];
  }

  return parseList(data, toCredit);
}

/**
 * The ones they could spend right now.
 *
 * Offered at checkout. `AVAILABLE` is computed by `credit_balances`, which is
 * also what `place_order()` checks — one definition, so the list a customer
 * sees and the rule that admits their order cannot disagree.
 */
export async function spendableCreditsForUser(
  clerkUserId: string,
): Promise<readonly Credit[]> {
  const credits = await creditsForUser(clerkUserId);
  return credits.filter((credit) => credit.status === "AVAILABLE");
}

/**
 * Everything the Vouchers & Credits panel says about credits, in one read.
 *
 * Three round trips, not one per credit: the credits, then every movement on
 * them, then the order numbers those movements name. `credit_transactions`
 * stores an order *uuid*, and "Order KHEM-2026-1042" is the only form of it a
 * customer has ever been shown.
 *
 * The available total is summed here rather than in the component. A figure the
 * customer is told is money, and money is added up where the rows are.
 */
export async function creditLedgerForUser(
  clerkUserId: string,
): Promise<CustomerCreditLedger> {
  const credits = await creditsForUser(clerkUserId);

  const available = credits.filter((credit) => credit.status === "AVAILABLE");
  const totals = {
    availableInCents: available.reduce((sum, c) => sum + c.balanceInCents, 0),
    availableCount: available.length,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase || credits.length === 0) {
    return {
      credits: credits.map((credit) => ({ ...credit, sourceOrderNumber: null })),
      entries: [],
      ...totals,
    };
  }

  /*
   * Filtered by credit id, and those ids came from a list already filtered to
   * this customer. `credit_transactions` carries no owner column of its own —
   * the credit it hangs from is the owner — so this is the only correct way to
   * scope it, and it cannot widen: an id the customer does not hold is simply
   * not in the list.
   */
  const { data, error } = await supabase
    .from("credit_transactions")
    .select(CREDIT_TRANSACTION_COLUMNS)
    .in(
      "creditId",
      credits.map((credit) => credit.id),
    )
    .order("occurredAt", { ascending: false });

  if (error) {
    console.error(`[credits] creditLedgerForUser failed: ${error.message}`);
  }

  const transactions = error ? [] : parseList(data, toCreditTransaction);

  /*
   * Both sets of ids in one lookup: the orders that *earned* the credits, and
   * the orders the movements name. An EARNED row carries no `orderId` of its
   * own (0026 writes the note and nothing else), so the credit's
   * `sourceOrderId` is the only way to label the card it belongs to.
   */
  const orderIds = [
    ...new Set([
      ...credits.map((credit) => credit.sourceOrderId),
      ...transactions
        .map((entry) => entry.orderId)
        .filter((id): id is string => id !== null),
    ]),
  ];

  const orderNumbers = new Map<string, string>();

  if (orderIds.length > 0) {
    const { data: rows, error: orderError } = await supabase
      .from("Order")
      .select("id, orderNumber")
      .in("id", orderIds);

    if (orderError) {
      // A missing number costs the row its label, not the panel its ledger.
      console.error(
        `[credits] creditLedgerForUser.orders failed: ${orderError.message}`,
      );
    }

    for (const row of rows ?? []) {
      if (typeof row.id === "string" && typeof row.orderNumber === "string") {
        orderNumbers.set(row.id, row.orderNumber);
      }
    }
  }

  const withOrder: CustomerCredit[] = credits.map((credit) => ({
    ...credit,
    sourceOrderNumber: orderNumbers.get(credit.sourceOrderId) ?? null,
  }));

  const entries: CreditLedgerEntry[] = transactions.map((entry) => ({
    id: entry.id,
    creditId: entry.creditId,
    kind: entry.kind,
    amountInCents: entry.amountInCents,
    orderNumber:
      entry.orderId === null ? null : (orderNumbers.get(entry.orderId) ?? null),
    note: entry.note,
    occurredAt: entry.occurredAt,
  }));

  return { credits: withOrder, entries, ...totals };
}
