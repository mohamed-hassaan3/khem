import "server-only";

/**
 * House settings reads for the dashboard.
 *
 * Reads with the secret key, and here the reason is neither secrecy (a social
 * profile is on the website) nor RLS hiding drafts (nothing in these tables is
 * unpublished). It is that the *projection* differs: the dashboard needs the
 * Arabic columns unresolved and the sort order, and the public column lists
 * carry neither. Using one client for every admin read also means no screen
 * beneath `requireAdmin()` has to reason about which one it holds.
 *
 * House rules unchanged: explicit column lists, rows parsed rather than
 * asserted, failures that return an empty projection and log the provider's
 * message rather than throwing into a page.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import {
  ADMIN_CONTACT_CHANNEL_COLUMNS,
  ADMIN_SOCIAL_PROFILE_COLUMNS,
  BOUTIQUE_SETTING_COLUMNS,
  toAdminContactChannel,
  toAdminSocialProfile,
  toBoutiqueSetting,
  type AdminContactChannel,
  type AdminSocialProfile,
  type BoutiqueSetting,
} from "@/src/schemas/db/directory";
import {
  DELIVERY_SETTING_COLUMNS,
  toDeliverySetting,
  type DeliverySetting,
} from "@/src/schemas/db/delivery";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/**
 * The singleton row, or `null`.
 *
 * Null rather than the fallback `src/services/settings.ts` returns, and the
 * difference is deliberate: that fallback exists so an enquiry always has
 * somewhere to go, which is the right answer when the site is *sending* mail.
 * On an editing screen it would be a lie — showing `info@…` in three inputs the
 * editor did not set, which a save would then write to the database as though
 * they had.
 */
export async function getAdminSettings(): Promise<BoutiqueSetting | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("BoutiqueSetting")
    .select(BOUTIQUE_SETTING_COLUMNS)
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    logFailure("getAdminSettings", error.message);
    return null;
  }

  return toBoutiqueSetting(data);
}

/**
 * Both delivery rows, online first.
 *
 * Ordered by `channel` rather than left to the row order: the form renders one
 * card per channel and "Online" belongs above "Offline" on a screen where one of
 * them decides what every visitor is charged.
 *
 * An empty array on failure, like every other read here. The form renders a
 * notice rather than a blank pair of inputs that a save would then write.
 */
export async function listDeliverySettings(): Promise<DeliverySetting[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("DeliverySetting")
    .select(DELIVERY_SETTING_COLUMNS)
    .order("channel");

  if (error) {
    logFailure("listDeliverySettings", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toDeliverySetting);
}

/** Every contact channel, in the order `/contact` renders them. */
export async function listAdminContactChannels(): Promise<AdminContactChannel[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ContactChannel")
    .select(ADMIN_CONTACT_CHANNEL_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("listAdminContactChannels", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toAdminContactChannel);
}

/** Every social profile, in the order the signatures print them. */
export async function listAdminSocialProfiles(): Promise<AdminSocialProfile[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("SocialProfile")
    .select(ADMIN_SOCIAL_PROFILE_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("listAdminSocialProfiles", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toAdminSocialProfile);
}
