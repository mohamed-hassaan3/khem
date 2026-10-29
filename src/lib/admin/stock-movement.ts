import { getSupabaseAdmin } from "@/src/lib/supabase";

/** The single application entry point for a positive stock movement. */
export async function addStockMovement(input: {
  slug: string;
  channel: "ONLINE" | "OFFLINE";
  quantity: number;
  reason: "restock" | "initial stock";
  actor: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "Enter a positive whole number." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, message: "Stock service is not configured." };

  const { error } = await supabase.rpc("add_stock_movement", {
    p_slug: input.slug,
    p_channel: input.channel,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_actor: input.actor,
  });

  if (error) {
    console.error(`[admin] addStockMovement failed for ${input.slug}: ${error.message}`);
    return { ok: false, message: "Stock could not be updated. Please try again." };
  }

  return { ok: true };
}
