"use server";

/**
 * Discount writes.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export, and every input is parsed by
 * `schemas/discounts.ts` before a value reaches a query.
 *
 * These actions govern **what a customer is charged**, which makes them the
 * most consequential writes in the dashboard after the order functions
 * themselves. Nothing here computes a price: they describe a rule, and
 * `resolve_discount()` applies it inside the order transaction.
 *
 * ## Why these revalidate the storefront
 *
 * A code is validated at checkout, which is dynamic, so until the offer popup
 * landed nothing here needed to re-render a page. It does now: the popup prints
 * what the **welcome** offer is worth, read from `discounts."isWelcome"` by the
 * prerendered root layout. Editing that campaign — its percentage, its window,
 * its switch, or moving the flag to another code — changes a sentence on every
 * page, so every write here calls `revalidateMarketing()`. Doing it
 * unconditionally rather than only for the welcome row is deliberate: the flag
 * moves between rows by trigger (`0030`), so "did this edit touch the welcome
 * offer" is not a question this file can answer correctly.
 *
 * ## Deactivating is not deleting
 *
 * Deactivating is the reversible way to stop a code — the row, its restrictions
 * and its whole redemption history survive, and the figures on the list stay
 * truthful. Deletion is behind a confirm in the editor and cascades the
 * restrictions, the grants and the redemption ledger, which is why it should
 * almost never be used on a code that has been redeemed. Orders keep their
 * `discountCode` snapshot regardless.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateMarketing } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  createDiscountSchema,
  deleteDiscountSchema,
  setDiscountActiveSchema,
  updateDiscountSchema,
} from "@/src/schemas/discounts";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

function failure(error: PostgresErrorLike): AdminActionResult {
  if (error.code === "23505") {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { code: "Another discount already uses that code." },
    };
  }

  // The database re-checks what `schemas/discounts.ts` checks — a percentage
  // above 100, an end before a start. Reaching one means the two drifted.
  if (error.code === "23514") {
    return {
      ok: false,
      message:
        "The database refused those values. A percentage must be 1–100 and an end date must follow its start.",
    };
  }

  return postgresFailure(error, "collection");
}

/**
 * Replace a code's restriction sets.
 *
 * Cleared and rewritten rather than diffed: these are two-column junctions with
 * no identity of their own and no history worth keeping, so a diff would be
 * ceremony. Inside the same request as the discount write, so a code cannot end
 * up restricted to nothing.
 */
async function writeRestrictions(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  discountId: string,
  appliesTo: string,
  productSlugs: readonly string[],
  collectionSlugs: readonly string[],
): Promise<string | null> {
  await supabase.from("discount_products").delete().eq("discountId", discountId);
  await supabase.from("discount_collections").delete().eq("discountId", discountId);

  if (appliesTo === "PRODUCTS" && productSlugs.length > 0) {
    const { error } = await supabase.from("discount_products").insert(
      productSlugs.map((productSlug) => ({ discountId, productSlug })),
    );
    if (error) return error.message;
  }

  if (appliesTo === "COLLECTIONS" && collectionSlugs.length > 0) {
    const { error } = await supabase.from("discount_collections").insert(
      collectionSlugs.map((collectionSlug) => ({ discountId, collectionSlug })),
    );
    if (error) return error.message;
  }

  return null;
}

export async function createDiscount(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createDiscountSchema.safeParse(input);
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
    .from("discounts")
    .insert(fields)
    .select("id, code")
    .maybeSingle();

  if (error) {
    console.error(`[admin] createDiscount rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "The discount could not be created." };

  const restrictionError = await writeRestrictions(
    supabase,
    String(data.id),
    fields.appliesTo,
    productSlugs,
    collectionSlugs,
  );

  if (restrictionError) {
    console.error(`[admin] createDiscount restrictions failed: ${restrictionError}`);
    return {
      ok: false,
      message: "The code was created, but its restrictions could not be saved.",
    };
  }

  revalidateMarketing();
  console.info(`[admin] discount created by ${actor.email} → ${String(data.code)}`);

  return {
    ok: true,
    slug: String(data.code),
    message: `${String(data.code)} created.`,
  };
}

export async function updateDiscount(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateDiscountSchema.safeParse(input);
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
    .from("discounts")
    // The code itself is not in `fields` — it is the row's identity and orders
    // carry it as a snapshot.
    .update({ ...fields, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id, code")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateDiscount rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That discount no longer exists." };

  const restrictionError = await writeRestrictions(
    supabase,
    id,
    fields.appliesTo,
    productSlugs,
    collectionSlugs,
  );

  if (restrictionError) {
    console.error(`[admin] updateDiscount restrictions failed: ${restrictionError}`);
    return { ok: false, message: "The restrictions could not be saved." };
  }

  revalidateMarketing();
  console.info(`[admin] discount updated by ${actor.email} → ${String(data.code)}`);

  return { ok: true, slug: String(data.code), message: `${String(data.code)} saved.` };
}

/** Stop or restart a code without touching its history. */
export async function setDiscountActive(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setDiscountActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid change." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("discounts")
    .update({ isActive: parsed.data.isActive, updatedAt: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("code")
    .maybeSingle();

  if (error) {
    console.error(`[admin] setDiscountActive rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That discount no longer exists." };

  revalidateMarketing();
  console.info(
    `[admin] ${actor.email} ${parsed.data.isActive ? "activated" : "deactivated"} ${String(data.code)}`,
  );

  return {
    ok: true,
    slug: String(data.code),
    message: parsed.data.isActive
      ? `${String(data.code)} is live.`
      : `${String(data.code)} is no longer accepted.`,
  };
}

export async function deleteDiscount(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteDiscountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid discount." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("discounts")
    .delete()
    .eq("id", parsed.data.id)
    .select("code")
    .maybeSingle();

  if (error) {
    console.error(`[admin] deleteDiscount rejected (${actor.email}): ${error.message}`);
    return failure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That discount no longer exists." };

  revalidateMarketing();
  console.info(`[admin] discount deleted by ${actor.email} → ${String(data.code)}`);

  return { ok: true, slug: String(data.code), message: "Discount removed." };
}
