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

import { MERCH_PAGE_FACETS } from "@/src/lib/facets";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";
import type { Locale } from "@/src/lib/i18n/config";
import { resolveList, resolveOptionalText, resolveText } from "@/src/lib/i18n/resolve";
import type {
  Collection,
  MerchPage,
  Product,
  ProductCardData,
  ProductImage,
  ScentProfile,
} from "@/src/types/catalog";

/**
 * Every mapper below takes the active locale and returns the *resolved*
 * record — translatable fields already collapsed to a plain `string`.
 *
 * That keeps `src/types/catalog.ts` and every component prop shape exactly as
 * they were: a `ProductCard` still receives `subtitle: string | null`, and has
 * no idea a translation was chosen. See `src/lib/i18n/resolve.ts` for why the
 * resolution lives here rather than in the view layer.
 *
 * The `_ar` columns are `.nullable()` rather than `.optional()`: Postgres sends
 * an explicit `null` for an untranslated field, and a schema that rejected it
 * would drop the whole row and blank the section — the exact failure the
 * "one malformed row is dropped, the list survives" rule exists to bound.
 */

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
  // Null for the house ranges (Signature, Noir, Gemstone), which stay Latin;
  // set for the category collections (Body Care, Gift Sets).
  name_ar: z.string().nullable().default(null),
  slug: z.string(),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  bannerAlt_ar: z.string().nullable().default(null),
  // The portrait card crop — see `0010_collection_card_image.sql`. Nullable and
  // defaulted, so a row read before that migration lands still parses rather
  // than dropping the collection out of the grid.
  cardUrl: z.string().nullable().default(null),
  cardAlt: z.string().nullable().default(null),
  cardAlt_ar: z.string().nullable().default(null),
  isFeatured: z.boolean(),
  kind: collectionKindSchema,
});

export const COLLECTION_COLUMNS =
  "id, name, name_ar, slug, description, description_ar, bannerUrl, bannerAlt, " +
  "bannerAlt_ar, cardUrl, cardAlt, cardAlt_ar, isFeatured, kind";

export function toCollection(row: unknown, locale: Locale): Collection | null {
  const parsed = collectionRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    name_ar,
    description_ar,
    bannerAlt_ar,
    cardUrl,
    cardAlt,
    cardAlt_ar,
    ...collection
  } = parsed.data;

  const bannerAltResolved = resolveText(collection.bannerAlt, bannerAlt_ar, locale);

  return {
    ...collection,
    name: resolveText(collection.name, name_ar, locale),
    description: resolveText(collection.description, description_ar, locale),
    bannerAlt: bannerAltResolved,
    /*
     * The fallback is resolved here rather than at the two call sites, so
     * `Collection.cardUrl` is a plain `string` and no component has to know
     * that a collection may not have a card crop of its own.
     *
     * The alt falls back with the image, not independently: alt text describes
     * a specific photograph, so reusing the card's wording over the banner's
     * picture would narrate the wrong image to a screen reader. The database
     * constraint keeps the pair from separating in the first place.
     */
    cardUrl: cardUrl ?? collection.bannerUrl,
    cardAlt:
      cardUrl !== null && cardAlt !== null
        ? resolveText(cardAlt, cardAlt_ar, locale)
        : bannerAltResolved,
  };
}

// ── MerchPage ─────────────────────────────────────────────────

/**
 * `"MerchPage"` — how `/collections/best-sellers` and
 * `/collections/limited-edition` introduce themselves.
 *
 * `slug` is validated against {@link MERCH_PAGE_FACETS} rather than accepted as
 * a string: the table has a check constraint saying the same thing, and parsing
 * it here is what lets `MerchPage.slug` be the narrow union the route already
 * switches on. A row for a page that no longer has a route parses to `null` and
 * is ignored, which is the correct outcome — the code decides which pages exist.
 */
