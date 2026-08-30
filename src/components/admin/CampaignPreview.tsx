/**
 * The letter, as it will arrive.
 *
 * A Server Component that renders the *actual* HTML `campaignEmail()` produces,
 * inside a sandboxed iframe. Not an approximation of it, and not a React
 * re-implementation of the template — either would be a second definition of
 * what a campaign looks like, and the one the desk approved would not be the one
 * that went out.
 *
 * `sandbox` with no permissions: the letter is inert here. It cannot run script,
 * cannot navigate the dashboard, and cannot submit anything. The hero image is a
 * URL an administrator supplied, and this is the one place it is fetched by a
 * browser at all — a sandboxed frame is where that should happen, not the
 * dashboard's own document.
 *
 * The preview is only ever a rehearsal of the *composition*. What a letter looks
 * like in Gmail is a question only Gmail answers, which is what "Send Me a Test"
 * is for.
 */

import { campaignEmail } from "@/src/lib/email/campaign-template";
import { unsubscribeUrlFor } from "@/src/lib/email/send-campaign-mail";
import type { Locale } from "@/src/lib/i18n/config";
import { getSocialProfiles } from "@/src/services/contact";
import type { Campaign } from "@/src/types/campaign";

export default async function CampaignPreview({
  campaign,
}: {
  campaign: Campaign;
}) {
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
    // A visibly fake token: the preview must show that the line is there
    // without putting a working credential on a dashboard screen.
    unsubscribeUrl: unsubscribeUrlFor("preview-token"),
    socials: await getSocialProfiles(),
  });

  return (
    <div className="border border-ground-border bg-ivory">
      <p className="border-b border-ground-border px-4 py-3 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
        Preview
      </p>

      <iframe
        title="Campaign preview"
        sandbox=""
        srcDoc={payload.html}
        className="h-[42rem] w-full border-0 bg-ivory"
      />
    </div>
  );
}
