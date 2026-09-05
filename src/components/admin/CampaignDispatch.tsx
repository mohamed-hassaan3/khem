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
import LocalTimestamp from "@/src/components/admin/LocalTimestamp";
import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import {
  dispatchCadencePhrase,
  fromDateTimeLocalValue,
  localTimeZone,
  scheduleProximity,
  toDateTimeLocalValue,
} from "@/src/lib/campaign-schedule";
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
 * ## Scheduling says what it can honour, in the reader's own clock
 *
 * The field is a `datetime-local`, which is a wall-clock reading with no zone
 * attached; the column behind it is a UTC instant. Every crossing between those
 * two goes through `src/lib/campaign-schedule.ts` and none happens here — an
 * earlier version sliced the UTC string straight into the field, which showed
 * the desk a time three hours from the one they had chosen and moved it another
 * three every time they pressed Schedule again.
 *
 * The field's value is derived, not seeded, because this component renders on
 * the server too and "local" there is the host's zone rather than the reader's.
 * `useIsHydrated()` is what says the browser may now be asked. The moment is
 * then echoed back beneath the field, with its zone named, so what was stored
 * can be checked against the clock on the wall.
 *
 * What the hint does *not* say is how often the dispatch runs. That is the
 * deployment's business — a platform cron now, a server cron on another host
 * later — and a control that quoted one host's timetable would be wrong the
 * morning it moved.
 */
export default function CampaignDispatch({
  campaign,
}: {
  campaign: CampaignWithProgress;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const [armed, setArmed] = useState(false);
  /*
   * What the desk has typed, or null while the field is still showing the
   * stored moment. Deliberately not seeded from the prop: "local" is a fact
   * about the browser, and computing it during a server render would produce
   * the host's zone — a wrong time on screen and a hydration mismatch. The
   * field is derived below instead, once the browser can be asked.
   */
  const [edited, setEdited] = useState<string | null>(null);
  const [toSubscribers, setToSubscribers] = useState(campaign.toSubscribers);
  const [toCustomers, setToCustomers] = useState(campaign.toCustomers);
  const [emails, setEmails] = useState<string[]>(campaign.recipients);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const hydrated = useIsHydrated();
  const zone = hydrated ? localTimeZone() : "";

  /*
   * The stored instant, in the reader's zone — and whatever they have typed
   * since, which wins until an action clears it. Derived rather than held, so
   * the field can never drift from the row: after a schedule is set or
   * withdrawn, `run()` drops the edit and this reads the refreshed prop again.
   */
  const when =
    edited ??
    (hydrated && campaign.scheduledAt
      ? toDateTimeLocalValue(campaign.scheduledAt)
      : "");

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

  /** Nobody selected. The same condition that refuses a send refuses a queue. */
  const reachesNobody = audience.total === 0;

  /*
   * How the chosen moment sits against the floor. The server refuses the first
   * two whatever this says — this is so the desk finds out before pressing the
   * button rather than after.
   */
  const proximity = scheduleProximity(when);
  const unreachable = proximity === "past" || proximity === "too-soon";

  function run(action: () => Promise<AdminActionResult>) {
    startTransition(async () => {
      const outcome = await action();
      setArmed(false);

      if (outcome.ok) {
        toast(outcome.message);
        // The row is the truth again; the field goes back to reading it. On a
        // refusal the typed moment stays put, next to the reason it was refused.
        setEdited(null);
      }

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
              onChange={setEdited}
              hint={`Times are read in your own timezone${
                zone ? ` (${zone})` : ""
              } and stored in UTC. The dispatch runs ${dispatchCadencePhrase()}, so the campaign goes out on the first run at or after the moment you choose.`}
            />

            {/*
              * What was actually stored, said back. A schedule the desk cannot
              * see is a schedule they cannot check, and this line is the one
              * that would have made the timezone bug obvious on the first day.
              */}
            {campaign.status === "SCHEDULED" && campaign.scheduledAt ? (
              <p className="text-[12px] text-ground-accent-soft">
                Scheduled for{" "}
                <LocalTimestamp iso={campaign.scheduledAt} className="tabular-nums" />
              </p>
            ) : null}

            {proximity === "past" ? (
              <AdminNotice tone="error">
                That moment has already passed. Choose a later one, or send it now.
              </AdminNotice>
            ) : null}

            {proximity === "too-soon" ? (
              <AdminNotice tone="error">
                That is too close to now to be relied on. Choose a moment at least
                five minutes ahead, or send it now.
              </AdminNotice>
            ) : null}

            {proximity === "soon" ? (
              <AdminNotice tone="warning">
                That is close to now. The dispatch runs {dispatchCadencePhrase()},
                so a campaign this near may go out a few minutes after the moment
                you chose — press Send Campaign if it has to go immediately.
              </AdminNotice>
            ) : null}

            {reachesNobody ? (
              <AdminNotice tone="error">
                This campaign would reach nobody. Choose an audience, or add an
                address above, before scheduling it.
              </AdminNotice>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <AdminButton
                variant="ghost"
                disabled={
                  isPending || when === "" || unsaved || unreachable || reachesNobody
                }
                onClick={() => {
                  const scheduledAt = fromDateTimeLocalValue(when);
                  if (!scheduledAt) return;

                  run(() => scheduleCampaign({ id: campaign.id, scheduledAt }));
                }}
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