const merchPageRowSchema = z.object({
  slug: z.enum(MERCH_PAGE_FACETS),
  name: z.string(),
  name_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  bannerAlt_ar: z.string().nullable().default(null),
});

export const MERCH_PAGE_COLUMNS =
  "slug, name, name_ar, description, description_ar, bannerUrl, bannerAlt, bannerAlt_ar";

export function toMerchPage(row: unknown, locale: Locale): MerchPage | null {
  const parsed = merchPageRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { name_ar, description_ar, bannerAlt_ar, ...page } = parsed.data;

  return {
    ...page,
    name: resolveText(page.name, name_ar, locale),
    description: resolveText(page.description, description_ar, locale),
    bannerAlt: resolveText(page.bannerAlt, bannerAlt_ar, locale),
  };
}

/**
 * A `"ScentProfile"` row — `supabase/sql/0020_scent_profile.sql`.
 *
 * `slug` is validated against {@link SCENT_PROFILE_SLUGS} for the reason the
 * merch-page schema above gives: the table carries a check constraint saying the
 * same thing, and a row for a profile that no longer has a route parses to
 * `null` and is ignored. `families` is left as free strings — the closed
 * vocabulary is enforced by a trigger on the table, and a family the storefront
 * has not heard of should narrow the query, not drop the page.
 */
const scentProfileRowSchema = z.object({
  slug: z.enum(SCENT_PROFILE_SLUGS),
  name: z.string(),
  name_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  bannerAlt_ar: z.string().nullable().default(null),
  families: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
});

export const SCENT_PROFILE_COLUMNS =
  "slug, name, name_ar, description, description_ar, bannerUrl, bannerAlt, " +
  "bannerAlt_ar, families, sortOrder";

export function toScentProfile(
  row: unknown,
  locale: Locale,
): ScentProfile | null {
  const parsed = scentProfileRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { name_ar, description_ar, bannerAlt_ar, ...profile } = parsed.data;

  return {
    ...profile,
    name: resolveText(profile.name, name_ar, locale),
    description: resolveText(profile.description, description_ar, locale),
    bannerAlt: resolveText(profile.bannerAlt, bannerAlt_ar, locale),
  };
}

const imageRowSchema = z.object({
  url: z.string(),
  alt: z.string(),
  alt_ar: z.string().nullable().default(null),
  // The triptych line — `0013_product_image_caption.sql`. Nullable *and*
  // defaulted for both the reason above and the one this file's header gives:
  // a gallery read before that migration lands still parses, rather than
  // dropping every photograph out of every product page at once.
  caption: z.string().nullable().default(null),
  caption_ar: z.string().nullable().default(null),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
});

/** Image columns, as selected for both the gallery and the card projection. */
const IMAGE_COLUMNS =
  "url, alt, alt_ar, caption, caption_ar, isPrimary, sortOrder";

function toImage(image: z.infer<typeof imageRowSchema>, locale: Locale): ProductImage {
  const { alt_ar, caption, caption_ar, ...rest } = image;

  return {
    ...rest,
    alt: resolveText(image.alt, alt_ar, locale),
    caption: resolveOptionalText(caption, caption_ar, locale),
  };
}

/**
 * The join Supabase returns for an embedded resource.
 *
 * PostgREST gives an object for a to-one relationship and an array for a
 * to-many one — but a to-one embed through a nullable or ambiguous foreign key
 * can also arrive as a single-element array. Accepting both here is cheaper
 * than being wrong about it at runtime on one page.
 */
const embeddedCollectionShape = z.object({
  name: z.string(),
  name_ar: z.string().nullable().default(null),
  kind: collectionKindSchema,
});

const embeddedCollection = z.union([
  embeddedCollectionShape,
  z.array(embeddedCollectionShape).min(1),
]);

/** The same embed where only the kind was selected. */
const embeddedCollectionKindShape = z.object({ kind: collectionKindSchema });

const embeddedCollectionKind = z.union([
  embeddedCollectionKindShape,
  z.array(embeddedCollectionKindShape).min(1),
]);

