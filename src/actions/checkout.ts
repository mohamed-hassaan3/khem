"use server";

/**
 * Placing an order from the storefront.
 *
 * ## The rule this file inherits
 *
 * An order and the stock it consumes are **one event**. `src/actions/admin/orders.ts`
 * states it for the desk and it holds here without exception: nothing in this
 * module reads an inventory count, decides, and writes it back. Every order is
 * created by `place_order()` in `supabase/sql/0016_checkout.sql`, which takes
 * the row locks and does both halves in one transaction.
 *
 * ## Where the money comes from
 *
 * Not from the request. The browser posts `{ productId, quantity }` pairs —
 * that is literally all `src/providers/cart-provider.tsx` persists — and every
 * figure is derived server-side:
 *
 *   line prices  → `place_order()`, from `"Product"` rows it has locked
 *   subtotal     → `place_order()`, summed from those same rows
 *   delivery     → `shippingInCents()` here, from a subtotal read a moment
 *                  earlier; it is the one number the SQL function cannot
 *                  derive, so it is passed in
 *   total        → `place_order()`, subtotal + delivery
 *
 * The display currency never enters any of this. An order settles in Egyptian
 * pounds, and `src/lib/currency.ts` says outright that a converted figure must
 * never become a pricing input.
 *
 * ## Card versus cash
 *
 * Both create the order here. They differ in what state it lands in:
 *
 *   CASH → PENDING and UNPAID until the courier collects. Nothing is being
 *          waited for, so both emails go out now; the desk moves it to
 *          PROCESSING when it actually starts preparing the parcel.
 *   CARD → PENDING and UNPAID, stock already reserved. **No customer email
 *          yet** — an unpaid order is not a confirmed one. The client then asks
 *          `/api/checkout/intent` for a client secret, and the webhook marks it
 *          paid and sends the mail once Stripe says the money moved. Paying
 *          does not advance the status either: see
 *          `supabase/sql/0017_order_events.sql`.
 *
 * The cost of reserving stock before payment is abandoned baskets holding
 * bottles, and this module pays most of it itself — see {@link sweepStaleHolds}.
 * `/api/cron/sweep-unpaid-orders` is the backstop.
 *
 * ## Logging
 *
 * Order number, method, and provider errors. **Never** the name, email, phone,
 * address, or note. These rows hold a street address now, which makes the rule
 * stricter than it was, not looser.
 */

import { getUserId } from "@/src/lib/auth";
import { shippingInCents } from "@/src/lib/cart";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { announceOrder } from "@/src/lib/email/send-order-mail";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { checkoutFieldErrors, checkoutSchema } from "@/src/schemas/checkout";
import { getOrderForMailByNumber, resolveCartToLines } from "@/src/services/orders";
import type { CheckoutFormInput, CheckoutResult } from "@/src/types/checkout";

import { revalidateProductsBySlug } from "./admin/shared";

/**
 * Eight attempts per ten minutes per client.
 *
 * Higher than the contact form's three, because the thing being protected is
 * different. There, the scarce resource is the attention of whoever opens the
 * mailbox. Here it is stock: every accepted request reserves bottles. But a
 * genuine buyer whose first card is declined will legitimately try again, and a
 * limit that locks them out after two attempts loses a sale to a bank's fraud
 * heuristic.
 */
const LIMIT = { limit: 8, windowMs: 10 * 60 * 1_000 };

/** How long an unpaid card order may hold its bottles. Matches the cron route. */
const HOLD_MINUTES = 30;

