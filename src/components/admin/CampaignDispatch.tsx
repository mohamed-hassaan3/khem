"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  scheduleCampaign,
  sendCampaignNow,
  unscheduleCampaign,
} from "@/src/actions/admin/campaigns";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
} from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { CampaignWithProgress } from "@/src/types/campaign";

/**
 * Sending, and the only irreversible control in this dashboard.
 *
 * ## Why "Send now" asks twice
 *
 * Everywhere else here, a mis-click is an edit somebody undoes. This one puts a
 * letter in thousands of inboxes and cannot be taken back — so the button arms
 * itself first, and the armed state states the number it is about to write to.
 * A confirmation that says "are you sure?" teaches nothing; one that says "this
 * sends to 412 addresses" is a fact somebody can check against what they meant.
 *
 * The server is not relying on any of this. `dispatchCampaign()` claims the
 * audience under a row lock, so a double press claims nothing the second time
 * and sends nothing. The arming is for the person, not for the system.
 *
 * ## Scheduling says what it can honour
 *
 * The dispatch runs once a day. A campaign scheduled for a named hour goes at
 * the next run after it, and the hint says so — a control that implied
 * minute-precision would break that promise every time it was used.
 */
export default function CampaignDispatch({
  campaign,
}: {
  campaign: CampaignWithProgress;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const [armed, setArmed] = useState(false);
  const [when, setWhen] = useState(
    campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : "",
  );
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const outstanding = campaign.claimed - campaign.delivered;
  const sending = campaign.status === "SENDING";
  const finished = campaign.status === "SENT";

  function run(action: () => Promise<AdminActionResult>) {
    startTransition(async () => {
      const outcome = await action();
      setArmed(false);

      if (outcome.ok) toast(outcome.message);
      setResult(outcome.ok ? null : outcome);

      router.refresh();
    });
  }

  if (finished) {
    return (
      <section className="border border-gold/20 bg-gold/5 px-6 py-5">
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          Sent
        </p>
        <p className="mt-2 text-[12px] text-ground-muted">
          {campaign.delivered} of {campaign.claimed} letters were accepted by the
          mail provider.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 border border-ground-border bg-stone/60 px-6 py-6">
      <div>
        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          Sending
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
          {sending
            ? `Under way — ${campaign.delivered} of ${campaign.claimed} sent, ${outstanding} to go. The next run continues automatically.`
            : `This will write to ${campaign.audienceNow} subscribed ${
                campaign.audienceNow === 1 ? "address" : "addresses"
              } on the ${campaign.locale === "ar" ? "Arabic" : "English"} list. It cannot be undone.`}
        </p>
      </div>

      {result ? <AdminNotice tone="error">{result.message}</AdminNotice> : null}

      <div className="flex flex-wrap items-center gap-3">
        {armed ? (
          <>
            <AdminButton
              variant="danger"
              disabled={isPending}
              onClick={() => run(() => sendCampaignNow({ id: campaign.id }))}
            >
              {isPending
                ? "Sending"
                : `Yes — send to ${campaign.audienceNow}`}
            </AdminButton>

            <AdminButton
              variant="ghost"
              disabled={isPending}
              onClick={() => setArmed(false)}
            >
              Cancel
            </AdminButton>
          </>
        ) : (
          <AdminButton
            disabled={isPending || campaign.audienceNow === 0}
            onClick={() => setArmed(true)}
          >
            {sending ? "Continue Sending" : "Send Now"}
          </AdminButton>
        )}
      </div>

      {sending ? null : (
        <div className="space-y-3 border-t border-ground-border pt-5">
          <AdminInput
            id="scheduledAt"
            label="Or schedule it"
            type="datetime-local"
            value={when}
            onChange={setWhen}
            hint="The dispatch runs once a day, so a campaign goes out at the first run after the time you choose."
          />

          <div className="flex flex-wrap gap-3">
            <AdminButton
              variant="ghost"
              disabled={isPending || when === ""}
              onClick={() =>
                run(() =>
                  scheduleCampaign({
                    id: campaign.id,
                    scheduledAt: new Date(when).toISOString(),
                  }),
                )
              }
            >
              Schedule
            </AdminButton>

            {campaign.status === "SCHEDULED" ? (
              <AdminButton
                variant="ghost"
                disabled={isPending}
                onClick={() => run(() => unscheduleCampaign({ id: campaign.id }))}
              >
                Withdraw Schedule
              </AdminButton>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
