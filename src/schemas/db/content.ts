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
  "Gourmand",
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

/**
 * `usedIn` reaches through two foreign keys rather than one.
 *
 * `"IngredientUsage"."productSlug"` references `"Product".slug`
 * (`supabase/sql/0002_content.sql`), and a product's collection carries the
 * `kind` that decides which page it opens on. Selecting that one extra column
 * here is what lets the "Found in" list render through `productHref()` — a
 * material used in a candle links to `/ritual/…` instead of a `/perfume/…` URL
 * that would 404. No migration: existing tables, existing grants, one more
 * column on an embed that was already being made.
 */
export const INGREDIENT_COLUMNS =
  "id, name, slug, latinName, origin, families, rarity, priceTier, description, " +
  "facts, imageUrl, imageAlt, " +
  "usedIn:IngredientUsage(name, productSlug, sortOrder, product:Product(collection:Collection(kind)))";

/** Mirrors `CollectionKind` — the same closed vocabulary `catalog.ts` parses. */
const collectionKindSchema = z.enum([
  "FRAGRANCE",
  "BODY",
  "HOME",
  "DISCOVERY",
  "GIFT",
]);

/*
 * PostgREST renders a to-one embed as an object on some versions and a
 * single-element array on others, so both are accepted — the same union
 * `catalog.ts` uses for `collection:Collection(...)`, and for the same reason:
 * a shape difference must not blank a section.
 */
const embeddedKind = z.object({ kind: collectionKindSchema });

const embeddedProduct = z.object({
  collection: z.union([embeddedKind, z.array(embeddedKind).min(1)]),
});

const ingredientUsageRowSchema = z.object({
  name: z.string(),
  productSlug: z.string(),
  sortOrder: z.number().default(0),
  /*
   * Nullable and optional on purpose. A product hidden by RLS comes back as
   * `null`, and a query made before this embed existed carries nothing at all;
   * either way the usage falls back to `"FRAGRANCE"` below, which is exactly
   * the behaviour that shipped before — a widened `select` can degrade, but it
   * can never empty the list.
   */
  product: z
    .union([embeddedProduct, z.array(embeddedProduct).min(1)])
    .nullable()
    .default(null),
});

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

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
      .map((usage) => ({
        name: usage.name,
        slug: usage.productSlug,
        collectionKind: usage.product
          ? first(first(usage.product).collection).kind
          : "FRAGRANCE",
      })),
    image: { url: imageUrl, alt: imageAlt },
  };
}

// ── Article ───────────────────────────────────────────────────

/**
 * Everything a card needs, and nothing more.
 *
 * The body of a fifteen-minute essay has no business travelling with a grid of
 * six cards, and `embedding` — 1536 floats — has no business leaving the
 * database at all. Both are absent here by construction rather than by
 * discipline at each call site.
 */
export const ARTICLE_CARD_COLUMNS =
  "id, slug, title, category, excerpt, publishedAt, readTimeMinutes, isFeatured, " +
  "imageUrl, imageAlt";

/** The card projection plus the essay. Only `getArticleBySlug()` asks for it. */
export const ARTICLE_COLUMNS = `${ARTICLE_CARD_COLUMNS}, body`;

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
  /*
   * Absent from a card projection and present on the detail one, which is why
   * it defaults rather than being required. The column itself is
   * `not null default ''` in Postgres, so the default describes the *query*,
   * not a row that could be missing the value.
   *
   * One schema for both projections rather than two: a second schema is a
   * second place to add the next column to, and forgetting it there would fail
   * a page rather than a type check.
   */
  body: z.string().default(""),
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
