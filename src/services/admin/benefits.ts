import "server-only";

/**
 * The `"BenefitSetting"` row, for the dashboard.
 *
 * A separate module from `src/services/benefits.ts` for the reason every
 * `admin/` twin in this directory exists: the storefront reads through the
 * publishable key and is memoised per request, and neither is right behind
 * `requireAdmin()` — an editor who has just saved must see what they saved, not
 * a value cached earlier in the same render.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  BENEFIT_FALLBACK,
  BENEFIT_SETTING_COLUMNS,
  toBenefitSettings,
} from "@/src/schemas/db/benefits";
import type { BenefitSettings } from "@/src/types/benefits";

export async function getAdminBenefitSettings(): Promise<BenefitSettings> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return BENEFIT_FALLBACK;

  const { data, error } = await supabase
    .from("BenefitSetting")
    .select(BENEFIT_SETTING_COLUMNS)
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.error(`[admin] getAdminBenefitSettings failed: ${error.message}`);
    return BENEFIT_FALLBACK;
  }

  return toBenefitSettings(data) ?? BENEFIT_FALLBACK;
}
