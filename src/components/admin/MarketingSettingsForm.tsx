"use client";

/**
 * How the announcement bar rotates, and how the offer popup behaves.
 *
 * One form for one row, saved in one write. Splitting the bar and the popup into
 * two screens would let a half-saved pair leave the bar in carousel mode with an
 * interval the editor chose for the marquee.
 *
 * ## What is deliberately not on this screen
 *
 * The **discount percentage**. The popup promises whatever the live welcome
 * offer is worth, read from `discounts."isWelcome"` at render time, and it is
 * edited in the discount editor beside its grants and its redemption ledger.
 * Putting a second percentage here would create two numbers that must agree and
 * no mechanism to make them.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import { saveMarketingSettings } from "@/src/actions/admin/marketing";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminMarketingSettings } from "@/src/types/marketing";

const MODE_OPTIONS = [
  { value: "STATIC", label: "Static — the first live announcement only" },
  { value: "CAROUSEL", label: "Carousel — one at a time, on an interval" },
  { value: "MARQUEE", label: "Marquee — a continuous drift" },
] as const;

/** The three intervals the brief names, plus the two either side of them. */
const INTERVAL_OPTIONS = [
  { value: "2000", label: "2 seconds" },
  { value: "3000", label: "3 seconds" },
  { value: "5000", label: "5 seconds" },
  { value: "8000", label: "8 seconds" },
  { value: "12000", label: "12 seconds" },
] as const;

const DELAY_OPTIONS = [
  { value: "10000", label: "10 seconds" },
  { value: "15000", label: "15 seconds" },
  { value: "20000", label: "20 seconds" },
  { value: "30000", label: "30 seconds" },
  { value: "60000", label: "1 minute" },
] as const;

