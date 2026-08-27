"use server";

/**
 * Campaign writes.
 *
 * ## The rule this file exists to enforce
 *
 * A campaign is the one record here whose consequences cannot be undone. So:
 * nothing in this file sends to a customer. Create, edit, delete, and a
 * **rehearsal to the administrator's own address** — that is the whole surface
 * in Stage 1, and dispatch arrives as its own file with its own review.
 *
 * ## The voucher is checked twice, and neither check is here
 *
 * `campaigns."discountCode"` is a foreign key into `discounts`, so a code that
 * does not exist is refused by the database rather than by a validation somebody
 * has to remember to write. Whether the code is *usable* is
 * `resolve_discount()`'s question, asked at checkout by the customer holding it.
 * What this file adds is a courtesy: a campaign naming an inactive code is
 * refused at save, because a letter promising a code the checkout will refuse is
 * worse than no letter.
 *
 * ## Trust model
 *
 * `requireAdmin()` first, as in every sibling. The form may name content; it may
 * never name a status, a sent time, or an audience — those are dispatch's own
 * record of what it did, and a form that could set them could claim a campaign
 * had been sent when it had not.
 *
 * ## Logging
 *
 * A campaign id and the actor. Never a subject, never an address.
 */

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/src/lib/admin/auth";
import { dispatchCampaign } from "@/src/services/admin/campaign-dispatch";
import { sendCampaignTest } from "@/src/lib/email/send-campaign-mail";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  campaignIdSchema,
  createCampaignSchema,
  scheduleCampaignSchema,
  updateCampaignSchema,
} from "@/src/schemas/campaigns";
import {
  CAMPAIGN_COLUMNS,
  campaignStatusSchema,
  toCampaign,
} from "@/src/schemas/db/campaigns";
import { isEditable } from "@/src/types/campaign";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

const CAMPAIGNS_PATH = "/admin/campaigns";

/** A foreign-key complaint about the code, said in words an editor can act on. */
function failure(error: PostgresErrorLike): AdminActionResult {
  if (error.code === "23503" && error.message.includes("discountCode")) {
    return {
      ok: false,
      message: "That discount code does not exist.",
      fieldErrors: { discountCode: "No such code." },
    };
  }

  return { ok: false, message: "That campaign could not be saved." };
}

/**
 * Refuse a code the checkout would refuse.
 *
 * Read, not resolved: `resolve_discount()` needs a bag, and there is none here.
 * What can be answered without one is whether the campaign is switched on and in
 * date, which is the case that actually happens — a code typed from last
 * season's campaign.
 */
async function unusableCodeReason(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  code: string | null,
): Promise<string | null> {
  if (!code) return null;

  const { data, error } = await supabase
    .from("discounts")
    .select("isActive, startsAt, endsAt")
    .eq("code", code)
    .maybeSingle();

  // A read failure is not a verdict. The foreign key still guarantees the code
  // exists, and refusing a save over a transient error would be worse.
  if (error || !data) return null;

  if (data.isActive === false) return "That code is switched off.";

  const now = Date.now();
  if (data.endsAt && Date.parse(String(data.endsAt)) <= now) {
    return "That code has expired.";
  }
  if (data.startsAt && Date.parse(String(data.startsAt)) > now) {
    return "That code has not started yet.";
  }

  return null;
}

export async function createCampaign(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const unusable = await unusableCodeReason(supabase, parsed.data.discountCode);
  if (unusable) {
    return { ok: false, message: unusable, fieldErrors: { discountCode: unusable } };
  }

  const { data, error } = await supabase
    .from("campaigns")
    // The status is not in `parsed.data` and cannot be: a new campaign is a
    // draft, and the column's default says so.
    .insert({ ...parsed.data, createdBy: actor.id })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createCampaign rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "The campaign could not be created." };

  console.info(`[admin] campaign ${String(data.id)} created by ${actor.email}`);
  revalidatePath(CAMPAIGNS_PATH);

  return { ok: true, slug: String(data.id), message: "Campaign saved." };
}

export async function updateCampaign(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const unusable = await unusableCodeReason(supabase, parsed.data.discountCode);
  if (unusable) {
    return { ok: false, message: unusable, fieldErrors: { discountCode: unusable } };
  }

  const { id, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...fields, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    /*
     * The database refuses to edit a campaign that has begun sending — see the
     * `campaign_edit_guard` trigger. Its message is written for a person and is
     * passed straight through.
     */
    console.error(`[admin] updateCampaign rejected (${actor.email}): ${error.message}`);

    if (error.message.includes("cannot be edited")) {
      return { ok: false, message: "That campaign has been sent and can no longer be edited." };
    }

    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That campaign no longer exists." };

  console.info(`[admin] campaign ${id} updated by ${actor.email}`);
  revalidatePath(CAMPAIGNS_PATH);
  revalidatePath(`${CAMPAIGNS_PATH}/${id}`);

  return { ok: true, slug: id, message: "Campaign saved." };
}

/**
 * Delete a campaign that never went out.
 *
 * A sent one is history and stays: `campaign_sends` records who it reached, and
 * deleting the campaign would cascade those rows away and leave the house unable
 * to answer what it sent to whom.
 */
export async function deleteCampaign(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown campaign." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data: existing } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  // Parsed rather than cast: an unrecognised status must not be treated as
  // editable just because TypeScript was told to look away.
  const status = campaignStatusSchema.safeParse(existing?.status);

  if (status.success && !isEditable(status.data)) {
    return {
      ok: false,
      message: "A campaign that has been sent is a record and cannot be deleted.",
    };
  }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    console.error(`[admin] deleteCampaign rejected (${actor.email}): ${error.message}`);
    return { ok: false, message: "That campaign could not be deleted." };
  }

  console.info(`[admin] campaign ${parsed.data.id} deleted by ${actor.email}`);
  revalidatePath(CAMPAIGNS_PATH);

  return { ok: true, slug: parsed.data.id, message: "Campaign deleted." };
}

