import "server-only";

/**
 * Editorial content reads for the dashboard.
 *
 * Reads with the secret key for the projection reason rather than the secrecy
 * one — nothing in these tables is private, every row is on a public page. What
 * the public column lists omit is the Arabic twins *unresolved* and the sort
 * order, and an editor needs both: `resolveText()` would hand back the English
 * fallback for an empty Arabic field, and saving that would write the English
 * copy into the Arabic column as though somebody had translated it.
 *
 * House rules unchanged: explicit column lists, rows parsed rather than
 * asserted, failures that return an empty projection and log the provider's
 * message rather than throwing into a page.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import {
  ADMIN_BRAND_VALUE_COLUMNS,
  ADMIN_CRAFT_PILLAR_COLUMNS,
  ADMIN_CRAFT_QUOTE_COLUMNS,
  ADMIN_CRAFT_STAT_COLUMNS,
  ADMIN_CRAFT_STEP_COLUMNS,
  ADMIN_HERO_SETTING_COLUMNS,
  ADMIN_HERO_SLIDE_COLUMNS,
  ADMIN_INGREDIENT_COLUMNS,
  ADMIN_MISSION_STATEMENT_COLUMNS,
  ADMIN_TESTIMONIAL_COLUMNS,
  ADMIN_TIMELINE_COLUMNS,
  toAdminBrandValue,
  toAdminCraftPillar,
  toAdminCraftQuote,
  toAdminCraftStat,
  toAdminCraftStep,
  toAdminHero,
  toAdminIngredient,
  toAdminMissionStatement,
  toAdminTestimonial,
  toAdminTimelineEvent,
  type AdminBrandValue,
  type AdminCraftPillar,
  type AdminCraftQuote,
  type AdminCraftStat,
  type AdminCraftStep,
  type AdminIngredient,
  type AdminMissionStatement,
  type AdminTestimonial,
  type AdminTimelineEvent,
} from "@/src/schemas/db/content";
import type { AdminHero } from "@/src/types/content";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

async function listContent<T>(
  label: string,
  table: string,
  columns: string,
  parse: (row: unknown) => T | null,
): Promise<T[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order("sortOrder");

  if (error) {
    logFailure(label, error.message);
    return [];
  }

  return parseList(data as unknown[] | null, parse);
}

/** The heritage timeline, in the order `/heritage` renders it. */
export async function listAdminTimeline(): Promise<AdminTimelineEvent[]> {
  return listContent(
    "listAdminTimeline",
    "TimelineEvent",
    ADMIN_TIMELINE_COLUMNS,
    toAdminTimelineEvent,
  );
}

/** The craft pillars, in the order the home page renders them. */
export async function listAdminCraftPillars(): Promise<AdminCraftPillar[]> {
  return listContent(
    "listAdminCraftPillars",
    "CraftPillar",
    ADMIN_CRAFT_PILLAR_COLUMNS,
    toAdminCraftPillar,
  );
}

/** The brand values on `/heritage`. */
export async function listAdminBrandValues(): Promise<AdminBrandValue[]> {
  return listContent(
    "listAdminBrandValues",
    "BrandValue",
    ADMIN_BRAND_VALUE_COLUMNS,
    toAdminBrandValue,
  );
}

/** The mission statements on `/about`. */
export async function listAdminMissionStatements(): Promise<
  AdminMissionStatement[]
> {
  return listContent(
    "listAdminMissionStatements",
    "MissionStatement",
    ADMIN_MISSION_STATEMENT_COLUMNS,
    toAdminMissionStatement,
  );
}

export async function listAdminTestimonials(): Promise<AdminTestimonial[]> {
  return listContent(
    "listAdminTestimonials",
    "Testimonial",
    ADMIN_TESTIMONIAL_COLUMNS,
    toAdminTestimonial,
  );
}

/** The six atelier stages on `/craftsmanship`, in process order. */
export async function listAdminCraftSteps(): Promise<AdminCraftStep[]> {
  return listContent(
    "listAdminCraftSteps",
    "CraftStep",
    ADMIN_CRAFT_STEP_COLUMNS,
    toAdminCraftStep,
  );
}

/** The figures in the `/craftsmanship` stat band. */
export async function listAdminCraftStats(): Promise<AdminCraftStat[]> {
  return listContent(
    "listAdminCraftStats",
    "CraftStat",
    ADMIN_CRAFT_STAT_COLUMNS,
    toAdminCraftStat,
  );
}

/**
 * Every craft quote, published or not.
 *
 * The secret key matters here rather than merely being consistent: the RLS
 * policy on `"CraftQuote"` filters unpublished rows out of any public read, so
 * an editor holding the publishable key could not see the row they had just
 * unpublished — or find it again to put back.
 */
export async function listAdminCraftQuotes(): Promise<AdminCraftQuote[]> {
  return listContent(
    "listAdminCraftQuotes",
    "CraftQuote",
    ADMIN_CRAFT_QUOTE_COLUMNS,
    toAdminCraftQuote,
  );
}

/** Every material, in the order `/ingredients` renders them. */
export async function listAdminIngredients(): Promise<AdminIngredient[]> {
  return listContent(
    "listAdminIngredients",
    "Ingredient",
    ADMIN_INGREDIENT_COLUMNS,
    toAdminIngredient,
  );
}

/**
 * One material, by its slug — the value in the URL.
 *
 * The row is addressed by `id` everywhere else (it is what `"IngredientUsage"`
 * points at), but `slug` is the readable half and the one an editor can type.
 * Both are unique, so either works; the form carries the id for its writes.
 */
export async function getAdminIngredient(
  slug: string,
): Promise<AdminIngredient | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Ingredient")
    .select(ADMIN_INGREDIENT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getAdminIngredient", error.message);
    return null;
  }

  return toAdminIngredient(data);
}

/**
 * The hero, as the editor holds it.
 *
 * `null` only when the database is unreachable or the singleton row is missing
 * — `0037_hero.sql` inserts it, so the screen renders an explanatory empty state
 * rather than a form whose save would write nothing.
 *
 * The slides come back whatever the media type says. An editor who switched to
 * video for a fortnight still has their campaign images listed underneath, which
 * is the whole reason the rows are kept rather than deleted on the switch.
 */
export async function getAdminHero(): Promise<AdminHero | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const [setting, slides] = await Promise.all([
    supabase
      .from("HeroSetting")
      .select(ADMIN_HERO_SETTING_COLUMNS)
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("HeroSlide")
      .select(ADMIN_HERO_SLIDE_COLUMNS)
      .order("sortOrder")
      .order("createdAt"),
  ]);

  if (setting.error) {
    logFailure("getAdminHero", setting.error.message);
    return null;
  }

  if (slides.error) {
    logFailure("getAdminHero slides", slides.error.message);
  }

  return toAdminHero(setting.data, slides.data as unknown[] | null);
}
