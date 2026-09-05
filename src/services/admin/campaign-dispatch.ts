import "server-only";

/**
 * Sending a campaign to the list.
 *
 * The one piece of this codebase whose mistakes reach every customer at once, so
 * the shape is worth stating plainly before the code:
 *
 *   1. **Claim** the whole audience in one transaction — `begin_campaign_dispatch()`.
 *   2. **Compose and send** in batches of a hundred, each with an idempotency key.
 *   3. **Record** what the provider took, and what it refused.
 *   4. **Finish**, when nothing is outstanding.
 *
 * Every failure mode this has costs somebody a letter they never receive; none
 * of them sends one twice. That is the trade, and it is the only sensible one:
 * an unsent address still has no `sentAt` stamp and is picked up by the next
 * run, while a letter that went twice cannot be recalled.
 *
 * ## Four defences against a duplicate, not one
 *
 *  - the **run lease** on the campaign row, so two invocations cannot be in the
 *    send loop at the same time — the one the others could not provide, because
 *    they all guard the claim and none of them guarded the sending;
 *  - the `for update` lock in `begin_campaign_dispatch()`, so two dispatches
 *    cannot both claim;
 *  - the `campaign_sends` primary key, so a claim that somehow ran twice writes
 *    no second row;
 *  - `idempotencyKey` per batch, so even a retry that reached Resend with the
 *    same hundred letters is collapsed at their end.
 *
 * ## Bounded per invocation
 *
 * A serverless function has a wall clock. This sends at most `MAX_BATCHES`
 * batches and returns; the campaign stays SENDING and the next run continues.
 * `finish_campaign()` decides it is done by looking for outstanding rows, never
 * by trusting what one run thought it had achieved.
 *
 * ## Privacy
 *
 * `next_campaign_batch()` returns addresses and unsubscribe tokens because a
 * letter cannot be composed without them. **Neither is ever logged.** A token in
 * a log is a credential in a log — anyone holding it can unsubscribe that
 * person. Counts and campaign ids only.
 *
 * ## Three audiences, one letter each
 *
 * A recipient may be a subscriber, a consenting customer, or an address
 * somebody typed. Nothing in this file knows the difference: the claim in
 * `begin_campaign_dispatch()` unions the three and the address is the primary
 * key, so an address on two lists is already one row by the time anything here
 * reads it. The unsubscribe token now belongs to the **send row** rather than to
 * a subscriber, which is what lets a customer's letter carry a working link
 * without enrolling them in a list they never joined.
 */

import { randomUUID } from "node:crypto";

import { campaignEmail } from "@/src/lib/email/campaign-template";
import { getEmailClient } from "@/src/lib/email/client";
import { houseFromAddress, inboxAddress } from "@/src/lib/email/addresses";
import { unsubscribeUrlFor } from "@/src/lib/email/send-campaign-mail";
import type { Locale } from "@/src/lib/i18n/config";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { CAMPAIGN_COLUMNS, toCampaign } from "@/src/schemas/db/campaigns";
import { getSocialProfiles } from "@/src/services/contact";
import type { Campaign, CampaignRecipientKind } from "@/src/types/campaign";

/** Resend's documented ceiling for one batch call. */
const CHUNK_SIZE = 100;

/** How many batches one invocation may send before leaving the rest. */
const MAX_BATCHES = 10;

/**
 * How long one run holds the campaign, in seconds.
 *
 * Must comfortably outlast the longest run the host permits: a lease that
 * lapses while letters are still going out puts a second run beside the first,
 * which is the overlap it exists to prevent. Fifteen minutes against a run
 * bounded at `MAX_BATCHES` batches and a five-minute function ceiling — raise
 * it if either of those rises. See `supabase/sql/0057_campaign_dispatch_lease.sql`.
 */
const LEASE_SECONDS = 900;

/** One claimed recipient, as the batch query returns them. */
interface Recipient {
  email: string;
  /** This send row's own unsubscribe token. Never logged. */
  token: string;
  kind: CampaignRecipientKind;
}

export interface DispatchResult {
  campaignId: string;
  claimed: number;
  sent: number;
  failed: number;
  /** True when nothing is outstanding and the campaign is now SENT. */
  finished: boolean;
  reason?: string;
  /**
   * True when another run holds the lease and this one stood down.
   *
   * Not a failure, and not logged as one: the work is being done by somebody
   * else. It is distinguished from a refusal so that a scheduler firing faster
   * than a run completes does not fill the logs with warnings about the system
   * behaving exactly as designed.
   */
  skipped?: boolean;
}

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function readCampaign(
  supabase: Supabase,
  id: string,
): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  return error ? null : toCampaign(data);
}