/**
 * Send the letter to the administrator, and to nobody else.
 *
 * The address is the one `requireAdmin()` verified — never a field on the form.
 * That is the whole of the safety here: there is no parameter this action could
 * be given that would make it write to a customer.
 */
export async function sendCampaignTestEmail(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown campaign." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", parsed.data.id)
    .maybeSingle();

  const campaign = error ? null : toCampaign(data);
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  /*
   * The administrator's own unsubscribe token when they are on the list, so the
   * rehearsal's link is a working one. Otherwise a placeholder, which lands on
   * the "that link is not valid" page — the letter is still composed by exactly
   * the code that will compose the real ones.
   */
  const { data: subscriber } = await supabase
    .from("NewsletterSubscriber")
    .select("unsubscribeToken")
    .eq("email", actor.email.toLowerCase())
    .maybeSingle();

  const token =
    typeof subscriber?.unsubscribeToken === "string"
      ? subscriber.unsubscribeToken
      : "test-token-not-a-subscriber";

  const sent = await sendCampaignTest(campaign, actor.email, token);

  if (!sent) {
    return { ok: false, message: "The test could not be sent. Check the mail settings." };
  }

  console.info(`[admin] campaign ${campaign.id} test sent by ${actor.email}`);

  return { ok: true, slug: campaign.id, message: "Test sent to your own address." };
}

/**
 * Put a campaign in the queue for a moment in the future.
 *
 * The moment is honoured to the nearest cron run, which is daily — see
 * `src/app/api/cron/send-campaigns/route.ts`. The dashboard says so beside the
 * field; a schedule that implied a precision the plan cannot buy would be a
 * promise broken every time it was used.
 */
export async function scheduleCampaign(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = scheduleCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "That schedule could not be set.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  /*
   * Only from DRAFT. A campaign already sending cannot be rescheduled — the
   * letters are going out — and one already sent is history.
   */
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      status: "SCHEDULED",
      scheduledAt: parsed.data.scheduledAt,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .in("status", ["DRAFT", "SCHEDULED"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error(`[admin] scheduleCampaign rejected (${actor.email})`);
    return { ok: false, message: "Only a draft can be scheduled." };
  }

  console.info(`[admin] campaign ${parsed.data.id} scheduled by ${actor.email}`);
  revalidatePath(CAMPAIGNS_PATH);
  revalidatePath(`${CAMPAIGNS_PATH}/${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Campaign scheduled." };
}

/**
 * Withdraw a schedule before it runs.
 *
 * Back to DRAFT rather than to CANCELLED: nothing has gone out, so this is an
 * edit, not an ending. CANCELLED is reserved for a campaign deliberately
 * abandoned, which the desk does by deleting a draft.
 */
export async function unscheduleCampaign(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown campaign." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      status: "DRAFT",
      scheduledAt: null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("status", "SCHEDULED")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "That campaign is no longer scheduled." };
  }

  console.info(`[admin] campaign ${parsed.data.id} unscheduled by ${actor.email}`);
  revalidatePath(CAMPAIGNS_PATH);
  revalidatePath(`${CAMPAIGNS_PATH}/${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Schedule withdrawn." };
}

/**
 * Send it now.
 *
 * **The irreversible one.** Everything protecting it is in
 * `dispatchCampaign()` and the SQL beneath: the audience is claimed under a row
 * lock before a single letter is composed, so a second press — or a cron run
 * arriving mid-send — claims nothing and sends nothing.
 *
 * The action reports what actually left rather than what was asked for, because
 * a run is bounded and a large list finishes across several.
 */
export async function sendCampaignNow(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = campaignIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown campaign." };

  const result = await dispatchCampaign(parsed.data.id);

  if (result.reason) {
    return { ok: false, message: result.reason };
  }

  console.info(
    `[admin] campaign ${parsed.data.id} sent by ${actor.email} — ${result.sent} letter(s)`,
  );

  revalidatePath(CAMPAIGNS_PATH);
  revalidatePath(`${CAMPAIGNS_PATH}/${parsed.data.id}`);

  const tail = result.finished
    ? ""
    : " The rest follow on the next run.";
  const failed = result.failed > 0 ? ` ${result.failed} refused.` : "";

  return {
    ok: true,
    slug: parsed.data.id,
    message: `${result.sent} letter${result.sent === 1 ? "" : "s"} sent.${failed}${tail}`,
  };
}
