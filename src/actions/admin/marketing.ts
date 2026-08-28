"use server";

/**
 * Announcement and marketing-settings writes.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export, and every input is parsed by
 * `src/schemas/marketing.ts` before a value reaches a query.
 *
 * Nothing here touches money. The announcement bar is prose in the site header
 * and the popup is chrome around a form — the *offer* those two advertise is
 * `discounts."isWelcome"`, edited in the discount editor, and this file cannot
 * change what anybody is charged. That separation is deliberate: a marketing
 * screen that could also move a percentage would make the discount ledger
 * unreadable.
 *
 * ## Deactivating is not deleting
 *
 * An announcement can be switched off, scheduled out of its window, or removed.
 * The first two are reversible and keep the row; deletion is behind a confirm.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateMarketing } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  announcementIdSchema,
  createAnnouncementSchema,
  marketingSettingsSchema,
  setAnnouncementActiveSchema,
  updateAnnouncementSchema,
} from "@/src/schemas/marketing";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  type PostgresErrorLike,
} from "./shared";

/**
 * The database re-checks what the schema checks — a message over 160
 * characters, an end before its start, an `href` that is not an app path.
 * Reaching one of these means the two drifted, so the message says what the
 * constraint means rather than naming it.
 */
function failure(error: PostgresErrorLike): AdminActionResult {
  if (error.code === "23514") {
    return {
      ok: false,
      message:
        "The database refused those values. A message must fit 160 characters, a link must be a path on this site, and an end date must follow its start.",
    };
  }

  return {
    ok: false,
    message: "The database refused that change. The details are in the server log.",
  };
}

/** Announcement columns, from a parsed payload. `_ar` naming is the database's. */
function announcementRow(fields: {
  message: string;
  messageAr: string | null;
  href: string | null;
  ctaLabel: string | null;
  ctaLabelAr: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
}) {
  return {
    message: fields.message,
    message_ar: fields.messageAr,
    href: fields.href,
    ctaLabel: fields.ctaLabel,
    ctaLabel_ar: fields.ctaLabelAr,
    isActive: fields.isActive,
    sortOrder: fields.sortOrder,
    startsAt: fields.startsAt,
    endsAt: fields.endsAt,
  };
}

export async function createAnnouncement(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Announcement")
    .insert(announcementRow(parsed.data))
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createAnnouncement rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "The announcement could not be created." };

  revalidateMarketing();
  console.info(`[admin] announcement created by ${actor.email}`);

  return { ok: true, slug: String(data.id), message: "Announcement created." };
}

export async function updateAnnouncement(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { id, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("Announcement")
    .update({ ...announcementRow(fields), updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateAnnouncement rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That announcement no longer exists." };

  revalidateMarketing();
  console.info(`[admin] announcement updated by ${actor.email}`);

  return { ok: true, slug: id, message: "Announcement saved." };
}

/** Stop or restart one line without touching the rest of the bar. */
export async function setAnnouncementActive(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setAnnouncementActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid change." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Announcement")
    .update({ isActive: parsed.data.isActive, updatedAt: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] setAnnouncementActive rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That announcement no longer exists." };

  revalidateMarketing();

  return {
    ok: true,
    slug: parsed.data.id,
    message: parsed.data.isActive
      ? "Announcement is showing."
      : "Announcement is hidden.",
  };
}

export async function deleteAnnouncement(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = announcementIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid announcement." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Announcement")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] deleteAnnouncement rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That announcement no longer exists." };

  revalidateMarketing();
  console.info(`[admin] announcement deleted by ${actor.email}`);

  return { ok: true, slug: parsed.data.id, message: "Announcement removed." };
}

/**
 * The bar's behaviour and the popup's, saved together.
 *
 * One row, one form, one write. Splitting them into two actions would let a
 * half-saved screen leave the bar in carousel mode with an interval the editor
 * meant for the marquee.
 */
export async function saveMarketingSettings(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = marketingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const fields = parsed.data;

  const { error } = await supabase
    .from("MarketingSetting")
    .update({
      announcementsEnabled: fields.announcementsEnabled,
      announcementMode: fields.announcementMode,
      announcementIntervalMs: fields.announcementIntervalMs,
      offerPopupEnabled: fields.offerPopupEnabled,
      offerPopupDelayMs: fields.offerPopupDelayMs,
      offerPopupScrollPercent: fields.offerPopupScrollPercent,
      offerPopupSnoozeDays: fields.offerPopupSnoozeDays,
      offerPopupEyebrow: fields.offerPopupEyebrow,
      offerPopupEyebrow_ar: fields.offerPopupEyebrowAr,
      offerPopupHeading: fields.offerPopupHeading,
      offerPopupHeading_ar: fields.offerPopupHeadingAr,
      offerPopupBody: fields.offerPopupBody,
      offerPopupBody_ar: fields.offerPopupBodyAr,
      offerPopupImageUrl: fields.offerPopupImageUrl,
      offerPopupImageAlt: fields.offerPopupImageAlt,
      offerPopupImageAlt_ar: fields.offerPopupImageAltAr,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", "default");

  if (error) {
    console.error(`[admin] saveMarketingSettings rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  revalidateMarketing();
  console.info(`[admin] marketing settings saved by ${actor.email}`);

  // `slug` is the row's identity in `AdminActionResult`; this table has exactly
  // one row, and "default" is what its primary key says.
  return { ok: true, slug: "default", message: "Marketing settings saved." };
}
