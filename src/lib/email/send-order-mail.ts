import "server-only";

/**
 * Order mail delivery.
 *
 * ## Best-effort, always
 *
 * Every function here swallows every failure and returns `void`. That is the
 * posture `sendAcknowledgement` in `src/actions/checkout.ts`'s sibling —
 * `src/actions/contact.ts` — establishes, and it matters more here than it does
 * there.
 *
 * A sale is already secured by the time any of this runs: the row exists, the
 * stock has moved, and for a card order the money has been taken. Letting a
 * Resend outage propagate would turn a completed purchase into an error screen,
 * or a successful status change into a red toast on the desk. An order that
 * exists with no email sent is recoverable by one person clicking a button; an
 * order refused because a mail provider was down is not recoverable at all.
 *
 * So: no throws, no rethrows, and a log line on every path that fails.
 *
 * ## Privacy
 *
 * The logs carry an order number and, at most, a provider error message. Never
 * a name, an address, a phone number, or an email. `supabase/sql/0015_orders.sql`
 * grants the public roles nothing on these rows precisely because of what they
 * hold, and copying it into a log defeats that.
 */

import { getSocialProfiles } from "@/src/services/contact";
import type { OrderMailRecord } from "@/src/services/orders";

import {
  fromAddress,
  houseFromAddress,
  inboxAddress,
  orderInboxAddress,
} from "./addresses";
import { getEmailClient } from "./client";
import { stripHeaderBreaks } from "./escape";
import { AUTO_REPLY_HEADERS } from "./headers";
import { logoAttachment, logoSrc } from "./logo";
import type { OrderMailKind } from "./order-copy";
import { customerOrderEmail, newOrderNotificationEmail } from "./order-templates";

function logFailure(context: string, orderNumber: string, cause: unknown): void {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "unknown error";

  console.error(`[order-mail] ${context} for ${orderNumber}: ${message}`);
}

/**
 * Tell the house an order has arrived.
 *
 * `Reply-To` is the customer, so answering "when will this ship?" is one click
 * from the notification. `From` is `noreply@` — the same reasoning
 * `addresses.ts` gives, that a mailbox sending to itself scores worse with spam
 * filters.
 *
 * It goes to `orderInboxAddress()` — khem.official@outlook.com, the operations
 * account — and **not** to the contact page's published address. Fulfilment mail
 * and correspondence are different jobs, often different people. Override with
 * `ORDER_NOTIFICATION_EMAIL`.
 */
export async function notifyHouseOfOrder(order: OrderMailRecord): Promise<void> {
  const resend = getEmailClient();

  if (!resend) {
    console.warn(
      `[order-mail] RESEND_API_KEY is not set; ${order.orderNumber} not announced.`,
    );
    return;
  }

  try {
    const payload = newOrderNotificationEmail(order);

    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: await orderInboxAddress(),
      // Validated by `checkoutSchema` before it ever reached the database, and
      // stripped again here: a header is the one place a newline is an attack
      // rather than a typo.
      replyTo: order.customerEmail
        ? stripHeaderBreaks(order.customerEmail)
        : undefined,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    // Resend answers `{ data, error }` rather than throwing. Not reading this
    // is the silent-drop bug `src/actions/contact.ts` calls out by name.
    if (error) logFailure("House notification rejected", order.orderNumber, error.message);
  } catch (cause) {
    logFailure("House notification threw", order.orderNumber, cause);
  }
}

/**
 * Tell the customer where their order stands.
 *
 * Written in `order.locale`, the column — not in the language of whoever
 * clicked the button. Four of the five kinds are sent from an English-only
 * dashboard days after the order was placed.
 *
 * The mark travels as an inline attachment so it renders before the reader
 * allows remote images; `logoSrc` hands the template the matching `cid:`
 * reference, or an absolute URL if the file could not be read.
 */
export async function notifyCustomerOfOrder(
  order: OrderMailRecord,
  kind: OrderMailKind,
): Promise<void> {
  const resend = getEmailClient();

  if (!resend) {
    console.warn(
      `[order-mail] RESEND_API_KEY is not set; ${order.orderNumber} ${kind} not sent.`,
    );
    return;
  }

  // A guest order always has one — `checkoutSchema` requires it — but a walk-in
  // typed at the desk need not, and the desk can move a walk-in to SHIPPED.
  if (!order.customerEmail) return;

  try {
    // Both are reads the synchronous template cannot perform itself, so they
    // happen here and are passed in. Same split as `src/actions/contact.ts`.
    const [socials, attachment] = await Promise.all([
      getSocialProfiles(),
      logoAttachment(),
    ]);

    const payload = customerOrderEmail({
      order,
      kind,
      socials,
      logoSrc: logoSrc(attachment),
    });

    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      to: order.customerEmail,
      replyTo: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: AUTO_REPLY_HEADERS,
      attachments: attachment
        ? [
            {
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType,
              // Makes it an *inline* part rather than a paperclip: the
              // signature's `<img src="cid:khem-logo">` resolves against this.
              contentId: attachment.contentId,
            },
          ]
        : undefined,
    });

    if (error) logFailure(`${kind} rejected`, order.orderNumber, error.message);
  } catch (cause) {
    logFailure(`${kind} threw`, order.orderNumber, cause);
  }
}

/**
 * Both messages for a newly confirmed order, in the order that matters.
 *
 * The house notification goes **first**. It is addressed to a mailbox we
 * control and therefore the one unlikely to hard-bounce; the customer's address
 * is one somebody typed thirty seconds ago. Same reasoning `contact.ts` gives
 * for securing the enquiry before sending the acknowledgement — if only one of
 * the two can arrive, it must be the one that lets a person act.
 *
 * Sequential rather than `Promise.all` for the same reason: a rate limit that
 * drops one of two parallel sends should drop the second, not either.
 */
export async function announceOrder(order: OrderMailRecord): Promise<void> {
  await notifyHouseOfOrder(order);
  await notifyCustomerOfOrder(order, "confirmation");
}

/**
 * Which status change is worth an email, and which message it gets.
 *
 * Every status is. `PENDING` used to map to nothing, on the reasoning that an
 * order awaiting a card authorisation is a state the buyer is already watching
 * on screen — but since `supabase/sql/0017_order_events.sql` stopped promoting
 * paid orders to PROCESSING, PENDING is where an order genuinely *sits* until
 * the desk picks it up, and silence there is silence for the whole first leg of
 * the journey. It sends the confirmation, which is the same thing checkout
 * would have said.
 *
 * `PROCESSING` reuses that confirmation too, because a desk pulling an order
 * forward is telling the customer the same thing in different words.
 *
 * Exported so `src/actions/admin/orders.ts` does not have to restate the
 * mapping, and so adding a status to `OrderStatus` fails to compile here.
 */
export function mailKindForStatus(
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED",
): OrderMailKind | null {
  switch (status) {
    case "PROCESSING":
      return "confirmation";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "REFUNDED":
      return "refunded";
    case "PENDING":
      return "confirmation";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
