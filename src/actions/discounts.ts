"use server";

/**
 * Checking a discount code from the checkout, before anything is paid.
 *
 * ## Why this exists now, when `DiscountStep` argued against it
 *
 * That component's header used to say a live check "would tell a prober which
 * codes exist, one guess at a time", and refused to make one. The objection was
 * right and is answered here rather than dropped:
 *
 *   - **Throttled.** The same eight-per-ten-minutes window the order action
 *     uses, in its own scope, so guessing costs the same as ordering and a
 *     customer retyping their code is never locked out.
 *   - **A bag is required.** The caller must present cart lines that resolve to
 *     real products. There is no bare "does this code exist?" endpoint.
 *   - **No signal beyond the code typed.** The reply names the code the caller
 *     already knew and nothing else — no count, no neighbour, no hint that some
 *     other string would have worked.
 *
 * What that buys is the thing §5.4 of the plan asks for: a customer who mistypes
 * a code, or whose code lapsed last week, learns it at the field instead of at
 * the payment button.
 *
 * ## It decides nothing
 *
 * The answer is an estimate that binds nothing. `place_order()` resolves the
 * same code again, under a row lock, in the transaction that writes the order —
 * against that order's real lines, its real subtotal and its real email — and
 * that is what the customer is charged. Nothing here is persisted, no redemption
 * row is written, and no grant is consumed.
 *
 * ## The email
 *
 * A grant-gated code is entitled to an *address*, and both the gate and the
 * consumption key on the order's `customerEmail`. So the preview is given the
 * address currently in the form, not the session's — otherwise it would answer a
 * different question from the one the order will ask, and a customer could be
 * told a code works and then refused at the button.
 *
 * The cost is that somebody who knows a granted code can learn whether a given
 * address holds a grant for it, one throttled guess at a time. That is a smaller
 * disclosure than letting the same person discover it by attempting an order,
 * which they can already do.
 */

import { getUserId } from "@/src/lib/auth";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { discountPreviewSchema } from "@/src/schemas/checkout";
import { previewDiscountForCart } from "@/src/services/discounts";
import { resolveCartToLines } from "@/src/services/orders";
import type { DiscountPreview } from "@/src/types/discount";
import type { DiscountPreviewInput } from "@/src/schemas/checkout";

/**
 * Eight attempts per ten minutes per client, matching `src/actions/checkout.ts`.
 *
 * Its own scope, so checking a code never eats into the budget for placing the
 * order it is being checked for.
 */
const LIMIT = { limit: 8, windowMs: 10 * 60 * 1_000 };

/** Refusals this action can produce before the database is ever reached. */
function refuse(
  reasonCode: Extract<DiscountPreview, { ok: false }>["reasonCode"],
  reason: string,
): DiscountPreview {
  return { ok: false, reasonCode, reason };
}

export async function previewDiscount(
  input: DiscountPreviewInput,
): Promise<DiscountPreview> {
  // Throttle first, before any parsing or database call — the same order
  // `placeCustomerOrder` uses, and for the same reason.
  if (isRateLimited("discount-preview", await clientKey(), LIMIT)) {
    return refuse("UNKNOWN", "Too many attempts just now. Try again shortly.");
  }

  const parsed = discountPreviewSchema.safeParse(input);
  if (!parsed.success) {
    return refuse("NO_CODE", "That code cannot be checked.");
  }

  /*
   * Ids → slugs, against `"Product"`. This is also what makes a bag mandatory:
   * a caller with no resolvable lines gets no answer about any code.
   *
   * A bag that no longer matches the catalog is reported as unavailable rather
   * than as a verdict on the code — the code may be perfectly good, and telling
   * the customer otherwise would send them chasing the wrong problem.
   */
  const resolution = await resolveCartToLines(parsed.data.items);
  if (!resolution.ok) {
    return refuse("UNKNOWN", "Your bag no longer matches the catalogue.");
  }

  // From the session, never from the body: it decides the per-customer cap.
  const clerkUserId = await getUserId();

  return previewDiscountForCart({
    code: parsed.data.code,
    items: resolution.lines.map((line) => ({
      slug: line.slug,
      quantity: line.quantity,
    })),
    email: parsed.data.customerEmail || null,
    clerkUserId,
  });
}