/**
 * Release stock from card orders nobody came back to pay for.
 *
 * ## Why this is here and not only on a schedule
 *
 * `vercel.json` runs the same sweep on a cron, but the Hobby plan permits at
 * most one cron run per day — a more frequent expression makes Vercel refuse
 * the deployment outright, which is what kept the first version of this feature
 * from ever reaching production. Once a day is far too slow: a basket abandoned
 * at 09:00 would hold its bottles until the small hours.
 *
 * So the sweep runs *here*, on the one event that both cares about the answer
 * and happens exactly as often as it needs to. A shopper reaching checkout is
 * the moment stale reservations matter, and running it **before**
 * `place_order()` means bottles freed by this call are available to this very
 * order — someone can buy the last bottle that an abandoned basket was sitting
 * on, instead of being told it is out of stock.
 *
 * Cheap enough to be unremarkable: `order_unpaid_card_idx` is a partial index
 * over exactly the at-risk rows, so the usual result is zero rows and one round
 * trip. On Pro, tighten the cron and this becomes pure redundancy — which is
 * the right thing for it to become, not a reason to remove it.
 *
 * Never allowed to fail a sale. A sweep that errors leaves stock reserved a
 * little longer; a sweep that throws would refuse a customer's money.
 */
async function sweepStaleHolds(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("expire_unpaid_orders", {
      older_than_minutes: HOLD_MINUTES,
    });

    if (error) {
      console.error(`[checkout] sweep failed: ${error.message}`);
      return;
    }

    const cancelled = Array.isArray(data) ? data.length : 0;
    if (cancelled > 0) {
      console.info(`[checkout] released ${cancelled} stale hold(s) before placing.`);
    }
  } catch (cause) {
    console.error(
      "[checkout] sweep threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }
}

/**
 * Turn a `place_order()` raise into something the visitor can act on.
 *
 * "Nefertem has only 2 in stock" is not a field error a schema could have
 * caught — the answer lives in a row that may change between the page being
 * rendered and the button being pressed. The database raises with a sentence;
 * this decides which translated message frames it.
 *
 * The sentence itself is English-only and rides along as `detail`, shown
 * beneath the translated line rather than instead of it. Translating a message
 * built inside Postgres would mean parsing it, and a checkout that guesses at
 * the shape of an error string is a checkout that shows the wrong one.
 */
function placementFailure(message: string): CheckoutResult {
  if (message.includes("in stock")) {
    return { ok: false, formError: "outOfStock", detail: message };
  }

  if (message.includes("archived")) {
    return { ok: false, formError: "unavailable", detail: message };
  }

  return { ok: false, formError: "server" };
}

export async function placeCustomerOrder(
  input: CheckoutFormInput,
): Promise<CheckoutResult> {
  /*
   * Order is deliberate, and matches `src/actions/contact.ts`: cheapest and
   * most traffic-shedding first, so nothing that costs stock or a metered call
   * runs before the throttle.
   *
   * 1. Honeypot. A bot walked the DOM. Report success and do nothing — telling
   *    a scraper it was detected only teaches it to adapt. It gets a plausible
   *    number that belongs to no order.
   */
  if (input.company.length > 0) {
    return { ok: true, orderNumber: "KHEM-0000-0000", paymentMethod: "CASH" };
  }

  // 2. Throttle, before any parsing or database call.
  if (isRateLimited("checkout", await clientKey(), LIMIT)) {
    return { ok: false, formError: "rateLimited" };
  }

  /*
   * 3. Authoritative validation, and — for the country — the *only* gate.
   *
   * The house delivers within Egypt, and `checkoutSchema` is what enforces it:
   * a country that is not Egypt fails the `country` field with `outsideEgypt`.
   *
   * Deliberately judged from the **submitted country** rather than from
   * `x-vercel-ip-country`. The header decides what the form's dropdown starts
   * at and nothing more, because it is routinely wrong about people standing in
   * Cairo — a VPN, a corporate proxy, a carrier homed abroad — and a refusal
   * such a customer cannot correct is a lost order defending against nothing.
   * The parcel goes to the address below regardless, and that is what
   * fulfilment reads.
   *
   * The form checked the same rule and disabled its own button; that was an
   * affordance. This is the boundary.
   */
  const parsed = checkoutSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      formError: "validation",
      fieldErrors: checkoutFieldErrors(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[checkout] SUPABASE_SECRET_KEY is not set; no order written.");
    return { ok: false, formError: "unconfigured" };
  }

  // 4. Ids → slugs and prices. The slugs are what `place_order()` takes; the
  //    subtotal exists only to compute the delivery fee below.
  const resolution = await resolveCartToLines(parsed.data.items);

  if (!resolution.ok) {
    return {
      ok: false,
      formError: resolution.reason === "missing" ? "cartChanged" : "unconfigured",
      detail: resolution.productName,
    };
  }

  // 5. The one figure the database cannot derive. Same function the cart page
  //    used to quote it, so the total shown and the total charged come from one
  //    implementation — which is the promise `src/lib/cart.ts` opens with.
  const shipInCents = shippingInCents(resolution.subtotalInCents);

  // 6. Free anything abandoned before asking for stock, so a bottle held by a
  //    basket nobody paid for is available to the person standing here now.
  await sweepStaleHolds(supabase);

  // 7. Identity from the session, never from the body. A guest gets null here
  //    and their order correctly never appears in anybody's portal.
  const clerkUserId = await getUserId();

  const { data, error } = await supabase.rpc("place_order", {
    payload: {
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      clerkUserId: clerkUserId ?? "",
      // Never `OFFLINE` from this path. It is what separates storefront revenue
      // from walk-ins in `"DailySales"`.
      channel: "ONLINE",
      paymentMethod: parsed.data.paymentMethod,
      locale: parsed.data.locale,
      note: parsed.data.note,
      shipLine1: parsed.data.line1,
      shipLine2: parsed.data.line2,
      shipCity: parsed.data.city,
      shipState: parsed.data.state,
      shipPostalCode: parsed.data.postalCode,
      shipCountry: parsed.data.country,
      shipInCents,
      items: resolution.lines.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
      })),
    },
  });

  if (error) {
    console.error(`[checkout] place_order failed: ${error.message}`);
    return placementFailure(error.message);
  }

  const orderNumber = typeof data === "string" ? data : "";

  if (orderNumber === "") {
    console.error("[checkout] place_order returned no order number.");
    return { ok: false, formError: "server" };
  }

  console.info(
    `[checkout] ${orderNumber} placed — ${parsed.data.paymentMethod}, ${resolution.lines.length} line(s)`,
  );

  // Stock just moved, so every surface printing a sold-out badge or a remaining
  // count is stale. Awaited but never allowed to change the outcome — the sale
  // is already recorded.
  await revalidateProductsBySlug(resolution.lines.map((line) => line.slug));

  const order = await getOrderForMailByNumber(orderNumber);

  if (!order) {
    // The row exists — `place_order()` returned its number — so this is a read
    // failure, not a write one. The customer is not told a successful order
    // failed over an email that did not send.
    console.error(`[checkout] ${orderNumber} placed but could not be read back.`);
    return {
      ok: true,
      orderNumber,
      paymentMethod: parsed.data.paymentMethod,
    };
  }

  if (parsed.data.paymentMethod === "CASH") {
    /*
     * The order stays PENDING, and both emails go now.
     *
     * It used to be promoted to PROCESSING here, on the reasoning that there
     * was nothing to wait for. But PROCESSING means somebody in Cairo has
     * begun preparing the parcel, and thirty seconds after checkout nobody
     * has. The customer's rail lit its second station before the first had
     * been earned. PENDING is the true state — the desk moves it when work
     * starts — and the desk still sees it, because `OPEN_STATUSES` in
     * `src/services/admin/orders.ts` counts PENDING as owed.
     */
    await announceOrder(order);

    return { ok: true, orderNumber, paymentMethod: "CASH" };
  }

  // Card: the order is PENDING and its stock is held. No customer email — an
  // unpaid order is not a confirmed one, and the webhook sends both messages
  // once Stripe confirms the money moved.
  return {
    ok: true,
    orderNumber,
    orderId: order.id,
    paymentMethod: "CARD",
  };
}
