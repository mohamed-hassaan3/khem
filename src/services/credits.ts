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
import { CREDIT_COLUMNS, parseList, toCredit } from "@/src/schemas/db/credits";
import type { Credit } from "@/src/types/credit";

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
