/**
 * Layout primitives for the customer-facing emails.
 *
 * Distinct from the internal `shell()` in `templates.ts`: that one is a dense
 * label/value notification for the team, this is a brand surface. An
 * acknowledgement is often the first email KHEM ever sends someone.
 *
 * ── Why this looks like 2005 markup ──────────────────────────
 *
 * Email clients are not browsers. Outlook on Windows renders through Word,
 * which supports neither flexbox, nor grid, nor `border-radius`, nor
 * background images, and drops `<style>` blocks entirely. So: nested tables,
 * inline styles on every element, explicit `width` attributes, `<td>`
 * "buttons", and an MSO conditional where Word needs different geometry.
 *
 * ── Dark backgrounds ─────────────────────────────────────────
 *
 * Gmail on Android and Outlook light mode both recolour backgrounds they think
 * are wrong. Every element therefore carries an explicit colour, and the
 * layout stays legible if the obsidian ground is dropped: no text is defined
 * only by its contrast with a background we do not control.
 */

import { LOCALE_DIRECTION, LOCALE_HTML_TAG, type Locale } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { SOCIAL_PROFILES } from "@/src/data/contact";
import { SIGNATURE_COPY } from "./copy";
import { escapeHtml } from "./escape";

/* ── Tokens ──────────────────────────────────────────────────
 *
 * Mirrors `@theme` in the stylesheet. Restated rather than imported because
 * email cannot use CSS variables — every value must be literal at send time.
 */
const BACKGROUND = "#0d0d0d";
const SURFACE = "#141416";
const GOLD = "#c8a96a";
const CHAMPAGNE = "#e6d6a8";
const IVORY = "#f7f4ec";
const MUTED = "#8f8f92";
const BORDER = "#2a2a2d";

const SERIF = "Georgia, 'Times New Roman', 'Cinzel', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Absolute base for image URLs.
 *
 * Email cannot resolve relative paths and cannot reach `localhost`, so the
 * seal only renders once the site is deployed. The override exists for staging
 * against a preview deployment.
 */
function assetBase(): string {
  return process.env.EMAIL_ASSET_BASE_URL ?? SITE_URL;
}

/** Hidden preview line — what the inbox shows beside the subject. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BACKGROUND};opacity:0;">${escapeHtml(text)}</div>`;
}

/**
 * Gold-bordered call to action.
 *
 * A `<td>` rather than a `<button>` or a padded `<a>`: Word collapses padding
 * on inline elements, so the cell provides the box and the anchor fills it.
 */
export function ctaButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${BACKGROUND}" style="border:1px solid ${GOLD};padding:15px 38px;">
          <a href="${escapeHtml(href)}" style="font-family:${SERIF};font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${GOLD};text-decoration:none;display:inline-block;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * The visitor's own words, quoted back.
 *
 * `body` must arrive already escaped — it is the one place in these templates
 * where untrusted input lands, so the caller passes it through
 * `escapeMultiline` and this function does not second-guess that.
 *
 * The subject value is an LTR island: `ENQUIRY_SUBJECTS` is English-only, and
 * dropping English into an RTL line misplaces the trailing punctuation. Same
 * reasoning as `ltrIsland()` in `src/lib/i18n/rtl.ts`.
 */
