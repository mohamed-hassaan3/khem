"use server";

/**
 * The menu, edited.
 *
 * The Nav and the Footer are `"NavLink"` rows (`supabase/sql/0048_navigation.sql`),
 * and these four actions are the whole of what can be done to them: add an
 * entry, edit one, move one, remove one.
 *
 * ## What an editor cannot do here, deliberately
 *
 * **Type a URL.** Every write names a category, a collection, or one of the
 * static pages the code routes, and the address is derived at render time. A
 * mistyped destination is therefore not a 404 — it is not expressible. It also
 * means the CMS cannot be used to point the header at an external site, which
 * is the reason no `href` field exists rather than an oversight to fix later.
 *
 * **Break the shape.** One level of nesting is enforced by a trigger, and the
 * "exactly one target" rule by a check constraint. Both are re-stated in
 * `schemas/admin.ts` so a mistake reads as a sentence in the form, but the
 * database is what actually holds.
 *
 * Same contract as every action in this directory: `requireAdmin()` first, Zod
 * before the query, the provider's message to the log and a sentence to the
 * editor.
 */

import { randomUUID } from "node:crypto";

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateNavigation } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  createNavLinkSchema,
  moveNavLinkSchema,
  updateNavLinkSchema,
  type AdminActionResult,
} from "@/src/schemas/admin";

import { UNCONFIGURED, fieldErrorsFrom, postgresFailure } from "./shared";

/** The row shape both writes send, minus the id. */
function toRow(data: {
  columnKey: "COLLECTIONS" | "QUICK_ACCESS" | "WORLD";
  parentId: string | null;
  targetType: "CATEGORY" | "COLLECTION" | "PAGE" | "GROUP";
  categorySlug: string | null;
  collectionSlug: string | null;
  pageKey: string | null;
  groupKey: string | null;
  label: string | null;
  desc: string | null;
  showInNav: boolean;
  showInFooter: boolean;
  isEnabled: boolean;
  sortOrder: number;
}) {
  return {
    // `column_key` is the one snake_case column in the schema — `column` is
    // reserved enough in enough places that quoting it everywhere was worse.
    column_key: data.columnKey,
    parentId: data.parentId,
    targetType: data.targetType,
    categorySlug: data.categorySlug,
    collectionSlug: data.collectionSlug,
    pageKey: data.pageKey,
    groupKey: data.groupKey,
    label: data.label,
    desc: data.desc,
    showInNav: data.showInNav,
    showInFooter: data.showInFooter,
    isEnabled: data.isEnabled,
    sortOrder: data.sortOrder,
    updatedAt: new Date().toISOString(),
  };
}

/** Add an entry to a column, or to a disclosure inside one. */
export async function createNavLink(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createNavLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  /*
   * A generated id, unlike everything else in this catalog.
   *
   * Elsewhere an id is the slug, because the row *is* the thing named. A menu
   * entry is not: the same collection can legitimately appear twice — once in
   * its category's disclosure and once in Quick Access — so there is nothing
   * unique about it to name the row after.
   */
  const id = `nav-${randomUUID()}`;

  const { error } = await supabase
    .from("NavLink")
    .insert({ id, ...toRow(parsed.data) });

  if (error) {
    console.error(`[admin] createNavLink rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error, "menu entry");
  }

  revalidateNavigation();
  console.log(`[admin] menu entry added by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: "Menu entry added." };
}

/** Edit an entry: its target, its wording, or where it is shown. */
export async function updateNavLink(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateNavLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { id, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("NavLink")
    .update(toRow(rest))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateNavLink rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error, "menu entry");
  }

  // supabase-js resolves happily when the filter matched nothing.
  if (!data) {
    return { ok: false, message: "That menu entry no longer exists." };
  }

  revalidateNavigation();
  console.log(`[admin] menu entry updated by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: "Menu entry saved." };
}

/**
 * Move an entry up or down among its siblings.
 *
 * Siblings, not the whole table: a row inside a disclosure moves within that
 * disclosure, and a top-level row within its column. Every sibling's position
 * is rewritten on save, exactly as `moveSection()` does, so gaps are transient
 * rather than a state anything has to survive.
 */
export async function moveNavLink(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = moveNavLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error: readError } = await supabase
    .from("NavLink")
    .select('id, column_key, "parentId", "sortOrder"')
    .order("sortOrder");

  if (readError) {
    console.error(`[admin] moveNavLink read failed: ${readError.message}`);
    return postgresFailure(readError, "menu entry");
  }

  const rows = (data ?? []) as {
    id: string;
    column_key: string;
    parentId: string | null;
    sortOrder: number;
  }[];

  const target = rows.find((row) => row.id === parsed.data.id);
  if (!target) {
    return { ok: false, message: "That menu entry no longer exists." };
  }

  const siblings = rows.filter(
    (row) =>
      row.column_key === target.column_key && row.parentId === target.parentId,
  );

  const from = siblings.findIndex((row) => row.id === target.id);
  const to = from + (parsed.data.direction === "up" ? -1 : 1);

  if (to < 0 || to >= siblings.length) {
    // Already at the end of its travel. Not an error — the button should have
    // been disabled — so this reports success without writing.
    return { ok: true, slug: target.id, message: "Already there." };
  }

  const reordered = [...siblings];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  for (const [index, row] of reordered.entries()) {
    const { error } = await supabase
      .from("NavLink")
      .update({ sortOrder: index, updatedAt: new Date().toISOString() })
      .eq("id", row.id);

    if (error) {
      console.error(`[admin] moveNavLink write failed on ${row.id}: ${error.message}`);
      return postgresFailure(error, "menu entry");
    }
  }

  revalidateNavigation();
  console.info(
    `[admin] ${actor.email} moved menu entry ${target.id} ${parsed.data.direction}`,
  );

  return { ok: true, slug: target.id, message: "Menu order saved." };
}

/**
 * Remove an entry.
 *
 * A disclosure takes its rows with it — `"parentId"` cascades — which is the
 * honest reading of deleting a heading: the rows beneath it were reachable only
 * through it. Nothing in the catalogue is touched; a menu entry is a pointer.
 */
export async function deleteNavLink(id: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, message: "No menu entry was named." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("NavLink").delete().eq("id", id);

  if (error) {
    console.error(`[admin] deleteNavLink rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error, "menu entry");
  }

  revalidateNavigation();
  console.log(`[admin] menu entry deleted by ${actor.email} → ${id}`);

  return { ok: true, slug: id, message: "Menu entry removed." };
}
