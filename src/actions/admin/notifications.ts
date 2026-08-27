"use server";

/**
 * Dismissing what the desk has already seen.
 *
 * The only write this feature has. Everything else about a notification — that
 * it exists, what it says, when it happened — is a fact about an order, an
 * account, a redemption or a credit, and lives in those rows.
 *
 * ## Marking read never touches the thing itself
 *
 * In particular it does **not** stamp `"Order"."firstOpenedAt"`. That column
 * means "somebody at the desk opened this order's screen" (0023), and dismissing
 * a bell item is not that. The feed treats an opened order as read — a shortcut
 * in one direction only — so the two signals never have to be reconciled.
 *
 * ## Trust model
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement, as in every sibling here. What the caller may name is a `(kind,
 * entityId)` pair, which grants nothing: the worst a forged pair can do is
 * insert a read row for something that is not in anybody's feed.
 *
 * ## Logging
 *
 * A count and the actor. Never a label, a customer, or an order number.
 */

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/src/lib/admin/auth";
import { ADMIN_PATH } from "@/src/lib/routes";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { markReadSchema } from "@/src/schemas/notifications";
import type { AdminActionResult } from "@/src/schemas/admin";

import { UNCONFIGURED } from "./shared";

export async function markNotificationsRead(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Those notifications could not be marked read." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase.rpc("mark_notifications_read", {
    items: parsed.data.items,
    // The Clerk id from the verified session, never from the form.
    actor: actor.id,
  });

  if (error) {
    console.error(`[admin] markNotificationsRead failed: ${error.message}`);
    return { ok: false, message: "Those notifications could not be marked read." };
  }

  const marked = typeof data === "number" ? data : 0;
  console.info(`[admin] ${marked} notification(s) marked read by ${actor.email}`);

  /*
   * The bell is rendered by the admin layout, so every screen beneath it holds a
   * copy of the feed. Revalidating the layout's own path is what makes the count
   * fall everywhere rather than only on the screen the panel happened to be open
   * over.
   */
  revalidatePath(ADMIN_PATH, "layout");

  return { ok: true, slug: String(marked), message: "Marked as read." };
}
