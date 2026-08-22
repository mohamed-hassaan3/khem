"use server";

/**
 * Order writes — recording a sale, and moving one along.
 *
 * ## The rule this file exists to keep
 *
 * An order and the stock it consumes are **one event**. Neither this module
 * nor any other reads a product's inventory, decides, and then writes it back:
 * that gap is where two editors each sell the last bottle. Every write here
 * calls a function in `supabase/sql/0015_orders.sql` that takes the row locks
 * and does both halves inside one transaction. If a future change needs a new
 * kind of stock movement, it belongs in that file, not in this one.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export — the admin layout's gate protects pages, not
 * endpoints — and every input is parsed by `schemas/orders.ts` before a value
 * reaches a query.
 *
 * ## Moving an order also tells the customer
 *
 * `updateOrderStatus` sends a branded email on every status a customer would
 * want to hear about — shipped, delivered, cancelled, refunded — written in
 * `"Order"."locale"` rather than in the language of whoever clicked the button.
 * The mapping lives in `src/lib/email/send-order-mail.ts` so this file does not
 * restate it, and the send is best-effort by construction: a mail outage must
 * never turn a successful status change into a red toast on the desk.
 *
 * ## Logging
 *
 * Actor, action, order number. **Never** the customer's name, email, phone or
 * the desk's note: those are the reason `0015` grants the public roles nothing,
 * and copying them into a log defeats the point.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import {
  mailKindForStatus,
  notifyCustomerOfOrder,
} from "@/src/lib/email/send-order-mail";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  canTransition,
  createOrderSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
  type AdminActionResult,
} from "@/src/schemas/orders";
import { getAdminOrderById } from "@/src/services/admin/orders";
import { getOrderForMail } from "@/src/services/orders";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  revalidateProductsBySlug,
  type PostgresErrorLike,
} from "./shared";

/**
 * Why `place_order` raises rather than returns.
 *
 * "That product has only 3 in stock" is not a field error the schema could
 * have caught — the answer lives in a row that may change between the form
 * being rendered and the button being pressed. The function raises with a
 * sentence written for the person at the desk, and this turns it into the
 * form-level message. Anything unrecognised falls through to the generic
 * mapping in `./shared.ts`, with the provider's text going to the log.
 */
function placementFailure(error: PostgresErrorLike): AdminActionResult {
  const message = error.message ?? "";

  if (message.includes("in stock") || message.includes("archived")) {
    return { ok: false, message, fieldErrors: { items: message } };
  }

  return postgresFailure(error, "product");
}

/**
 * Record a sale.
 *
 * Prices come from the catalog inside the database function, never from the
 * form: a request that could name its own price is a request that can sell a
 * bottle for nothing.
 */
export async function createOrder(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase.rpc("place_order", {
    payload: {
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      channel: parsed.data.channel,
      note: parsed.data.note,
      shipInCents: parsed.data.shipInCents,
      items: parsed.data.items,
    },
  });

  if (error) {
    console.error(`[admin] createOrder failed: ${error.message}`);
    return placementFailure(error);
  }

  const orderNumber = typeof data === "string" ? data : "";
  console.info(`[admin] ${actor.email} recorded order ${orderNumber}`);

  // Stock just moved, so every surface that prints a sold-out badge or a
  // remaining count is stale.
  await revalidateProductsBySlug(parsed.data.items.map((item) => item.slug));

  return {
    ok: true,
    slug: orderNumber,
    message: `Order ${orderNumber} recorded.`,
  };
}

/**
 * Move an order along — and, for the two closing statuses, put its units back.
 *
 * The restock is not performed here. `set_order_status()` does both halves, so
 * "cancelled" and "the stock is back" cannot come apart because a second
 * request failed.
 */
export async function updateOrderStatus(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That status change is not valid." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  // The current status is read server-side rather than trusted from the form:
  // the page may have been open while somebody else cancelled the order, and
  // the transition table is only meaningful against the row as it is now.
  const order = await getAdminOrderById(parsed.data.orderId);
  if (!order) {
    return { ok: false, message: "That order no longer exists." };
  }

  if (order.status === parsed.data.status) {
    return { ok: true, slug: order.orderNumber, message: "Nothing to change." };
  }

  if (!canTransition(order.status, parsed.data.status)) {
    return {
      ok: false,
      message: `An order that is ${order.status.toLowerCase()} cannot become ${parsed.data.status.toLowerCase()}.`,
    };
  }

  const { error } = await supabase.rpc("set_order_status", {
    order_id: parsed.data.orderId,
    next_status: parsed.data.status,
  });

  if (error) {
    console.error(`[admin] updateOrderStatus failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  console.info(
    `[admin] ${actor.email} set ${order.orderNumber} to ${parsed.data.status}`,
  );

  // Cancelling and refunding return units to the shelf; the other transitions
  // do not, and revalidating anyway is a cheap no-op beside getting it wrong.
  await revalidateProductsBySlug(order.lines.map((line) => line.productSlug));

  /*
   * Tell the customer. `PENDING` maps to null and sends nothing — "your order
   * is pending" is anxiety with no information in it.
   *
   * `notifyCustomerOfOrder` swallows its own failures, so this cannot throw and
   * cannot change what the desk sees. The row is re-read rather than reusing
   * `order`, because that projection was taken *before* the status changed and
   * carries no address, tracking code or locale — the three things the email
   * needs. It is also the read that picks up a tracking code saved a moment ago.
   */
  const notified = mailKindForStatus(parsed.data.status);
  let mailed = false;

  if (notified) {
    const record = await getOrderForMail(parsed.data.orderId);

    if (record?.customerEmail) {
      await notifyCustomerOfOrder(record, notified);
      mailed = true;
    }
  }

  return {
    ok: true,
    slug: order.orderNumber,
    message: mailed
      ? `Order ${order.orderNumber} is now ${parsed.data.status.toLowerCase()}. The customer has been notified.`
      : `Order ${order.orderNumber} is now ${parsed.data.status.toLowerCase()}.`,
  };
}

/** Payment state only — it moves no stock, so there is no function behind it. */
export async function updatePaymentStatus(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updatePaymentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That payment state is not valid." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Order")
    .update({
      paymentStatus: parsed.data.paymentStatus,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", parsed.data.orderId)
    .select("orderNumber")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updatePaymentStatus failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  const orderNumber =
    data && typeof data.orderNumber === "string" ? data.orderNumber : "";

  console.info(
    `[admin] ${actor.email} marked ${orderNumber} ${parsed.data.paymentStatus}`,
  );

  return {
    ok: true,
    slug: orderNumber,
    message: `Payment marked ${parsed.data.paymentStatus.toLowerCase()}.`,
  };
}
