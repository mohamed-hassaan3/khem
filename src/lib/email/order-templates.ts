/**
 * The order emails.
 *
 * Two audiences, two formats, and the split is the whole design of this file:
 *
 *  - **The customer** gets `customerOrderEmail()` — the `luxuryShell` brand
 *    surface with the seal, the wordmark, the signature and the social links.
 *    It is often the second thing KHEM ever sends someone and the first that
 *    carries money.
 *  - **The house** gets `newOrderNotificationEmail()` — the dense label/value
 *    `shell()` from `./templates.ts`, English only, no seal. It goes to one
 *    person who needs the address and the item list in three seconds. It is a
 *    picking slip, not a brand moment, and dressing it up would slow down the
 *    only job it has.
 *
 * ## Escaping
 *
 * Everything from `./order-copy.ts` is trusted author prose and is interpolated
 * raw. Everything from an `"Order"` row is not: a customer's name, their
 * address, their note, and even a product name are values somebody typed
 * somewhere. All of them go through `escapeHtml`. The rule is the same one
 * `layout.ts` states for `quoteBlock` — the caller escapes, the primitive does
 * not second-guess it — applied consistently rather than selectively.
 *
 * ## Why the tokens are restated
 *
 * Email cannot use CSS variables; every value must be literal at send time.
 * `layout.ts` and `templates.ts` both make this compromise and both document
 * it. Keep the three in step with `@theme` in the stylesheet.
 */

import { formatPrice } from "@/src/lib/format";
import {
  LOCALE_DIRECTION,
  localizePath,
  type Locale,
} from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS, productHref } from "@/src/lib/routes";
import type { OrderFeedbackRecord, OrderMailRecord } from "@/src/services/orders";
import type { CollectionKind } from "@/src/types/catalog";
import type { SocialProfile } from "@/src/types/contact";

import { escapeHtml } from "./escape";
import {
  ctaButton,
  luxuryShell,
  mutedParagraph,
  paragraph,
  signoff,
  spacer,
} from "./layout";
import {
  FEEDBACK_COPY,
  ORDER_COPY,
  ORDER_LABELS,
  type OrderMailKind,
} from "./order-copy";
import { type EmailPayload, internalRow, internalShell } from "./templates";

const BACKGROUND = "#0d0d0d";
const GOLD = "#c8a96a";
const CHAMPAGNE = "#e6d6a8";
const IVORY = "#f7f4ec";
const MUTED = "#8f8f92";
const BORDER = "#2a2a2d";

const SERIF = "Georgia, 'Times New Roman', 'Cinzel', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

type Align = "left" | "right";

/** Which way the letter reads. Arabic mirrors, English does not. */
function alignFor(locale: Locale): Align {
  return LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";
}

/** The opposite edge — where a price sits in a two-column receipt row. */
function opposite(align: Align): Align {
  return align === "right" ? "left" : "right";
}

/**
 * The order number, framed.
 *
 * Centred and an LTR island regardless of locale: `KHEM-2026-1043` is a code,
 * not a sentence, and letting it reflow in RTL puts the year in the wrong
 * place. Same reasoning as `ltrIsland()` in `src/lib/i18n/rtl.ts` — and the
 * reason this block takes no alignment argument when every other one does.
 */
