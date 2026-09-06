"use server";

/**
 * Offer writes.
 *
 * Shaped after `actions/admin/promotions.ts`, which is the closest existing
 * relative: a row plus target sets, cleared and rewritten rather than diffed.
 *
 * ## Four junctions, all cleared on every save
 *
 * `writeTargets` clears all four regardless of scope, for the reason the
 * promotion action gives: switching an offer from products to collections must
 * not leave its old product rows behind, invisible in the editor and waiting to
 * come back the moment somebody switches the scope again. Trigger and reward are
 * separate pairs because an offer may legitimately name a collection on one side
 * and products on the other.
 *
 * ## What is not here
 *
 * No way to grant, redeem or release an offer by hand. A redemption is written
 * by `place_order()` inside the order transaction and released by
 * `set_order_status()` on a refund; a button that could write one would make the
 * caps count something that never happened.
 */

import type { z } from "zod";

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateOffers } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import { offerSchema } from "@/src/schemas/offers";

import { UNCONFIGURED, fieldErrorsFrom, type PostgresErrorLike } from "./shared";

function failure(error: PostgresErrorLike): AdminActionResult {
  const message = error.message ?? "";

  if (message.includes("offer_code_gate_stacks")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: {
        requiresCode:
          "An offer gated on a code must be allowed to run beside one, or it could never apply.",
      },
    };
  }

  if (message.includes("offer_percentage_value")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { rewardValue: "A percentage reward needs a percentage." },
    };
  }

  if (message.includes("offer_window")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { endsAt: "The end must come after the start." },
    };
  }

  return {
    ok: false,
    message: "The database refused that change. The details are in the server log.",
  };
}

/** Everything `offerSchema` produces — the row's columns and its four target sets. */
type OfferFields = z.output<typeof offerSchema>;

async function writeTargets(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  offerId: string,
  targets: OfferFields,
): Promise<string | null> {
  for (const table of [
    "offer_trigger_products",
    "offer_trigger_collections",
    "offer_reward_products",
    "offer_reward_collections",
  ]) {
    await supabase.from(table).delete().eq("offerId", offerId);
  }

  const writes: { table: string; rows: Record<string, string>[] }[] = [];

  if (targets.triggerScope === "PRODUCTS") {
    writes.push({
      table: "offer_trigger_products",
      rows: targets.triggerProductSlugs.map((productSlug) => ({ offerId, productSlug })),
    });
  } else {
    writes.push({
      table: "offer_trigger_collections",
      rows: targets.triggerCollectionSlugs.map((collectionSlug) => ({
        offerId,
        collectionSlug,
      })),
    });
  }

  if (targets.rewardScope === "PRODUCTS") {
    writes.push({
      table: "offer_reward_products",
      rows: targets.rewardProductSlugs.map((productSlug) => ({ offerId, productSlug })),
    });
  } else {
    writes.push({
      table: "offer_reward_collections",
      rows: targets.rewardCollectionSlugs.map((collectionSlug) => ({
        offerId,
        collectionSlug,
      })),
    });
  }

  for (const write of writes) {
    if (write.rows.length === 0) continue;
    const { error } = await supabase.from(write.table).insert(write.rows);
    if (error) return error.message;
  }

  return null;
}

/**
 * The `offers` columns, from a parsed payload.
 *
 * Written out field by field rather than spread, for `promotionRow()`'s reason:
 * the parsed object also carries the four target arrays, and spreading it would
 * send them to a table that has no such columns.
 */
function offerRow(data: OfferFields) {
  return {
    name: data.name,
    description: data.description || null,
    label: data.label || null,
    label_ar: data.labelAr || null,
    isActive: data.isActive,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    triggerQuantity: data.triggerQuantity,
    triggerScope: data.triggerScope,
    rewardQuantity: data.rewardQuantity,
    rewardKind: data.rewardKind,
    rewardScope: data.rewardScope,
    rewardSelection: data.rewardSelection,
    rewardValue: data.rewardValue,
    audience: data.audience,
    requiresCode: data.requiresCode,
    totalUseLimit: data.totalUseLimit,
    perCustomerLimit: data.perCustomerLimit,
    stacksWithCodes: data.stacksWithCodes,
    stacksWithCredit: data.stacksWithCredit,
    priority: data.priority,
  };
}

export async function createOffer(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = offerSchema.safeParse(input);
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
    .from("offers")
    .insert(offerRow(parsed.data))
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createOffer rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "The offer could not be created." };

  const targetError = await writeTargets(supabase, String(data.id), parsed.data);

  if (targetError) {
    console.error(`[admin] createOffer targets failed: ${targetError}`);
    return {
      ok: false,
      message:
        "The offer was created, but what it applies to could not be saved. Open it and set the selection again.",
    };
  }

  revalidateOffers();
  console.info(`[admin] offer created by ${actor.email} → ${String(data.name)}`);

  return { ok: true, slug: String(data.id), message: `${String(data.name)} created.` };
}

export async function updateOffer(
  id: string,
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("offers")
    .update({
      ...offerRow(parsed.data),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`[admin] updateOffer rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  const targetError = await writeTargets(supabase, id, parsed.data);

  if (targetError) {
    console.error(`[admin] updateOffer targets failed: ${targetError}`);
    return {
      ok: false,
      message: "The offer was saved, but what it applies to could not be. Try again.",
    };
  }

  revalidateOffers();
  console.info(`[admin] offer ${id} updated by ${actor.email}`);

  return { ok: true, slug: id, message: "Offer saved." };
}

/**
 * The switch on the list screen.
 *
 * Separate from `updateOffer` so turning a campaign off in a hurry does not
 * require the editor to pass validation on every other field first — the same
 * shape `setPromotionActive()` has.
 */
export async function setOfferActive(
  id: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("offers")
    .update({ isActive, updatedAt: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error(`[admin] setOfferActive rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  revalidateOffers();
  console.info(`[admin] offer ${id} switched ${isActive ? "on" : "off"} by ${actor.email}`);

  return { ok: true, slug: id, message: isActive ? "Offer is live." : "Offer switched off." };
}

/**
 * Deleting an offer.
 *
 * `offer_redemptions."offerId"` cascades, which is deliberate and worth stating:
 * an offer nobody has used should leave nothing behind, and one people *have*
 * used should be switched off rather than deleted — the orders keep their
 * `"offerLabel"` snapshot either way, so no confirmation is rewritten. The
 * dashboard warns before offering this on an offer with redemptions.
 */
export async function deleteOffer(id: string): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("offers").delete().eq("id", id);

  if (error) {
    console.error(`[admin] deleteOffer rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  revalidateOffers();
  console.info(`[admin] offer ${id} deleted by ${actor.email}`);

  return { ok: true, slug: id, message: "Offer deleted." };
}
