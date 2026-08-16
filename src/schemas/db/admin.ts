/**
 * Row schemas for the dashboard's reads.
 *
 * The public schemas in `catalog.ts` and `content.ts` describe what a *visitor*
 * may see, and they deliberately omit the columns that decide visibility —
 * `isArchived`, `deletedAt`, `isPublished` — because no public surface reads
 * them. An editor's list is exactly the view where those columns are the point:
 * a dashboard that cannot show you the archived product is a dashboard you
 * cannot un-archive it from.
 *
 * So these are wider projections of the same tables, used only by
 * `src/services/admin/`. Same rules as everywhere else: explicit column lists,
 * rows parsed rather than asserted, and one malformed row dropped rather than a
 * blanked page.
 *
 * Types are inferred from the schemas here rather than declared in `src/types/`.
 * The types under `src/types/` are the site's public vocabulary — shared by
 * components, services and pages — while these shapes have exactly one consumer
 * each, and a hand-written interface beside them would be a second thing to
 * keep in step for no reader's benefit.
 */

import { z } from "zod";

import { parseList } from "./catalog";

const collectionKindSchema = z.enum([
  "FRAGRANCE",
  "BODY",
  "HOME",
  "DISCOVERY",
  "GIFT",
]);

const concentrationSchema = z.enum([
  "PARFUM",
  "EXTRAIT_DE_PARFUM",
  "EAU_DE_PARFUM",
  "ATTAR_OIL",
]);

const productTagSchema = z.enum(["NEW_ARRIVAL", "LIMITED_EDITION"]);

// ── Collection ────────────────────────────────────────────────

export const ADMIN_COLLECTION_COLUMNS =
  "id, name, slug, description, bannerUrl, bannerAlt, isFeatured, kind, sortOrder";

const adminCollectionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  isFeatured: z.boolean(),
  kind: collectionKindSchema,
  sortOrder: z.number(),
});

export type AdminCollection = z.infer<typeof adminCollectionRowSchema>;

export function toAdminCollection(row: unknown): AdminCollection | null {
  const parsed = adminCollectionRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Product ───────────────────────────────────────────────────

/**
 * Never `select('*')` — `"Product"` carries a 1536-float `embedding` and two
 * generated search columns, none of which any dashboard screen renders and all
 * of which would ride into the page payload.
 */
export const ADMIN_PRODUCT_COLUMNS =
  "id, name, slug, subtitle, description, story, concentration, format, includes, " +
  "badge, tags, topNotes, heartNotes, baseNotes, volumeMl, priceInCents, " +
  "sku, inventory, isBestseller, collectionSlug, sortOrder, isArchived, updatedAt";

/** The edit screen additionally needs the gallery it is about to rewrite. */
export const ADMIN_PRODUCT_WITH_IMAGES_COLUMNS =
  `${ADMIN_PRODUCT_COLUMNS}, images:ProductImage(id, url, alt, isPrimary, sortOrder)`;

const adminImageRowSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
});

export type AdminProductImage = z.infer<typeof adminImageRowSchema>;

const adminProductRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  subtitle: z.string().nullable(),
  description: z.string(),
  story: z.string().nullable(),
  concentration: concentrationSchema.nullable(),
  format: z.string().nullable(),
  includes: z.array(z.string()),
  badge: z.string().nullable(),
  tags: z.array(productTagSchema),
  topNotes: z.array(z.string()),
  heartNotes: z.array(z.string()),
  baseNotes: z.array(z.string()),
  volumeMl: z.number(),
  priceInCents: z.number(),
  sku: z.string(),
  inventory: z.number(),
  isBestseller: z.boolean(),
  collectionSlug: z.string(),
  sortOrder: z.number(),
  isArchived: z.boolean(),
  updatedAt: z.string(),
  images: z.array(adminImageRowSchema).default([]),
});

export type AdminProduct = z.infer<typeof adminProductRowSchema>;

export function toAdminProduct(row: unknown): AdminProduct | null {
  const parsed = adminProductRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    images: [...parsed.data.images].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

// ── Article ───────────────────────────────────────────────────

export const ADMIN_ARTICLE_COLUMNS =
  "id, slug, title, category, excerpt, publishedAt, readTimeMinutes, " +
  "isFeatured, isPublished, imageUrl, imageAlt";

const adminArticleRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  excerpt: z.string(),
  /* A `date` column; PostgREST renders it `YYYY-MM-DD`, which is what the
   * `<input type="date">` on the form wants back. */
  publishedAt: z.string(),
  readTimeMinutes: z.number(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  imageUrl: z.string(),
  imageAlt: z.string(),
});

export type AdminArticle = z.infer<typeof adminArticleRowSchema>;

export function toAdminArticle(row: unknown): AdminArticle | null {
  const parsed = adminArticleRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