function orderNumberBlock(label: string, orderNumber: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${GOLD};background-color:${BACKGROUND};margin:0 0 26px 0;">
      <tr>
        <td align="center" style="padding:20px 24px;">
          <p style="margin:0 0 6px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};text-align:center;">${escapeHtml(label)}</p>
          <p dir="ltr" style="margin:0;font-family:${SERIF};font-size:20px;letter-spacing:0.14em;color:${GOLD};text-align:center;">${escapeHtml(orderNumber)}</p>
        </td>
      </tr>
    </table>`;
}

/** One receipt line: name and quantity on one edge, line total on the other. */
function itemRow(
  name: string,
  quantity: number,
  lineTotal: string,
  align: Align,
): string {
  return `
    <tr>
      <td style="padding:0 0 16px 0;text-align:${align};" valign="top">
        <p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.5;color:${IVORY};">${escapeHtml(name)}</p>
        <p style="margin:4px 0 0 0;font-family:${SANS};font-size:11px;letter-spacing:0.1em;color:${MUTED};">&times;&nbsp;${quantity}</p>
      </td>
      <td style="padding:0 0 16px 0;text-align:${opposite(align)};" valign="top" nowrap="nowrap">
        <p dir="ltr" style="margin:0;font-family:${SANS};font-size:14px;color:${IVORY};">${escapeHtml(lineTotal)}</p>
      </td>
    </tr>`;
}

/** A totals line. `emphasis` is the final Total, in gold at a larger size. */
function totalRow(
  label: string,
  value: string,
  align: Align,
  emphasis = false,
): string {
  const size = emphasis ? "18px" : "13px";
  const colour = emphasis ? GOLD : MUTED;
  const family = emphasis ? SERIF : SANS;

  return `
    <tr>
      <td style="padding:${emphasis ? "14px 0 0 0" : "0 0 10px 0"};text-align:${align};">
        <p style="margin:0;font-family:${SANS};font-size:${emphasis ? "12px" : "12px"};letter-spacing:${emphasis ? "0.16em" : "0.08em"};${emphasis ? "text-transform:uppercase;" : ""}color:${emphasis ? IVORY : MUTED};">${escapeHtml(label)}</p>
      </td>
      <td style="padding:${emphasis ? "14px 0 0 0" : "0 0 10px 0"};text-align:${opposite(align)};" nowrap="nowrap">
        <p dir="ltr" style="margin:0;font-family:${family};font-size:${size};color:${colour};">${escapeHtml(value)}</p>
      </td>
    </tr>`;
}

/**
 * The receipt.
 *
 * Prices are formatted with the **base currency** and no argument: an order
 * settles in Egyptian pounds, and the six display currencies in
 * `src/lib/currency.ts` are a browsing convenience that must never reach a
 * document recording what somebody was actually charged. `formatPrice`
 * defaults to `BASE_CURRENCY` precisely so this call site cannot get it wrong.
 */
function receiptTable(order: OrderMailRecord, locale: Locale): string {
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  const items = order.items
    .map((item) =>
      itemRow(
        item.productName,
        item.quantity,
        formatPrice(item.priceInCents * item.quantity),
        align,
      ),
    )
    .join("");

  const delivery =
    order.shipInCents === 0
      ? labels.complimentary
      : formatPrice(order.shipInCents);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};background-color:${BACKGROUND};margin:0 0 26px 0;">
      <tr>
        <td style="padding:24px 26px;">
          <p style="margin:0 0 18px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${GOLD};text-align:${align};">${escapeHtml(labels.items)}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};margin:8px 0 0 0;padding:0;">
            <tr><td colspan="2" style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>
            ${totalRow(labels.subtotal, formatPrice(order.subtotalInCents), align)}
            ${totalRow(labels.delivery, delivery, align)}
            ${totalRow(labels.total, formatPrice(order.totalInCents), align, true)}
          </table>
        </td>
      </tr>
    </table>`;
}

/** The delivery address, as typed, one line per field that is present. */
function addressBlock(order: OrderMailRecord, locale: Locale): string {
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  const lines = [
    order.customerName,
    order.shipLine1,
    order.shipLine2,
    [order.shipCity, order.shipState].filter(Boolean).join(", "),
    [order.shipPostalCode, order.shipCountry].filter(Boolean).join(" "),
    order.customerPhone,
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line && line.length > 0));

  if (lines.length === 0) return "";

  const body = lines
    .map(
      (line) =>
        `<p style="margin:0 0 4px 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${IVORY};">${escapeHtml(line)}</p>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};background-color:${BACKGROUND};margin:0 0 26px 0;">
      <tr>
        <td style="padding:22px 26px;text-align:${align};">
          <p style="margin:0 0 12px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${GOLD};">${escapeHtml(labels.deliverTo)}</p>
          ${body}
        </td>
      </tr>
    </table>`;
}

