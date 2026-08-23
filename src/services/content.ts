/**
 * Editorial content query layer.
 *
 * Same contract and same rules as `products.ts`: reads through the publishable
 * key so RLS applies, explicit column lists, rows parsed rather than asserted,
 * and a failure degrades a section to its empty state instead of taking the
 * page down.
 */

import "server-only";

import { getSupabasePublic } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import {
  ARTICLE_CARD_COLUMNS,
  ARTICLE_COLUMNS,
  BRAND_VALUE_COLUMNS,
  CRAFT_PILLAR_COLUMNS,
  CRAFT_QUOTE_COLUMNS,
  CRAFT_STAT_COLUMNS,
  CRAFT_STEP_COLUMNS,
  INGREDIENT_COLUMNS,
  MISSION_STATEMENT_COLUMNS,
  TESTIMONIAL_COLUMNS,
  TIMELINE_COLUMNS,
  toArticle,
  toBrandValue,
  toCraftPillar,
  toCraftQuote,
  toCraftStat,
  toCraftStep,
  toIngredient,
  toMissionStatement,
  toTestimonial,
  toTimelineEvent,
} from "@/src/schemas/db/content";
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

function logFailure(query: string, message: string): void {
  console.error(`[content] ${query} failed: ${message}`);
}

/**
 * The shape every list query here takes: select, order by the curated
 * `sortOrder`, parse, drop what does not fit.
 */
async function list<T>(
  label: string,
  table: string,
  columns: string,
  parse: (row: unknown) => T | null,
  order = "sortOrder",
): Promise<T[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase.from(table).select(columns).order(order);

  if (error) {
    logFailure(label, error.message);
    return [];
  }

  return parseList(data as unknown[] | null, parse);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return list("getTestimonials", "Testimonial", TESTIMONIAL_COLUMNS, toTestimonial);
}

export async function getIngredients(): Promise<Ingredient[]> {
  return list("getIngredients", "Ingredient", INGREDIENT_COLUMNS, toIngredient);
}

/**
 * Every ingredient with its full detail payload, for `/ingredients`.
 *
 * Identical to {@link getIngredients} today. Kept separate so the home rail can
 * later select a narrow projection while the detail page selects everything —
 * two call sites with different needs should not share one column list by
 * accident.
 */
export async function getIngredientDetails(): Promise<Ingredient[]> {
  return getIngredients();
}

/**
 * The materials a given fragrance is built on, for the PDP's "Key Ingredients"
 * section.
 *
 * The link is a real foreign key: `"IngredientUsage"."productSlug"`. Nothing is
 * derived from the note pyramid, which names accords rather than sourced
 * materials.
 *
 * Returns an empty array for a fragrance with no catalogued material, so the
 * page can omit the section rather than render an empty heading.
 */
