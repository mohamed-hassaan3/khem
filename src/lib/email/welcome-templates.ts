/**
 * The two account letters: the welcome and the invitation.
 *
 * Both are built from the kit in `./layout.ts` — the same `luxuryShell`,
 * `ctaButton`, `paragraph` and `signatureBlock` the order mail and the Inner
 * Circle welcome use. Nothing about the house's email look is re-invented here;
 * this file contributes one new block (the voucher frame) and two compositions.
 *
 * The same mail-client constraints `./templates.ts` opens with apply: table
 * layout, inline styles only, no custom fonts, and a `text` alternative beside
 * every HTML part.
 *
 * ## The one untrusted value
 *
 * A customer's first name, from Clerk. It is escaped where it is written and
 * nowhere else has to think about it. Everything else in these letters is
 * author-written prose from `./welcome-copy.ts` or a value the database
 * produced — and the voucher code in particular is one `claim_welcome()` wrote
 * in the same transaction that claimed the letter, which is the whole reason
 * §7.2's "the code shown in the email is actually valid" holds.
 */

import { LOCALE_DIRECTION, type Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import type { SocialProfile } from "@/src/types/contact";

import { escapeHtml, stripHeaderBreaks } from "./escape";
import {
  ctaButton,
  luxuryShell,
  mutedParagraph,
  paragraph,
  signoff,
  spacer,
} from "./layout";
import type { EmailPayload } from "./templates";
import { ACCOUNT_WELCOME_COPY, INVITATION_COPY } from "./welcome-copy";

/* §3.1 tokens, mirrored from `./layout.ts` — same values, same reason. */
const BACKGROUND = "#0d0d0d";
const GOLD = "#c8a96a";
const IVORY = "#f7f4ec";
const MUTED = "#8a8a8a";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * The privilege frame: a label, the code, and its terms.
 *
 * The code is set large, letter-spaced, and **always `dir="ltr"`** — it is an
 * uppercase Latin string whose character order is the whole of its meaning, and
 * in an Arabic letter the bidi algorithm would otherwise move its punctuation.
 * The same rule `ltrIsland()` applies across the site.
 *
 * It is rendered as selectable text rather than as an image or a link: the
 * reader's next action is to copy it.
 *
 * Centred in both trees, unlike the prose around it: the code is a monument in
 * the middle of the letter rather than a line of running text, and centring is
 * what makes it read as one in either direction.
 */
function privilegeBlock(label: string, code: string, terms: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${GOLD};background-color:${BACKGROUND};">
      <tr>
        <td align="center" style="padding:26px 24px;text-align:center;">
          <p style="margin:0 0 14px 0;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</p>
          <p dir="ltr" lang="en" style="margin:0 0 14px 0;font-family:${SERIF};font-size:26px;letter-spacing:0.3em;text-indent:0.3em;color:${GOLD};">${escapeHtml(code)}</p>
          <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.8;color:${IVORY};text-align:center;">${escapeHtml(terms)}</p>
        </td>
      </tr>
    </table>`;
}

/** What a welcome letter needs to know. Assembled by the webhook. */
export interface WelcomeEmailInput {
  locale: Locale;
  /** From Clerk. Null for an account that carries no name. */
  firstName: string | null;
  /** The code `claim_welcome()` wrote, or null when no offer is running. */
  code: string | null;
  /** ISO-8601, already the earlier of the grant's and the campaign's end. */
  expiresAt: string | null;
  socials: readonly SocialProfile[];
  logoSrc?: string;
}

/**
 * Sent once, when an account becomes real.
 *
 * Transactional (§9.1): it is about the account the person just created, and it
 * is sent whatever their marketing preference says. The Inner Circle
 * reconciliation in the webhook is a separate matter and stays that way.
 */
export function accountWelcomeEmail({
  locale,
  firstName,
  code,
  expiresAt,
  socials,
  logoSrc,
}: WelcomeEmailInput): EmailPayload {
  const copy = ACCOUNT_WELCOME_COPY[locale];
  const align = LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";

  const name = firstName?.trim() ?? "";
  const headline = name
    ? interpolate(copy.headline, { name })
    : copy.headlineNoName;

  const expiryLine = expiresAt
    ? interpolate(copy.privilegeExpiry, {
        date: new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(expiresAt)),
      })
    : copy.privilegeNoExpiry;

  /*
   * No code, no frame. An empty privilege block promising nothing reads worse
   * than a letter that simply welcomes somebody — see the migration's header
   * for why the letter never depends on a campaign existing.
   */
  const privilege = code
    ? [
        paragraph(copy.privilegeLead, align),
        spacer(6),
        privilegeBlock(copy.privilegeLabel, code, expiryLine),
        spacer(18),
        mutedParagraph(copy.privilegeHow, align),
      ].join("")
    : paragraph(copy.noPrivilege, align);

  const body = [
    paragraph(copy.intro, align),
    paragraph(copy.house, align),
    spacer(10),
    privilege,
    spacer(26),
    ctaButton(copy.cta, `${SITE_URL}/collections`),
    spacer(30),
    signoff(copy.signoff, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    headline,
    body,
    socials,
    logoSrc,
  });

  const text = [
    headline,
    "",
    copy.intro,
    "",
    copy.house,
    "",
    ...(code
      ? [copy.privilegeLead, "", `${copy.privilegeLabel}: ${code}`, expiryLine, copy.privilegeHow]
      : [copy.noPrivilege]),
    "",
    `${copy.cta}: ${SITE_URL}/collections`,
    "",
    "—",
    "KHEM Perfumes · Essence of Heritage",
    SITE_URL,
  ].join("\n");

  // `stripHeaderBreaks` on every subject, as everywhere else in this folder:
  // a newline in a header is a header injection.
  return { subject: stripHeaderBreaks(copy.subject), html, text };
}

export interface InvitationEmailInput {
  locale: Locale;
  /**
   * Clerk's invitation URL, carrying the ticket.
   *
   * Comes straight from `createInvitation()` — never assembled here. It is the
   * one thing in the letter that grants anything, and it must be the string
   * Clerk minted rather than one this file guessed the shape of.
   */
  url: string;
  expiresInDays: number;
  socials: readonly SocialProfile[];
  logoSrc?: string;
}

/**
 * The house's own invitation letter.
 *
 * Sent because `createInvitation` is called with `notify: false`. Clerk still
 * owns the invitation, the ticket, and its expiry — this changes the envelope,
 * not the mechanism, and the link inside is Clerk's.
 */
export function invitationEmail({
  locale,
  url,
  expiresInDays,
  socials,
  logoSrc,
}: InvitationEmailInput): EmailPayload {
  const copy = INVITATION_COPY[locale];
  const align = LOCALE_DIRECTION[locale] === "rtl" ? "right" : "left";

  const body = [
    paragraph(copy.intro, align),
    paragraph(copy.house, align),
    spacer(16),
    ctaButton(copy.cta, url),
    spacer(24),
    mutedParagraph(interpolate(copy.expiry, { days: String(expiresInDays) }), align),
    spacer(20),
    signoff(copy.signoff, align),
  ].join("");

  const html = luxuryShell({
    locale,
    preheaderText: copy.preheader,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
    body,
    socials,
    logoSrc,
  });

  const text = [
    copy.headline,
    "",
    copy.intro,
    "",
    copy.house,
    "",
    copy.linkLabel,
    url,
    "",
    interpolate(copy.expiry, { days: String(expiresInDays) }),
    "",
    "—",
    "KHEM Perfumes · Essence of Heritage",
    SITE_URL,
  ].join("\n");

  return { subject: stripHeaderBreaks(copy.subject), html, text };
}
