/**
 * Stripe's side of the conversation.
 *
 * The only place a card order becomes a paid one. `src/actions/checkout.ts`
 * creates the order and reserves its stock; this promotes it once Stripe says
 * the money actually moved — which is the only authority on that question. A
 * browser reporting its own success is a browser that can lie.
 *
 * ## Signature verification is the authentication
 *
 * This endpoint is public and unauthenticated in the ordinary sense: Stripe
 * cannot hold a session. What it can do is sign every request with a shared
 * secret, and `constructEvent` refuses anything whose signature does not match
 * the raw bytes. Two consequences that are easy to get wrong:
 *
 *  - **The body must be read as text**, before any parsing. `request.json()`
 *    re-serialises, and a re-serialised body has a different signature. There
 *    is no way to recover from that except reading it correctly the first time.
 *  - **A missing secret is a 500, never a bypass.** An unconfigured deployment
 *    must refuse to settle orders, not settle all of them.
 *
 * `src/proxy.ts` excludes `api` from its matcher, so nothing here is touched by
 * the locale rewrite.
 *
 * ## Idempotency, in two layers
 *
 * Stripe retries until it gets a 2xx and may deliver the same event more than
 * once even after one.
 *
 *  1. **Per event.** `record_stripe_event()` inserts the event id and reports
 *     whether *this* call was the one that recorded it. A second delivery of
 *     the same event is answered 200 and dispatched to nothing. See
 *     `supabase/sql/0054_stripe_webhook_events.sql`.
 *  2. **Per order.** `settle_order_payment()` returns true exactly once per
 *     order, and **that boolean is what gates the customer's email**. It is the
 *     older guard and it stays: the ledger stops the same event twice, this
 *     stops two different events both trying to settle one order.
 *
 * The ledger is a gate, not a dependency — if recording fails, the event is
 * handled anyway and layer 2 catches what it can. A database wobble must not
 * stop money being recorded.
 *
 * ## Verified, not merely signed
 *
 * A valid signature proves Stripe sent the event. It does not prove the event
 * is about the order it names, for the amount that order is owed — the
 * `orderId` rides in a metadata bag, and the amount comes from an intent this
 * application may not have created. So `handleSucceeded` compares the intent's
 * amount and currency against the row before settling, and refuses on any
 * disagreement. Defence in depth: `/api/checkout/intent` already reads the
 * amount from the same row, so the two should never differ, and if they ever do
 * the correct action is to settle nothing and page a human.
 *
 * ## Why a handled event always answers 200
 *
 * Even when the email failed. The event *was* handled — the order is paid, the
 * database says so — and a non-2xx would make Stripe redeliver it, which
 * re-runs the settle (harmless, returns false) and achieves nothing. Mail
 * failures are logged and dealt with by a person.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  announceOrder,
  notifyCustomerOfOrder,
} from "@/src/lib/email/send-order-mail";
import { getStripe } from "@/src/lib/stripe/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { getOrderForMail } from "@/src/services/orders";

/**
 * Node, not Edge.
 *
 * `constructEvent` needs Node's crypto for the HMAC comparison, and this route
 * reads a file (the logo attachment) further down the call graph.
 */
export const runtime = "nodejs";

/** Never cached, never prerendered — it is a write endpoint. */
export const dynamic = "force-dynamic";

/**
 * The one currency an order can settle in.
 *
 * Egyptian pounds, in Stripe's lowercase ISO form. `src/lib/currency.ts` is
 * explicit that the six display currencies are a presentation transform and
 * never a pricing input; this is the assertion of that at the point money
 * arrives. A payment in anything else is not this order's payment.
 */
const SETTLEMENT_CURRENCY = "egp";

