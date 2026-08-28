import "server-only";

/**
 * Announcement and marketing-settings reads for the dashboard.
 *
 * Secret key, behind `requireAdmin()`, same failure posture as its neighbours:
 * log the provider's message and return an empty projection rather than throwing
 * into a page.
 *
 * The difference from `src/services/marketing.ts` is the whole reason this file
 * exists: that one reads what is **live**, through the publishable key, and this
 * one reads **everything** — a campaign scheduled for next month, one that ended
 * last week, one switched off. Those rows are exactly what the row policies keep
 * from the storefront, and exactly what a desk needs to see.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  ANNOUNCEMENT_COLUMNS,
  MARKETING_SETTING_COLUMNS,
  parseList,
  toAdminAnnouncement,
  toAdminMarketingSettings,
} from "@/src/schemas/db/marketing";
import type {
  AdminAnnouncement,
  AdminMarketingSettings,
} from "@/src/types/marketing";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** Every announcement, in the order the bar would print them. */
export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Announcement")
    .select(ANNOUNCEMENT_COLUMNS)
    .order("sortOrder")
    .order("createdAt");

  if (error) {
    logFailure("listAdminAnnouncements", error.message);
    return [];
  }

  return parseList(data, toAdminAnnouncement);
}

export async function getAdminAnnouncement(
  id: string,
): Promise<AdminAnnouncement | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Announcement")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getAdminAnnouncement", error.message);
    return null;
  }

  return toAdminAnnouncement(data);
}

/**
 * The single `"MarketingSetting"` row.
 *
 * `null` only when the database is unreachable or the row is missing — the
 * migration inserts it, so the editor renders an explanatory empty state rather
 * than a form that would write nothing.
 */
export async function getAdminMarketingSettings(): Promise<AdminMarketingSettings | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("MarketingSetting")
    .select(MARKETING_SETTING_COLUMNS)
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    logFailure("getAdminMarketingSettings", error.message);
    return null;
  }

  return toAdminMarketingSettings(data);
}
