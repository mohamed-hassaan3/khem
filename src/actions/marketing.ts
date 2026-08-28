"use server";

/**
 * Subscribing through the offer popup.
 *
 * ## Why this is not `subscribeToNewsletter()`
 *
 * It does the same first thing — put an address on the Inner Circle list — and
 * then one more: it claims the **welcome entitlement** for that address, because
 * the popup promised one. Folding that into the footer form's action would mean
 * every home-page signup silently issued a voucher, which is a different
 * business decision that nobody made.
 *
 * The two share the schema, the honeypot, the rate limiter and the letter. They
 * differ in what the house promised.
 *
 * ## Nothing about the discount is decided here
 *
 * This file never sees a percentage. `claim_subscriber_offer()` finds the live
 * welcome campaign, writes a grant addressed to this email, and returns the code
 * — inside one transaction, so there is no arrangement of failures that produces
 * a letter naming an entitlement the database does not hold. The same guarantee
 * `claim_welcome()` gives an account, and the same table behind it.
 *
 * ## Privacy
 *
 * The address is never logged, by this file or by anything it calls. Same rule
 * as `contact.ts` and `newsletter.ts`.
 */

import { houseFromAddress, inboxAddress } from "@/src/lib/email/addresses";
import { getEmailClient } from "@/src/lib/email/client";
import { AUTO_REPLY_HEADERS } from "@/src/lib/email/headers";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { newsletterWelcomeEmail } from "@/src/lib/email/templates";
import { DEFAULT_LOCALE, isLocale } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { newsletterSchema } from "@/src/schemas/newsletter";
import { getSocialProfiles } from "@/src/services/contact";
import { claimSubscriberOffer } from "@/src/services/marketing";
import { subscribe } from "@/src/services/newsletter";
import type { SubscribeOfferResult } from "@/src/types/marketing";

/**
 * Three per ten minutes, tighter than the footer form's five.
 *
 * The popup is the one signup surface a visitor did not go looking for, which
 * makes it the one most worth throttling: a script that finds it can otherwise
 * mint a grant per address it feels like typing. The per-address unique index on
 * `discount_grants` is what actually bounds the damage — this bounds the noise.
 */
const LIMIT = { limit: 3, windowMs: 10 * 60 * 1_000 };

export interface OfferSubscribeInput {
  email: string;
  /** Honeypot. Any content means a bot, and the answer is a silent success. */
  company: string;
  locale: string;
}

export async function subscribeForOffer(
  input: OfferSubscribeInput,
): Promise<SubscribeOfferResult> {
  /*
   * Honeypot → silent success, nothing written and nothing granted. Telling a
   * bot it was detected is telling whoever wrote it how to try again.
   */
  if (input.company.length > 0) {
    return { ok: true, code: null, alreadySubscribed: false };
  }

  if (isRateLimited("offer", await clientKey(), LIMIT)) {
    return { ok: false, error: "rateLimited" };
  }

  const parsed = newsletterSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;

  /*
   * The list first, exactly as `newsletter.ts` argues: a signup that reached a
   * mailbox but not the database is one nobody can honour, unsubscribe, or
   * prove consent for.
   */
  const outcome = await subscribe({
    email: parsed.data.email,
    locale,
    source: "POPUP",
  });

  if (!outcome) {
    return { ok: false, error: "delivery" };
  }

  const alreadySubscribed = !outcome.isNew && !outcome.reactivated;

  /*
   * The entitlement.
   *
   * Claimed even for somebody who was already on the list: they may have
   * subscribed before the campaign started, or through a form that promised
   * nothing, and refusing them the offer the popup just made would be the house
   * going back on its word. `claim_subscriber_offer()` is idempotent — a second
   * attempt issues nothing and returns the grant that already exists — so this
   * cannot mint a second voucher for one address.
   */
  const offer = await claimSubscriberOffer(parsed.data.email);
  const code = offer?.code ?? null;

  const resend = getEmailClient();

  if (!resend) {
    // The subscription and the grant both stand; only the letter failed, which
    // is a configuration problem for the house rather than a lost signup. The
    // code is still returned, and the panel prints it.
    console.warn("[offer] RESEND_API_KEY is not set; no letter delivered.");
    return { ok: true, code, alreadySubscribed };
  }

  const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(outcome.token)}`;

  try {
    const payload = newsletterWelcomeEmail(
      locale,
      await getSocialProfiles(),
      unsubscribeUrl,
      code ? { code, expiresAt: offer?.expiresAt ?? null } : null,
    );

    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      to: parsed.data.email,
      replyTo: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: AUTO_REPLY_HEADERS,
    });

    if (error) {
      // Logged, not returned. The row and the grant are written; a red form for
      // a signup that succeeded would be a lie about the only part that matters,
      // and the panel shows the code on screen anyway.
      console.error("[offer] Resend rejected the welcome:", error.message);
    }
  } catch (cause) {
    console.error(
      "[offer] Welcome delivery threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }

  return { ok: true, code, alreadySubscribed };
}
