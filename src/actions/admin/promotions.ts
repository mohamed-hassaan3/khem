"use server";

/**
 * Promotion writes.
 *
 * ## Trust model, restated
 *
 * `requireAdmin()` first in every export; every input parsed by
 * `src/schemas/marketing.ts` before it reaches a query.
 *
 * These actions govern **what a customer is charged**, which puts them beside
 * `actions/admin/discounts.ts` as the most consequential writes in the
 * dashboard. And like those, nothing here computes a price: they describe a
 * promotion, and `active_product_promotions` applies it — inside the order
 * transaction, when `place_order()` reads it under a row lock.
 *
 * ## Deactivating is not deleting
 *
 * Switching a promotion off, or letting its window lapse, stops it repricing
 * anything while the row and its selections survive. Deleting removes them —
 * and, because `"OrderItem"."promotionId"` is `on delete set null`, past orders
 * keep the price they were charged and their `listPriceInCents` snapshot; only
 * the *name* of the promotion is lost. That is the right trade: no order is ever
 * repriced by an edit here.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidatePromotions } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  createPromotionSchema,
  promotionIdSchema,
  setPromotionActiveSchema,
  updatePromotionSchema,
} from "@/src/schemas/marketing";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  type PostgresErrorLike,
} from "./shared";

function failure(error: PostgresErrorLike): AdminActionResult {
  if (error.code === "23514") {
    return {
      ok: false,
      message:
        "The database refused those values. A percentage must be 1–100 and an end date must follow its start.",
    };
  }

  if (error.code === "23503") {
    return {
      ok: false,
      message:
        "One of the selected products or collections no longer exists. Reload and try again.",
    };
  }

  return {
    ok: false,
    message: "The database refused that change. The details are in the server log.",
  };
}

/**
 * Replace a promotion's target sets.
 *
 * Cleared and rewritten rather than diffed, for the reason
 * `actions/admin/discounts.ts` gives: these are two-column junctions with no
 * identity of their own and no history worth keeping, so a diff would be
 * ceremony.
 *
 * **Both are cleared regardless of scope.** Switching a promotion from products
 * to collections must not leave its old product rows behind — they would be
 * invisible in the editor and would come back the moment somebody switched the
 * scope again.
 */
async function writeTargets(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  promotionId: string,
  appliesTo: string,
  productSlugs: readonly string[],
  collectionSlugs: readonly string[],
): Promise<string | null> {
  await supabase.from("promotion_products").delete().eq("promotionId", promotionId);
  await supabase
    .from("promotion_collections")
    .delete()
    .eq("promotionId", promotionId);

  if (appliesTo === "PRODUCTS" && productSlugs.length > 0) {
    const { error } = await supabase
      .from("promotion_products")
      .insert(productSlugs.map((productSlug) => ({ promotionId, productSlug })));
    if (error) return error.message;
  }

  if (appliesTo === "COLLECTIONS" && collectionSlugs.length > 0) {
    const { error } = await supabase
      .from("promotion_collections")
      .insert(
        collectionSlugs.map((collectionSlug) => ({ promotionId, collectionSlug })),
      );
    if (error) return error.message;
  }

  return null;
}

/** Promotion columns, from a parsed payload. */
function promotionRow(fields: {
  name: string;
  description: string | null;
  label: string | null;
  labelAr: string | null;
  kind: string;
  value: number;
  appliesTo: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  stacksWithCodes: boolean;
  priority: number;
}) {
  return {
    name: fields.name,
    description: fields.description,
    label: fields.label,
    label_ar: fields.labelAr,
    kind: fields.kind,
    value: fields.value,
    appliesTo: fields.appliesTo,
    isActive: fields.isActive,
    startsAt: fields.startsAt,
    endsAt: fields.endsAt,
    stacksWithCodes: fields.stacksWithCodes,
    priority: fields.priority,
  };
}

export async function createPromotion(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createPromotionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { productSlugs, collectionSlugs, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("promotions")
    .insert(promotionRow(fields))
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createPromotion rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "The promotion could not be created." };

  const targetError = await writeTargets(
    supabase,
    String(data.id),
    fields.appliesTo,
    productSlugs,
    collectionSlugs,
  );

  if (targetError) {
    console.error(`[admin] createPromotion targets failed: ${targetError}`);
    return {
      ok: false,
      message:
        "The promotion was created, but what it applies to could not be saved. Open it and set the selection again.",
    };
  }

  revalidatePromotions();
  console.info(`[admin] promotion created by ${actor.email} → ${String(data.name)}`);

  return {
    ok: true,
    slug: String(data.id),
    message: `${String(data.name)} created.`,
  };
}

export async function updatePromotion(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updatePromotionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { id, productSlugs, collectionSlugs, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("promotions")
    .update({ ...promotionRow(fields), updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updatePromotion rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That promotion no longer exists." };

  const targetError = await writeTargets(
    supabase,
    id,
    fields.appliesTo,
    productSlugs,
    collectionSlugs,
  );

  if (targetError) {
    console.error(`[admin] updatePromotion targets failed: ${targetError}`);
    return { ok: false, message: "What it applies to could not be saved." };
  }

  revalidatePromotions();
  console.info(`[admin] promotion updated by ${actor.email} → ${String(data.name)}`);

  return { ok: true, slug: id, message: `${String(data.name)} saved.` };
}

/** Stop or restart a promotion without touching its selections. */
export async function setPromotionActive(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setPromotionActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid change." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("promotions")
    .update({ isActive: parsed.data.isActive, updatedAt: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("name")
    .maybeSingle();

  if (error) {
    console.error(`[admin] setPromotionActive rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That promotion no longer exists." };

  revalidatePromotions();
  console.info(
    `[admin] ${actor.email} ${parsed.data.isActive ? "started" : "stopped"} ${String(data.name)}`,
  );

  return {
    ok: true,
    slug: parsed.data.id,
    message: parsed.data.isActive
      ? `${String(data.name)} is pricing the catalogue.`
      : `${String(data.name)} is no longer pricing anything.`,
  };
}

export async function deletePromotion(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = promotionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid promotion." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("promotions")
    .delete()
    .eq("id", parsed.data.id)
    .select("name")
    .maybeSingle();

  if (error) {
    console.error(`[admin] deletePromotion rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That promotion no longer exists." };

  revalidatePromotions();
  console.info(`[admin] promotion deleted by ${actor.email} → ${String(data.name)}`);

  return { ok: true, slug: parsed.data.id, message: "Promotion removed." };
}
