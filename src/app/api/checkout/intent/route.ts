/**
 * Ask Stripe for a client secret so the browser can pay for an order.
 *
 * `POST { orderId }` → `{ clientSecret }`. Nothing else, in either direction.
 *
 * ## Why the amount is not in the request
 *
 * Because it must not be possible to name it. The order was written by
 * `src/actions/checkout.ts` before this route is ever called, with every figure
 * derived from catalog rows under a lock; this reads `"totalInCents"` back off
 * that row and charges exactly that. A body carrying an amount would be a body
 * that can buy a bottle for a pound, and no downstream check can undo it.
 *
 * ## Why an order id is safe to accept
 *
 * It is a uuid, so it is not enumerable the way an order number is, and the
 * four guards below mean holding one buys nothing anyway: the route will only
 * act on an order that is still PROCESSING, still UNPAID, still CARD, and less
 * than thirty minutes old. The worst an attacker with a stolen id can do is
 * create a payment intent that lets them pay somebody else's bill.
 *
 * ## Reuse, not accumulate
 *
 * A visitor who refreshes the payment step, or whose first card is declined,
 * must not leave a trail of orphaned intents against one order. If the row
 * already carries an intent id, it is retrieved and its existing secret
 * returned. `"stripePaymentIntentId"` has a unique index for the same reason.
 */

import { NextResponse } from "next/server";

import { getStripe, isCardPaymentAvailable } from "@/src/lib/stripe/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { z } from "zod";

/** Beyond this, the sweeper may already have cancelled and restocked the order. */
const PAYMENT_WINDOW_MINUTES = 30;

const bodySchema = z.object({
  orderId: z.string().trim().min(8).max(64),
});

const orderRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  paymentStatus: z.string(),
  paymentMethod: z.string(),
  totalInCents: z.number(),
  placedAt: z.string(),
  stripePaymentIntentId: z.string().nullable().default(null),
});

/** One shape for every refusal, so the response never says which guard fired. */
function refuse(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  /*
   * Before the body is even read. An intent is a request to charge somebody,
   * and the house not currently taking card payments is a complete answer to
   * it — there is nothing in the request that could change the outcome, so
   * nothing in the request is parsed.
   *
   * `isCardPaymentAvailable()` and not `getStripe()`: a deployment that still
   * holds working keys but has `STRIPE_PAYMENT_ENABLED` off must refuse here as
   * well, or the flag would only hide a panel while leaving the route open to
   * anyone who called it directly.
   */
  if (!isCardPaymentAvailable()) {
    console.error("[checkout] intent refused; the card rail is off.");
    return refuse(503, "unconfigured");
  }

  const stripe = getStripe();

  if (!stripe) {
    console.error("[checkout] STRIPE_SECRET_KEY is not set; no intent created.");
    return refuse(503, "unconfigured");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return refuse(503, "unconfigured");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return refuse(400, "badRequest");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return refuse(400, "badRequest");

  const { data, error } = await supabase
    .from("Order")
    .select(
      "id, orderNumber, status, paymentStatus, paymentMethod, totalInCents, " +
        "placedAt, stripePaymentIntentId",
    )
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (error) {
    console.error(`[checkout] intent lookup failed: ${error.message}`);
    return refuse(503, "server");
  }

  const order = orderRowSchema.safeParse(data);
  if (!order.success) return refuse(404, "notFound");

  const row = order.data;

  // Four guards, one answer. An order that is already paid, already cancelled,
  // a cash order, or one old enough to have been swept must not be payable.
  const isPayable =
    row.status === "PROCESSING" &&
    row.paymentStatus === "UNPAID" &&
    row.paymentMethod === "CARD" &&
    Date.now() - Date.parse(row.placedAt) < PAYMENT_WINDOW_MINUTES * 60_000;

  if (!isPayable) return refuse(409, "notPayable");

  try {
    // Already asked once — reuse it rather than opening a second intent against
    // the same order.
    if (row.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(
        row.stripePaymentIntentId,
      );

      if (existing.client_secret && existing.status !== "canceled") {
        return NextResponse.json({ clientSecret: existing.client_secret });
      }
    }

    const intent = await stripe.paymentIntents.create({
      // Piastres. `"Product"."priceInCents"` is already the minor unit of EGP
      // and Stripe's minor unit for EGP is the same, so the figure passes
      // straight through with no conversion — see `src/lib/currency.ts`.
      amount: row.totalInCents,
      currency: "egp",
      automatic_payment_methods: { enabled: true },
      // How the webhook finds the order. Cheaper and more reliable than a
      // reverse lookup on the intent id, which is not yet stored at this point.
      metadata: {
        orderId: row.id,
        orderNumber: row.orderNumber,
      },
      description: `KHEM order ${row.orderNumber}`,
    });

    // Stored now rather than in the webhook, so a refresh finds it and the
    // reuse branch above works on the very next request.
    const { error: stampError } = await supabase
      .from("Order")
      .update({
        stripePaymentIntentId: intent.id,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (stampError) {
      // Not fatal: the intent exists and carries the order id in its metadata,
      // so the webhook can still settle it. Only the reuse optimisation is lost.
      console.error(
        `[checkout] ${row.orderNumber} intent not stamped: ${stampError.message}`,
      );
    }

    if (!intent.client_secret) {
      console.error(`[checkout] ${row.orderNumber} intent has no client secret.`);
      return refuse(503, "server");
    }

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (cause) {
    console.error(
      `[checkout] intent creation failed for ${row.orderNumber}:`,
      cause instanceof Error ? cause.message : "unknown error",
    );
    return refuse(503, "server");
  }
}
