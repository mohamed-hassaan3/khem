"use server";

/**
 * Asking what the house is giving away on this bag.
 *
 * ## Why an action rather than a prop
 *
 * The bag lives in the browser (`src/providers/cart-provider.tsx` persists ids
 * and quantities, nothing else), so no server render knows what is in it. The
 * discount field has the same problem and solves it the same way — see
 * `src/actions/discounts.ts`, whose reasoning about throttling and disclosure
 * applies here with one difference in the customer's favour: **an offer discloses
 * nothing**. It is the house's own campaign, already printed on collection pages
 * and product cards, and the reply names only what this basket earns.
 *
 * It is still throttled, in its own scope, because it is a database round trip
 * an anonymous caller can ask for.
 *
 * ## It decides nothing
 *
 * The answer is an estimate that binds nothing. `place_order()` resolves the
 * same offers again, against the order actually being written, under the lock
 * that makes their caps real — and that is what the customer is charged. Nothing
 * here is persisted and no redemption row is written.
 */

import { getUserId } from "@/src/lib/auth";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { isLocale } from "@/src/lib/i18n/config";
import { previewOfferForCart } from "@/src/services/offers";
import { resolveCartToLines } from "@/src/services/orders";
import type { OfferPreview } from "@/src/types/offer";

/**
 * Thirty a ten-minute window, well above the eight the discount field allows.
 *
 * The two are not the same risk. A discount check is a guess at a secret; an
 * offer check is the bag asking what it is worth, and it fires whenever a line
 * changes — so a customer editing quantities in the bag would hit a tighter
 * limit through ordinary use.
 */
const LIMIT = { limit: 30, windowMs: 10 * 60 * 1_000 };

export interface OfferPreviewInput {
  items: readonly { productId: string; quantity: number }[];
  locale: string;
  /** The address in the form, for the subscriber and invited audiences. */
  customerEmail?: string;
  /** A code the customer has typed. An offer that will not stack declines itself. */
  discountCode?: string;
  /** Whether a Discovery Credit is selected. Same reason. */
  usingCredit?: boolean;
}

export async function previewCartOffer(
  input: OfferPreviewInput,
): Promise<OfferPreview | null> {
  if (isRateLimited("offer-preview", await clientKey(), LIMIT)) return null;

  if (!Array.isArray(input.items) || input.items.length === 0) return null;

  // Ids → slugs, against the real catalog. The same resolution the order path
  // uses, so an id the browser invented resolves to nothing rather than to a
  // guess.
  const resolution = await resolveCartToLines(input.items);
  if (!resolution.ok) return null;

  const email = (input.customerEmail ?? "").trim().toLowerCase();

  return previewOfferForCart({
    items: resolution.lines.map((line) => ({
      slug: line.slug,
      quantity: line.quantity,
    })),
    locale: isLocale(input.locale) ? input.locale : "en",
    email: email.length > 0 ? email : null,
    // Identity from the session, never from the body — the caps and the
    // new/existing-customer audiences key on it.
    clerkUserId: await getUserId(),
    discountCode: input.discountCode ?? "",
    usingCredit: input.usingCredit ?? false,
  });
}