async function nextChunk(
  supabase: Supabase,
  id: string,
): Promise<Recipient[]> {
  const { data, error } = await supabase.rpc("next_campaign_batch", {
    campaign_id: id,
    chunk_size: CHUNK_SIZE,
  });

  if (error) {
    console.error(`[campaign] chunk read failed for ${id}: ${error.message}`);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data.flatMap((row: unknown) => {
    const entry = row as Partial<Recipient>;
    return typeof entry.email === "string" && typeof entry.token === "string"
      ? [
          {
            email: entry.email,
            token: entry.token,
            kind: (entry.kind ?? "SUBSCRIBER") as CampaignRecipientKind,
          },
        ]
      : [];
  });
}

/** Whether a `{ ok, … }` jsonb result from the dispatch functions said yes. */
function saidOk(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok: unknown }).ok === true
  );
}

/** The `reason` such a result carried, or the caller's own wording. */
function saidWhy(value: unknown, fallback: string): string {
  return typeof value === "object" && value !== null && "reason" in value
    ? String((value as { reason: unknown }).reason)
    : fallback;
}

/**
 * Send one campaign, as far as one invocation can take it.
 *
 * ## One run at a time, and why that needs saying
 *
 * Calling this twice *in sequence* has always been safe: the claim is
 * idempotent and a recipient already stamped is not in the next batch. Calling
 * it twice *at once* was not. The row lock inside `begin_campaign_dispatch()`
 * ends with its own statement, so a second invocation arriving while the
 * campaign is already SENDING was handed the outstanding count and walked into
 * the send loop beside the first — and `next_campaign_batch()` reserves nothing,
 * so both read the same unstamped rows and both wrote to them.
 *
 * A daily trigger made that improbable. A trigger that fires faster than a run
 * finishes makes it routine, because any campaign past `MAX_BATCHES × 100`
 * recipients spans runs by design.
 *
 * So the run takes a **lease** first — a holder and an expiry on the campaign
 * row, written under that same lock, which is what makes taking it atomic even
 * though holding it spans several transactions. A second run finds the lease
 * live and declines, quietly and successfully: the run that holds it is already
 * doing the work, and the next trigger will find whatever is left.
 *
 * The lease is handed back in a `finally`, so an exception cannot leave a
 * campaign unsendable until the expiry. A process killed outright still can —
 * and that is the intended trade, because a campaign an hour late is
 * recoverable and a letter sent twice is not.
 */
export async function dispatchCampaign(id: string): Promise<DispatchResult> {
  const empty: DispatchResult = {
    campaignId: id,
    claimed: 0,
    sent: 0,
    failed: 0,
    finished: false,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ...empty, reason: "Database unavailable." };

  const resend = getEmailClient();
  if (!resend) return { ...empty, reason: "Mail is not configured." };

  const campaign = await readCampaign(supabase, id);
  if (!campaign) return { ...empty, reason: "No such campaign." };

  // 0. The lease. Nothing below this line runs in two places at once.
  const leaseId = randomUUID();

  const { data: lease, error: leaseError } = await supabase.rpc(
    "acquire_campaign_dispatch",
    { campaign_id: id, lease_id: leaseId, lease_seconds: LEASE_SECONDS },
  );

  if (leaseError) {
    /*
     * Refusing is the only safe reading. The lease may or may not have been
     * taken, and sending on the assumption that it was not is the one mistake
     * this subsystem cannot undo.
     */
    console.error(`[campaign] lease failed for ${id}: ${leaseError.message}`);
    return { ...empty, reason: "The dispatch could not be started." };
  }

  if (!saidOk(lease)) {
    return {
      ...empty,
      skipped: true,
      reason: saidWhy(lease, "That campaign is already being sent."),
    };
  }

  try {
    return await sendClaimed(supabase, resend, campaign, empty);
  } finally {
    const { error: releaseError } = await supabase.rpc(
      "release_campaign_dispatch",
      { campaign_id: id, lease_id: leaseId },
    );

    /*
     * Not fatal, and not retried: the expiry releases it anyway. Worth a line,
     * because a campaign that goes quiet for fifteen minutes should be
     * explicable from the logs.
     */
    if (releaseError) {
      console.error(
        `[campaign] lease not released for ${id}: ${releaseError.message}`,
      );
    }
  }
}

/**
 * The run itself, inside the lease.
 *
 * Claim, compose, record, finish — unchanged from what it has always been. It
 * is a separate function only so the lease can be released in one place, on
 * every path out of it.
 */
