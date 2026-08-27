import "server-only";

/**
 * What the desk should look at, and what is running out.
 *
 * Two reads, deliberately separate because they answer different questions:
 *
 *   `listAdminNotifications()` — **events**. Things that happened, newest first,
 *   each carrying whether anybody has marked it read. One RPC over four sources;
 *   see `supabase/sql/0031_admin_notifications.sql` for why the feed is derived
 *   rather than stored.
 *
 *   `listLowStock()` — a **condition**. Products below the shelf threshold right
 *   now. It cannot be dismissed and does not need to be: it disappears when the
 *   shelf is refilled, which is the only thing that should make it disappear.
 *
 * Secret key, behind `requireAdmin()`, same failure posture as every neighbour:
 * log the provider's message and return an empty projection rather than throwing
 * into the dashboard chrome. A bell that cannot load is a bell that shows
 * nothing — never a dashboard that will not render.
 */

import { LOW_STOCK_THRESHOLD } from "@/src/lib/inventory";
import { NOTIFICATION_LIMIT } from "@/src/schemas/notifications";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  parseList,
  toAdminNotification,
  toLowStockItem,
} from "@/src/schemas/db/notifications";
import type { AdminNotification, LowStockItem } from "@/src/types/notification";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

export async function listAdminNotifications(): Promise<AdminNotification[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("admin_notification_feed", {
    max_items: NOTIFICATION_LIMIT,
  });

  if (error) {
    logFailure("listAdminNotifications", error.message);
    return [];
  }

  return parseList(data, toAdminNotification);
}

/**
 * Products at or below the threshold, emptiest first.
 *
 * `LOW_STOCK_THRESHOLD` is the site's single definition — the same constant the
 * storefront's stock chip and the inventory screen read, so the bell cannot
 * disagree with the badge on the product row about what "low" means.
 */
export async function listLowStock(): Promise<LowStockItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select("slug, name, inventory")
    .eq("isArchived", false)
    .lt("inventory", LOW_STOCK_THRESHOLD)
    .order("inventory", { ascending: true })
    .limit(20);

  if (error) {
    logFailure("listLowStock", error.message);
    return [];
  }

  return parseList(data, toLowStockItem);
}
