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
 * That address is `HOUSE_EMAIL` — `info@khemperfumes.com`, the address printed
 * on the contact page and in the signature of every letter. A house of this
 * kind writes to its customers from the address it publishes; a machine name in
 * the From line is the one detail that makes a confirmation feel issued rather
 * than sent.
 *
 * Anchored to the constant, **not** to `inboxAddress()`. They are usually the
 * same address, but `CONTACT_INBOX_EMAIL` may point somewhere off-domain (a
 * Gmail account, while a spam filter is being sorted out) — and Resend can only
 * send as a domain it has verified. Deriving the sender from the recipient
 * would turn that redirect into a hard delivery failure.
 */
const DEFAULT_HOUSE_FROM = `KHEM <${HOUSE_EMAIL}>`;

export function houseFromAddress(): string {
  return process.env.RESEND_HOUSE_FROM_EMAIL ?? DEFAULT_HOUSE_FROM;
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
 * Defaults to `orders@khemperfumes.com`, the mailbox the team opens to pick and
 * pack. `ORDER_NOTIFICATION_EMAIL` overrides it, which makes redirecting
 * fulfilment mail a dashboard edit rather than a deploy. It was
 * `khem.official@outlook.com` — the Outlook account directly — until the house
 * moved fulfilment onto its own domain.
 *
 * Note which direction this is. `info@` is what the house **sends** as; this is
 * what the team **receives** at. They must stay different addresses: a
 * notification sent from `orders@` to `orders@` is a mailbox writing to itself,
 * which scores worse with exactly the junk filter this arrangement exists to
 * satisfy. {@link sameMailbox} enforces that at send time.
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
 * `info@` — the house's own address, the same one {@link houseFromAddress}
 * writes to customers from, rather than a machine address invented for this one
 * message. Two reasons, and neither is aesthetic:
 *
 *  - **Reputation is per sender.** `info@` is an established mailbox that
 *    people already correspond with; a brand-new local part starts with none,
 *    and a cold sender writing to a mailbox on its own domain is precisely the
 *    shape a junk filter is unsure about.
 *  - **One address to whitelist.** The `orders@` mailbox marks `info@` as safe
 *    once and every order mail there is — the picking slip and, if it is ever
 *    CC'd, anything else — is covered.
 *
 * Deliberately not `orders@`: that is the *destination*, and a sender must
 * never be its own recipient. {@link sameMailbox} checks that at send time in
 * case an env var ever collapses the two.
 *
 * `RESEND_ORDER_FROM_EMAIL` overrides it — point it at a machine address if the
 * house ever wants order notifications to look distinct in the inbox.
 */
const DEFAULT_ORDER_FROM = `KHEM Orders <${HOUSE_EMAIL}>`;

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
