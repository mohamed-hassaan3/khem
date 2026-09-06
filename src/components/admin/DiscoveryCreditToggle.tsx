"use client";

/**
 * The permanent Discovery Credit switch.
 *
 * Deliberately the simplest control in the dashboard: no dates, no audience, no
 * targeting. The credit is a conversion mechanism the house either runs or does
 * not, and giving it a campaign's shape would invite it to be scheduled, which
 * is not what it is.
 *
 * ## What the copy has to say, and why
 *
 * Switching this off does **three** things and leaves a fourth alone, and an
 * editor who does not know the fourth will assume the worst:
 *
 *   · new Discovery Set purchases stop earning a credit;
 *   · every customer-facing mention disappears — the banner line, the set page,
 *     the "Unlock Your Credit" step, the comparison row;
 *   · nothing is deleted;
 *   · **credits already held stay valid and can still be spent.**
 *
 * That last one is the whole reason this panel carries a paragraph instead of
 * just a switch. A credit is a promise the house has already made, and an editor
 * needs to know that flipping this does not withdraw it.
 */

import { useState, useTransition } from "react";

import { setDiscoveryCreditEnabled } from "@/src/actions/admin/benefits";
import { AdminNotice, AdminToggle } from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";

export default function DiscoveryCreditToggle({
  enabled: initial,
}: {
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { toast } = useAdminToast();

  return (
    <div className="max-w-3xl space-y-4 border border-ground-border px-5 py-5">
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}

      <AdminToggle
        id="discoveryCreditEnabled"
        label="Discovery Credit"
        description="On, a paid Discovery Set earns a credit worth what was paid for it, redeemable against one full-size fragrance within sixty days of delivery. Off, new purchases earn nothing and every mention of the benefit disappears from the storefront — but credits already held stay valid and can still be spent."
        checked={enabled}
        disabled={isPending}
        onChange={(next) => {
          // Optimistic, then corrected: the switch is the whole control, and a
          // toggle that does not move until a round trip returns reads as
          // broken.
          setEnabled(next);
          setError(null);

          startTransition(async () => {
            const outcome = await setDiscoveryCreditEnabled(next);

            if (outcome.ok) {
              toast(outcome.message);
              return;
            }

            setEnabled(!next);
            setError(outcome.message);
          });
        }}
      />
    </div>
  );
}
