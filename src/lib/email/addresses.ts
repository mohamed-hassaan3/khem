/**
 * Who mail comes from, and where it lands.
 *
 * Both are env-overridable so a mail-host change is a dashboard edit, not a
 * deploy. The fallbacks are the real production values, which keeps a fresh
 * clone working without extra setup.
 */

import { HOUSE_EMAIL } from "@/src/data/contact";
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
 * Falls through to `getConciergeEmail()` so `src/data/contact.ts` stays the one
 * place the address is written — the same constant the contact page publishes
 * to visitors. An enquiry form that mails somewhere other than the address on
 * the page is the bug that file's header comment exists to prevent.
 */
export async function inboxAddress(): Promise<string> {
  return process.env.CONTACT_INBOX_EMAIL ?? (await getConciergeEmail());
}
