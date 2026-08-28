"use client";

/**
 * Create or edit one line of the announcement bar.
 *
 * ## Both languages, side by side
 *
 * The Arabic field sits beside its English twin rather than behind a tab: an
 * announcement is one short sentence, and a translator who cannot see the
 * original while typing is translating from memory. Leaving it empty is a
 * legitimate answer — `resolveText()` falls back to English rather than printing
 * an empty bar (`src/lib/i18n/resolve.ts`).
 *
 * ## The link is a path, not a URL
 *
 * The field refuses anything that is not a path on this site. That value is
 * rendered into an anchor in the header of every page, so an off-site host or a
 * `javascript:` target would be a stored redirect on the most trusted surface
 * the site has. The schema, the row mapper and a check constraint all say the
 * same thing.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/src/actions/admin/marketing";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminAnnouncement } from "@/src/types/marketing";

/** `datetime-local` wants `YYYY-MM-DDTHH:mm`; the column is a timestamptz. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AnnouncementForm({
  announcement,
  locale,
}: {
  /** `null` when creating. */
  announcement: AdminAnnouncement | null;
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = announcement !== null;

  const [message, setMessage] = useState(announcement?.message ?? "");
  const [messageAr, setMessageAr] = useState(announcement?.messageAr ?? "");
  const [href, setHref] = useState(announcement?.href ?? "");
  const [ctaLabel, setCtaLabel] = useState(announcement?.ctaLabel ?? "");
  const [ctaLabelAr, setCtaLabelAr] = useState(announcement?.ctaLabelAr ?? "");
  const [isActive, setIsActive] = useState(announcement?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(announcement?.sortOrder ?? 0));
  const [startsAt, setStartsAt] = useState(
    toLocalInput(announcement?.startsAt ?? null),
  );
  const [endsAt, setEndsAt] = useState(toLocalInput(announcement?.endsAt ?? null));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /* Hoisted so it is both what the action receives and what the guard watches —
     a field that reaches the server necessarily reaches the comparison. */
  const payload = {
    id: announcement?.id ?? "",
    message,
    messageAr,
    href,
    ctaLabel,
    ctaLabelAr,
    isActive,
    sortOrder,
    // A `datetime-local` value has no zone; the browser's offset is applied here
    // so the stored instant is the one the editor meant.
    startsAt: startsAt ? new Date(startsAt).toISOString() : "",
    endsAt: endsAt ? new Date(endsAt).toISOString() : "",
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit
      ? await updateAnnouncement(payload)
      : await createAnnouncement(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      router.push(localizePath(locale, `/admin/announcements/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
      router.refresh();
    }

    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function submit() {
    startTransition(async () => {
      await persist();
    });
  }

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deleteAnnouncement({ id: announcement.id });

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/announcements"));
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

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

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          The message
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="message"
            label="Message — English"
            value={message}
            onChange={setMessage}
            error={fieldErrors.message}
            required
            hint="One line. The bar never wraps, so keep it short enough to read on a phone."
          />
          <AdminInput
            id="messageAr"
            label="Message — Arabic"
            value={messageAr}
            onChange={setMessageAr}
            error={fieldErrors.messageAr}
            hint="Leave empty to print the English line on the Arabic site."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Where it leads
        </h2>

        <AdminInput
          id="href"
          label="Link"
          value={href}
          onChange={setHref}
          error={fieldErrors.href}
          placeholder="/collections/noir"
          hint="A path on this site, starting with a slash. Leave empty for a message that is not a link."
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="ctaLabel"
            label="Call to action — English"
            value={ctaLabel}
            onChange={setCtaLabel}
            error={fieldErrors.ctaLabel}
            hint="Optional. Printed after the message, underlined in gold."
          />
          <AdminInput
            id="ctaLabelAr"
            label="Call to action — Arabic"
            value={ctaLabelAr}
            onChange={setCtaLabelAr}
            error={fieldErrors.ctaLabelAr}
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          When it shows
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="startsAt"
            type="datetime-local"
            label="Starts"
            value={startsAt}
            onChange={setStartsAt}
            error={fieldErrors.startsAt}
            hint="Leave empty to start immediately."
          />
          <AdminInput
            id="endsAt"
            type="datetime-local"
            label="Ends"
            value={endsAt}
            onChange={setEndsAt}
            error={fieldErrors.endsAt}
            hint="Leave empty for no end. Outside its window an announcement stops showing on its own."
          />
          <AdminInput
            id="sortOrder"
            type="number"
            label="Order"
            value={sortOrder}
            onChange={setSortOrder}
            error={fieldErrors.sortOrder}
            hint="Lower shows first. This is also the priority — in Static mode only the first live announcement is printed."
          />
        </div>

        <AdminToggle
          id="isActive"
          label="Showing"
          description="Switching this off hides the line without deleting it or touching its schedule."
          checked={isActive}
          onChange={setIsActive}
        />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save announcement" : "Create announcement"}
        </AdminButton>

        {isEdit ? (
          <AdminButton
            variant={armed ? "danger" : "ghost"}
            disabled={isPending}
            onClick={() => (armed ? remove() : setArmed(true))}
          >
            {armed ? "Confirm — delete permanently" : "Delete"}
          </AdminButton>
        ) : null}
      </div>

      {armed ? (
        <p className="text-[11px] leading-relaxed text-ivory/35">
          Deleting removes the line for good. To take it off the bar and keep the
          wording, switch off &ldquo;Showing&rdquo; instead.
        </p>
      ) : null}
    </form>
  );
}