function firstOf<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The narrowest product projection there is: a slug and its collection's kind.
 *
 * Enough to answer "does this exist, and which page does it live on" —
 * `getDetailPageTarget()`'s row, and the shape `productHref()` takes. Parsed
 * like every other row rather than asserted, because a `select` this small is
 * still a `select`, and the reason for parsing does not scale with the column
 * count.
 */
const detailPageTargetRowSchema = z.object({
  slug: z.string(),
  collection: embeddedCollectionKind,
});

export function toDetailPageTarget(
  row: unknown,
): { slug: string; collectionKind: z.infer<typeof collectionKindSchema> } | null {
  const parsed = detailPageTargetRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    slug: parsed.data.slug,
    collectionKind: firstOf(parsed.data.collection).kind,
  };
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
  // No `name_ar`: a perfume name is a proper noun and stays Latin on `/ar`.
  name: z.string(),
  slug: z.string(),
  subtitle: z.string().nullable(),
  subtitle_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
  story: z.string().nullable(),
  story_ar: z.string().nullable().default(null),
  concentration: concentrationSchema.nullable(),
  format: z.string().nullable(),
  format_ar: z.string().nullable().default(null),
  includes: z.array(z.string()),
  includes_ar: z.array(z.string()).nullable().default(null),
  badge: z.string().nullable(),
  badge_ar: z.string().nullable().default(null),
  tags: z.array(productTagSchema),
  topNotes: z.array(z.string()),
  topNotes_ar: z.array(z.string()).nullable().default(null),
  heartNotes: z.array(z.string()),
  heartNotes_ar: z.array(z.string()).nullable().default(null),
  baseNotes: z.array(z.string()),
  baseNotes_ar: z.array(z.string()).nullable().default(null),
  volumeMl: z.number(),
  priceInCents: z.number(),
  sku: z.string(),
  inventory: z.number(),
  isBestseller: z.boolean(),
  collectionSlug: z.string(),
  images: z.array(imageRowSchema).default([]),
});

/**
 * The fields both the full row and the card projection share.
 *
 * Typed structurally rather than as `z.infer<typeof productRowSchema>` so the
 * card schema — a `.pick()` without `story`, `sku`, or `id` — satisfies it too.
 */
interface TranslatableProductFields {
  subtitle: string | null;
  subtitle_ar: string | null;
  description: string;
  description_ar: string | null;
  format: string | null;
  format_ar: string | null;
  badge: string | null;
  badge_ar: string | null;
  includes: string[];
  includes_ar: string[] | null;
  topNotes: string[];
  topNotes_ar: string[] | null;
  heartNotes: string[];
  heartNotes_ar: string[] | null;
  baseNotes: string[];
  baseNotes_ar: string[] | null;
}

/** The translatable half of a product row, resolved in one place. */
function resolveProductText(row: TranslatableProductFields, locale: Locale) {
  return {
    subtitle: resolveOptionalText(row.subtitle, row.subtitle_ar, locale),
    description: resolveText(row.description, row.description_ar, locale),
    format: resolveOptionalText(row.format, row.format_ar, locale),
    badge: resolveOptionalText(row.badge, row.badge_ar, locale),
    includes: resolveList(row.includes, row.includes_ar, locale),
    topNotes: resolveList(row.topNotes, row.topNotes_ar, locale),
    heartNotes: resolveList(row.heartNotes, row.heartNotes_ar, locale),
    baseNotes: resolveList(row.baseNotes, row.baseNotes_ar, locale),
  };
}

/**
 * Drop every `_ar` column from a parsed row.
 *
 * Without this the untranslated twin of each field would ride along in the RSC
 * payload — roughly doubling the catalog JSON a page ships, and putting the
 * English copy in the browser on an Arabic page.
 */
function stripArabicColumns<T extends Record<string, unknown>>(
  row: T,
): Omit<T, `${string}_ar`> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !key.endsWith("_ar")),
  ) as Omit<T, `${string}_ar`>;
}