export function quoteBlock(
  label: string,
  subjectLabel: string,
  subject: string,
  body: string,
  align: "left" | "right",
): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};background-color:${BACKGROUND};">
      <tr>
        <td style="padding:24px 26px;text-align:${align};">
          <p style="margin:0 0 4px 0;font-family:${SANS};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD};">${escapeHtml(label)}</p>
          <p style="margin:0 0 14px 0;font-family:${SANS};font-size:12px;color:${MUTED};">${escapeHtml(subjectLabel)}: <span dir="ltr" lang="en">${escapeHtml(subject)}</span></p>
          <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.85;color:${IVORY};">${body}</p>
        </td>
      </tr>
    </table>`;
}

/**
 * House signature.
 *
 * The seal, the name, the tagline, then the four links. Two deliberate
 * choices:
 *
 *  - The name and tagline are **live text under the image**, not part of it.
 *    Most clients block remote images until the reader allows them, and a
 *    signature that vanishes entirely in that state is not a signature. The
 *    `alt` carries the mark's meaning in the meantime.
 *  - `width`/`height` attributes sit alongside the CSS. Outlook ignores the
 *    style and would otherwise render the 480px source at full size, blowing
 *    the layout apart.
 */
export function signatureBlock(locale: Locale): string {
  const copy = SIGNATURE_COPY[locale];
  const seal = `${assetBase()}/email/khem-seal.png`;

  const byId = new Map(SOCIAL_PROFILES.map((profile) => [profile.id, profile]));

  // Ordered as specified, not as `SOCIAL_PROFILES` happens to be sorted.
  const links = [
    { label: "Instagram", url: byId.get("instagram")?.url },
    { label: "Facebook", url: byId.get("facebook")?.url },
    { label: "Pinterest", url: byId.get("pinterest")?.url },
    { label: copy.officialHouse, url: SITE_URL },
  ]
    .filter((link): link is { label: string; url: string } => Boolean(link.url))
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" style="font-family:${SANS};font-size:11px;letter-spacing:0.12em;color:${GOLD};text-decoration:none;">${escapeHtml(link.label)}</a>`,
    )
    .join(
      `<span style="font-family:${SANS};font-size:11px;color:${BORDER};">&nbsp;&nbsp;•&nbsp;&nbsp;</span>`,
    );

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:0 0 22px 0;">
          <div style="height:1px;line-height:1px;font-size:0;background-color:${BORDER};">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 16px 0;">
          <img src="${escapeHtml(seal)}" width="104" height="104" alt="${escapeHtml(copy.logoAlt)}" style="display:block;width:104px;height:104px;border:0;outline:none;text-decoration:none;" />
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 4px 0;">
          <p style="margin:0;font-family:${SERIF};font-size:15px;letter-spacing:0.26em;text-transform:uppercase;color:${IVORY};">${escapeHtml(copy.house)}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 20px 0;">
          <p style="margin:0;font-family:${SERIF};font-size:12px;letter-spacing:0.16em;font-style:italic;color:${GOLD};">${escapeHtml(copy.tagline)}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 18px 0;">${links}</td>
      </tr>
      <tr>
        <td align="center">
          <p style="margin:0;font-family:${SANS};font-size:10px;letter-spacing:0.08em;line-height:1.8;color:${MUTED};">${escapeHtml(copy.rights)}</p>
        </td>
      </tr>
    </table>`;
}

export interface LuxuryShellInput {
  locale: Locale;
  preheaderText: string;
  eyebrow: string;
  headline: string;
  /** Pre-composed HTML for the middle of the letter. Trusted or pre-escaped. */
  body: string;
}

/** The full customer-facing document. */
export function luxuryShell({
  locale,
  preheaderText,
  eyebrow,
  headline,
  body,
}: LuxuryShellInput): string {
  const dir = LOCALE_DIRECTION[locale];
  const align = dir === "rtl" ? "right" : "left";

  return `<!doctype html>
<html lang="${LOCALE_HTML_TAG[locale]}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(headline)}</title>
  </head>
  <body dir="${dir}" style="margin:0;padding:0;background-color:${BACKGROUND};-webkit-text-size-adjust:100%;">
    ${preheader(preheaderText)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BACKGROUND}" style="background-color:${BACKGROUND};">
      <tr>
        <td align="center" style="padding:36px 14px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}" style="width:100%;max-width:600px;background-color:${SURFACE};border:1px solid ${BORDER};">

            <!-- Crown: wordmark over a gold hairline -->
            <tr>
              <td align="center" style="padding:44px 40px 0 40px;">
                <p style="margin:0;font-family:${SERIF};font-size:26px;letter-spacing:0.42em;text-indent:0.42em;color:${GOLD};">KHEM</p>
                <table role="presentation" width="56" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0 auto;">
                  <tr><td style="height:1px;line-height:1px;font-size:0;background-color:${GOLD};">&nbsp;</td></tr>
                </table>
              </td>
            </tr>

            <!-- Letter -->
            <tr>
              <td style="padding:36px 40px 0 40px;text-align:${align};">
                <p style="margin:0 0 14px 0;font-family:${SANS};font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:${MUTED};">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0 0 22px 0;font-family:${SERIF};font-size:28px;line-height:1.35;font-weight:normal;color:${CHAMPAGNE};">${escapeHtml(headline)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;text-align:${align};">${body}</td>
            </tr>

            <!-- Signature -->
            <tr>
              <td style="padding:38px 40px 44px 40px;">${signatureBlock(locale)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A paragraph of trusted, author-written prose. */
export function paragraph(text: string, align: "left" | "right"): string {
  return `<p style="margin:0 0 18px 0;font-family:${SANS};font-size:15px;line-height:1.9;color:${IVORY};text-align:${align};">${escapeHtml(text)}</p>`;
}

/** A muted, smaller paragraph — timing promises, unsubscribe lines. */
export function mutedParagraph(text: string, align: "left" | "right"): string {
  return `<p style="margin:0 0 18px 0;font-family:${SANS};font-size:13px;line-height:1.85;color:${MUTED};text-align:${align};">${escapeHtml(text)}</p>`;
}

/**
 * Gold-marked list.
 *
 * Built from table rows rather than `<ul>`: list markers and their indentation
 * are one of the least consistent things across mail clients, and in RTL they
 * land on the wrong side more often than not.
 */
export function markedList(items: string[], align: "left" | "right"): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td valign="top" style="padding:0 0 12px 0;text-align:${align};">
          <span style="font-family:${SANS};font-size:14px;line-height:1.8;color:${IVORY};"><span style="color:${GOLD};">&#9670;</span>&nbsp;&nbsp;${escapeHtml(item)}</span>
        </td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">${rows}</table>`;
}

/** Vertical rhythm between blocks. */
export function spacer(height: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;
}

/** Sign-off line above the signature. */
export function signoff(text: string, align: "left" | "right"): string {
  return `<p style="margin:0 0 4px 0;font-family:${SERIF};font-size:14px;font-style:italic;color:${MUTED};text-align:${align};">${escapeHtml(text)}</p>`;
}
