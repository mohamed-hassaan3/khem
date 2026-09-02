"use client";

/**
 * The `"BoutiqueSetting"` singleton: three addresses and the featured fragrance.
 *
 * ## Why the addresses are the serious field on this screen
 *
 * `inboxAddress()` sends the contact form to whatever `houseEmail` holds. A
 * typo here is not a cosmetic error — it is an enquiry that vanishes, and
 * nobody finds out, which is exactly the failure `src/services/settings.ts`
 * keeps a hard-coded fallback for. They are validated as real addresses in
 * `schemas/settings.ts` and typed as `email` inputs here so a phone keyboard
 * offers the right keys.
 *
 * ## The featured fragrance is a select, not a text field
 *
 * The column carries a foreign key to `"Product"(slug)`, so a typed slug would
 * be refused by the database — correct, but a poor way to find out. Choosing
 * from the live catalog cannot produce a slug that does not exist.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateBoutiqueSettings } from "@/src/actions/admin/settings";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { BoutiqueSetting } from "@/src/schemas/db/directory";

export interface FeaturedOption {
  slug: string;
  name: string;
}

export default function HouseSettingsForm({
  settings,
}: {
  /** `null` when the row is missing — see `getAdminSettings()`. */
  settings: BoutiqueSetting | null;
  /** Live products, for the featured picker. */
}) {
  const router = useRouter();

  const [houseEmail, setHouseEmail] = useState(settings?.houseEmail ?? "");
  const [conciergeEmail, setConciergeEmail] = useState(
    settings?.conciergeEmail ?? "",
  );
  const [wholesaleEmail, setWholesaleEmail] = useState(
    settings?.wholesaleEmail ?? "",
  );


  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted: this
   * one object is both what the action receives and what `useUnsavedGuard`
   * watches, so a field that reaches the server necessarily reaches the
   * comparison too.
   */
  const payload = {
    houseEmail,
    conciergeEmail,
    wholesaleEmail,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await updateBoutiqueSettings(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (!outcome.ok) return false;

    // The form now matches the row, so leaving it is no longer losing anything.
    markSaved();
    router.refresh();
    return true;
  }

  function submit() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately — the save button
     * would stop saying "Saving" the instant it was pressed.
     */
    startTransition(async () => {
      await persist();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-6"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      {settings === null ? (
        <AdminNotice tone="error">
          The settings row could not be read. Saving will not create one — run
          `npm run db:seed` first.
        </AdminNotice>
      ) : null}

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id="houseEmail"
          type="email"
          label="House email"
          value={houseEmail}
          onChange={setHouseEmail}
          error={fieldErrors.houseEmail}
          hint="Where the contact form and Inner Circle signups arrive."
        />
        <AdminInput
          id="conciergeEmail"
          type="email"
          label="Concierge email"
          value={conciergeEmail}
          onChange={setConciergeEmail}
          error={fieldErrors.conciergeEmail}
          hint="Quoted for personal fragrance consultations."
        />
        <AdminInput
          id="wholesaleEmail"
          type="email"
          label="Wholesale email"
          value={wholesaleEmail}
          onChange={setWholesaleEmail}
          error={fieldErrors.wholesaleEmail}
          hint="Printed on /stockists for partnership enquiries."
        />

      </div>

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Saving" : "Save settings"}
      </AdminButton>
    </form>
  );
}