/** The order id Stripe carries for us, set when the intent was created. */
function orderIdFrom(intent: Stripe.PaymentIntent): string | null {
  const id = intent.metadata?.orderId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** `payment_intent.succeeded` — the one event that moves money into an order. */
async function handleSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const orderId = orderIdFrom(intent);

  if (!orderId) {
    // A payment with no order behind it. Nothing to settle, and inventing a
    // record from an untrusted metadata bag would be worse than logging it.
    console.error(`[stripe] ${intent.id} succeeded with no orderId in metadata.`);
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[stripe] SUPABASE_SECRET_KEY is not set; payment not settled.");
    return;
  }

  /*
   * What the order is owed, read back before anything is settled.
   *
   * The row is the authority on the amount — it is what `/api/checkout/intent`
   * charged from — so this is a comparison between two readings of the same
   * fact, and they agree in every ordinary case. It is here for the case that
   * is not ordinary: an intent created outside this application, or one whose
   * amount was altered after creation. Neither is reachable through the
   * storefront, which is the point of checking.
   */
  const { data: row, error: readError } = await supabase
    .from("Order")
    .select("orderNumber, totalInCents")
    .eq("id", orderId)
    .maybeSingle();

  if (readError || !row) {
    // Not settled. An order that cannot be read cannot be verified, and
    // settling an unverified payment is the one thing this file exists to
    // prevent. Stripe retries, and a transient read failure resolves itself.
    console.error(
      `[stripe] ${intent.id} could not read its order: ${readError?.message ?? "no row"}`,
    );
    throw new Error("order unreadable");
  }

  const currency = intent.currency.toLowerCase();

  if (intent.amount !== row.totalInCents || currency !== SETTLEMENT_CURRENCY) {
    /*
     * Deliberately not thrown, and deliberately still a 200 upstream. A
     * redelivery cannot make these figures agree, so retrying forever achieves
     * nothing but noise; what this needs is a person. Both figures are logged
     * because the discrepancy *is* the finding.
     */
    console.error(
      `[stripe] ${row.orderNumber} amount mismatch — intent ${intent.id} ` +
        `is ${intent.amount} ${currency}, order is ${row.totalInCents} ` +
        `${SETTLEMENT_CURRENCY}. Not settled.`,
    );
    return;
  }

  const { data, error } = await supabase.rpc("settle_order_payment", {
    order_id: orderId,
    intent_id: intent.id,
  });

  if (error) {
    console.error(`[stripe] settle_order_payment failed: ${error.message}`);
    return;
  }

  // `false` means this order was already paid — a retry, or a duplicate
  // delivery. The work is done and the customer already has their receipt.
  if (data !== true) return;

  const order = await getOrderForMail(orderId);

  if (!order) {
    console.error(`[stripe] ${orderId} settled but could not be read back.`);
    return;
  }

  console.info(`[stripe] ${order.orderNumber} paid.`);

  // Now, and only now, is the order confirmed — so this is where both messages
  // go out for the card path.
  await announceOrder(order);
}

/**
 * `payment_intent.payment_failed`.
 *
 * The order stays PROCESSING on purpose. A decline is very often the first of two
 * attempts — a bank's fraud heuristic, a mistyped CVC — and cancelling here
 * would put the stock back while the buyer is still typing. The sweeper handles
 * the ones that never come back.
 */
