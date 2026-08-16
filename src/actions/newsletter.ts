"use server";

/**
 * Inner Circle signup delivery.
 *
 * Deliberately *not* a list subscription: no Resend Audience, no double opt-in,
 * no persistence. The address arrives in the house inbox and a human adds it.
 *
 * This matters because the success copy says "you will receive a confirmation
 * shortly" — that confirmation is a human action today. Real list management is
 * a larger piece of work and a consent question (see `src/lib/consent.ts`), not
 * something to smuggle in behind a form wiring.
 *
 * Same privacy rule as `contact.ts`: the address is never logged.
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
import { newsletterSchema } from "@/src/schemas/newsletter";
import { getSocialProfiles } from "@/src/services/contact";
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
): Promise<void> {
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  // The signature's links live in `"SocialProfile"`; composing the body is
  // synchronous, so the read happens here and the list is handed down.
  const payload = newsletterWelcomeEmail(locale, await getSocialProfiles());

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

  const resend = getEmailClient();
  if (!resend) {
    console.warn("[newsletter] RESEND_API_KEY is not set; signup not delivered.");
    return { ok: false, error: "delivery" };
  }

  const payload = newsletterEmail(parsed.data.email);

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      console.error("[newsletter] Resend rejected the signup:", error.message);
      return { ok: false, error: "delivery" };
    }

    // Courtesy, after the notification is secured. See `contact.ts` for why
    // the ordering is not an accident.
    await sendWelcome(resend, parsed.data.email, input.locale);

    return { ok: true };
  } catch (cause) {
    console.error(
      "[newsletter] Signup delivery threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return { ok: false, error: "delivery" };
  }
}