export async function getIngredientsForProduct(
  productSlug: string,
): Promise<Ingredient[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Ingredient")
    // `!inner` turns the usage table into a join condition, so this returns the
    // materials used *in this product* rather than every material with the row
    // filtered afterwards.
    .select(INGREDIENT_COLUMNS.replace("IngredientUsage(", "IngredientUsage!inner("))
    .eq("usedIn.productSlug", productSlug)
    .order("sortOrder");

  if (error) {
    logFailure("getIngredientsForProduct", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toIngredient);
}

/** Latest journal articles, newest first. */
export async function getLatestArticles(limit = 3): Promise<JournalArticle[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Article")
    .select(ARTICLE_CARD_COLUMNS)
    .order("publishedAt", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("getLatestArticles", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toArticle);
}

/** Every journal article, newest first. */
export async function getJournalArticles(): Promise<JournalArticle[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Article")
    .select(ARTICLE_CARD_COLUMNS)
    .order("publishedAt", { ascending: false });

  if (error) {
    logFailure("getJournalArticles", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toArticle);
}

/**
 * The promoted article, falling back to the newest one when nothing is flagged.
 *
 * Two queries rather than one, because "the featured article, or else the
 * newest" is two questions: PostgREST has no `order by isFeatured desc nulls
 * last` that would also survive an empty featured set without a second round
 * trip on the common path.
 */
export async function getFeaturedArticle(): Promise<JournalArticle | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Article")
    .select(ARTICLE_CARD_COLUMNS)
    .eq("isFeatured", true)
    .order("publishedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logFailure("getFeaturedArticle", error.message);
    return null;
  }

  const featured = toArticle(data);
  if (featured) return featured;

  const [newest] = await getLatestArticles(1);
  return newest ?? null;
}

/**
 * One article, body included, or `null`.
 *
 * The only query in this file that selects {@link ARTICLE_COLUMNS}: the essay
 * is fetched for the page that renders it and nowhere else.
 *
 * An unpublished article is invisible here without a filter, because the read
 * goes through the publishable key and the RLS policy on `"Article"` publishes
 * `isPublished` rows only. The detail page turns the `null` into a 404.
 */
export async function getArticleBySlug(
  slug: string,
): Promise<JournalArticle | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Article")
    .select(ARTICLE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getArticleBySlug", error.message);
    return null;
  }

  return toArticle(data);
}

/** Published article slugs, for `generateStaticParams()`. */
export async function getArticleSlugs(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Article")
    .select("slug")
    .order("publishedAt", { ascending: false });

  if (error) {
    logFailure("getArticleSlugs", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (typeof row.slug === "string" ? row.slug : null))
    .filter((slug): slug is string => slug !== null);
}

/**
 * "Continue Reading" — the essays nearest this one in meaning.
 *
 * `related_articles()` (supabase/sql/0009_journal.sql) ranks by cosine distance
 * over the pgvector embeddings and falls back to same-category-first when no
 * vector exists, so the rail is full on a database where `npm run embed` has
 * never run.
 *
 * The `.select()` on top of the RPC matters: the function returns
 * `setof "Article"`, so without a projection the response would carry the body
 * of every article in the rail *and* its 1536-float embedding.
 */
export async function getRelatedArticles(
  slug: string,
  limit = 3,
): Promise<JournalArticle[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .rpc("related_articles", { article_slug: slug, match_limit: limit })
    .select(ARTICLE_CARD_COLUMNS);

  if (error) {
    logFailure("getRelatedArticles", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toArticle);
}

/**
 * Categories present in the journal, derived from the records.
 *
 * Derived rather than listed, so a category gains its chip the moment an
 * article uses it and loses it when the last one goes.
 */
export async function getJournalCategories(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [ALL_FILTER];

  const { data, error } = await supabase
    .from("Article")
    .select("category")
    .order("publishedAt", { ascending: false });

  if (error) {
    logFailure("getJournalCategories", error.message);
    return [ALL_FILTER];
  }

  return toFilterOptions(
    (data ?? [])
      .map((row) => (typeof row.category === "string" ? row.category : null))
      .filter((category): category is string => category !== null),
  );
}

export async function getCraftPillars(): Promise<CraftPillar[]> {
  return list("getCraftPillars", "CraftPillar", CRAFT_PILLAR_COLUMNS, toCraftPillar);
}

/** The six atelier stages for `/craftsmanship`, in process order. */
export async function getCraftSteps(): Promise<CraftStep[]> {
  return list("getCraftSteps", "CraftStep", CRAFT_STEP_COLUMNS, toCraftStep);
}

export async function getCraftStats(): Promise<CraftStat[]> {
  return list("getCraftStats", "CraftStat", CRAFT_STAT_COLUMNS, toCraftStat);
}

/**
 * The head perfumer's house statement. Nullable so the section can be dropped
 * entirely when no quote is published.
 */
export async function getMasterPerfumerQuote(): Promise<CraftQuote | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("CraftQuote")
    .select(CRAFT_QUOTE_COLUMNS)
    .order("sortOrder")
    .limit(1)
    .maybeSingle();

  if (error) {
    logFailure("getMasterPerfumerQuote", error.message);
    return null;
  }

  return toCraftQuote(data);
}

export async function getTimeline(): Promise<TimelineEvent[]> {
  return list("getTimeline", "TimelineEvent", TIMELINE_COLUMNS, toTimelineEvent);
}

export async function getBrandValues(): Promise<BrandValue[]> {
  return list("getBrandValues", "BrandValue", BRAND_VALUE_COLUMNS, toBrandValue);
}

export async function getMissionStatements(): Promise<MissionStatement[]> {
  return list(
    "getMissionStatements",
    "MissionStatement",
    MISSION_STATEMENT_COLUMNS,
    toMissionStatement,
  );
}
