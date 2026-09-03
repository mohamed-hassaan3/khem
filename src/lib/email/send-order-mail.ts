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
import type { OrderFeedbackRecord, OrderMailRecord } from "@/src/services/orders";

import {
  fromAddress,
  houseFromAddress,
  inboxAddress,
  orderFromAddress,
  orderInboxAddress,
  sameMailbox,
} from "./addresses";
import { getEmailClient } from "./client";
import { AUTO_REPLY_HEADERS } from "./headers";
import { logoAttachment, logoSrc } from "./logo";
import type { OrderMailKind } from "./order-copy";
import {
  customerFeedbackEmail,
  customerOrderEmail,
  newOrderNotificationEmail,
} from "./order-templates";

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
 * It goes to `orderInboxAddress()` — orders@khemperfumes.com, the mailbox the
 * team opens to pick and pack — and **not** to the contact page's published
 * address. Fulfilment mail
 * and correspondence are different jobs, often different people. Override with
 * `ORDER_NOTIFICATION_EMAIL`.
 *
 * ## Why this one is shaped for a junk filter
 *
 * The house mailbox is Outlook, and order notifications were landing in Junk.
 * Two things about the message were feeding that, and both are fixed here:
 *
 *  - **`Reply-To` pointed at the customer.** A reply-to address on a domain the
 *    sender does not control is one of the oldest phishing shapes there is, and
 *    Outlook scores it accordingly — every order replied-to a different
 *    stranger's gmail. It is gone. Nothing is lost that the message does not
 *    already carry: the customer's address and phone number are a row in the
 *    slip, and answering means a new message rather than a reply.
 *  - **The sender was the shared `noreply@`.** A junk verdict is learned per
 *    sender, and `noreply@` carries whatever every other automated message on
 *    the site has earned. `orderFromAddress()` sends as `info@` instead — an
 *    established mailbox that people already correspond with, and one address
 *    the `orders@` mailbox marks safe once and for good.
 *
 * `X-Entity-Ref-ID` carries the order number so two notifications never collapse
 * into one thread — a picking slip that hides behind "show trimmed content" is a
 * parcel nobody packs.
 *
 * None of this can override a filter that has already made its mind up: the
 * `orders@` mailbox still needs `info@khemperfumes.com` in Safe Senders, and
 * the domain still needs its SPF, DKIM and DMARC records standing. That is operations, not
 * code, and it is written down in
 * `prompts/order-mail-deliverability-feedback-and-egypt-only-checkout.md`.
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

    const to = await orderInboxAddress();

    /*
     * A mailbox must not send to itself.
     *
     * `ORDER_NOTIFICATION_EMAIL` and `RESEND_ORDER_FROM_EMAIL` are edited
     * independently, and pointing both at `orders@` is an easy thing to do by
     * accident — it has already happened once. Self-addressed mail scores worse with exactly the filter
     * this whole arrangement exists to satisfy, so the send falls back to the
     * website's general sender rather than going out mis-shaped.
     */
    const configured = orderFromAddress();
    const from = sameMailbox(configured, to) ? fromAddress() : configured;

    if (from !== configured) {
      console.warn(
        "[order-mail] RESEND_ORDER_FROM_EMAIL names the order inbox; sending as the website address instead.",
      );
    }

    const { error } = await resend.emails.send({
      from,
      to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      // The order number, not an address: this header exists only to keep two
      // notifications from being threaded together.
      headers: { "X-Entity-Ref-ID": order.orderNumber },
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
 * Ask a customer what they thought, a day after the parcel arrived.
 *
 * Sent by `src/app/api/cron/order-feedback/route.ts`, never by a status change:
 * nothing happens to an order at the twenty-four hour mark, which is precisely
 * why this one needs a clock rather than a trigger.
 *
 * Best-effort like everything else here, and *deliberately* so even though this
 * one runs unattended: the caller has already stamped
 * `"Order"."feedbackRequestedAt"` before calling, so a throw would earn no
 * second attempt anyway — it would only turn one unsent letter into a failed
 * cron run and a red mark on a dashboard.
 *
 * Written in `order.locale`, carrying the same mark, shell and signature as the
 * five status letters. It is a letter from the house, not a survey.
 */
export async function notifyCustomerOfFeedbackRequest(
  order: OrderFeedbackRecord,
): Promise<void> {
  const resend = getEmailClient();

  if (!resend) {
    console.warn(
      `[order-mail] RESEND_API_KEY is not set; ${order.orderNumber} feedback not sent.`,
    );
    return;
  }

  if (!order.customerEmail) return;

  try {
    const [socials, attachment] = await Promise.all([
      getSocialProfiles(),
      logoAttachment(),
    ]);

    const payload = customerFeedbackEmail({
      order,
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
              contentId: attachment.contentId,
            },
          ]
        : undefined,
    });

    if (error) logFailure("feedback rejected", order.orderNumber, error.message);
  } catch (cause) {
    logFailure("feedback threw", order.orderNumber, cause);
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
 * Every status is. `PROCESSING` — where an order now begins, since 0051 retired
 * `PENDING` — sends the confirmation, which is the same thing checkout would
 * have said. The two used to share that letter; with one of them gone the
 * mapping is simply shorter, and what the customer receives is unchanged.
 *
 * Exported so `src/actions/admin/orders.ts` does not have to restate the
 * mapping, and so adding a status to `OrderStatus` fails to compile here.
 */
export function mailKindForStatus(
  status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED",
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
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
