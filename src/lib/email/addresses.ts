/**
 * Who mail comes from, and where it lands.
 *
 * Both are env-overridable so a mail-host change is a dashboard edit, not a
 * deploy. The fallbacks are the real production values, which keeps a fresh
 * clone working without extra setup.
 */

import { HOUSE_EMAIL } from "@/src/constants/contact";
import { getConciergeEmail } from "@/src/services/contact";

/**
 * Envelope sender.
 *
 * `noreply@` rather than `info@` sending to itself: self-addressed mail scores
 * worse with spam filters, and the convenience people actually want — hitting
 * reply and reaching the visitor — comes from `Reply-To`, not from `From`.
 *
 * Requires khemperfumes.com to stay verified in Resend. If verification lapses
 * the send fails loudly with a delivery error, which is the correct outcome.
 */
const DEFAULT_FROM = "KHEM Website <noreply@khemperfumes.com>";

export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

/**
 * Sender for mail a customer receives.
 *
 * `noreply@` is right for the internal notification — nobody answers it — and
 * wrong here. An acknowledgement that invites a reply must come from an address
 * that reads mail, or the invitation is a lie the first time someone accepts it.
 *
 * Anchored to `HOUSE_EMAIL`, **not** to `inboxAddress()`. They are usually the
 * same address, but `CONTACT_INBOX_EMAIL` may point somewhere off-domain (a
 * Gmail account, while a spam filter is being sorted out) — and Resend can only
 * send as a domain it has verified. Deriving the sender from the recipient
 * would turn that redirect into a hard delivery failure.
 */
export function houseFromAddress(): string {
  return process.env.RESEND_HOUSE_FROM_EMAIL ?? `KHEM <${HOUSE_EMAIL}>`;
}

/**
 * The house mailbox.
 *
 * Falls through to `getConciergeEmail()`, which reads `"BoutiqueSetting"` — the
 * same row the contact page publishes to visitors. An enquiry form that mails
 * somewhere other than the address on the page is the bug that arrangement
 * exists to prevent.
 */
export async function inboxAddress(): Promise<string> {
  return process.env.CONTACT_INBOX_EMAIL ?? (await getConciergeEmail());
}

/**
 * Where a new-order notification lands.
 *
 * Deliberately **not** {@link inboxAddress}. The two answer different
 * questions, and collapsing them would be wrong in both directions:
 *
 *  - `inboxAddress()` is the address published to visitors on the contact page.
 *    An enquiry has to arrive there, or the site is advertising a mailbox
 *    nobody reads.
 *  - This is the *operational* mailbox — the one somebody opens to pick, wrap
 *    and dispatch a parcel. It is fulfilment, not correspondence, and it is
 *    routinely a different person or a different account entirely.
 *
 * Defaults to `orders@khemperfumes.com`, the house operations mailbox.
 * `ORDER_NOTIFICATION_EMAIL` overrides it, which makes redirecting fulfilment
 * mail a dashboard edit rather than a deploy.
 *
 * It was `khem.official@outlook.com` — the Outlook account directly — until the
 * house moved fulfilment onto its own domain. On-domain is the better default
 * for the reason the whole deliverability pass exists: a recipient on a mailbox
 * we control can be whitelisted, filtered and forwarded by us, and an address
 * on the sending domain is one fewer hop for a spam filter to be suspicious of.
 *
 * A hardcoded default rather than a database read, unlike `inboxAddress()`:
 * this address is never published to anybody, so there is no page for it to
 * agree with — and the one thing that must never happen is a new order going
 * unannounced because a settings row was missing.
 *
 * Synchronous in everything but signature. It stays `async` so that switching
 * it to a `"BoutiqueSetting"` row later is a change of body, not of every
 * caller.
 */
const DEFAULT_ORDER_INBOX = "orders@khemperfumes.com";

export async function orderInboxAddress(): Promise<string> {
  return process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_INBOX;
}

/**
 * Sender for the new-order notification.
 *
 * Its own identity rather than {@link fromAddress}, for one reason: the house
 * mailbox is Outlook behind the domain, and Outlook's junk verdict is learned
 * per *sender*, not per domain. A dedicated address is one thing a person adds
 * to Safe Senders once and never thinks about again — and it cannot be dragged
 * back into Junk by whatever else `noreply@` sends.
 *
 * `notifications@` and **not** `orders@`, deliberately: `orders@` is where the
 * notification *lands* now that `ORDER_NOTIFICATION_EMAIL` points there, and a
 * mailbox that sends to itself is the exact arrangement {@link fromAddress}
 * warns about — worse spam scoring, and a threading mess in the one inbox that
 * has to stay readable. {@link sameMailbox} enforces the separation at send
 * time, in case an env var ever collapses the two again.
 *
 * On the same verified domain as everything else, so nothing new has to be
 * proven to Resend. `RESEND_ORDER_FROM_EMAIL` overrides it.
 */
const DEFAULT_ORDER_FROM = "KHEM Orders <notifications@khemperfumes.com>";

export function orderFromAddress(): string {
  return process.env.RESEND_ORDER_FROM_EMAIL ?? DEFAULT_ORDER_FROM;
}

/**
 * The bare address inside a `Name <local@domain>` header, lowercased.
 *
 * Both forms are legal in every env var here, so a comparison that did not
 * unwrap the display name would call `"KHEM Orders <orders@…>"` and
 * `"orders@…"` different mailboxes when they are the same one.
 */
function mailboxOf(address: string): string {
  const angled = address.match(/<([^>]+)>/);
  return (angled ? angled[1] : address).trim().toLowerCase();
}

/**
 * True when two headers name the same mailbox.
 *
 * Used once, by `notifyHouseOfOrder`, to keep a notification from being
 * addressed from and to the same account after somebody edits an env var. It is
 * a guard rather than a rule, because the two values are configuration and the
 * failure it prevents is silent: mail that sends, arrives, and quietly scores
 * worse every time.
 */
export function sameMailbox(a: string, b: string): boolean {
  return mailboxOf(a) === mailboxOf(b);
}
