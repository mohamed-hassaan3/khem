/**
 * Catalog types — a 1:1 mirror of the Prisma models defined in AGENTS.md §9.
 *
 * These shapes are deliberately identical (field names, casing, units) to the
 * eventual Postgres/Supabase tables so that migrating away from the local seed
 * data in `src/data/` is a change to `src/services/` only. No component or page
 * should ever need to be edited to switch the data source.
 *
 * Deviations from Prisma, and why:
 *  - `id` values are stable slugs rather than uuids until the database assigns them.
 *  - Relations are expressed by slug (`collectionSlug`) instead of a uuid FK,
 *    for the same reason.
 *  - Server-managed columns (`createdAt`, `updatedAt`, `deletedAt`, `isArchived`)
 *    are omitted because nothing in the UI reads them.
 */

/** Mirrors the `Concentration` enum in AGENTS.md §9. */
export type Concentration =
  | "PARFUM"
  | "EXTRAIT_DE_PARFUM"
  | "EAU_DE_PARFUM"
  | "ATTAR_OIL";

/** Mirrors the `ProductImage` model. */
export interface ProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

/** Mirrors the `Collection` model. */
export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  bannerUrl: string;
  bannerAlt: string;
  isFeatured: boolean;
}

/** Mirrors the `Product` model. */
export interface Product {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string;
  /** Editorial background story — the `story` column. */
  story: string | null;
  concentration: Concentration;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  volumeMl: number;
  /** Smallest currency unit, per AGENTS.md §9 (29500 = $295.00). */
  priceInCents: number;
  sku: string;
  inventory: number;
  isBestseller: boolean;
  collectionSlug: string;
  images: ProductImage[];
}

/**
 * The narrow projection a product card needs.
 *
 * Cards must not demand columns a list query would not select — keeping this
 * type narrow is what lets `getFeaturedProducts()` become a real `.select(...)`
 * with an explicit column list instead of `select('*')`.
 */
export type ProductCardData = Pick<
  Product,
  | "id"
  | "name"
  | "slug"
  | "subtitle"
  | "topNotes"
  | "heartNotes"
  | "baseNotes"
  | "volumeMl"
  | "priceInCents"
  | "collectionSlug"
  /*
   * The last two are not read by `<ProductCard>` — they are here for the cart
   * and wishlist, which resolve stored product ids against this same
   * projection. The cart needs `inventory` to cap its quantity stepper and
   * `concentration` to print the format line beside the price, and neither
   * surface can afford a second round trip for two columns a list query
   * already has in hand.
   */
  | "inventory"
  | "concentration"
> & {
  /** Resolved display name of the parent collection (a join in SQL terms). */
  collectionName: string;
  /** The single `isPrimary` image; a list query never needs the full gallery. */
  primaryImage: ProductImage;
};
