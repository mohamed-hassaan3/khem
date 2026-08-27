import type { ReactNode } from "react";

import type { CampaignWithProgress } from "@/src/types/campaign";

/**
 * A campaign that has gone out, read back.
 *
 * ## Why this is not the form with its fields disabled
 *
 * A greyed-out editor says "you may not touch this *yet*" — it invites somebody
 * to look for the thing that would re-enable it. A campaign that has been sent
 * is not waiting for permission; it is a record of a letter thousands of people
 * have already read, and the screen should say that in its shape as well as in
 * its words.
 *
 * So the fields become printed values, the buttons are gone rather than
 * disabled, and what is added is the part that only exists after the fact: how
 * many letters were claimed, how many the provider took, and when.
 *
 * The preview beneath it is unchanged, and it is the point of the screen — the
 * one place the house can see exactly what it sent.
 */

const TYPE_LABEL: Record<string, string> = {
  NEW_ARRIVAL: "New Arrival",
  DISCOUNT: "Discount",
  NEW_COLLECTION: "New Collection",
  EXCLUSIVE_OFFER: "Exclusive Offer",
  SEASONAL: "Seasonal",
  CUSTOM: "Custom",
};

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-4 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/30">
        {label}
      </p>
      <div className="min-w-0 text-[12px] leading-relaxed text-ivory/75">
        {children}
      </div>
    </div>
  );
}

export default function CampaignRecord({
  campaign,
}: {
  campaign: CampaignWithProgress;
}) {
  const refused = campaign.claimed - campaign.delivered;

  return (
    <div className="max-w-3xl space-y-8">
      <section className="border border-gold/20 bg-gold/5 px-6 py-5">
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold">
          {campaign.status === "SENDING" ? "Sending" : "Sent"}
        </p>

        <p className="mt-2 text-[12px] leading-relaxed text-ivory/55">
          {campaign.delivered} of {campaign.claimed}{" "}
          {campaign.claimed === 1 ? "letter" : "letters"} accepted by the mail
          provider
          {refused > 0 ? `, ${refused} refused` : ""}
          {campaign.sentAt ? ` — ${stamp(campaign.sentAt)}` : ""}.
        </p>

        <p className="mt-3 text-[11px] leading-relaxed text-ivory/30">
          This is a record of what went out. It cannot be edited, and the letter
          below is exactly what its recipients received.
        </p>
      </section>

      <section className="border border-border bg-surface/60 px-6 py-2">
        <Row label="Name">{campaign.name}</Row>
        <Row label="Type">{TYPE_LABEL[campaign.type] ?? campaign.type}</Row>
        <Row label="List">
          {campaign.locale === "ar" ? "Arabic" : "English"}
        </Row>
        <Row label="Subject">{campaign.subject}</Row>

        {campaign.preheader ? (
          <Row label="Preview text">{campaign.preheader}</Row>
        ) : null}

        {campaign.discountCode ? (
          <Row label="Voucher">
            {/* A code is a Latin string whose character order is its meaning. */}
            <span dir="ltr" className="font-heading tracking-[0.14em] text-gold">
              {campaign.discountCode}
            </span>
          </Row>
        ) : null}

        {campaign.ctaLabel ? (
          <Row label="Button">
            {campaign.ctaLabel}
            <span className="mt-0.5 block break-all text-[11px] text-ivory/30">
              {campaign.ctaHref}
            </span>
          </Row>
        ) : null}

        <Row label="Created">{stamp(campaign.createdAt)}</Row>
      </section>
    </div>
  );
}
