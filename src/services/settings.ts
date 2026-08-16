/**
 * House-wide settings — the single `"BoutiqueSetting"` row.
 *
 * Three addresses the whole site quotes, plus which fragrance is featured on
 * the home page. They live together because they are one row: reading them
 * separately would be three round trips for three columns.
 *
 * ## The fallback
 *
 * When the row cannot be read, the addresses fall back to {@link HOUSE_EMAIL}.
 * That is not decoration. `inboxAddress()` sends the contact form somewhere, and
 * "somewhere" must never be undefined or an empty string — a swallowed enquiry
 * is worse than a database outage, because nobody finds out. The featured
 * product has no such fallback: an absent feature section is a fine degradation.
 */

import "server-only";

import { HOUSE_EMAIL } from "@/src/constants/contact";
import { getSupabasePublic } from "@/src/lib/supabase";
import {
  BOUTIQUE_SETTING_COLUMNS,
  toBoutiqueSetting,
  type BoutiqueSetting,
} from "@/src/schemas/db/directory";

const FALLBACK: BoutiqueSetting = {
  houseEmail: HOUSE_EMAIL,
  conciergeEmail: HOUSE_EMAIL,
  wholesaleEmail: HOUSE_EMAIL,
  featuredProductSlug: null,
};

export async function getBoutiqueSettings(): Promise<BoutiqueSetting> {
  const supabase = getSupabasePublic();
  if (!supabase) return FALLBACK;

  const { data, error } = await supabase
    .from("BoutiqueSetting")
    .select(BOUTIQUE_SETTING_COLUMNS)
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.error(`[settings] getBoutiqueSettings failed: ${error.message}`);
    return FALLBACK;
  }

  return toBoutiqueSetting(data) ?? FALLBACK;
}
