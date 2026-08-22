"use server";

/**
 * Stock corrections.
 *
 * Separate from `./orders.ts` because the two move stock for opposite reasons.
 * An order consumes units and must do so under a lock, inside the same
 * transaction that records the sale — that is why it goes through
 * `place_order()`. This is an editor telling the database what is actually on
 * the shelf after counting it, which is a plain overwrite and should not
 * pretend to be anything cleverer.
 *
 * Same contract as every action in this directory: `requireAdmin()` first,
 * Zod before the query, the provider's message to the log and a sentence to
 * the editor.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { adjustInventorySchema, type AdminActionResult } from "@/src/schemas/orders";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  revalidateProductsBySlug,
} from "./shared";

/**
 * Set a product's stock to a counted figure.
 *
 * Absolute, not a delta, and deliberately so: this is the control an editor
 * uses after counting the shelf, and "set it to what I counted" is the only
 * instruction that stays correct on a page that was left open while sales came
 * in. A delta would silently double-apply.
 */
export async function adjustInventory(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = adjustInventorySchema.safeParse(input);
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
    .from("Product")
    .update({ inventory: parsed.data.inventory })
    .eq("slug", parsed.data.slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] adjustInventory failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  if (!data) {
    return { ok: false, message: "That product no longer exists." };
  }

  console.info(
    `[admin] ${actor.email} set stock for ${parsed.data.slug} to ${parsed.data.inventory}`,
  );

  await revalidateProductsBySlug([parsed.data.slug]);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `Stock set to ${parsed.data.inventory}.`,
  };
}
