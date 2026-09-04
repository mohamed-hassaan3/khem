"use server";

/**
 * House settings writes — the addresses the site quotes, the channels on
 * `/contact`, and the profiles in every email signature.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export, and every input is parsed by `schemas/settings.ts`
 * before a value reaches a query.
 *
 * ## No secret is readable or writable here
 *
 * `supabase/AGENTS.md` §17 requires it and nothing in this file touches one.
 * The API keys, the signing secrets and the connection string live in
 * environment variables; there is no action here that could surface one, and
 * there should never be.
 *
 * ## The singleton is updated, never inserted
 *
 * `"BoutiqueSetting"` is constrained to a single row with `id = 'default'`
 * (`check (id = 'default')`). An upsert would be the same statement with a
 * failure mode: if the row is somehow missing, an insert would succeed and the
 * site would silently start quoting whatever the form happened to hold. An
 * update that matches nothing is reported instead, which is a problem somebody
 * can go and look at.
 *
 * ## Every write revalidates
 *
 * `/contact` and `/stockists` are ISR at an hour and the home page carries the
 * featured fragrance. See `revalidateSettings()` for which surface reads what.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import {
  revalidateDelivery,
  revalidateSettings,
} from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  createContactChannelSchema,
  createSocialProfileSchema,
  deleteContactChannelSchema,
  deleteSocialProfileSchema,
  updateBoutiqueSettingsSchema,
  updateDeliverySettingSchema,
  updateContactChannelSchema,
  updateSocialProfileSchema,
} from "@/src/schemas/settings";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

/**
 * A missing featured product is the one foreign-key failure this screen can
 * produce, and the generic mapping would blame `collectionSlug` — a field that
 * does not exist on this form.
 */
function settingsFailure(error: PostgresErrorLike): AdminActionResult {
  if (error.code === "23503") {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: {
        featuredProductSlug: "No product has that slug.",
      },
    };
  }

  return postgresFailure(error, "collection");
}

// ── The singleton ─────────────────────────────────────────────

export async function updateBoutiqueSettings(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateBoutiqueSettingsSchema.safeParse(input);
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
    .from("BoutiqueSetting")
    .update({ ...parsed.data, updatedAt: new Date().toISOString() })
    .eq("id", "default")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] updateBoutiqueSettings rejected (${actor.email}): ${error.message}`,
    );
    return settingsFailure(error as PostgresErrorLike);
  }

  if (!data) {
    // See the header: the row is meant to exist, and inventing one here would
    // hide the fact that it does not.
    return {
      ok: false,
      message:
        "The settings row is missing. Run `npm run db:seed` — it is not something this screen should create.",
    };
  }

  revalidateSettings();
  console.info(`[admin] house settings updated by ${actor.email}`);

  return { ok: true, slug: "default", message: "House settings saved." };
}

// ── Delivery terms ────────────────────────────────────────────

/**
 * The fee and the free-delivery minimum for one channel.
 *
 * Updated, never inserted — the same rule the singleton above follows, and for
 * the same reason. `0053_delivery_terms.sql` seeds both rows; an upsert here
 * would mean that a channel somebody had deleted quietly came back with whatever
 * figures the form happened to hold, and the site would start charging them
 * without anyone deciding to.
 *
 * These two numbers are what the cart quotes and what `place_order()` is
 * charged, so the write revalidates the layout that carries them — see
 * `revalidateDelivery()`.
 */
export async function updateDeliverySetting(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateDeliverySettingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  // The channel names the row; it is never one of the values written.
  const { channel, ...terms } = parsed.data;

  const { data, error } = await supabase
    .from("DeliverySetting")
    .update({ ...terms, updatedAt: new Date().toISOString() })
    .eq("channel", channel)
    .select("channel")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] updateDeliverySetting rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) {
    return {
      ok: false,
      message:
        "There is no delivery row for that channel, so nothing was saved. Run the migrations, then try again.",
    };
  }

  revalidateDelivery();
  console.info(
    `[admin] delivery terms updated by ${actor.email} → ${channel} ` +
      `fee=${terms.feeInCents} minimum=${terms.freeThresholdInCents}`,
  );

  return {
    ok: true,
    slug: channel,
    message: `${channel === "ONLINE" ? "Online" : "Offline"} delivery terms saved.`,
  };
}

// ── Contact channels ──────────────────────────────────────────

export async function createContactChannel(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createContactChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("ContactChannel").insert(parsed.data);

  if (error) {
    console.error(
      `[admin] createContactChannel rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  revalidateSettings();
  console.info(`[admin] contact channel created by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: `${parsed.data.label} added.` };
}

export async function updateContactChannel(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateContactChannelSchema.safeParse(input);
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
    .from("ContactChannel")
    .update(fields)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] updateContactChannel rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That channel no longer exists." };

  revalidateSettings();
  console.info(`[admin] contact channel updated by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: `${parsed.data.label} saved.` };
}

export async function deleteContactChannel(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteContactChannelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid channel." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("ContactChannel")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] deleteContactChannel rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That channel no longer exists." };

  revalidateSettings();
  console.info(`[admin] contact channel deleted by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Channel removed." };
}

// ── Social profiles ───────────────────────────────────────────

export async function createSocialProfile(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createSocialProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("SocialProfile").insert(parsed.data);

  if (error) {
    console.error(
      `[admin] createSocialProfile rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  revalidateSettings();
  console.info(`[admin] social profile created by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: `${parsed.data.platform} added.` };
}

export async function updateSocialProfile(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateSocialProfileSchema.safeParse(input);
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
    .from("SocialProfile")
    .update(fields)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] updateSocialProfile rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That profile no longer exists." };

  revalidateSettings();
  console.info(`[admin] social profile updated by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: `${parsed.data.platform} saved.` };
}

export async function deleteSocialProfile(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteSocialProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid profile." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("SocialProfile")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] deleteSocialProfile rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That profile no longer exists." };

  revalidateSettings();
  console.info(`[admin] social profile deleted by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Profile removed." };
}
