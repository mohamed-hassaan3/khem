/**
 * Send whatever is due.
 *
 * Two kinds of work: campaigns whose scheduled moment has passed, and campaigns
 * already sending that a previous run did not finish. `due_campaigns()` returns
 * both, which is what makes a bounded run safe — a list larger than one
 * invocation can carry is simply picked up by the next.
 *
 * ## Two triggers, and neither of them is in this repository
 *
 * **An external scheduler (cron-job.org) calls this endpoint every few minutes**
 * with the bearer token below. That is what makes a scheduled campaign go out
 * near the moment it was set for. `vercel.json` also runs it once a day at
 * 10:00 UTC, kept as a backstop for the day the external service is down or its
 * account lapses.
 *
 * Both may fire at once; that is safe, and deliberately so. The run lease in
 * `0057_campaign_dispatch_lease.sql` means the second caller stands down rather
 * than sending beside the first. **Do not add a faster trigger without checking
 * that lease is still applied.**
 *
 * ### The dependency this creates
 *
 * A third party now holds a copy of `CRON_SECRET`. Two consequences worth
 * knowing before debugging this at speed:
 *
 *  - **Rotating `CRON_SECRET` silently stops scheduled campaigns.** The
 *    external caller starts receiving 401s, this endpoint does exactly what it
 *    should, and nothing anywhere says a campaign is late. Rotate the value in
 *    both places or not at all.
 *  - The daily Vercel cron would still run, so the symptom is not "campaigns
 *    stopped" but "campaigns are hours late again" — the failure this
 *    scheduling work was undertaken to fix, wearing a different hat.
 *
 * `src/lib/campaign-schedule.ts` holds `DISPATCH_INTERVAL_MINUTES`, which is
 * what the dashboard promises the desk. It is a claim about the external
 * schedule, so the two have to be changed together.
 *
 * ## Authentication
 *
 * A bearer token compared in constant time, exactly as its three neighbours.
 * Without the guard, anyone on the internet could make the house mail its entire
 * list — which is the single most damaging unauthenticated action this
 * application could offer.
 *
 * ## Logging
 *
 * Campaign ids and counts. Never an address, and never an unsubscribe token.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  dispatchCampaign,
  dueCampaignIds,
} from "@/src/services/admin/campaign-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time comparison. See `sweep-unpaid-orders` for why. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured; no campaigns sent");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const provided = request.headers.get("authorization") ?? "";
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : "";

  if (!tokenMatches(token, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ids = await dueCampaignIds();
  if (ids.length === 0) return NextResponse.json({ dispatched: 0 });

  const results = [];

  // Serial, deliberately: each dispatch sends up to a thousand letters, and
  // running several at once would collide with the provider's rate limit and
  // with this function's own wall clock.
  for (const id of ids) {
    results.push(await dispatchCampaign(id));
  }

  const sent = results.reduce((total, result) => total + result.sent, 0);
  const failed = results.reduce((total, result) => total + result.failed, 0);

  /*
   * A refusal is not a quiet no-op. The commonest one is a campaign whose
   * audience emptied between being scheduled and being due — `0056` leaves it
   * queued rather than filing it as sent, which is right, but it means the run
   * will meet it again next time. Saying so is what turns a silent loop into
   * something the desk can act on. Ids and reasons; never an address.
   *
   * Standing down for another run is not a refusal and is not warned about: on
   * a scheduler that fires faster than a campaign finishes, that is the lease
   * doing its job, several times an hour, for as long as a large send takes.
   */
  for (const result of results) {
    if (!result.reason) continue;

    if (result.skipped) {
      console.info(`[cron] campaign ${result.campaignId} skipped: ${result.reason}`);
    } else {
      console.warn(`[cron] campaign ${result.campaignId} not sent: ${result.reason}`);
    }
  }

  // Skipped runs are not dispatches. Counting them as such would report work
  // that another invocation is doing, once per tick, for the length of a send.
  const dispatched = results.filter((result) => !result.skipped).length;

  console.info(
    `[cron] campaigns: ${dispatched} dispatched, ${sent} sent, ${failed} failed`,
  );

  return NextResponse.json({ dispatched, sent, failed });
}
