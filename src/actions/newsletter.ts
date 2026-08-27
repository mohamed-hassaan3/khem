"use server";

/**
 * Inner Circle signup.
 *
 * **Now a real subscription.** Until `supabase/sql/0025_newsletter.sql` this
 * file emailed the house inbox and stored nothing, and its header said so: a
 * signup was a message somebody had to act on by hand. The list is now the
 * record, which changes three things here.
 *
 * ## The row is written before anything is sent
 *
 * If the write fails, the person is told the signup failed. Reporting success
 * for an address that reached nothing but an inbox is exactly the state this
 * phase exists to end — and the welcome letter promises a list they would not
 * be on.
 *
 * ## The welcome is sent once
 *
 * `subscribe_newsletter()` reports whether the address was new, or had lapsed
 * and come back. Either earns the letter; neither means they were already
 * subscribed, and writing again would be the house mailing somebody for filling
 * in a form twice.
 *
 * ## The letter carries a working unsubscribe link
 *
 * The row's own random token, never the row id. See the header of
 * `0025_newsletter.sql` for why it is random rather than an HMAC.
 *
 * Same privacy rule as `contact.ts`, and now load-bearing rather than a
 * courtesy: the address is never logged, by this file or by anything it calls.
 */

import {
  fromAddress,
  houseFromAddress,
  inboxAddress,
} from "@/src/lib/email/addresses";
import { getEmailClient } from "@/src/lib/email/client";
import { AUTO_REPLY_HEADERS } from "@/src/lib/email/headers";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import {
  newsletterEmail,
  newsletterWelcomeEmail,
} from "@/src/lib/email/templates";
import { DEFAULT_LOCALE, isLocale } from "@/src/lib/i18n/config";
import { DEFAULT_LOCALE as FALLBACK_LOCALE } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { newsletterSchema } from "@/src/schemas/newsletter";
import { getSocialProfiles } from "@/src/services/contact";
import { subscribe } from "@/src/services/newsletter";
import type { FormActionResult } from "@/src/types/contact";

/** Five per ten minutes — a signup costs less attention than an enquiry. */
const LIMIT = { limit: 5, windowMs: 10 * 60 * 1_000 };

export interface NewsletterFormInput {
  email: string;
  company: string;
  /** Active site locale, so the welcome is written in their language. */
  locale: string;
}

/** Best-effort welcome to the new subscriber. Failures never propagate. */
async function sendWelcome(
  resend: NonNullable<ReturnType<typeof getEmailClient>>,
  email: string,
  rawLocale: string,
  unsubscribeUrl: string,
): Promise<void> {
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  // The signature's links live in `"SocialProfile"`; composing the body is
  // synchronous, so the read happens here and the list is handed down.
  const payload = newsletterWelcomeEmail(
    locale,
    await getSocialProfiles(),
    unsubscribeUrl,
  );

  try {
    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      to: email,
      // The unsubscribe line tells them to reply to this message, so the reply
      // has to land somewhere a human reads.
      replyTo: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: AUTO_REPLY_HEADERS,
    });

    if (error) {
      console.error("[newsletter] Welcome not sent:", error.message);
    }
  } catch (cause) {
    console.error(
      "[newsletter] Welcome threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }
}

export async function subscribeToNewsletter(
  input: NewsletterFormInput,
): Promise<FormActionResult> {
  // Honeypot → silent success, no send. See `contact.ts` for the ordering.
  if (input.company.length > 0) {
    return { ok: true };
  }

  if (isRateLimited("newsletter", await clientKey(), LIMIT)) {
    return { ok: false, error: "rateLimited" };
  }

  const parsed = newsletterSchema.safeParse(input);

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "invalidEmail";
    return { ok: false, error: "validation", fieldErrors: { email: code } };
  }

  /*
   * The list first.
   *
   * Before the inbox notification and before the welcome, because this is the
   * only one of the three that is a *record*. A signup that reached a mailbox
   * but not the database is a signup nobody can honour, unsubscribe, or prove
   * consent for — and the person would have been told it worked.
   */
  const locale = isLocale(input.locale) ? input.locale : FALLBACK_LOCALE;

  const outcome = await subscribe({
    email: parsed.data.email,
    locale,
    source: "HOME_FORM",
  });

  if (!outcome) {
    // `subscribe()` has already logged the provider's message, without the
    // address in it.
    return { ok: false, error: "delivery" };
  }

  const resend = getEmailClient();
  if (!resend) {
    // The subscription stands — it is in the database and the dashboard shows
    // it. Only the letters failed, which is a configuration problem for the
    // house rather than a lost signup.
    console.warn("[newsletter] RESEND_API_KEY is not set; letters not delivered.");
    return { ok: true };
  }

  const payload = newsletterEmail(parsed.data.email);
  const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(outcome.token)}`;

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      // Logged, not returned: the subscription is already recorded and the
      // house can see it in the dashboard. A red form for a signup that
      // succeeded would be a lie about the only thing that matters.
      console.error("[newsletter] Resend rejected the notification:", error.message);
    }

    // Courtesy, after the notification is secured. See `contact.ts` for why
    // the ordering is not an accident.
    //
    // Only for somebody who has just joined or just come back. An address that
    // was already subscribed gets nothing — re-submitting the form is not a
    // reason to be welcomed again.
    if (outcome.isNew || outcome.reactivated) {
      await sendWelcome(resend, parsed.data.email, input.locale, unsubscribeUrl);
    }

    return { ok: true };
  } catch (cause) {
    console.error(
      "[newsletter] Signup delivery threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    // The row is written, so this is not reported as a failed signup: the
    // person *is* on the list, and telling them otherwise would invite a second
    // attempt that changes nothing.
    return { ok: true };
  }
}
