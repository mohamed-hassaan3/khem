import "server-only";

/**
 * Campaign delivery.
 *
 * **Stage 1 sends to exactly one address: the administrator's own.** Dispatch to
 * the list is Stage 2 and is deliberately not in this file yet — the composer
 * and the test send are useful on their own, and mass delivery is the half that
 * can go wrong in front of customers.
 *
 * ## Why a test send exists at all
 *
 * A campaign is the one thing in this house that cannot be corrected after the
 * fact. "Does this look right?" must therefore be answerable *before* anything
 * irreversible happens, and answerable in a real inbox rather than in a preview
 * pane — because what a letter looks like in Gmail is not something a browser
 * can tell you.
 *
 * ## Privacy
 *
 * Logs carry a campaign id and a provider message. **Never** an address, and
 * never an unsubscribe token — a token in a log is a credential in a log.
 */

import { SITE_URL } from "@/src/lib/i18n/metadata";
import type { Locale } from "@/src/lib/i18n/config";
import { getSocialProfiles } from "@/src/services/contact";
import type { Campaign } from "@/src/types/campaign";

import { houseFromAddress, inboxAddress } from "./addresses";
import { campaignEmail } from "./campaign-template";
import { getEmailClient } from "./client";

/**
 * Where an unsubscribe link points, for a given token.
 *
 * One definition, used by the test send now and by the dispatch later, so the
 * link in a rehearsal is the link a customer will actually receive.
 */
export function unsubscribeUrlFor(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Send one campaign to one address, as a rehearsal.
 *
 * The token is a real one — the administrator's own row if they are on the list,
 * and otherwise a placeholder that leads to the "that link is not valid" page.
 * Either way the letter is composed by exactly the code that will compose the
 * real ones, because a rehearsal that skipped the unsubscribe line would be
 * rehearsing a different letter.
 *
 * @returns whether Resend accepted it.
 */
export async function sendCampaignTest(
  campaign: Campaign,
  to: string,
  unsubscribeToken: string,
): Promise<boolean> {
  const resend = getEmailClient();
  if (!resend) {
    console.error("[campaign] RESEND_API_KEY is not configured");
    return false;
  }

  const payload = campaignEmail({
    locale: campaign.locale as Locale,
    subject: campaign.subject,
    preheader: campaign.preheader,
    body: campaign.body,
    heroUrl: campaign.heroUrl,
    heroAlt: campaign.heroAlt,
    ctaLabel: campaign.ctaLabel,
    ctaHref: campaign.ctaHref,
    discountCode: campaign.discountCode,
    unsubscribeUrl: unsubscribeUrlFor(unsubscribeToken),
    socials: await getSocialProfiles(),
  });

  try {
    const { error } = await resend.emails.send({
      from: houseFromAddress(),
      to,
      replyTo: await inboxAddress(),
      // Marked in the subject so a rehearsal can never be mistaken for the real
      // letter sitting in the same inbox.
      subject: `[TEST] ${payload.subject}`,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      console.error(`[campaign] test send rejected for ${campaign.id}: ${error.message}`);
      return false;
    }

    return true;
  } catch (cause) {
    console.error(
      `[campaign] test send threw for ${campaign.id}:`,
      cause instanceof Error ? cause.message : "unknown error",
    );
    return false;
  }
}
