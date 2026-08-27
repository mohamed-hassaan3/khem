"use server";

/**
 * Dismissing what a customer has already seen.
 *
 * The only write the customer's notification panel has. Everything a
 * notification *says* is a fact about an order, a credit or a grant, and lives
 * in those rows.
 *
 * ## The owner is never in the payload
 *
 * A Server Action is a public HTTP endpoint. The caller may say *what* was read;
 * *whose* comes from `getUserId()` and is passed into the SQL function as its
 * own parameter. So the worst a forged `(kind, entityId)` can do is write a read
 * row for something that is not in that customer's feed — it can never mark
 * somebody else's notifications read, and it can never read one.
 */

import { getUserId } from "@/src/lib/auth";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { markCustomerReadSchema } from "@/src/schemas/preferences";

export interface MarkReadResult {
  ok: boolean;
}

export async function markNotificationsRead(
  input: unknown,
): Promise<MarkReadResult> {
  const clerkUserId = await getUserId();
  if (clerkUserId === null) return { ok: false };

  const parsed = markCustomerReadSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };

  const { error } = await supabase.rpc("mark_customer_notifications_read", {
    owner: clerkUserId,
    items: parsed.data.items,
  });

  if (error) {
    // The id is safe to log; nothing about what was read is.
    console.error(`[notifications] mark read failed for ${clerkUserId}`);
    return { ok: false };
  }

  return { ok: true };
}