export default function MarketingSettingsForm({
  settings,
  locale,
  /** What the popup currently promises, for the note under the toggle. */
  offerSummary,
}: {
  settings: AdminMarketingSettings;
  locale: Locale;
  offerSummary: string;
}) {
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(
    settings.announcementsEnabled,
  );
  const [announcementMode, setAnnouncementMode] = useState<string>(
    settings.announcementMode,
  );
  const [announcementIntervalMs, setAnnouncementIntervalMs] = useState(
    String(settings.announcementIntervalMs),
  );

  const [offerPopupEnabled, setOfferPopupEnabled] = useState(
    settings.offerPopupEnabled,
  );
  const [offerPopupDelayMs, setOfferPopupDelayMs] = useState(
    String(settings.offerPopupDelayMs),
  );
  const [offerPopupScrollPercent, setOfferPopupScrollPercent] = useState(
    String(settings.offerPopupScrollPercent),
  );
  const [offerPopupSnoozeDays, setOfferPopupSnoozeDays] = useState(
    String(settings.offerPopupSnoozeDays),
  );
  const [offerPopupEyebrow, setOfferPopupEyebrow] = useState(
    settings.offerPopupEyebrow ?? "",
  );
  const [offerPopupEyebrowAr, setOfferPopupEyebrowAr] = useState(
    settings.offerPopupEyebrowAr ?? "",
  );
  const [offerPopupHeading, setOfferPopupHeading] = useState(
    settings.offerPopupHeading,
  );
  const [offerPopupHeadingAr, setOfferPopupHeadingAr] = useState(
    settings.offerPopupHeadingAr ?? "",
  );
  const [offerPopupBody, setOfferPopupBody] = useState(
    settings.offerPopupBody ?? "",
  );
  const [offerPopupBodyAr, setOfferPopupBodyAr] = useState(
    settings.offerPopupBodyAr ?? "",
  );
  const [offerPopupImageUrl, setOfferPopupImageUrl] = useState(
    settings.offerPopupImageUrl,
  );
  const [offerPopupImageAlt, setOfferPopupImageAlt] = useState(
    settings.offerPopupImageAlt,
  );
  const [offerPopupImageAltAr, setOfferPopupImageAltAr] = useState(
    settings.offerPopupImageAltAr ?? "",
  );

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const payload = {
    announcementsEnabled,
    announcementMode,
    announcementIntervalMs,
    offerPopupEnabled,
    offerPopupDelayMs,
    offerPopupScrollPercent,
    offerPopupSnoozeDays,
    offerPopupEyebrow,
    offerPopupEyebrowAr,
    offerPopupHeading,
    offerPopupHeadingAr,
    offerPopupBody,
    offerPopupBodyAr,
    offerPopupImageUrl,
    offerPopupImageAlt,
    offerPopupImageAltAr,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await saveMarketingSettings(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (outcome.ok) markSaved();

    return outcome.ok;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await persist();
        });
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The announcement bar
        </h2>

        <AdminToggle
          id="announcementsEnabled"
          label="Show the bar"
          description="Off hides it everywhere, whatever the individual announcements say. With it on, the bar appears only while at least one announcement is live."
          checked={announcementsEnabled}
          onChange={setAnnouncementsEnabled}
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminSelect
            id="announcementMode"
            label="How it rotates"
            value={announcementMode}
            onChange={setAnnouncementMode}
            options={[...MODE_OPTIONS]}
            error={fieldErrors.announcementMode}
            hint="With one live announcement all three read the same — there is nowhere to rotate to."
          />
          <AdminSelect
            id="announcementIntervalMs"
            label="Carousel interval"
            value={announcementIntervalMs}
            onChange={setAnnouncementIntervalMs}
            options={[...INTERVAL_OPTIONS]}
            error={fieldErrors.announcementIntervalMs}
            hint="Ignored in Static and Marquee. The marquee's speed comes from how many announcements are live."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The offer popup
        </h2>

        <AdminToggle
          id="offerPopupEnabled"
          label="Show the popup"
          description={offerSummary}
          checked={offerPopupEnabled}
          onChange={setOfferPopupEnabled}
        />

        <p className="text-[11px] leading-relaxed text-ground-muted">
          What it promises is the welcome offer —{" "}
          <Link
            href={localizePath(locale, "/admin/discounts")}
            className="text-ground-accent underline-offset-4 transition-colors duration-300 hover:text-ground-accent"
          >
            edited with the discount codes
          </Link>
          , so the percentage shown here and the one honoured at checkout are the
          same row. With no welcome offer running, the popup still invites people
          to the list and promises nothing.
        </p>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-3">
          <AdminSelect
            id="offerPopupDelayMs"
            label="Appears after"
            value={offerPopupDelayMs}
            onChange={setOfferPopupDelayMs}
            options={[...DELAY_OPTIONS]}
            error={fieldErrors.offerPopupDelayMs}
          />
          <AdminInput
            id="offerPopupScrollPercent"
            type="number"
            label="Or after reading, %"
            value={offerPopupScrollPercent}
            onChange={setOfferPopupScrollPercent}
            error={fieldErrors.offerPopupScrollPercent}
            hint="Whichever comes first. 0 to wait for the timer alone."
          />
          <AdminInput
            id="offerPopupSnoozeDays"
            type="number"
            label="Dismissal lasts, days"
            value={offerPopupSnoozeDays}
            onChange={setOfferPopupSnoozeDays}
            error={fieldErrors.offerPopupSnoozeDays}
            hint="Somebody who subscribes is never asked again."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          What the popup says
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="offerPopupEyebrow"
            label="Eyebrow — English"
            value={offerPopupEyebrow}
            onChange={setOfferPopupEyebrow}
            error={fieldErrors.offerPopupEyebrow}
            hint="Optional. Falls back to the house wording."
          />
          <AdminInput
            id="offerPopupEyebrowAr"
            label="Eyebrow — Arabic"
            value={offerPopupEyebrowAr}
            onChange={setOfferPopupEyebrowAr}
            error={fieldErrors.offerPopupEyebrowAr}
          />
          <AdminInput
            id="offerPopupHeading"
            label="Heading — English"
            value={offerPopupHeading}
            onChange={setOfferPopupHeading}
            error={fieldErrors.offerPopupHeading}
            required
          />
          <AdminInput
            id="offerPopupHeadingAr"
            label="Heading — Arabic"
            value={offerPopupHeadingAr}
            onChange={setOfferPopupHeadingAr}
            error={fieldErrors.offerPopupHeadingAr}
          />
        </div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminTextarea
            id="offerPopupBody"
            label="Paragraph — English"
            value={offerPopupBody}
            onChange={setOfferPopupBody}
            error={fieldErrors.offerPopupBody}
            rows={3}
            hint="Optional. Leave empty and the panel prints the offer sentence on its own."
          />
          <AdminTextarea
            id="offerPopupBodyAr"
            label="Paragraph — Arabic"
            value={offerPopupBodyAr}
            onChange={setOfferPopupBodyAr}
            error={fieldErrors.offerPopupBodyAr}
            rows={3}
          />
        </div>

        <AdminInput
          id="offerPopupImageUrl"
          type="url"
          label="Photograph"
          value={offerPopupImageUrl}
          onChange={setOfferPopupImageUrl}
          error={fieldErrors.offerPopupImageUrl}
          required
          hint="A portrait crop reads best — it fills half the panel on a laptop and a band above the form on a phone."
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="offerPopupImageAlt"
            label="Photograph description — English"
            value={offerPopupImageAlt}
            onChange={setOfferPopupImageAlt}
            error={fieldErrors.offerPopupImageAlt}
            required
            hint="For somebody who cannot see it."
          />
          <AdminInput
            id="offerPopupImageAltAr"
            label="Photograph description — Arabic"
            value={offerPopupImageAltAr}
            onChange={setOfferPopupImageAltAr}
            error={fieldErrors.offerPopupImageAltAr}
          />
        </div>
      </section>

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Saving" : "Save settings"}
      </AdminButton>
    </form>
  );
}
