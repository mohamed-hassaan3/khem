import "server-only";

/**
 * Delivery for the two account letters.
 *
 * ## Why these report failure, when the order mail does not
 *
 * `send-order-mail.ts` swallows everything and returns `void`, and its header
 * explains why: a sale is already secured by the time it runs, and letting a
 * Resend outage propagate would turn a completed purchase into an error screen.
 *
 * These are the other case. Nothing is secured yet — the welcome's *claim* has
 * been taken and the invitation's Clerk record has been created — and both
 * callers have something specific to undo if the letter does not go: the webhook
 * releases the claim so a retry can send it, and the invite action revokes the
 * invitation so a dead row does not block re-inviting that address. Neither can
 * do that without being told, so these return a boolean.
 *
 * They still never throw. The caller decides what a failure means; it is not
 * this module's business to end a request.
 *
 * ## Privacy
 *
 * The logs carry a reason and, at most, a provider message. **Never** the
 * address, the name, or the voucher code. Same rule as every other sender here,
 * and the reason `0024` grants the public roles nothing on `"User"`.
 */

import type { Locale } from "@/src/lib/i18n/config";
import { getSocialProfiles } from "@/src/services/contact";

import { houseFromAddress, inboxAddress } from "./addresses";
import { getEmailClient } from "./client";
import { AUTO_REPLY_HEADERS } from "./headers";
import { logoAttachment, logoSrc } from "./logo";
import type { EmailPayload } from "./templates";
import { accountWelcomeEmail, invitationEmail } from "./welcome-templates";

function logFailure(context: string, cause: unknown): void {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "unknown error";

  console.error(`[account-mail] ${context}: ${message}`);
}

/**
 * One send, with the house's envelope.
 *
 * `replyTo` is the house mailbox rather than the no-reply sender: both letters
 * invite a person into the house, and a reply to either should reach somebody
 * who can answer it.
 */
async function deliver(
  context: string,
  to: string,
  payload: EmailPayload,
  attachment: Awaited<ReturnType<typeof logoAttachment>>,
): Promise<boolean> {
  const resend = getEmailClient();
  if (!resend) {
    logFailure(context, "RESEND_API_KEY is not configured");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      to,
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
              // Inline, not a paperclip: the signature's
              // `<img src="cid:khem-logo">` resolves against this.
              contentId: attachment.contentId,
            },
          ]
        : undefined,
    });

    if (error) {
      logFailure(context, error.message);
      return false;
    }

    return true;
  } catch (cause) {
    logFailure(context, cause);
    return false;
  }
}

export interface WelcomeMailInput {
  to: string;
  locale: Locale;
  firstName: string | null;
  code: string | null;
  expiresAt: string | null;
}

/**
 * The welcome letter.
 *
 * Sent to somebody who has just created an account, about that account — a
 * transactional message under §9.1, and therefore sent whatever their marketing
 * preference says. The Inner Circle list is reconciled separately in the same
 * webhook and governs only marketing.
 *
 * @returns whether Resend accepted it. `false` means the caller should release
 *   the welcome claim so a later delivery can take it.
 */
export async function sendWelcomeMail(
  input: WelcomeMailInput,
): Promise<boolean> {
  // The signature's links and mark: read here, so composing stays synchronous.
  const [socials, attachment] = await Promise.all([
    getSocialProfiles(),
    logoAttachment(),
  ]);

  const payload = accountWelcomeEmail({
    locale: input.locale,
    firstName: input.firstName,
    code: input.code,
    expiresAt: input.expiresAt,
    socials,
    logoSrc: logoSrc(attachment),
  });

  return deliver("welcome", input.to, payload, attachment);
}

export interface InvitationMailInput {
  to: string;
  locale: Locale;
  /** Clerk's own invitation URL, carrying the ticket. */
  url: string;
  expiresInDays: number;
}

/**
 * The invitation letter, in place of Clerk's.
 *
 * @returns whether Resend accepted it. `false` means the caller should revoke
 *   the Clerk invitation — an invitation nobody was told about is a row that
 *   blocks re-inviting that address and reaches no one.
 */
export async function sendInvitationMail(
  input: InvitationMailInput,
): Promise<boolean> {
  const [socials, attachment] = await Promise.all([
    getSocialProfiles(),
    logoAttachment(),
  ]);

  const payload = invitationEmail({
    locale: input.locale,
    url: input.url,
    expiresInDays: input.expiresInDays,
    socials,
    logoSrc: logoSrc(attachment),
  });

  return deliver("invitation", input.to, payload, attachment);
}
