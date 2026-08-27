"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCampaign,
  deleteCampaign,
  sendCampaignTestEmail,
  updateCampaign,
} from "@/src/actions/admin/campaigns";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import { isEditable, type CampaignWithProgress } from "@/src/types/campaign";

/**
 * Composing a campaign.
 *
 * ## The one screen in this dashboard that can do something irreversible
 *
 * So it is built to slow the hand down where it matters:
 *
 *  - the audience size is stated **before** anything is sent, not after;
 *  - the only send here is a rehearsal to the administrator's own address;
 *  - a campaign that has gone out renders read-only, because the database will
 *    refuse the edit anyway and a form that lets somebody type into a frozen
 *    record is a form that wastes their afternoon.
 *
 * Everything else is an ordinary editor: same fields kit, same unsaved-changes
 * guard, same toast-on-success rule as its dozen neighbours.
 */

const TYPES = [
  { value: "NEW_ARRIVAL", label: "New Arrival" },
  { value: "DISCOUNT", label: "Discount" },
  { value: "NEW_COLLECTION", label: "New Collection" },
  { value: "EXCLUSIVE_OFFER", label: "Exclusive Offer" },
  { value: "SEASONAL", label: "Seasonal" },
  { value: "CUSTOM", label: "Custom" },
] as const;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
] as const;

export default function CampaignForm({
  campaign,
  locale,
  audienceEn,
  audienceAr,
}: {
  /** Null when composing a new one. */
  campaign: CampaignWithProgress | null;
  locale: Locale;
  /** How many subscribed addresses each list holds right now. */
  audienceEn: number;
  audienceAr: number;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const isEdit = campaign !== null;
  const frozen = campaign !== null && !isEditable(campaign.status);

  const [name, setName] = useState(campaign?.name ?? "");
  const [type, setType] = useState<string>(campaign?.type ?? "CUSTOM");
  const [campaignLocale, setCampaignLocale] = useState<string>(
    campaign?.locale ?? "en",
  );
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [preheader, setPreheader] = useState(campaign?.preheader ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [heroUrl, setHeroUrl] = useState(campaign?.heroUrl ?? "");
  const [heroAlt, setHeroAlt] = useState(campaign?.heroAlt ?? "");
  const [ctaLabel, setCtaLabel] = useState(campaign?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(campaign?.ctaHref ?? "");
  const [discountCode, setDiscountCode] = useState(campaign?.discountCode ?? "");

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTest] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Hoisted out of the save so it can be compared as well as posted: this one
   * object is both what the action receives and what `useUnsavedGuard` watches,
   * so a field that reaches the server necessarily reaches the comparison too.
   */
  const payload = {
    name,
    type,
    locale: campaignLocale,
    subject,
    preheader,
    body,
    heroUrl,
    heroAlt,
    ctaLabel,
    ctaHref,
    discountCode,
  };

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    if (frozen) return true;

    setResult(null);

    const outcome = isEdit
      ? await updateCampaign({ ...payload, id: campaign.id })
      : await createCampaign(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (!outcome.ok) return false;

    markSaved();

    if (!isEdit) {
      // Straight to the campaign's own screen: the next thing the desk does is
      // preview it and send itself a test, and both live there.
      router.push(localizePath(locale, `/admin/campaigns/${outcome.slug}`));
    }

    router.refresh();
    return true;
  }

  function submit() {
    startTransition(async () => {
      await persist();
    });
  }

  const audience = campaignLocale === "ar" ? audienceAr : audienceEn;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      {frozen ? (
        <AdminNotice tone="success">
          This campaign has been sent. It is a record of what went out and can no
          longer be edited.
        </AdminNotice>
      ) : null}

      <fieldset disabled={frozen} className="space-y-8 disabled:opacity-70">
        <section className="space-y-4 md:space-y-6">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            The campaign
          </h2>

          <AdminInput
            id="name"
            label="Name"
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            hint="For the desk only. Never sent."
            required
          />

          <AdminSelect
            id="type"
            label="Type"
            value={type}
            onChange={setType}
            options={TYPES}
            error={fieldErrors.type}
          />

          <AdminSelect
            id="locale"
            label="Language"
            value={campaignLocale}
            onChange={setCampaignLocale}
            options={LANGUAGES}
            error={fieldErrors.locale}
            hint={`This letter goes to the ${
              campaignLocale === "ar" ? "Arabic" : "English"
            } list — ${audience} subscribed ${audience === 1 ? "address" : "addresses"} today.`}
          />
        </section>

        <section className="space-y-4 md:space-y-6">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            The letter
          </h2>

          <AdminInput
            id="subject"
            label="Subject"
            value={subject}
            onChange={setSubject}
            error={fieldErrors.subject}
            required
          />

          <AdminInput
            id="preheader"
            label="Preview text"
            value={preheader}
            onChange={setPreheader}
            error={fieldErrors.preheader}
            hint="The line the inbox shows beside the subject. Falls back to the subject."
          />

          <AdminTextarea
            id="body"
            label="Body"
            value={body}
            onChange={setBody}
            error={fieldErrors.body}
            hint="Plain text. Leave a blank line between paragraphs — the house styles them."
            rows={10}
            required
          />
        </section>

        <section className="space-y-4 md:space-y-6">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Image, button and voucher
          </h2>

          <AdminInput
            id="heroUrl"
            label="Hero image URL"
            value={heroUrl}
            onChange={setHeroUrl}
            error={fieldErrors.heroUrl}
            hint="Optional. An absolute https:// link — email cannot resolve a relative path."
          />

          <AdminInput
            id="heroAlt"
            label="Image description"
            value={heroAlt}
            onChange={setHeroAlt}
            error={fieldErrors.heroAlt}
            hint="Required when there is an image, and read aloud in its place."
          />

          <AdminInput
            id="ctaLabel"
            label="Button label"
            value={ctaLabel}
            onChange={setCtaLabel}
            error={fieldErrors.ctaLabel}
          />

          <AdminInput
            id="ctaHref"
            label="Button destination"
            value={ctaHref}
            onChange={setCtaHref}
            error={fieldErrors.ctaHref}
          />

          <AdminInput
            id="discountCode"
            label="Voucher code"
            value={discountCode}
            onChange={(value) => setDiscountCode(value.toUpperCase())}
            error={fieldErrors.discountCode}
            hint="Optional, and must be a code that already exists in Discounts — the letter never invents one."
          />
        </section>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        {frozen ? null : (
          <AdminButton type="submit" disabled={isPending}>
            {isPending ? "Saving" : "Save Campaign"}
          </AdminButton>
        )}

        {isEdit ? (
          <AdminButton
            variant="ghost"
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const outcome = await sendCampaignTestEmail({ id: campaign.id });
                if (outcome.ok) toast(outcome.message);
                setResult(outcome.ok ? null : outcome);
              })
            }
          >
            {isTesting ? "Sending" : "Send Me a Test"}
          </AdminButton>
        ) : null}

        {isEdit && !frozen ? (
          <AdminButton
            variant="danger"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const outcome = await deleteCampaign({ id: campaign.id });

                if (outcome.ok) {
                  toast(outcome.message);
                  router.push(localizePath(locale, "/admin/campaigns"));
                  router.refresh();
                  return;
                }

                setResult(outcome);
              })
            }
          >
            Delete
          </AdminButton>
        ) : null}
      </div>
    </form>
  );
}
