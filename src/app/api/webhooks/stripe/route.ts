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
 * ## Idempotency
 *
 * Stripe retries until it gets a 2xx and may deliver the same event more than
 * once even after one. `settle_order_payment()` returns true exactly once per
 * order, and **that boolean is the only thing gating the customer's email**.
 * Without it, a retry is a second receipt in somebody's inbox.
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

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handleSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handleFailed(event.data.object);
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
    return NextResponse.json({ error: "handler" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
