import "server-only";

/**
 * Asking what a code would be worth, before there is an order.
 *
 * One function, one caller, and deliberately almost no logic: every question a
 * discount raises — is it real, active, in date, within both caps, granted to
 * this person, applicable to anything in this bag, and worth how much — is
 * answered by `resolve_discount()` in `supabase/sql/0029_discount_preview.sql`.
 * This module hands it a bag and passes its answer back.
 *
 * That is the whole design. A TypeScript re-implementation of those rules would
 * be a second definition of what a customer is owed, and it would agree with the
 * first only until somebody edited one of them — which is exactly the drift the
 * discount engine's header was written to prevent.
 *
 * ## The answer binds nothing
 *
 * Resolved **without a lock**, because it consumes nothing and must not hold a
 * write lock on a popular code while somebody reads their screen. The same code
 * is resolved again, under a lock, inside the transaction `place_order()` runs —
 * and that is what the customer is charged. If the two ever disagree, the order
 * is right.
 *
 * ## Trust
 *
 * Secret key, like every other reader of these tables: `0028` grants the public
 * roles nothing and has no RLS policy. The bag arrives as slugs and quantities
 * that `resolveCartToLines()` has already resolved against `"Product"`, and the
 * prices are read in SQL — no number the browser sent reaches the arithmetic.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { toDiscountPreview } from "@/src/schemas/db/discount-preview";
import type { DiscountPreview } from "@/src/types/discount";

/** One line of the bag, as the database is asked to price it. */
export interface PreviewLine {
  slug: string;
  quantity: number;
}

export interface PreviewRequest {
  /** As typed. `resolve_discount()` trims and uppercases it. */
  code: string;
  items: readonly PreviewLine[];
  /**
   * The address the order will carry, because that is what the grant gate keys
   * on. Passing the session's address instead would make the preview answer a
   * different question from the one the order asks.
   */
  email: string | null;
  /** From the session, or null for a guest. Used for the per-customer cap. */
  clerkUserId: string | null;
}

/** The unavailable answer, used when the provider cannot be reached. */
const UNAVAILABLE: DiscountPreview = {
  ok: false,
  reasonCode: "UNKNOWN",
  reason: "That code could not be checked just now.",
};

export async function previewDiscountForCart(
  request: PreviewRequest,
): Promise<DiscountPreview> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[discounts] SUPABASE_SECRET_KEY is not set; no preview.");
    return UNAVAILABLE;
  }

  const { data, error } = await supabase.rpc("resolve_discount", {
    payload: {
      code: request.code,
      // A bag, not an order. The subtotal and the eligible lines are both summed
      // in SQL from these slugs — see the migration's header.
      items: request.items.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
      })),
      email: request.email ?? "",
      clerkUserId: request.clerkUserId ?? "",
      // The one thing this call does differently from `place_order()`'s.
      lock: false,
    },
  });

  if (error) {
    console.error(`[discounts] previewDiscountForCart failed: ${error.message}`);
    return UNAVAILABLE;
  }

  return toDiscountPreview(data) ?? UNAVAILABLE;
}
