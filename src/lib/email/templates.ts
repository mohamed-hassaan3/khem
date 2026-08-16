/**
 * Notification emails sent to the house mailbox.
 *
 * Deliberately hand-built HTML rather than React Email (AGENTS.md §6): these
 * two templates are read only by the KHEM team, and pulling in a renderer for
 * an internal notification is weight without payoff. When a customer-facing
 * email lands — order confirmation, shipping update — React Email is the right
 * call for *those*, and nothing here is in its way.
 *
 * Mail-client constraints, which is why this looks like 2005 markup:
 *   - table layout, inline styles only (Gmail strips <style> blocks)
 *   - no custom fonts; Cinzel does not load in an inbox, so the serif stack
 *     degrades to Georgia and keeps the register
 *   - a `text` alternative always accompanies the HTML, for deliverability
 *
 * Every interpolated value passes through `escape.ts` first. No exceptions.
 */

import { LOCALE_DIRECTION, type Locale } from "@/src/lib/i18n/config";
import type { SocialProfile } from "@/src/types/contact";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";

import { ACKNOWLEDGEMENT_COPY, WELCOME_COPY } from "./copy";
import { escapeHtml, escapeMultiline, stripHeaderBreaks } from "./escape";
import {
  ctaButton,
  luxuryShell,
  markedList,
  mutedParagraph,
  paragraph,
  quoteBlock,
  signoff,
  spacer,
} from "./layout";

export interface EmailPayload {
  subject: string;
  html: string;
  text: string;
}

const BACKGROUND = "#0d0d0d";
const SURFACE = "#1a1a1a";
const GOLD = "#c8a96a";
const IVORY = "#f7f4ec";
const MUTED = "#8a8a8a";
const BORDER = "rgba(255,255,255,0.08)";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** One label/value pair. `value` must already be escaped. */
function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 20px 0;">
        <p style="margin:0 0 6px 0;font-family:${SANS};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
        <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.7;color:${IVORY};">${value}</p>
      </td>
    </tr>`;
}

/** Shared dark shell: gold rule, wordmark, content slot, footer note. */
function shell(heading: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${BACKGROUND};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BACKGROUND};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${SURFACE};border:1px solid ${BORDER};">
            <tr>
              <td style="padding:40px 40px 0 40px;" align="center">
                <p style="margin:0;font-family:${SERIF};font-size:24px;letter-spacing:0.35em;color:${GOLD};">KHEM</p>
                <div style="height:1px;background-color:${GOLD};opacity:0.35;margin:24px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <p style="margin:0;font-family:${SERIF};font-size:16px;letter-spacing:0.12em;text-transform:uppercase;color:${IVORY};">${escapeHtml(heading)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 40px 40px;">
                <div style="height:1px;background-color:${BORDER};margin:0 0 20px 0;"></div>
                <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.8;color:${MUTED};">Sent automatically from khemperfumes.com. Reply directly to reach the sender.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface EnquiryInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Contact-page enquiry. `replyTo` is set by the action, never by this file. */
export function enquiryEmail(input: EnquiryInput): EmailPayload {
  const heading = "New Enquiry";

  const html = shell(
    heading,
    [
      row("From", escapeHtml(input.name)),
      row("Email", escapeHtml(input.email)),
      row("Subject", escapeHtml(input.subject)),
      row("Message", escapeMultiline(input.message)),
    ].join(""),
  );

  const text = [
    "New enquiry — khemperfumes.com",
    "",
    `From:    ${input.name}`,
    `Email:   ${input.email}`,
    `Subject: ${input.subject}`,
    "",
    input.message,
  ].join("\n");

  return {
    // The visitor's own words never reach the header line — only the
    // enum-validated subject, and stripped of breaks regardless.
    subject: stripHeaderBreaks(`KHEM Enquiry — ${input.subject}`),
    html,
    text,
  };
}

/*
 * ── Customer-facing auto-replies ────────────────────────────
 *
 * These use `luxuryShell()` from `layout.ts`, not the internal `shell()` above.
 * Different audience, different job: the team wants the facts at a glance, the
 * visitor is meeting the house for the first time.
 */

/**
 * Acknowledgement sent to whoever filled in the contact form.
 *
 * Quotes their own message back — the single most reassuring element such an
 * email can carry, and the reason `escapeMultiline` matters as much here as in
 * the internal notification.
 */
export function enquiryAcknowledgementEmail(
  input: EnquiryInput,
  locale: Locale,
  socials: readonly SocialProfile[],
): EmailPayload {
  const copy = ACKNOWLEDGEMENT_COPY[locale];
  const align = LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";

  const body = [
    paragraph(copy.intro, align),
    mutedParagraph(copy.timing, align),
    spacer(6),
    quoteBlock(
      copy.quoteLabel,
      copy.subjectLabel,
      input.subject,
      escapeMultiline(input.message),
      align,
    ),
    spacer(30),
    ctaButton(copy.cta, `${SITE_URL}/collections`),
    spacer(30),
    signoff(copy.signoff, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    // Raw name, deliberately: `luxuryShell` escapes the headline itself, so
    // escaping here too would double-encode an apostrophe in "O'Brien".
    headline: interpolate(copy.headline, { name: input.name }),
    body,
    socials,
  });

  const text = [
    copy.headline.replace("{name}", input.name),
    "",
    copy.intro,
    copy.timing,
    "",
    `${copy.quoteLabel} — ${copy.subjectLabel}: ${input.subject}`,
    "",
    input.message,
    "",
    "—",
    "KHEM Perfumes · Essence of Heritage",
    SITE_URL,
  ].join("\n");

  return { subject: stripHeaderBreaks(copy.subject), html, text };
}

/** Welcome sent to a new Inner Circle subscriber. */
export function newsletterWelcomeEmail(
  locale: Locale,
  socials: readonly SocialProfile[],
): EmailPayload {
  const copy = WELCOME_COPY[locale];
  const align = LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";

  const body = [
    paragraph(copy.intro, align),
    spacer(6),
    markedList(copy.benefits, align),
    ctaButton(copy.cta, `${SITE_URL}/heritage`),
    spacer(30),
    signoff(copy.signoff, align),
    spacer(10),
    mutedParagraph(copy.unsubscribe, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    body,
    socials,
  });

  const text = [
    copy.headline,
    "",
    copy.intro,
    "",
    ...copy.benefits.map((benefit) => `- ${benefit}`),
    "",
    copy.unsubscribe,
    "",
    "—",
    "KHEM Perfumes · Essence of Heritage",
    SITE_URL,
  ].join("\n");

  return { subject: stripHeaderBreaks(copy.subject), html, text };
}

/** Inner Circle signup notification. */
export function newsletterEmail(email: string): EmailPayload {
  const heading = "Inner Circle Signup";

  const html = shell(
    heading,
    [
      row("Email", escapeHtml(email)),
      row(
        "Note",
        "Added from the home page form. No list subscription happened — add this address to the mailing list manually.",
      ),
    ].join(""),
  );

  const text = [
    "New Inner Circle signup — khemperfumes.com",
    "",
    `Email: ${email}`,
    "",
    "No list subscription happened. Add this address to the mailing list manually.",
  ].join("\n");

  return { subject: "KHEM — New Inner Circle Signup", html, text };
}
