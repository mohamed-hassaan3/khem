import "server-only";

/**
 * A customer's own vouchers.
 *
 * Split from `src/services/admin/discounts.ts` for the reason
 * `src/services/credits.ts` is split from its admin twin: that file sits behind
 * `requireAdmin()` and may read every code and every grant, this one is reached
 * by the person the grants are addressed to.
 *
 * **The identity must arrive from `await auth()` / `currentUser()` on the
 * server** — never a route param, a search param, or a form field.
 * `supabase/sql/0028_discounts.sql` grants the public roles nothing and has no
 * RLS policy at all, so this filter *is* the access control.
 *
 * A voucher listed here is not a permission. `resolve_discount()` re-weighs the
 * campaign window, both caps and the grant under a row lock against the order
 * actually being placed — a list rendered a minute ago is a suggestion.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  DISCOUNT_COLUMNS,
  DISCOUNT_GRANT_COLUMNS,
  parseList,
  toDiscount,
  toDiscountGrant,
} from "@/src/schemas/db/discounts";
import { compareVouchers, toCustomerVoucher } from "@/src/schemas/db/vouchers";
import type { Discount, DiscountGrant } from "@/src/types/discount";
import type { CustomerVoucher } from "@/src/types/voucher";

/** Who to look for. Both halves come from the Clerk session, or from nowhere. */
export interface VoucherHolder {
  clerkUserId: string;
  /** The session's verified primary address; a grant may predate the account. */
  email: string | null;
}

function logFailure(query: string, message: string): void {
  console.error(`[vouchers] ${query} failed: ${message}`);
}

/**
 * Every voucher this customer holds, usable ones first.
 *
 * Two queries rather than one `or(...)` filter. PostgREST's `or` takes a
 * comma-delimited string, and an email address is user-shaped data that would
 * have to be escaped into it correctly every time; two `eq` filters merged in
 * memory cannot be malformed by an unusual address. The grant list is per
 * customer and tiny, so the second round trip costs nothing worth the risk.
 */
export async function vouchersForUser(
  holder: VoucherHolder,
): Promise<readonly CustomerVoucher[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const email = holder.email?.trim().toLowerCase() ?? null;

  const [byUser, byEmail] = await Promise.all([
    supabase
      .from("discount_grants")
      .select(DISCOUNT_GRANT_COLUMNS)
      .eq("clerkUserId", holder.clerkUserId),

    // Grants are written with a lowercased address (0028), so this comparison
    // is exact rather than case-insensitive by luck.
    email === null
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("discount_grants")
          .select(DISCOUNT_GRANT_COLUMNS)
          .eq("email", email),
  ]);

  if (byUser.error) logFailure("vouchersForUser.byUser", byUser.error.message);
  if (byEmail.error) logFailure("vouchersForUser.byEmail", byEmail.error.message);

  // One grant can satisfy both filters; the id de-duplicates it.
  const grants = new Map<string, DiscountGrant>();
  for (const row of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) {
    const grant = toDiscountGrant(row);
    if (grant) grants.set(grant.id, grant);
  }

  if (grants.size === 0) return [];

  const discountIds = [...new Set([...grants.values()].map((g) => g.discountId))];

  const { data, error } = await supabase
    .from("discounts")
    .select(DISCOUNT_COLUMNS)
    .in("id", discountIds);

  if (error) {
    logFailure("vouchersForUser.discounts", error.message);
    return [];
  }

  const discounts = new Map<string, Discount>(
    parseList(data, toDiscount).map((discount) => [discount.id, discount]),
  );

  // One clock for the whole list, so two vouchers expiring in the same second
  // cannot be judged against different `now`s.
  const now = Date.now();

  const vouchers: CustomerVoucher[] = [];
  for (const grant of grants.values()) {
    const discount = discounts.get(grant.discountId);
    // A grant whose campaign was deleted, or whose row failed to parse, is
    // dropped rather than rendered as a voucher with no benefit attached.
    if (discount) vouchers.push(toCustomerVoucher(grant, discount, now));
  }

  return vouchers.sort(compareVouchers);
}