/**
 * Payment method, and — only where money is still owed — the amount to have
 * ready at the door.
 *
 * The condition is a fact about the **order**, not about the message. Keying it
 * on `kind` alone was not enough: a cash order marked delivered before it was
 * marked shipped still received a shipping notice telling the customer to "have
 * EGP 870 ready for the courier" — money they had already handed over at the
 * door. Read as a second demand for payment, which is exactly what it looks
 * like.
 *
 * So three things must all hold: the message is one where money could still be
 * owed, the order has not been paid, and the parcel has not arrived. Any letter
 * about a delivered or settled order prints the method and stops.
 *
 * The method line itself stays on every message that shows this block: "Cash on
 * delivery" is a fact about the order, and a receipt that omits how it was
 * settled is a worse receipt.
 */
function paymentBlock(
  order: OrderMailRecord,
  locale: Locale,
  kind: OrderMailKind,
): string {
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  const method = order.paymentMethod === "CARD" ? labels.card : labels.cash;

  const owing =
    (kind === "confirmation" || kind === "shipped") &&
    order.paymentStatus !== "PAID" &&
    order.status !== "DELIVERED";

  const instruction =
    order.paymentMethod === "CASH" && owing
      ? `<p style="margin:8px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.8;color:${CHAMPAGNE};">${escapeHtml(
          interpolate(labels.cashInstruction, {
            amount: formatPrice(order.totalInCents),
          }),
        )}</p>`
      : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
      <tr>
        <td style="text-align:${align};">
          <p style="margin:0 0 4px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${GOLD};">${escapeHtml(labels.paymentMethod)}</p>
          <p style="margin:0;font-family:${SANS};font-size:14px;color:${IVORY};">${escapeHtml(method)}</p>
          ${instruction}
        </td>
      </tr>
    </table>`;
}

/**
 * Where the button goes.
 *
 * Three destinations, and the choice between the first two is the whole reason
 * this is a function:
 *
 *  - **A signed-in customer** is sent to their own order history, in the
 *    language the order was placed in, with the order number as a fragment —
 *    `/ar/account/orders#KHEM-2026-1042`. `<OrderCard>` carries that `id`, so
 *    the browser scrolls the right order into view. A fragment never leaves the
 *    browser, so it selects nothing on the server and grants nothing; the list
 *    was already filtered on the session before it rendered.
 *  - **A guest** has no account for the order to appear in — checkout without a
 *    session stores no `clerkUserId` — so the portal would be a sign-in wall
 *    in front of an order that would not be there afterwards. They get the
 *    confirmation page instead, which is built to be safe to open by number.
 *  - **A closed order** gets the collections, because there is nothing left to
 *    track.
 *
 * `localizePath` rather than a bare path: the letter is written in
 * `order.locale`, and a link that switches the reader back to English at the
 * click is the same bug as an untranslated subject line.
 */
function orderHref(order: OrderMailRecord): string {
  if (order.clerkUserId) {
    return `${SITE_URL}${localizePath(order.locale, ACCOUNT_PATHS.orders)}#${
      order.orderNumber
    }`;
  }

  return `${SITE_URL}${localizePath(order.locale, "/checkout/confirmed")}?order=${encodeURIComponent(
    order.orderNumber,
  )}`;
}

function trackingHref(order: OrderMailRecord, kind: OrderMailKind): string {
  const open = kind === "confirmation" || kind === "shipped";

  if (!open) return `${SITE_URL}${localizePath(order.locale, "/collections")}`;

  return orderHref(order);
}

export interface CustomerOrderEmailInput {
  order: OrderMailRecord;
  kind: OrderMailKind;
  /** House social profiles, read by the sender and passed in. */
  socials: readonly SocialProfile[];
  /** `cid:khem-logo` when the sender attached the mark. See `./logo.ts`. */
  logoSrc?: string;
}

/**
 * The customer-facing order email, in all five of its moods.
 *
 * One function rather than five because the difference between "confirmed" and
 * "delivered" is entirely prose: same receipt, same address, same signature,
 * same shell. Five functions would be five places to fix a broken total.
 *
 * The language comes from `order.locale` — the column, written at checkout —
 * and not from the request, because four of the five are sent days later from
 * an English-only dashboard.
 */
export function customerOrderEmail({
  order,
  kind,
  socials,
  logoSrc,
}: CustomerOrderEmailInput): EmailPayload {
  const locale = order.locale;
  const copy = ORDER_COPY[locale][kind];
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  // First name only. "Thank you, Mohamed" reads like a person wrote it;
  // "Thank you, Mohamed Hassaan Ibrahim" reads like a database did.
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";

  const subject = interpolate(copy.subject, { orderNumber: order.orderNumber });
  const headline = interpolate(copy.headline, { name: firstName });

  // The tracking sentence only exists once there is a code to print, and only
  // on the message where it means something.
  const tracking =
    kind === "shipped" && order.trackingCode
      ? mutedParagraph(
          interpolate(labels.trackingCode, { code: order.trackingCode }),
          align,
        )
      : "";

  // Cancelled and refunded orders are not being delivered to anybody, so the
  // address panel would be noise at best and a false promise at worst.
  const isOpen = kind === "confirmation" || kind === "shipped" || kind === "delivered";

  const ctaHref = trackingHref(order, kind);

  const body = [
    paragraph(copy.intro, align),
    orderNumberBlock(labels.orderNumber, order.orderNumber),
    receiptTable(order, locale),
    isOpen ? paymentBlock(order, locale, kind) : "",
    isOpen ? addressBlock(order, locale) : "",
    mutedParagraph(copy.detail, align),
    tracking,
    spacer(8),
    ctaButton(copy.cta, ctaHref),
    spacer(30),
    signoff(copy.signoff, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    headline,
    body,
    socials,
    logoSrc,
  });

  return {
    subject,
    html,
    text: customerOrderText(order, kind, headline, ctaHref),
  };
}

/**
 * The plain-text alternative.
 *
 * Not optional. A message with no `text/plain` part scores worse with spam
 * filters and is unreadable in the clients that prefer text, and a receipt that
 * lands in a junk folder is a support ticket.
 */
function customerOrderText(
  order: OrderMailRecord,
  kind: OrderMailKind,
  headline: string,
  ctaHref: string,
): string {
  const locale = order.locale;
  const copy = ORDER_COPY[locale][kind];
  const labels = ORDER_LABELS[locale];

  const items = order.items
    .map(
      (item) =>
        `  ${item.productName} x${item.quantity}  ${formatPrice(item.priceInCents * item.quantity)}`,
    )
    .join("\n");

  const delivery =
    order.shipInCents === 0 ? labels.complimentary : formatPrice(order.shipInCents);

  return [
    headline,
    "",
    copy.intro,
    "",
    `${labels.orderNumber}: ${order.orderNumber}`,
    "",
    `${labels.items}:`,
    items,
    "",
    `${labels.subtotal}: ${formatPrice(order.subtotalInCents)}`,
    `${labels.delivery}: ${delivery}`,
    `${labels.total}: ${formatPrice(order.totalInCents)}`,
    "",
    copy.detail,
    order.trackingCode && kind === "shipped"
      ? interpolate(labels.trackingCode, { code: order.trackingCode })
      : "",
    "",
    `${copy.cta}: ${ctaHref}`,
    "",
    copy.signoff,
    "KHEM Perfumes — Essence of Heritage",
    SITE_URL,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * The picking slip.
 *
 * English only, deliberately: it has exactly one reader and they work here.
 * Wide where the customer's copy is careful — it carries the full address and
 * the phone number, because that is the entire reason somebody opens it.
 *
 * `Reply-To` is set to the customer by the sender, so answering a question
 * about an order is one click from this message.
 */
export function newOrderNotificationEmail(order: OrderMailRecord): EmailPayload {
  const paid = order.paymentStatus === "PAID";

  const items = order.items
    .map(
      (item) =>
        `${escapeHtml(item.productName)} &times; ${item.quantity} — ${escapeHtml(
          formatPrice(item.priceInCents * item.quantity),
        )}`,
    )
    .join("<br />");

  const address = [
    order.customerName,
    order.shipLine1,
    order.shipLine2,
    [order.shipCity, order.shipState].filter(Boolean).join(", "),
    [order.shipPostalCode, order.shipCountry].filter(Boolean).join(" "),
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line && line.length > 0))
    .map((line) => escapeHtml(line))
    .join("<br />");

  const rows = [
    internalRow("Order", escapeHtml(order.orderNumber)),
    internalRow(
      "Total",
      `${escapeHtml(formatPrice(order.totalInCents))} — ${
        order.paymentMethod === "CARD" ? "Card" : "Cash on delivery"
      }, ${paid ? "PAID" : order.paymentStatus}`,
    ),
    internalRow("Items", items),
    internalRow("Deliver to", address),
    internalRow(
      "Contact",
      `${escapeHtml(order.customerEmail ?? "—")}<br />${escapeHtml(order.customerPhone ?? "—")}`,
    ),
    order.note ? internalRow("Customer note", escapeHtml(order.note)) : "",
    internalRow("Language", order.locale === "ar" ? "Arabic" : "English"),
  ].join("");

  const html = internalShell(
    `New Order — ${order.orderNumber}`,
    rows,
  );

  const text = [
    `New order ${order.orderNumber}`,
    `${formatPrice(order.totalInCents)} — ${order.paymentMethod === "CARD" ? "Card" : "Cash on delivery"}, ${order.paymentStatus}`,
    "",
    ...order.items.map(
      (item) =>
        `${item.productName} x${item.quantity} — ${formatPrice(item.priceInCents * item.quantity)}`,
    ),
    "",
    "Deliver to:",
    order.customerName,
    order.shipLine1 ?? "",
    order.shipLine2 ?? "",
    [order.shipCity, order.shipState].filter(Boolean).join(", "),
    [order.shipPostalCode, order.shipCountry].filter(Boolean).join(" "),
    "",
    order.customerEmail ?? "",
    order.customerPhone ?? "",
    order.note ? `Note: ${order.note}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: `New order ${order.orderNumber} — ${formatPrice(order.totalInCents)}`,
    html,
    text,
  };
}


// ── The day-after letter ──────────────────────────────────────

/**
 * Where a customer goes to say what they thought of one purchase.
 *
 * `#comments` is the anchor on `<ProductComments>`, which carries a scroll
 * margin so the sticky header does not sit over the heading. `localizePath`
 * keeps the reader in the language the order was placed in — a link that
 * switches somebody back to English on click is the same bug as an
 * untranslated subject line.
 */
function commentHref(
  slug: string,
  collectionKind: CollectionKind,
  locale: Locale,
): string {
  const path = productHref({ slug, collectionKind });
  return `${SITE_URL}${localizePath(locale, path)}#comments`;
}

/**
 * The list of what they bought, each line an invitation.
 *
 * A line whose product no longer resolves to a page — archived, deleted, or a
 * set that never had one — is printed as plain text. That is deliberate: the
 * point of the letter is to reach the comment area, and a gold link that lands
 * on a 404 costs more trust than a name with no link costs interest.
 */
function feedbackItemRows(order: OrderFeedbackRecord, locale: Locale): string {
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  return order.items
    .map((item) => {
      const kind = order.linkable[item.productSlug];

      const action = kind
        ? `<p style="margin:6px 0 0 0;font-family:${SANS};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;"><a href="${commentHref(
            item.productSlug,
            kind,
            locale,
          )}" style="color:${GOLD};text-decoration:none;border-bottom:1px solid ${GOLD};">${escapeHtml(
            labels.leaveAComment,
          )}</a></p>`
        : "";

      return `
    <tr>
      <td style="padding:0 0 20px 0;text-align:${align};" valign="top">
        <p style="margin:0;font-family:${SERIF};font-size:16px;line-height:1.5;color:${IVORY};">${escapeHtml(item.productName)}</p>
        <p style="margin:4px 0 0 0;font-family:${SANS};font-size:11px;letter-spacing:0.1em;color:${MUTED};">&times;&nbsp;${item.quantity}</p>
        ${action}
      </td>
    </tr>`;
    })
    .join("");
}

/** The framed list, under its own gold caption. */
function feedbackItemTable(order: OrderFeedbackRecord, locale: Locale): string {
  const labels = ORDER_LABELS[locale];
  const align = alignFor(locale);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};background-color:${BACKGROUND};margin:0 0 26px 0;">
      <tr>
        <td style="padding:24px 26px;">
          <p style="margin:0 0 18px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${GOLD};text-align:${align};">${escapeHtml(labels.shareYourThoughts)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${feedbackItemRows(order, locale)}</table>
        </td>
      </tr>
    </table>`;
}

export interface CustomerFeedbackEmailInput {
  order: OrderFeedbackRecord;
  socials: readonly SocialProfile[];
  logoSrc?: string;
}

/**
 * The letter that arrives a day after the parcel did.
 *
 * Same shell, same signature, same mark as the five status letters — a reader
 * should not be able to tell that a different function built it. What it does
 * not carry is a receipt: the money is settled, the address is behind them, and
 * repeating either would make this look like a sixth notification instead of a
 * question.
 *
 * No prices anywhere, for the same reason. The subject of this letter is what
 * the fragrance is like, not what it cost.
 */
export function customerFeedbackEmail({
  order,
  socials,
  logoSrc,
}: CustomerFeedbackEmailInput): EmailPayload {
  const locale = order.locale;
  const copy = FEEDBACK_COPY[locale];
  const align = alignFor(locale);

  const firstName = order.customerName.trim().split(/\s+/)[0] ?? "";

  const subject = interpolate(copy.subject, { orderNumber: order.orderNumber });
  const headline = interpolate(copy.headline, { name: firstName });

  /*
   * The order itself, not the collections.
   *
   * A letter that arrives a day after the parcel is answering "where is my
   * order and what did I buy" as often as it is inviting a review, and the
   * customer has just been told to prepare cash for a courier who has already
   * been — so the one thing it must not do is send them shopping instead of to
   * their order.
   *
   * `orderHref` rather than `trackingHref`: the latter keys on the *message*,
   * and the messages it considers closed all get the collections. This letter
   * is about an order that very much still exists. Same two destinations the
   * open messages use — the portal for a customer with an account, the
   * confirmation page for a guest.
   */
  const ctaHref = orderHref(order);

  const body = [
    paragraph(copy.intro, align),
    feedbackItemTable(order, locale),
    mutedParagraph(copy.detail, align),
    spacer(8),
    ctaButton(copy.cta, ctaHref),
    spacer(30),
    signoff(copy.signoff, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    headline,
    body,
    socials,
    logoSrc,
  });

  const labels = ORDER_LABELS[locale];

  const lines = order.items.map((item) => {
    const kind = order.linkable[item.productSlug];
    return kind
      ? `  ${item.productName} — ${commentHref(item.productSlug, kind, locale)}`
      : `  ${item.productName}`;
  });

  const text = [
    headline,
    "",
    copy.intro,
    "",
    `${labels.shareYourThoughts}:`,
    ...lines,
    "",
    copy.detail,
    "",
    `${copy.cta}: ${ctaHref}`,
    "",
    copy.signoff,
    "KHEM Perfumes — Essence of Heritage",
    SITE_URL,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
