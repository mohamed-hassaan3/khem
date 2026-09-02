"use server";

/**
 * Stock corrections.
 *
 * Separate from `./orders.ts` because the two move stock for opposite reasons.
 * An order consumes units and must do so under a lock, inside the same
 * transaction that records the sale — that is why it goes through
 * `place_order()`. Everything here is a human telling the database what
 * happened away from the website: a sale at the counter, a delivery arriving, a
 * shelf recounted, units moved between the two.
 *
 * ## Two counters, and a ledger
 *
 * Since `supabase/sql/0042_inventory_channels.sql` stock is two independent
 * numbers. The website sells from `"inventoryOnline"`; the desk sells from
 * `"inventoryOffline"`; neither borrows from the other. Every function below
 * goes through a database function that writes an `"InventoryMovement"` row in
 * the same transaction as the change, so no path in this file can alter a count
 * without leaving a record of why.
 *
 * Same contract as every action in this directory: `requireAdmin()` first,
 * Zod before the query, the provider's message to the log and a sentence to
 * the editor.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  adjustInventorySchema,
  offlineSaleSchema,
  receiveStockSchema,
  transferStockSchema,
  type AdminActionResult,
} from "@/src/schemas/orders";

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

  const { error } = await supabase.rpc("set_channel_stock", {
    p_slug: parsed.data.slug,
    p_channel: parsed.data.channel,
    p_quantity: parsed.data.inventory,
    p_reason: "Counted correction",
    p_actor: actor.email,
  });

  if (error) {
    console.error(`[admin] adjustInventory failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  console.info(
    `[admin] ${actor.email} set ${parsed.data.channel} stock for ${parsed.data.slug} to ${parsed.data.inventory}`,
  );

  await revalidateProductsBySlug([parsed.data.slug]);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `${label(parsed.data.channel)} stock set to ${parsed.data.inventory}.`,
  };
}

/** "Online" / "Offline", for a sentence an editor reads. */
function label(channel: "ONLINE" | "OFFLINE"): string {
  return channel === "ONLINE" ? "Online" : "Offline";
}

/**
 * Units sold at the counter.
 *
 * A **delta**, unlike the correction above, and deliberately: the editor is
 * reporting an event ("we sold three today"), not restating a total. Applying it
 * twice would be wrong, so the form must not resubmit — but the arithmetic is
 * the database's, under the row lock, so two editors filing at once cannot both
 * read the same starting figure.
 */
export async function recordOfflineSale(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = offlineSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.rpc("record_offline_sale", {
    p_slug: parsed.data.slug,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason ?? null,
    p_actor: actor.email,
  });

  if (error) {
    console.error(`[admin] recordOfflineSale failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  console.info(
    `[admin] ${actor.email} recorded an offline sale of ${parsed.data.quantity} for ${parsed.data.slug}`,
  );

  await revalidateProductsBySlug([parsed.data.slug]);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `Offline sale of ${parsed.data.quantity} recorded.`,
  };
}

/** New stock arriving into one counter. */
export async function receiveStock(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = receiveStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.rpc("receive_stock", {
    p_slug: parsed.data.slug,
    p_channel: parsed.data.channel,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason ?? null,
    p_actor: actor.email,
  });

  if (error) {
    console.error(`[admin] receiveStock failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  console.info(
    `[admin] ${actor.email} received ${parsed.data.quantity} into ${parsed.data.channel} for ${parsed.data.slug}`,
  );

  await revalidateProductsBySlug([parsed.data.slug]);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `${parsed.data.quantity} added to ${label(parsed.data.channel).toLowerCase()} stock.`,
  };
}

/**
 * Move units from one counter to the other.
 *
 * Two ledger rows, one transaction — the audit trail shows where they went as
 * well as that they left. The giving side is debited first, so a shortfall
 * aborts before anything has moved.
 */
export async function transferStock(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = transferStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.rpc("transfer_stock", {
    p_slug: parsed.data.slug,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason ?? null,
    p_actor: actor.email,
  });

  if (error) {
    console.error(`[admin] transferStock failed: ${error.message}`);
    return postgresFailure(error, "product");
  }

  console.info(
    `[admin] ${actor.email} transferred ${parsed.data.quantity} ${parsed.data.from}→${parsed.data.to} for ${parsed.data.slug}`,
  );

  await revalidateProductsBySlug([parsed.data.slug]);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `${parsed.data.quantity} moved to ${label(parsed.data.to).toLowerCase()} stock.`,
  };
}
