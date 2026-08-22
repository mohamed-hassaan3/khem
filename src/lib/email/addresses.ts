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
 * Defaults to `khem.official@outlook.com`, the house operations account.
 * `ORDER_NOTIFICATION_EMAIL` overrides it, which makes redirecting fulfilment
 * mail a dashboard edit rather than a deploy.
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
const DEFAULT_ORDER_INBOX = "khem.official@outlook.com";

export async function orderInboxAddress(): Promise<string> {
  return process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_INBOX;
}