async function sendClaimed(
  supabase: Supabase,
  resend: NonNullable<ReturnType<typeof getEmailClient>>,
  campaign: Campaign,
  empty: DispatchResult,
): Promise<DispatchResult> {
  const id = campaign.id;

  // 1. Claim. Returns without claiming if another dispatch got here first.
  const { data: claim, error: claimError } = await supabase.rpc(
    "begin_campaign_dispatch",
    { campaign_id: id },
  );

  if (claimError) {
    console.error(`[campaign] claim failed for ${id}: ${claimError.message}`);
    return { ...empty, reason: "The audience could not be claimed." };
  }

  const claimed =
    typeof claim === "object" && claim !== null && "claimed" in claim
      ? Number((claim as { claimed: unknown }).claimed) || 0
      : 0;

  if (!saidOk(claim)) {
    return { ...empty, reason: saidWhy(claim, "That campaign cannot be sent.") };
  }

  /*
   * The signature's links and the reply-to address, resolved once for every
   * letter in this run rather than once per letter — and passed down, so there
   * is no module-level value a future caller could forget to populate.
   */
  const [socials, replyTo] = await Promise.all([
    getSocialProfiles(),
    inboxAddress(),
  ]);

  let sent = 0;
  let failed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const recipients = await nextChunk(supabase, id);
    if (recipients.length === 0) break;

    const letters = recipients.map((recipient) => {
      const payload = campaignEmail({
        locale: campaign.locale as Locale,
        subject: campaign.subject,
        preheader: campaign.preheader,
        body: campaign.body,
        heroUrl: campaign.heroUrl,
        heroAlt: campaign.heroAlt,
        ctaLabel: campaign.ctaLabel,
        ctaHref: campaign.ctaHref,
        discountCode: campaign.discountCode,
        // This recipient's own link. The reason a campaign is composed once per
        // person rather than once per campaign.
        unsubscribeUrl: unsubscribeUrlFor(recipient.token),
        socials,
      });

      return {
        from: houseFromAddress(),
        to: recipient.email,
        replyTo,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      };
    });

    /*
     * `permissive` so one malformed address does not refuse the other
     * ninety-nine. The errors come back by index, and each is recorded against
     * the row it belongs to rather than failing the batch.
     */
    const results = await sendBatch(resend, letters, `${id}:${batch}`);

    /*
     * Keyed by address, because that is what the row is keyed by and what the
     * provider was handed. A recipient with no subscriber row — a customer, a
     * typed address — has no other identity to stamp against.
     */
    const items = recipients.map((recipient, index) => ({
      email: recipient.email,
      error: results.errors.get(index),
    }));

    failed += results.errors.size;
    sent += recipients.length - results.errors.size;

    const { error: recordError } = await supabase.rpc("record_campaign_sends", {
      campaign_id: id,
      items,
    });

    if (recordError) {
      /*
       * The letters went and the record did not. Stopping here is the only safe
       * move: continuing would re-read the same unstamped rows as the next
       * chunk and send to those people a second time.
       */
      console.error(
        `[campaign] ${id}: sends not recorded, stopping — ${recordError.message}`,
      );
      return { campaignId: id, claimed, sent, failed, finished: false,
        reason: "Sends could not be recorded." };
    }

    if (results.aborted) break;
  }

  const { data: done } = await supabase.rpc("finish_campaign", { campaign_id: id });

  console.info(
    `[campaign] ${id}: claimed ${claimed}, sent ${sent}, failed ${failed}`,
  );

  return { campaignId: id, claimed, sent, failed, finished: done === true };
}

/**
 * One batch, with its idempotency key.
 *
 * Errors are returned by index rather than thrown, so the caller can record
 * exactly which recipients did not receive their letter. A thrown request — the
 * network, a 500 — is reported as every letter in the batch having failed, which
 * is the safe reading: none of them is stamped, and a later run will try again.
 */
async function sendBatch(
  resend: NonNullable<ReturnType<typeof getEmailClient>>,
  letters: readonly {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    html: string;
    text: string;
  }[],
  key: string,
): Promise<{ errors: Map<number, string>; aborted: boolean }> {
  const errors = new Map<number, string>();

  try {
    const { data, error } = await resend.batch.send([...letters], {
      batchValidation: "permissive",
      // Derived from the campaign and the batch index, so a retried invocation
      // presents the same key for the same hundred letters.
      idempotencyKey: `campaign:${key}`,
    });

    if (error) {
      for (let index = 0; index < letters.length; index += 1) {
        errors.set(index, error.message);
      }
      return { errors, aborted: true };
    }

    for (const failure of data?.errors ?? []) {
      errors.set(failure.index, failure.message);
    }

    return { errors, aborted: false };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown error";
    for (let index = 0; index < letters.length; index += 1) {
      errors.set(index, message);
    }
    return { errors, aborted: true };
  }
}

/** Everything the cron should work on this run. */
export async function dueCampaignIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("due_campaigns");

  if (error) {
    console.error(`[campaign] due_campaigns failed: ${error.message}`);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data.flatMap((row: unknown) => {
    const id = (row as { id?: unknown }).id;
    return typeof id === "string" ? [id] : [];
  });
}
