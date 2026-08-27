/**
 * The campaign letter.
 *
 * Built from the same kit as every other KHEM email — `luxuryShell`,
 * `ctaButton`, `paragraph`, `signatureBlock` — so a marketing letter and an
 * order confirmation are recognisably from the same house.
 *
 * ## Two differences from every other letter here, both forced
 *
 * **No inline logo.** Resend's batch API refuses attachments (confirmed in
 * `node_modules/resend/dist/index.d.mts`), and a campaign is sent in batches. So
 * the signature's mark comes from `logoSrc(null)` — the absolute-URL fallback
 * that `logo.ts` already provides for exactly this case. A reader who blocks
 * remote images sees the wordmark and the `alt`, which is why the signature was
 * built with live text under the image in the first place.
 *
 * **A per-recipient unsubscribe link.** Every letter carries that subscriber's
 * own token, which is what makes withdrawal work and what makes the letter
 * lawful. It is the reason a campaign is composed once per recipient rather than
 * once per campaign.
 *
 * ## The editor's prose is escaped
 *
 * Everything from the dashboard — subject, body, labels, links — is written by
 * an administrator, and it is still escaped. `escape.ts` is not applied here
 * because the author is untrusted; it is applied because a stray `&` in "Oud &
 * Amber" would otherwise arrive as broken markup in ten thousand inboxes.
 *
 * The body is **plain paragraphs**, split on blank lines. The editor writes
 * text; this decides what it looks like.
 */

import { LOCALE_DIRECTION, type Locale } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import type { SocialProfile } from "@/src/types/contact";

import { CAMPAIGN_FRAME_COPY } from "./campaign-copy";
import { escapeHtml, stripHeaderBreaks } from "./escape";
import {
  ctaButton,
  luxuryShell,
  mutedLink,
  mutedParagraph,
  paragraph,
  spacer,
} from "./layout";
import type { EmailPayload } from "./templates";

/* §3.1 tokens, mirrored from `./layout.ts` — same values, same reason. */
const BACKGROUND = "#0d0d0d";
const GOLD = "#c8a96a";
const IVORY = "#f7f4ec";
const MUTED = "#8a8a8a";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The hero photograph.
 *
 * `width="600"` as an attribute as well as in the style, because Outlook ignores
 * the CSS and would otherwise render the source at its natural size and burst
 * the letter open — the same lesson `signatureBlock` records about its mark.
 */
function heroImage(url: string, alt: string): string {
  return `
    <tr>
      <td style="padding:0;">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
      </td>
    </tr>`;
}

/**
 * The voucher frame — the same gold box the welcome letter uses.
 *
 * Centred and `dir="ltr"` in both language trees: a code is an uppercase Latin
 * string whose character order is its whole meaning.
 */
function voucherBlock(label: string, code: string, how: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${GOLD};background-color:${BACKGROUND};">
      <tr>
        <td align="center" style="padding:26px 24px;text-align:center;">
          <p style="margin:0 0 14px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
          <p dir="ltr" lang="en" style="margin:0 0 14px 0;font-family:${SERIF};font-size:26px;letter-spacing:0.3em;text-indent:0.3em;color:${GOLD};">${escapeHtml(code)}</p>
          <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${IVORY};">${escapeHtml(how)}</p>
        </td>
      </tr>
    </table>`;
}

export interface CampaignEmailInput {
  locale: Locale;
  subject: string;
  preheader: string;
  /** Plain text. Blank lines separate paragraphs. */
  body: string;
  heroUrl: string | null;
  heroAlt: string | null;
  ctaLabel: string;
  ctaHref: string;
  /** A real `discounts.code`, or null. */
  discountCode: string | null;
  /** This recipient's own unsubscribe URL, carrying their row's token. */
  unsubscribeUrl: string;
  socials: readonly SocialProfile[];
}

export function campaignEmail({
  locale,
  subject,
  preheader,
  body,
  heroUrl,
  heroAlt,
  ctaLabel,
  ctaHref,
  discountCode,
  unsubscribeUrl,
  socials,
}: CampaignEmailInput): EmailPayload {
  const frame = CAMPAIGN_FRAME_COPY[locale];
  const align = LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";

  // Blank lines separate paragraphs; a run of them counts once.
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const parts: string[] = [];

  if (heroUrl && heroAlt) {
    /*
     * The hero sits above the prose but inside the letter's own table, so it is
     * emitted as its own row and the rest of the body follows beneath it.
     */
    parts.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">${heroImage(heroUrl, heroAlt)}</table>`,
    );
  }

  for (const part of paragraphs) parts.push(paragraph(part, align));

  if (discountCode) {
    parts.push(spacer(10));
    parts.push(voucherBlock(frame.voucherLabel, discountCode, frame.voucherHow));
  }

  if (ctaLabel && ctaHref) {
    parts.push(spacer(26));
    parts.push(ctaButton(ctaLabel, ctaHref));
  }

  parts.push(spacer(30));
  parts.push(mutedParagraph(frame.marketingNote, align));
  parts.push(spacer(6));
  parts.push(mutedParagraph(frame.unsubscribe, align));
  parts.push(mutedLink(frame.unsubscribeLink, unsubscribeUrl, align));

  const html = luxuryShell({
    locale,
    preheaderText: preheader || subject,
    // The eyebrow names who is writing; the subject carries the message.
    eyebrow: frame.eyebrow,
    headline: subject,
    body: parts.join(""),
    socials,
    /*
     * Omitted on purpose, which makes `signatureBlock` use its absolute-URL
     * fallback: no attachment is possible in a batch send. See the header.
     */
  });

  const text = [
    subject,
    "",
    ...paragraphs,
    "",
    ...(discountCode ? [`${frame.voucherLabel}: ${discountCode}`, frame.voucherHow, ""] : []),
    ...(ctaLabel && ctaHref ? [`${ctaLabel}: ${ctaHref}`, ""] : []),
    frame.marketingNote,
    "",
    frame.unsubscribe,
    unsubscribeUrl,
    "",
    "—",
    "KHEM Perfumes · Essence of Heritage",
    SITE_URL,
  ].join("\n");

  return { subject: stripHeaderBreaks(subject), html, text };
}
