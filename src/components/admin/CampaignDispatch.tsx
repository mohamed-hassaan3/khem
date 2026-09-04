"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  scheduleCampaign,
  sendCampaignNow,
  setCampaignAudience,
  setCampaignRecipients,
  unscheduleCampaign,
} from "@/src/actions/admin/campaigns";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminStringList,
  AdminToggle,
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
 * ## Two ways to choose who, and they do not overlap
 *
 * **Audience** draws from the house's stored lists: the Inner Circle in this
 * campaign's language, and — only if selected — customers who ticked the
 * marketing box. **Named addresses** are the ones somebody types here, and they
 * are added to whatever the audience selects rather than replacing it, which is
 * why a campaign meant only for a handful of addresses has both switches off.
 *
 * ## Every number on this screen comes from the database
 *
 * The breakdown is `campaign_audience_breakdown()`, counting the very rows the
 * claim will insert. Nothing here adds up an audience in the browser — the sum
 * of the three sources is *not* the total, because an address that is both a
 * subscriber and a consenting customer receives one letter, and only the
 * database knows which addresses those are.
 *
 * That is also why the send button refuses while there is an unsaved change to
 * the selection: the figure on screen would describe the audience as it was
 * before the edit, and a confirmation showing a number that is no longer true is
 * worse than no confirmation at all.
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
  const [toSubscribers, setToSubscribers] = useState(campaign.toSubscribers);
  const [toCustomers, setToCustomers] = useState(campaign.toCustomers);
  const [emails, setEmails] = useState<string[]>(campaign.recipients);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const outstanding = campaign.claimed - campaign.delivered;
  const sending = campaign.status === "SENDING";
  const finished = campaign.status === "SENT";
  const { audience } = campaign;

  /** Rows the editor left blank are a spare row, not an address. */
  const typed = useMemo(
    () => emails.map((email) => email.trim()).filter((email) => email !== ""),
    [emails],
  );

  const audienceChanged =
    toSubscribers !== campaign.toSubscribers ||
    toCustomers !== campaign.toCustomers;

  const recipientsChanged =
    typed.length !== campaign.recipients.length ||
    typed.some((email, index) => email.toLowerCase() !== campaign.recipients[index]);

  const unsaved = audienceChanged || recipientsChanged;

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

  const listName = campaign.locale === "ar" ? "Arabic" : "English";

  return (
    <div className="space-y-6">
      {sending ? null : (
        <>
          <section className="space-y-4 border border-ground-border bg-stone/60 px-6 py-6">
            <div>
              <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
                Audience
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
                The house&rsquo;s stored lists. The second is everyone who has
                ordered and left an address. Anybody who has unsubscribed is
                left out of both, permanently and from every source &mdash;
                including an address typed by hand below.
              </p>
            </div>

            <AdminToggle
              id="toSubscribers"
              label="Subscribers"
              description={`The Inner Circle on the ${listName} list — ${audience.subscribers} ${
                audience.subscribers === 1 ? "address" : "addresses"
              } as selected.`}
              checked={toSubscribers}
              onChange={setToSubscribers}
            />

            <AdminToggle
              id="toCustomers"
              label="Customers"
              description={`Everyone who has ordered and left an address — ${audience.customers} ${
                audience.customers === 1 ? "address" : "addresses"
              } not already counted above.`}
              checked={toCustomers}
              onChange={setToCustomers}
            />

            {audienceChanged ? (
              <AdminButton
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    setCampaignAudience({
                      id: campaign.id,
                      toSubscribers,
                      toCustomers,
                    }),
                  )
                }
              >
                {isPending ? "Saving" : "Save audience"}
              </AdminButton>
            ) : null}
          </section>

          <section className="space-y-4 border border-ground-border bg-stone/60 px-6 py-6">
            <div>
              <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
                Named addresses
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
                Addresses to include by hand. They are added to whatever the
                audience above selects — for a campaign meant only for these
                people, switch both of those off.
              </p>
            </div>

            <AdminStringList
              label="Email address"
              values={emails}
              onChange={setEmails}
              addLabel="Add another email"
              placeholder="name@example.com"
              error={result && !result.ok ? result.fieldErrors?.emails : undefined}
              hint="Each address receives one letter. An address that is already a subscriber or a customer is still written to only once."
            />

            {recipientsChanged ? (
              <AdminButton
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    setCampaignRecipients({ id: campaign.id, emails: typed }),
                  )
                }
              >
                {isPending
                  ? "Saving"
                  : typed.length === 0
                    ? "Clear addresses"
                    : `Save ${typed.length} address${typed.length === 1 ? "" : "es"}`}
              </AdminButton>
            ) : null}
          </section>
        </>
      )}

      <section className="space-y-5 border border-ground-border bg-stone/60 px-6 py-6">
        <div>
          <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
            Sending
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ground-muted">
            {sending
              ? `Under way — ${campaign.delivered} of ${campaign.claimed} sent, ${outstanding} to go. The next run continues automatically.`
              : `This will write to ${audience.total} ${
                  audience.total === 1 ? "address" : "addresses"
                }. It cannot be undone.`}
          </p>
        </div>

        {result ? <AdminNotice tone="error">{result.message}</AdminNotice> : null}

        {!sending && unsaved ? (
          <AdminNotice tone="error">
            Save the change above before sending — the figures here describe the
            audience as it was saved.
          </AdminNotice>
        ) : null}

        {/*
          The confirmation. It states where the audience came from and, on its
          own line, the number of letters — which is smaller than the sum
          whenever somebody is on two of the lists.
        */}
        {armed && !sending ? (
          <div className="space-y-2 border border-gold/30 bg-gold/5 px-5 py-4">
            <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              {campaign.name}
            </p>

            <dl className="space-y-1 text-[12px] text-ground-muted">
              {audience.subscribers > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>Subscribers</dt>
                  <dd className="tabular-nums">{audience.subscribers}</dd>
                </div>
              ) : null}
              {audience.customers > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>Customers</dt>
                  <dd className="tabular-nums">{audience.customers}</dd>
                </div>
              ) : null}
              {audience.specific > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>Named addresses</dt>
                  <dd className="tabular-nums">{audience.specific}</dd>
                </div>
              ) : null}

              <div className="flex justify-between gap-4 border-t border-gold/20 pt-2 font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
                <dt>Total unique recipients</dt>
                <dd className="tabular-nums">{audience.total}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {armed ? (
            <>
              <AdminButton
                variant="danger"
                disabled={isPending}
                onClick={() => run(() => sendCampaignNow({ id: campaign.id }))}
              >
                {isPending ? "Sending" : `Confirm — send to ${audience.total}`}
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
              disabled={isPending || unsaved || (!sending && audience.total === 0)}
              onClick={() => (sending ? run(() => sendCampaignNow({ id: campaign.id })) : setArmed(true))}
            >
              {sending ? "Continue Sending" : "Send Campaign"}
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
                disabled={isPending || when === "" || unsaved}
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
    </div>
  );
}