export const PRODUCT_COLUMNS =
  "id, name, slug, subtitle, subtitle_ar, description, description_ar, story, " +
  "story_ar, concentration, format, format_ar, includes, includes_ar, " +
  "badge, badge_ar, tags, topNotes, topNotes_ar, heartNotes, heartNotes_ar, " +
  "baseNotes, baseNotes_ar, volumeMl, priceInCents, sku, " +
  "inventory, isBestseller, collectionSlug";

/** `PRODUCT_COLUMNS` plus the gallery, for the detail page. */
export const PRODUCT_WITH_IMAGES_COLUMNS = `${PRODUCT_COLUMNS}, images:ProductImage(${IMAGE_COLUMNS})`;

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
    subtitle_ar: true,
    description: true,
    description_ar: true,
    topNotes: true,
    topNotes_ar: true,
    heartNotes: true,
    heartNotes_ar: true,
    baseNotes: true,
    baseNotes_ar: true,
    volumeMl: true,
    priceInCents: true,
    collectionSlug: true,
    inventory: true,
    concentration: true,
    format: true,
    format_ar: true,
    includes: true,
    includes_ar: true,
    badge: true,
    badge_ar: true,
    isBestseller: true,
    tags: true,
  })
  .extend({
    collection: embeddedCollection,
    images: z.array(imageRowSchema).default([]),
  });

export const PRODUCT_CARD_COLUMNS =
  "id, name, slug, subtitle, subtitle_ar, description, description_ar, " +
  "topNotes, topNotes_ar, heartNotes, heartNotes_ar, baseNotes, baseNotes_ar, " +
  "volumeMl, priceInCents, collectionSlug, inventory, concentration, " +
  "format, format_ar, includes, includes_ar, badge, badge_ar, isBestseller, tags, " +
  "collection:Collection!inner(name, name_ar, kind), " +
  `images:ProductImage(${IMAGE_COLUMNS})`;

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
  caption: null,
  isPrimary: true,
  sortOrder: 0,
};

/** Gallery order is `sortOrder`; the primary is what a card shows. */
export function resolvePrimaryImage(images: readonly ProductImage[]): ProductImage {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((image) => image.isPrimary) ?? sorted[0] ?? PLACEHOLDER_IMAGE;
}

/**
 * The second photograph a card cross-fades to on hover — the first of the
 * gallery, in `sortOrder`, that is not the one already on screen.
 *
 * Identity-compared against the resolved primary rather than re-testing
 * `isPrimary`, so the fallback branches of {@link resolvePrimaryImage} (no
 * primary flagged at all) cannot leave a card fading an image into itself.
 *
 * `null` for a one-image product. No placeholder here on purpose: a card with
 * nothing to fade to should stay exactly as it is.
 */
export function resolveHoverImage(
  images: readonly ProductImage[],
  primary: ProductImage,
): ProductImage | null {
  return (
    [...images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((image) => image !== primary) ?? null
  );
}

export function toProduct(row: unknown, locale: Locale): Product | null {
  const parsed = productRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;

  return {
    ...stripArabicColumns(data),
    ...resolveProductText(data, locale),
    story: resolveOptionalText(data.story, data.story_ar, locale),
    images: data.images
      .map((image) => toImage(image, locale))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function toProductCard(row: unknown, locale: Locale): ProductCardData | null {
  const parsed = productCardRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { collection, images, ...product } = parsed.data;
  const parent = firstOf(collection);

  const gallery = images.map((image) => toImage(image, locale));
  const primaryImage = resolvePrimaryImage(gallery);

  return {
    ...stripArabicColumns(product),
    ...resolveProductText(parsed.data, locale),
    collectionName: resolveText(parent.name, parent.name_ar, locale),
    collectionKind: parent.kind,
    primaryImage,
    hoverImage: resolveHoverImage(gallery, primaryImage),
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
