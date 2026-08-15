"use server";

/**
 * Contact enquiry delivery.
 *
 * Closes the TODO that stood in `ContactForm.tsx`: until this existed the form
 * validated, showed "we will respond within 24 hours", and discarded the
 * message. The promise is now backed by a message that actually arrives.
 *
 * Nothing is persisted — no Prisma model, no Supabase row. The inbox is the
 * store. If enquiry history is wanted later it becomes an `Enquiry` table and
 * this action gains a write; the delivery path does not change.
 *
 * Privacy: this action never logs the message body, the sender's name, or their
 * address. On a contact form a debug `console.log` is a privacy incident, so
 * failure logs carry the provider error and nothing else.
 */

import {
  fromAddress,
  houseFromAddress,
  inboxAddress,
} from "@/src/lib/email/addresses";
import { getEmailClient } from "@/src/lib/email/client";
import { stripHeaderBreaks } from "@/src/lib/email/escape";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { AUTO_REPLY_HEADERS } from "@/src/lib/email/headers";
import {
  enquiryAcknowledgementEmail,
  enquiryEmail,
} from "@/src/lib/email/templates";
import { DEFAULT_LOCALE, isLocale } from "@/src/lib/i18n/config";
import { contactEnquirySchema } from "@/src/schemas/contact";
import type { FormActionResult } from "@/src/types/contact";

/**
 * Three enquiries per ten minutes per client.
 *
 * Far below the search endpoint's allowance because the cost being controlled
 * is different: not a billed API call, but the attention of the person who
 * opens the mailbox.
 */
const LIMIT = { limit: 3, windowMs: 10 * 60 * 1_000 };

/** Untrusted shape as it crosses the boundary. Zod decides what it really is. */
export interface ContactFormInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  company: string;
  /** Active site locale, so the acknowledgement is written in their language. */
  locale: string;
}

/**
 * Best-effort acknowledgement to the visitor.
 *
 * Swallows every failure by design — the caller has already secured the
 * enquiry, and nothing that happens here may change what the visitor sees.
 */
async function sendAcknowledgement(
  resend: NonNullable<ReturnType<typeof getEmailClient>>,
  data: { name: string; email: string; subject: string; message: string },
  rawLocale: string,
): Promise<void> {
  // Locale arrives from the client and is therefore untrusted: validated, not
  // used to index a record directly.
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const payload = enquiryAcknowledgementEmail(data, locale);

  try {
    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      // `parsed.data.email`, never the raw input — an address that failed
      // validation must not receive mail.
      to: data.email,
      replyTo: await inboxAddress(),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: AUTO_REPLY_HEADERS,
    });

    if (error) {
      console.error("[contact] Acknowledgement not sent:", error.message);
    }
  } catch (cause) {
    console.error(
      "[contact] Acknowledgement threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
  }
}

export async function sendContactEnquiry(
  input: ContactFormInput,
): Promise<FormActionResult> {
  /*
   * Order is deliberate: cheapest and most traffic-shedding first, so nothing
   * metered runs before the throttle.
   *
   * 1. Honeypot — a bot walked the DOM. Report success and send nothing;
   *    telling a scraper it was detected only teaches it to adapt.
   */
  if (input.company.length > 0) {
    return { ok: true };
  }

  // 2. Throttle, before any parsing or provider call.
  if (isRateLimited("contact", await clientKey(), LIMIT)) {
    return { ok: false, error: "rateLimited" };
  }

  // 3. Authoritative validation. The client checked the same fields; that was
  //    an affordance, this is the boundary.
  const parsed = contactEnquirySchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, error: "validation", fieldErrors };
  }

  // 4. Fail closed when unconfigured. A missing key must never fall through to
  //    a success panel — that silent drop is what this whole change removes.
  const resend = getEmailClient();
  if (!resend) {
    console.warn("[contact] RESEND_API_KEY is not set; enquiry not delivered.");
    return { ok: false, error: "delivery" };
  }

  const { name, email, subject, message } = parsed.data;
  const payload = enquiryEmail({ name, email, subject, message });

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: await inboxAddress(),
      // The visitor's address is validated before it reaches a header, and
      // carried in Reply-To only — never in From, which would be a spoof.
      replyTo: stripHeaderBreaks(email),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    /*
     * Resend returns `{ data, error }` rather than throwing. Not checking this
     * is the classic silent-drop bug: the await resolves, the form congratulates
     * the visitor, and no mail was ever queued.
     */
    if (error) {
      console.error("[contact] Resend rejected the enquiry:", error.message);
      return { ok: false, error: "delivery" };
    }

    /*
     * The enquiry is safe. Everything below is a courtesy, and is ordered this
     * way on purpose: the acknowledgement goes to an address the *visitor*
     * typed, so it is the one likely to hard-bounce. Sending it first — or
     * letting its failure propagate — would mean a typo in someone's own email
     * discards an enquiry KHEM could have answered by replying to the copy it
     * already holds.
     */
    await sendAcknowledgement(resend, parsed.data, input.locale);

    return { ok: true };
  } catch (cause) {
    console.error(
      "[contact] Enquiry delivery threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return { ok: false, error: "delivery" };
  }
}
