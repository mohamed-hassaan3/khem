/**
 * Editorial content query layer.
 *
 * Same contract as `products.ts`: the UI awaits these functions, so swapping the
 * source (Supabase table, CMS, or pgvector-backed article store) is a change of
 * function bodies only.
 */

// NOTE: add `import "server-only"` here once that package is installed.

import {
  CRAFT_PILLARS,
  INGREDIENTS,
  JOURNAL_ARTICLES,
  TESTIMONIALS,
} from "@/src/data/content";
import type {
  CraftPillar,
  Ingredient,
  JournalArticle,
  Testimonial,
} from "@/src/types/content";

/** → supabase.from('Testimonial').select('*').eq('isPublished', true) */
export async function getTestimonials(): Promise<Testimonial[]> {
  return TESTIMONIALS;
}

/** → supabase.from('Ingredient').select('*').order('name') */
export async function getIngredients(): Promise<Ingredient[]> {
  return INGREDIENTS;
}

/**
 * Latest journal articles, newest first.
 *
 * → supabase.from('Article').select('*').order('publishedAt', { ascending: false }).limit(limit)
 */
export async function getLatestArticles(limit = 3): Promise<JournalArticle[]> {
  return [...JOURNAL_ARTICLES]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, limit);
}

/** → supabase.from('CraftPillar').select('*').order('number') */
export async function getCraftPillars(): Promise<CraftPillar[]> {
  return CRAFT_PILLARS;
}
