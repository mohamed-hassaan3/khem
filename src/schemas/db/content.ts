/**
 * Row schemas for the editorial content tables.
 *
 * Same contract as `catalog.ts`: rows are parsed, never asserted, and a
 * malformed one is dropped rather than allowed to blank the section it belongs
 * to. Where the database stores an image as two flat columns, the mapper
 * rebuilds the `{ url, alt }` pair the components read — the shape stays a
 * property of the type, not of the storage.
 */

import { z } from "zod";

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

/** The closed olfactive vocabulary, mirroring `IngredientFamily`. */
const ingredientFamilySchema = z.enum([
  "Woody Aromas",
  "Floral",
  "Fresh / Citrus",
  "Fruity",
  "Oriental Aromas",
  "Aquatic Aromas",
  "Herbal",
]);

// ── Testimonial ───────────────────────────────────────────────

export const TESTIMONIAL_COLUMNS = "id, quote, author, authorTitle";

const testimonialRowSchema = z.object({
  id: z.string(),
  quote: z.string(),
  author: z.string(),
  authorTitle: z.string(),
});

export function toTestimonial(row: unknown): Testimonial | null {
  const parsed = testimonialRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Ingredient ────────────────────────────────────────────────

export const INGREDIENT_COLUMNS =
  "id, name, slug, latinName, origin, families, rarity, priceTier, description, " +
  "facts, imageUrl, imageAlt, usedIn:IngredientUsage(name, productSlug, sortOrder)";

const ingredientUsageRowSchema = z.object({
  name: z.string(),
  productSlug: z.string(),
  sortOrder: z.number().default(0),
});

const ingredientRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  latinName: z.string(),
  origin: z.string(),
  families: z.array(ingredientFamilySchema),
  rarity: z.string(),
  priceTier: z.number(),
  description: z.string(),
  facts: z.array(z.string()),
  imageUrl: z.string(),
  imageAlt: z.string(),
  usedIn: z.array(ingredientUsageRowSchema).default([]),
});

export function toIngredient(row: unknown): Ingredient | null {
  const parsed = ingredientRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { imageUrl, imageAlt, usedIn, ...ingredient } = parsed.data;

  return {
    ...ingredient,
    usedIn: [...usedIn]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((usage) => ({ name: usage.name, slug: usage.productSlug })),
    image: { url: imageUrl, alt: imageAlt },
  };
}

// ── Article ───────────────────────────────────────────────────

export const ARTICLE_COLUMNS =
  "id, slug, title, category, excerpt, publishedAt, readTimeMinutes, isFeatured, " +
  "imageUrl, imageAlt";

const articleRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  excerpt: z.string(),
  /* A `date` column; PostgREST renders it as `YYYY-MM-DD`, which is the ISO-8601
   * the type promises and `formatArticleDate()` parses. */
  publishedAt: z.string(),
  readTimeMinutes: z.number(),
  isFeatured: z.boolean(),
  imageUrl: z.string(),
  imageAlt: z.string(),
});

export function toArticle(row: unknown): JournalArticle | null {
  const parsed = articleRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { imageUrl, imageAlt, ...article } = parsed.data;
  return { ...article, image: { url: imageUrl, alt: imageAlt } };
}

// ── Heritage and About ────────────────────────────────────────

export const TIMELINE_COLUMNS = "id, year, title, description";

const timelineRowSchema = z.object({
  id: z.string(),
  year: z.string(),
  title: z.string(),
  description: z.string(),
});

export function toTimelineEvent(row: unknown): TimelineEvent | null {
  const parsed = timelineRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const BRAND_VALUE_COLUMNS = "id, title, description";

const brandValueRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
});

export function toBrandValue(row: unknown): BrandValue | null {
  const parsed = brandValueRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const MISSION_STATEMENT_COLUMNS = "id, label, title, text";

const missionStatementRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  title: z.string(),
  text: z.string(),
});

export function toMissionStatement(row: unknown): MissionStatement | null {
  const parsed = missionStatementRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Craftsmanship ─────────────────────────────────────────────

export const CRAFT_PILLAR_COLUMNS = "id, number, title, description";

const craftPillarRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  description: z.string(),
});

export function toCraftPillar(row: unknown): CraftPillar | null {
  const parsed = craftPillarRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CRAFT_STEP_COLUMNS =
  "id, number, title, subtitle, body, imageUrl, imageAlt";

const craftStepRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  subtitle: z.string(),
  body: z.string(),
  imageUrl: z.string(),
  imageAlt: z.string(),
});

export function toCraftStep(row: unknown): CraftStep | null {
  const parsed = craftStepRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { imageUrl, imageAlt, ...step } = parsed.data;
  return { ...step, image: { url: imageUrl, alt: imageAlt } };
}

export const CRAFT_STAT_COLUMNS = "id, value, label";

const craftStatRowSchema = z.object({
  id: z.string(),
  value: z.string(),
  label: z.string(),
});

export function toCraftStat(row: unknown): CraftStat | null {
  const parsed = craftStatRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CRAFT_QUOTE_COLUMNS = "id, quote, author, authorTitle";

const craftQuoteRowSchema = z.object({
  id: z.string(),
  quote: z.string(),
  author: z.string(),
  authorTitle: z.string(),
});

export function toCraftQuote(row: unknown): CraftQuote | null {
  const parsed = craftQuoteRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
