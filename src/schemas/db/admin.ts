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

import { MERCH_PAGE_FACETS } from "@/src/lib/facets";
import { PRODUCT_TYPE_VALUES } from "@/src/lib/product-types";

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

const productTagSchema = z.enum(["NEW_ARRIVAL"]);

/**
 * `public."ProductType"`, from the one list that holds its values.
 *
 * Built from `PRODUCT_TYPE_VALUES` rather than retyped, so a value added to the
 * enum in `src/lib/product-types.ts` cannot arrive here as an unparseable row —
 * which, given that a failed parse degrades to an empty projection rather than
 * throwing, would show as a product that had quietly vanished from the
 * dashboard.
 */
const productTypeSchema = z.enum(PRODUCT_TYPE_VALUES);

// ── Collection ────────────────────────────────────────────────

export const ADMIN_NAV_LINK_COLUMNS =
  'id, column_key, "parentId", "targetType", "categorySlug", "collectionSlug", ' +
  '"pageKey", "groupKey", label, "desc", "showInNav", "showInFooter", ' +
  '"isEnabled", "sortOrder"';

/**
 * A menu entry as the dashboard reads it — `0048_navigation.sql`.
 *
 * The `_ar` overrides are deliberately absent: no dashboard screen has ever
 * written Arabic (the translations are seeded and revised in SQL), and a label
 * left blank falls back to the target's own name, which *is* translated. So an
 * editor adding a collection to the menu gets both languages without touching
 * either.
 */
const adminNavLinkRowSchema = z.object({
  id: z.string(),
  column_key: z.enum(["COLLECTIONS", "QUICK_ACCESS", "WORLD"]),
  parentId: z.string().nullable().default(null),
  targetType: z.enum(["CATEGORY", "COLLECTION", "PAGE", "GROUP"]),
  categorySlug: z.string().nullable().default(null),
  collectionSlug: z.string().nullable().default(null),
  pageKey: z.string().nullable().default(null),
  groupKey: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
  desc: z.string().nullable().default(null),
  showInNav: z.boolean(),
  showInFooter: z.boolean(),
  isEnabled: z.boolean(),
  sortOrder: z.number(),
});

export type AdminNavLink = z.infer<typeof adminNavLinkRowSchema>;

export function toAdminNavLink(row: unknown): AdminNavLink | null {
  const parsed = adminNavLinkRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const ADMIN_CATEGORY_COLUMNS =
  "id, name, slug, description, bannerUrl, bannerAlt, kind, isEnabled, sortOrder";

/**
 * A category as the dashboard reads it — `0045_category.sql`.
 *
 * Disabled rows are read here and filtered on the storefront, not the other way
 * round: the one screen that must still show a withdrawn category is the screen
 * that can switch it back on.
 */
const adminCategoryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  kind: collectionKindSchema,
  isEnabled: z.boolean(),
  sortOrder: z.number(),
});

export type AdminCategory = z.infer<typeof adminCategoryRowSchema>;

export function toAdminCategory(row: unknown): AdminCategory | null {
  const parsed = adminCategoryRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const ADMIN_COLLECTION_COLUMNS =
  "id, name, slug, description, bannerUrl, bannerAlt, cardUrl, cardAlt, " +
  "isFeatured, kind, categorySlug, sortOrder";

/**
 * Note `cardUrl` / `cardAlt` stay **raw** here, null and all — unlike
 * `toCollection()` in `schemas/db/catalog.ts`, which falls them back to the
 * banner. The storefront wants the effective image; the dashboard wants the
 * stored one, or the edit form would show a banner URL in the card field and an
 * editor pressing Save would silently promote the fallback into a real value.
 */
const adminCollectionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  cardUrl: z.string().nullable().default(null),
  cardAlt: z.string().nullable().default(null),
  isFeatured: z.boolean(),
  /*
   * Read, never written by the dashboard: `collection_kind_from_category()`
   * copies it down from the category on every write. The list screen prints it,
   * and the form offers the category instead.
   */
  kind: collectionKindSchema,
  categorySlug: z.string(),
  sortOrder: z.number(),
});

export type AdminCollection = z.infer<typeof adminCollectionRowSchema>;

