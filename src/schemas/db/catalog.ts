/**
 * Row schemas for the catalog tables.
 *
 * `supabase-js` is untyped in this repository — no generated `Database` type
 * exists — so a row arrives as `unknown`. These schemas are how it becomes a
 * `Collection` or a `Product`: parsed, not asserted. An assertion would be a
 * lie the compiler believes, and the failure mode of a lie about data shape is
 * a page that crashes in production on a column somebody renamed.
 *
 * Rule everywhere below: **one malformed row is dropped, the list survives.**
 * A single bad product must not blank the collection page it sits on.
 */

import { z } from "zod";

import type {
  Collection,
  Product,
  ProductCardData,
  ProductImage,
} from "@/src/types/catalog";

const concentrationSchema = z.enum([
  "PARFUM",
  "EXTRAIT_DE_PARFUM",
  "EAU_DE_PARFUM",
  "ATTAR_OIL",
]);

const collectionKindSchema = z.enum([
  "FRAGRANCE",
  "BODY",
  "HOME",
  "DISCOVERY",
  "GIFT",
]);

const productTagSchema = z.enum(["NEW_ARRIVAL", "LIMITED_EDITION"]);

/** The `"Collection"` columns, as selected. */
export const collectionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  isFeatured: z.boolean(),
  kind: collectionKindSchema,
});

export const COLLECTION_COLUMNS =
  "id, name, slug, description, bannerUrl, bannerAlt, isFeatured, kind";

export function toCollection(row: unknown): Collection | null {
  const parsed = collectionRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const imageRowSchema = z.object({
  url: z.string(),
  alt: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
});

/**
 * The join Supabase returns for an embedded resource.
 *
 * PostgREST gives an object for a to-one relationship and an array for a
 * to-many one — but a to-one embed through a nullable or ambiguous foreign key
 * can also arrive as a single-element array. Accepting both here is cheaper
 * than being wrong about it at runtime on one page.
 */
const embeddedCollection = z.union([
  z.object({ name: z.string(), kind: collectionKindSchema }),
  z.array(z.object({ name: z.string(), kind: collectionKindSchema })).min(1),
]);

function firstOf<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The full `"Product"` row, with its gallery — the detail page's projection.
 *
 * Deliberately does not accept the search columns (`search_document`,
 * `search_vector`, `embedding`): they are never selected, and a schema without
 * them means a future `select('*')` cannot start shipping a 1536-float vector
 * to the browser inside a page payload.
 */
export const productRowSchema = z.object({
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
  images: z.array(imageRowSchema).default([]),
});

export const PRODUCT_COLUMNS =
  "id, name, slug, subtitle, description, story, concentration, format, includes, " +
  "badge, tags, topNotes, heartNotes, baseNotes, volumeMl, priceInCents, sku, " +
  "inventory, isBestseller, collectionSlug";

/** `PRODUCT_COLUMNS` plus the gallery, for the detail page. */
export const PRODUCT_WITH_IMAGES_COLUMNS = `${PRODUCT_COLUMNS}, images:ProductImage(url, alt, isPrimary, sortOrder)`;

/**
 * The narrow list projection, plus the two joined collection columns.
 *
 * `ProductCardData` exists so a grid does not demand columns a list query would
 * not select; this is the query side of that promise.
 */
export const productCardRowSchema = productRowSchema
  .pick({
    id: true,
    name: true,
    slug: true,
    subtitle: true,
    description: true,
    topNotes: true,
    heartNotes: true,
    baseNotes: true,
    volumeMl: true,
    priceInCents: true,
    collectionSlug: true,
    inventory: true,
    concentration: true,
    format: true,
    includes: true,
    badge: true,
    isBestseller: true,
    tags: true,
  })
  .extend({
    collection: embeddedCollection,
    images: z.array(imageRowSchema).default([]),
  });

export const PRODUCT_CARD_COLUMNS =
  "id, name, slug, subtitle, description, topNotes, heartNotes, baseNotes, " +
  "volumeMl, priceInCents, collectionSlug, inventory, concentration, format, " +
  "includes, badge, isBestseller, tags, " +
  "collection:Collection!inner(name, kind), " +
  "images:ProductImage(url, alt, isPrimary, sortOrder)";

/**
 * Fallback for a product with no image flagged primary.
 *
 * A unique partial index makes two primaries impossible and the seed gives
 * every product one, so this is the "somebody deleted a photograph in the
 * dashboard" case: a card with a missing image is better than a page that
 * throws.
 */
export const PLACEHOLDER_IMAGE: ProductImage = {
  url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=600&h=800&fit=crop&auto=format",
  alt: "KHEM fragrance flacon",
  isPrimary: true,
  sortOrder: 0,
};

/** Gallery order is `sortOrder`; the primary is what a card shows. */
export function resolvePrimaryImage(images: readonly ProductImage[]): ProductImage {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((image) => image.isPrimary) ?? sorted[0] ?? PLACEHOLDER_IMAGE;
}

export function toProduct(row: unknown): Product | null {
  const parsed = productRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    images: [...parsed.data.images].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function toProductCard(row: unknown): ProductCardData | null {
  const parsed = productCardRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { collection, images, ...product } = parsed.data;
  const parent = firstOf(collection);

  return {
    ...product,
    collectionName: parent.name,
    collectionKind: parent.kind,
    primaryImage: resolvePrimaryImage(images),
  };
}

/**
 * Parse a list, dropping rows that do not fit.
 *
 * Shared by every list query so the "one bad row does not blank the page"
 * behaviour is written once instead of remembered twenty times.
 */
export function parseList<T>(
  rows: readonly unknown[] | null,
  parse: (row: unknown) => T | null,
): T[] {
  return (rows ?? [])
    .map(parse)
    .filter((value): value is T => value !== null);
}
