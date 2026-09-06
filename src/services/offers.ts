import "server-only";

/**
 * What the house is giving away on the bag in front of the customer.
 *
 * One function, one caller, and deliberately almost no logic — the same design
 * as `src/services/discounts.ts`. Every question an offer raises (is it running,
 * does this customer qualify, is it within its caps, how many groups does this
 * basket make, which unit is free, what is that worth) is answered by
 * `resolve_offer()` in `supabase/sql/0060_offers.sql`. This module hands it a bag
 * and passes its answer back.
 *
 * A TypeScript re-implementation of the group arithmetic would be a second
 * definition of what a customer is owed, and it would agree with the first only
 * until somebody edited one of them.
 *
 * ## The answer binds nothing
 *
 * Resolved **without a lock**, because it consumes nothing and must not hold a
 * write lock on a popular campaign while somebody reads their screen. The same
 * offer is resolved again, under a lock, inside the transaction `place_order()`
 * runs — and that is what the customer is charged. If the two ever disagree, the
 * order is right.
 *
 * ## Trust
 *
 * Secret key, because the caps read `offer_redemptions`, which grants the public
 * roles nothing. The bag arrives as slugs and quantities that
 * `resolveCartToLines()` has already resolved against `"Product"`, and every
 * price is read in SQL — no number the browser sent reaches the arithmetic.
 */

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { toOfferPreview } from "@/src/schemas/db/offers";
import type { OfferPreview } from "@/src/types/offer";

/** One line of the bag, as the database is asked to price it. */
export interface OfferPreviewLine {
  slug: string;
  quantity: number;
}

export interface OfferPreviewRequest {
  items: readonly OfferPreviewLine[];
  locale: Locale;
  /**
   * The address the order will carry, because that is what the audience gate
   * keys on for a subscriber or an invited offer. Null early in the form.
   */
  email: string | null;
  /** From the session, or null for a guest. Used for the caps and the audience. */
  clerkUserId: string | null;
  /** A code the customer has typed. An offer that will not stack declines itself. */
  discountCode?: string;
  /** Whether a Discovery Credit is selected. Same reason. */
  usingCredit?: boolean;
}

/** Null when no offer applies — which is the ordinary case, not a failure. */
export async function previewOfferForCart(
  request: OfferPreviewRequest,
): Promise<OfferPreview | null> {
  if (request.items.length === 0) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[offers] SUPABASE_SECRET_KEY is not set; no preview.");
    return null;
  }

  const { data, error } = await supabase.rpc("resolve_offer", {
    payload: {
      // A bag, not an order. The units and their prices are both derived in SQL
      // from these slugs — see the migration's header.
      items: request.items.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
      })),
      email: request.email,
      clerkUserId: request.clerkUserId,
      discountCode: request.discountCode ?? "",
      usingCredit: request.usingCredit ?? false,
    },
  });

  if (error) {
    // A missing offer line costs the visitor a badge, never a page.
    console.error(`[offers] previewOfferForCart failed: ${error.message}`);
    return null;
  }

  return toOfferPreview(data, request.locale);
}