export function toAdminCollection(row: unknown): AdminCollection | null {
  const parsed = adminCollectionRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── MerchPage ─────────────────────────────────────────────────

export const ADMIN_MERCH_PAGE_COLUMNS =
  "slug, name, description, bannerUrl, bannerAlt, " +
  "name_ar, description_ar, bannerAlt_ar, updatedAt";

/**
 * The `_ar` columns are carried but never edited.
 *
 * No dashboard screen has ever written Arabic — the translations are seeded and
 * revised in SQL — so the form edits the English columns only. They are read
 * here so a page whose translation is present cannot be dropped by the parser,
 * and so the list can eventually say which pages are translated without another
 * projection.
 */
const adminMerchPageRowSchema = z.object({
  slug: z.enum(MERCH_PAGE_FACETS),
  name: z.string(),
  description: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  name_ar: z.string().nullable().default(null),
  description_ar: z.string().nullable().default(null),
  bannerAlt_ar: z.string().nullable().default(null),
  updatedAt: z.string(),
});

export type AdminMerchPage = z.infer<typeof adminMerchPageRowSchema>;

export function toAdminMerchPage(row: unknown): AdminMerchPage | null {
  const parsed = adminMerchPageRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Product ───────────────────────────────────────────────────

/**
 * Never `select('*')` — `"Product"` carries a 1536-float `embedding` and two
 * generated search columns, none of which any dashboard screen renders and all
 * of which would ride into the page payload.
 */
export const ADMIN_PRODUCT_COLUMNS =
  "id, name, slug, subtitle, description, description_ar, story, story_ar, " +
  "concentration, format, includes, " +
  "badge, tags, topNotes, heartNotes, baseNotes, volumeMl, priceInCents, " +
  /*
   * `productType` is read here and nowhere on the storefront.
   *
   * It is what the object *is* — a perfume, a gift, an antique — and since
   * `0052_product_type_and_volume.sql` it also decides whether the row must
   * carry a volume. Both are editing concerns: a card prints a concentration or
   * a format line, never a type, so the storefront projections in
   * `src/schemas/db/catalog.ts` deliberately do not select this column.
   */
  "productType, " +
  /*
   * Both counters by name, and the total.
   *
   * The storefront aliases `"inventoryOnline"` to `inventory`
   * (`src/schemas/db/catalog.ts`), because a visitor may only buy what the
   * website holds. The dashboard is the opposite case: it exists to show what
   * the house holds *everywhere*, so it reads the two real columns and the
   * maintained total side by side.
   */
    /*
   * `costInCents` is read here and **nowhere on the storefront**.
   *
   * It is what the house pays, not what a visitor is charged, and the
   * projections in `src/schemas/db/catalog.ts` are read with the publishable
   * key. Adding it there would publish the boutique's margin.
   */
  "costInCents, " +
  "sku, inventory, inventoryOnline, inventoryOffline, isBestseller, " +
  "collectionSlug, sortOrder, isArchived, updatedAt";

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
  description_ar: z.string().nullable().default(null),
  story: z.string().nullable(),
  story_ar: z.string().nullable().default(null),
  concentration: concentrationSchema.nullable(),
  format: z.string().nullable(),
  includes: z.array(z.string()),
  badge: z.string().nullable(),
  tags: z.array(productTagSchema),
  topNotes: z.array(z.string()),
  heartNotes: z.array(z.string()),
  baseNotes: z.array(z.string()),
  productType: productTypeSchema.nullable(),
  volumeMl: z.number().nullable(),
  priceInCents: z.number(),
  // Nullable *and* defaulted: every product predates
  // `supabase/sql/0062_sales_ledger.sql`, and null means "not stated" rather
  // than zero — see `src/types/sales.ts`.
  costInCents: z.number().nullable().default(null),
  sku: z.string(),
  inventory: z.number(),
  inventoryOnline: z.number(),
  inventoryOffline: z.number(),
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
  "id, slug, title, title_ar, category, category_ar, excerpt, excerpt_ar, " +
  "body, body_ar, publishedAt, readTimeMinutes, isFeatured, isPublished, " +
  "imageUrl, imageAlt, imageAlt_ar";

const adminArticleRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  category: z.string(),
  category_ar: z.string().nullable().default(null),
  excerpt: z.string(),
  excerpt_ar: z.string().nullable().default(null),
  /* `not null default ''` in Postgres, so an article written as a headline and
   * nothing else comes back as an empty string, not a null. */
  body: z.string(),
  body_ar: z.string().nullable().default(null),
  /* A `date` column; PostgREST renders it `YYYY-MM-DD`, which is what the
   * `<input type="date">` on the form wants back. */
  publishedAt: z.string(),
  readTimeMinutes: z.number(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  imageAlt_ar: z.string().nullable().default(null),
});

export type AdminArticle = z.infer<typeof adminArticleRowSchema>;

export function toAdminArticle(row: unknown): AdminArticle | null {
  const parsed = adminArticleRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
