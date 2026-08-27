"use server";

/**
 * Stockist writes — the boutique's own map of where it is sold.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export — the admin layout's gate protects pages, not
 * endpoints — and every input is parsed by `schemas/stockists.ts` before a
 * value reaches a query.
 *
 * ## Two constraints, enforced twice on purpose
 *
 * `"Stockist"` refuses an announced location that carries contact details, and
 * an open one that carries no address. Those CHECKs are what make the invariant
 * *true*; the Zod rules in `schemas/stockists.ts` are what make it **legible**,
 * landing the complaint on the field rather than as a constraint name. Neither
 * is redundant: the schema without the CHECK could be bypassed by any other
 * writer, and the CHECK without the schema would show an editor
 * `stockist_open_has_address`.
 *
 * ## Every write revalidates
 *
 * `/stockists` is ISR at an hour. Without `revalidateStockists()` an editor
 * adds a boutique, reloads the public page, sees nothing, and concludes the
 * save failed.
 *
 * ## Logging
 *
 * Actor and stockist id. These rows are public information — a shop's address
 * is on the website — so the rule here is brevity rather than privacy.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateStockists } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  createStockistSchema,
  deleteStockistSchema,
  setStockistPublishedSchema,
  updateStockistSchema,
} from "@/src/schemas/stockists";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

/** Add a location to the directory. */
export async function createStockist(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createStockistSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("Stockist").insert(parsed.data);

  if (error) {
    console.error(
      `[admin] createStockist rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "stockist");
  }

  revalidateStockists();
  console.info(`[admin] stockist created by ${actor.email} → ${parsed.data.id}`);

  return {
    ok: true,
    slug: parsed.data.id,
    message: `${parsed.data.name} added to the directory.`,
  };
}

/** Edit one. The id identifies the row and is never part of the update. */
export async function updateStockist(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateStockistSchema.safeParse(input);
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
    .from("Stockist")
    .update(fields)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] updateStockist rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "stockist");
  }

  if (!data) {
    return { ok: false, message: "That location no longer exists." };
  }

  revalidateStockists();
  console.info(`[admin] stockist updated by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: `${parsed.data.name} saved.` };
}

/**
 * Show or hide a location without opening the editor.
 *
 * Unpublishing is the reversible way to take a boutique off the public
 * directory — the row, its Arabic copy and its photograph all survive. That is
 * why the table screen offers this and not deletion.
 */
export async function setStockistPublished(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setStockistPublishedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid change." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Stockist")
    .update({ isPublished: parsed.data.isPublished })
    .eq("id", parsed.data.id)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] setStockistPublished rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "stockist");
  }

  if (!data) {
    return { ok: false, message: "That location no longer exists." };
  }

  revalidateStockists();
  console.info(
    `[admin] ${actor.email} ${parsed.data.isPublished ? "published" : "hid"} ${parsed.data.id}`,
  );

  const name = typeof data.name === "string" ? data.name : "That location";

  return {
    ok: true,
    slug: parsed.data.id,
    message: parsed.data.isPublished
      ? `${name} is on the public directory.`
      : `${name} is hidden from the public directory.`,
  };
}

/**
 * Remove a location outright.
 *
 * Offered from the editor rather than the table, and behind a confirmation,
 * because unlike unpublishing there is nothing to undo: the row, both languages
 * of its copy and its image reference all go. Nothing references `"Stockist"`,
 * so there is no cascade to reason about.
 */
export async function deleteStockist(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteStockistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid location." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from("Stockist")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[admin] deleteStockist rejected (${actor.email}): ${error.message}`,
    );
    return postgresFailure(error as PostgresErrorLike, "stockist");
  }

  if (!data) {
    return { ok: false, message: "That location no longer exists." };
  }

  revalidateStockists();
  console.info(`[admin] stockist deleted by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Location removed." };
}