async function handleFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const orderId = orderIdFrom(intent);
  if (!orderId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from("Order")
    .update({
      paymentStatus: "FAILED",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", orderId)
    // Never overwrite a settled payment. Stripe can deliver a stale failure
    // after a successful retry, and that must not un-pay a paid order.
    .neq("paymentStatus", "PAID");

  if (error) {
    console.error(`[stripe] marking ${orderId} failed: ${error.message}`);
  }
}

/**
 * `payment_intent.canceled`.
 *
 * A payment that will not be completed — cancelled from the dashboard, or by
 * Stripe when an intent expires. Distinct from a decline: nothing is being
 * waited for and no retry is coming.
 *
 * The order's *payment* is marked FAILED, and its **stock is deliberately left
 * alone**. Releasing it here would be a second restock path racing the sweeper
 * in `expire_unpaid_orders()`, which already cancels and restocks exactly these
 * orders through `set_order_status()`. `restock_order()` is idempotent by
 * `"stockReleasedAt"` so a double run would not double-restock — but two
 * mechanisms owning one decision is how the guard eventually gets removed from
 * the wrong one. The sweeper owns stock.
 */
async function handleCanceled(intent: Stripe.PaymentIntent): Promise<void> {
  const orderId = orderIdFrom(intent);
  if (!orderId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from("Order")
    .update({
      paymentStatus: "FAILED",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", orderId)
    // Same guard as the decline path, and for the same reason: a cancellation
    // delivered after a successful retry must not un-pay a paid order.
    .neq("paymentStatus", "PAID");

  if (error) {
    console.error(`[stripe] cancelling ${orderId}: ${error.message}`);
  }
}

/**
 * `payment_intent.processing`.
 *
 * An asynchronous method has been accepted but has not cleared. It is neither a
 * success nor a failure, and the order correctly stays UNPAID — a payment that
 * has not settled is not a payment, and `settle_order_payment()` must not be
 * reachable from here.
 *
 * So this handler writes nothing. It exists so the outcome is *handled* rather
 * than falling through the default branch, and so the log says the order is
 * waiting on a bank rather than going quiet — which is the difference between
 * an explicable delay and a support ticket.
 *
 * The visitor has already been moved to the confirmation page by
 * `CardPaymentForm`, which treats `processing` as "not finished, not failed".
 * The `succeeded` event that follows does the settling; if none ever arrives,
 * the sweeper cancels and restocks like any other unpaid card order.
 */
async function handleProcessing(intent: Stripe.PaymentIntent): Promise<void> {
  const orderId = orderIdFrom(intent);
  console.info(
    `[stripe] ${intent.id} is processing${orderId ? ` for order ${orderId}` : ""}; ` +
      "left unpaid until it clears.",
  );
}

/**
 * `charge.refunded` — a refund issued from the Stripe dashboard.
 *
 * Routed through `set_order_status`, which restocks. A refund performed from
 * `/admin/orders` already goes through the same function via
 * `updateOrderStatus`, and `restock_order()` is idempotent by
 * `"stockReleasedAt"`, so the two paths cannot double-restock each other.
 */
async function handleRefunded(charge: Stripe.Charge): Promise<void> {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!intentId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("Order")
    .select("id, status")
    .eq("stripePaymentIntentId", intentId)
    .maybeSingle();

  if (error || !data || typeof data.id !== "string") {
    if (error) console.error(`[stripe] refund lookup failed: ${error.message}`);
    return;
  }

  if (data.status === "REFUNDED") return;

  const { error: statusError } = await supabase.rpc("set_order_status", {
    order_id: data.id,
    next_status: "REFUNDED",
  });

  if (statusError) {
    console.error(`[stripe] refunding ${data.id}: ${statusError.message}`);
    return;
  }

  const order = await getOrderForMail(data.id);
  if (order) await notifyCustomerOfOrder(order, "refunded");
}

/**
 * The order an event concerns, for the ledger row only.
 *
 * Best effort by design. It reads the metadata a payment intent carries and
 * gives up on anything else — a `charge.refunded` finds its order by intent id
 * inside its own handler, and duplicating that lookup here would mean a
 * database round trip before the duplicate check that exists to avoid work.
 *
 * A null answer never changes what happens: the event is still recorded, still
 * dispatched, and its handler still finds its own order. See the nullable
 * column in `0054_stripe_webhook_events.sql`.
 */
function orderIdForLedger(event: Stripe.Event): string | null {
  const object = event.data.object as { metadata?: Stripe.Metadata | null };
  const id = object.metadata?.orderId;

  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    console.error("[stripe] Webhook is not configured; event rejected.");
    return NextResponse.json({ error: "unconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "unsigned" }, { status: 400 });
  }

  // Raw text, before anything parses it. See the header.
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (cause) {
    // The message only — never the body, which is somebody's payment details.
    console.error(
      "[stripe] Signature verification failed:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return NextResponse.json({ error: "badSignature" }, { status: 400 });
  }

  /*
   * Have we already acted on this exact event?
   *
   * Asked by writing, not by reading: `record_stripe_event()` inserts and
   * reports whether the insert happened, so two concurrent deliveries of one
   * event cannot both pass. A read-then-dispatch would let them.
   *
   * The ledger is a **gate, not a dependency**. If Supabase is unreachable or
   * the function is missing — a deployment where `0054` has not been applied
   * yet, which is a real state during a rollout — the event is dispatched
   * anyway and the per-order guards underneath do their older job. The failure
   * mode of skipping the ledger is a duplicate email; the failure mode of
   * refusing the event is money that moved and was never recorded. Those are
   * not close.
   */
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: firstDelivery, error: ledgerError } = await supabase.rpc(
      "record_stripe_event",
      {
        event_id: event.id,
        event_type: event.type,
        order_id: orderIdForLedger(event),
      },
    );

    if (ledgerError) {
      console.error(
        `[stripe] ${event.id} not recorded (${ledgerError.message}); handling it anyway.`,
      );
    } else if (firstDelivery !== true) {
      // Seen before. The work is done; saying so is the whole response.
      console.info(`[stripe] ${event.id} (${event.type}) already handled; ignored.`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handleSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handleFailed(event.data.object);
        break;

      case "payment_intent.canceled":
        await handleCanceled(event.data.object);
        break;

      case "payment_intent.processing":
        await handleProcessing(event.data.object);
        break;

      case "charge.refunded":
        await handleRefunded(event.data.object);
        break;

      default:
        // Everything else is acknowledged and ignored. Answering anything but
        // 200 to an event we do not handle makes Stripe retry it forever.
        break;
    }
  } catch (cause) {
    // A thrown handler is a bug worth retrying: answer 500 so Stripe redelivers.
    // Every path that is *expected* to fail — a mail send, a stale row —
    // handles itself above and never reaches here.
    console.error(
      `[stripe] Handler for ${event.type} threw:`,
      cause instanceof Error ? cause.message : "unknown error",
    );

    /*
     * Give the event id back before answering 500.
     *
     * The ledger row was written *before* dispatch, which is what makes two
     * simultaneous deliveries safe — but it would also make the retry we are
     * about to ask for a no-op, and the event would never be handled at all.
     * Recording that an event was handled has to be untrue once handling has
     * failed.
     *
     * A failed delete is logged and no more. The 500 still goes out and Stripe
     * still retries; the retry is simply answered as a duplicate, which leaves
     * the event unhandled and visible in the logs as exactly that. Swallowing
     * the 500 to avoid it would be worse.
     */
    if (supabase) {
      const { error: releaseError } = await supabase
        .from("StripeWebhookEvent")
        .delete()
        .eq("id", event.id);

      if (releaseError) {
        console.error(
          `[stripe] ${event.id} stays recorded despite failing: ${releaseError.message}. ` +
            "The redelivery will be treated as a duplicate — handle it by hand.",
        );
      }
    }

    return NextResponse.json({ error: "handler" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
