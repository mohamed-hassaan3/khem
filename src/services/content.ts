/**
 * Editorial content query layer.
 *
 * Same contract as `products.ts`: the UI awaits these functions, so swapping the
 * source (Supabase table, CMS, or pgvector-backed article store) is a change of
 * function bodies only.
 */

// NOTE: add `import "server-only"` here once that package is installed.

import {
  BRAND_VALUES,
  CRAFT_PILLARS,
  CRAFT_STATS,
  CRAFT_STEPS,
  INGREDIENT_FAMILIES,
  INGREDIENTS,
  JOURNAL_ARTICLES,
  MASTER_PERFUMER_QUOTE,
  MISSION_STATEMENTS,
  TESTIMONIALS,
  TIMELINE,
} from "@/src/data/content";
import type {
  BrandValue,
  CraftPillar,
  CraftQuote,
  CraftStat,
  CraftStep,
  Ingredient,
  JournalArticle,
  MissionStatement,
  Testimonial,
  TimelineEvent,
} from "@/src/types/content";

/** Filter label meaning "no filter". Shared by the ingredient and journal tab bars. */
export const ALL_FILTER = "All";

/** Distinct values across records, in first-seen order, prefixed with `ALL_FILTER`. */
function toFilterOptions(values: string[]): string[] {
  return [ALL_FILTER, ...new Set(values)];
}

/** → supabase.from('Testimonial').select('*').eq('isPublished', true) */
export async function getTestimonials(): Promise<Testimonial[]> {
  return TESTIMONIALS;
}

/** → supabase.from('Ingredient').select('*').order('name') */
export async function getIngredients(): Promise<Ingredient[]> {
  return INGREDIENTS;
}

/**
 * Every ingredient with its full detail payload, for `/ingredients`.
 *
 * Separate from `getIngredients()` so the home rail can later select a narrow
 * projection while the detail page selects everything.
 *
 * → supabase.from('Ingredient').select('*, usedIn:Product(name, slug)').order('name')
 */
export async function getIngredientDetails(): Promise<Ingredient[]> {
  return INGREDIENTS;
}

/**
 * The materials a given fragrance is built on, for the PDP's "Key Ingredients"
 * section.
 *
 * The link already exists in the data: every ingredient lists the perfumes it
 * appears in (`usedIn[].slug`). Nothing is derived from the note pyramid, which
 * names accords rather than sourced materials.
 *
 * Returns an empty array for a fragrance with no catalogued material, so the
 * page can omit the section rather than render an empty heading.
 *
 * → supabase
 *     .from('Ingredient')
 *     .select('*, usedIn:IngredientUsage!inner(slug)')
 *     .eq('usedIn.slug', productSlug)
 *     .order('name')
 */
export async function getIngredientsForProduct(
  productSlug: string,
): Promise<Ingredient[]> {
  return INGREDIENTS.filter((ingredient) =>
    ingredient.usedIn.some((usage) => usage.slug === productSlug),
  );
}

/**
 * The olfactive filter options for `/ingredients`, in taxonomy order.
 *
 * Read from the canonical `INGREDIENT_FAMILIES` list rather than derived from
 * the records: the seven families are a fixed vocabulary the copy is written
 * against, so the bar must not reorder itself — or grow — when a record is
 * added. `Ingredient.families` is typed against the same union, which is what
 * keeps the two in step.
 *
 * → supabase.from('IngredientFamily').select('name').order('sortOrder')
 */
export async function getIngredientFamilies(): Promise<string[]> {
  return [ALL_FILTER, ...INGREDIENT_FAMILIES];
}

/**
 * Latest journal articles, newest first.
 *
 * → supabase.from('Article').select('*').order('publishedAt', { ascending: false }).limit(limit)
 */
export async function getLatestArticles(limit = 3): Promise<JournalArticle[]> {
  return sortByNewest(JOURNAL_ARTICLES).slice(0, limit);
}

/**
 * Every journal article, newest first.
 *
 * → supabase.from('Article').select('*').order('publishedAt', { ascending: false })
 */
export async function getJournalArticles(): Promise<JournalArticle[]> {
  return sortByNewest(JOURNAL_ARTICLES);
}

/**
 * The promoted article, falling back to the newest one when nothing is flagged.
 *
 * → supabase.from('Article').select('*').eq('isFeatured', true).order('publishedAt', { ascending: false }).limit(1).maybeSingle()
 */
export async function getFeaturedArticle(): Promise<JournalArticle | null> {
  const sorted = sortByNewest(JOURNAL_ARTICLES);
  return sorted.find((article) => article.isFeatured) ?? sorted[0] ?? null;
}

/**
 * Categories present in the journal, derived from the records.
 *
 * → supabase.rpc('distinct_article_categories')
 */
export async function getJournalCategories(): Promise<string[]> {
  return toFilterOptions(JOURNAL_ARTICLES.map((article) => article.category));
}

/** → supabase.from('CraftPillar').select('*').order('number') */
export async function getCraftPillars(): Promise<CraftPillar[]> {
  return CRAFT_PILLARS;
}

/**
 * The six atelier stages for `/craftsmanship`, in process order.
 *
 * → supabase.from('CraftStep').select('*').order('number')
 */
export async function getCraftSteps(): Promise<CraftStep[]> {
  return CRAFT_STEPS;
}

/** → supabase.from('CraftStat').select('*').order('sortOrder') */
export async function getCraftStats(): Promise<CraftStat[]> {
  return CRAFT_STATS;
}

/**
 * The head perfumer's house statement. Nullable so the section can be dropped
 * entirely once this record lives in a table — same contract as
 * `getFeaturedArticle()`.
 *
 * → supabase.from('CraftQuote').select('*').eq('isPublished', true).limit(1).maybeSingle()
 */
export async function getMasterPerfumerQuote(): Promise<CraftQuote | null> {
  return MASTER_PERFUMER_QUOTE;
}

/** → supabase.from('TimelineEvent').select('*').order('sortOrder') */
export async function getTimeline(): Promise<TimelineEvent[]> {
  return TIMELINE;
}

/** → supabase.from('BrandValue').select('*').order('sortOrder') */
export async function getBrandValues(): Promise<BrandValue[]> {
  return BRAND_VALUES;
}

/** → supabase.from('MissionStatement').select('*').order('sortOrder') */
export async function getMissionStatements(): Promise<MissionStatement[]> {
  return MISSION_STATEMENTS;
}

function sortByNewest(articles: JournalArticle[]): JournalArticle[] {
  return [...articles].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
