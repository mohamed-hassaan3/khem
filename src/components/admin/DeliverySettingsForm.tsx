"use client";

/**
 * What delivery costs, per order channel.
 *
 * ## Why two forms and not one
 *
 * Each channel is its own row and its own save. A single form writing both would
 * make "change the online fee" a request that can half-fail — one row updated,
 * the other refused — and leave the screen unable to say which. Two forms, two
 * writes, two receipts.
 *
 * ## Why the figures are typed in pounds
 *
 * Everything downstream is piastres, but nobody types 9000 meaning ninety
 * pounds. The conversion happens once, in `schemas/settings.ts`, exactly as it
 * does for a product's price — this component never multiplies by 100, which is
 * what keeps the figure saved identical to the figure typed.
 *
 * ## The minimum is the promise the storefront prints
 *
 * `dict.product.trust.delivery` reads "On all orders over {amount}", and the
 * amount is this field. It is not marketing copy that happens to agree with the
 * checkout — it is the same number, so the badge cannot promise something the
 * total then contradicts.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateDeliverySetting } from "@/src/actions/admin/settings";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type {
  DeliveryChannel,
  DeliverySetting,
} from "@/src/schemas/db/delivery";

const CHANNEL_COPY: Record<
  DeliveryChannel,
  { title: string; description: string }
> = {
  ONLINE: {
    title: "Online",
    description:
      "What the website quotes in the bag and charges at checkout, and the figure the “Complimentary Delivery” badge promises on every product page.",
  },
  OFFLINE: {
    title: "Offline",
    description:
      "The walk-in desk. These figures fill in the Delivery field on a new order — typing over it still wins, because a delivery arranged at the counter is often not the standard one.",
  },
};

/** Piastres back to the pounds the input shows. */
function toEgpString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function ChannelForm({ setting }: { setting: DeliverySetting }) {
  const router = useRouter();
  const copy = CHANNEL_COPY[setting.channel];

  const [feeInCents, setFee] = useState(toEgpString(setting.feeInCents));
  const [freeThresholdInCents, setThreshold] = useState(
    toEgpString(setting.freeThresholdInCents),
  );

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted: this one
   * object is both what the action receives and what `useUnsavedGuard` watches,
   * so a field that reaches the server necessarily reaches the comparison too.
   */
  const payload = {
    channel: setting.channel,
    feeInCents,
    freeThresholdInCents,
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

    const outcome = await updateDeliverySetting(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (!outcome.ok) return false;

    markSaved();
    router.refresh();
    return true;
  }

  function submit() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately.
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
      className="max-w-3xl space-y-5 border-t border-ground-border pt-6 first:border-t-0 first:pt-0"
    >
      <div>
        <h3 className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground">
          {copy.title}
        </h3>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
          {copy.description}
        </p>
      </div>

      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id={`fee-${setting.channel}`}
          label="Delivery fee (EGP)"
          type="number"
          step="0.01"
          min={0}
          value={feeInCents}
          onChange={setFee}
          error={fieldErrors.feeInCents}
          hint="Charged on every order below the minimum. Zero means delivery is always complimentary on this channel."
        />

        <AdminInput
          id={`threshold-${setting.channel}`}
          label="Minimum order for free delivery (EGP)"
          type="number"
          step="0.01"
          min={0}
          value={freeThresholdInCents}
          onChange={setThreshold}
          error={fieldErrors.freeThresholdInCents}
          hint="At or above this subtotal, delivery is complimentary. Zero means every order qualifies and the fee above is never charged."
        />
      </div>

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Saving" : `Save ${copy.title.toLowerCase()} terms`}
      </AdminButton>
    </form>
  );
}

export default function DeliverySettingsForm({
  settings,
}: {
  /** Both rows; empty when they could not be read — see `listDeliverySettings()`. */
  settings: readonly DeliverySetting[];
}) {
  if (settings.length === 0) {
    return (
      <AdminNotice tone="error">
        The delivery terms could not be read, so they cannot be edited here. The
        storefront is quoting the fallback figures in <code>src/lib/cart.ts</code>{" "}
        — run <code>npm run db:migrate</code>, then reload.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-8">
      {settings.map((setting) => (
        <ChannelForm key={setting.channel} setting={setting} />
      ))}
    </div>
  );
}
