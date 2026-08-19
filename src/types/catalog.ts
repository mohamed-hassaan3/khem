/**
 * Catalog types — a 1:1 mirror of the Prisma models defined in AGENTS.md §9.
 *
 * These shapes are identical (field names, casing, units) to the Postgres
 * tables in `supabase/sql/0001_catalog.sql`, which is what made moving the
 * catalog out of local seed data a change to `src/services/` alone — no
 * component and no page was edited.
 *
 * Deviations from Prisma, and why:
 *  - `id` values are stable slugs rather than uuids, because the cart and the
 *    wishlist persist product ids in `localStorage` and uuids would have
 *    emptied every returning visitor's bag. See the SQL file's header.
 *  - Relations are expressed by slug (`collectionSlug`) rather than by a uuid
 *    FK, for the same reason; `slug` is unique, so the constraint is as strong.
 *  - Server-managed columns (`createdAt`, `updatedAt`, `deletedAt`, `isArchived`)
 *    are omitted because nothing in the UI reads them.
 */

/** Mirrors the `Concentration` enum in AGENTS.md §9. */
export type Concentration =
  | "PARFUM"
  | "EXTRAIT_DE_PARFUM"
  | "EAU_DE_PARFUM"
  | "ATTAR_OIL";

/**
 * What a collection sells.
 *
 * A discriminator, not a label: the fragrance surfaces — `/collections`, its
 * tab bar, `/perfume/[slug]`, the related-products rail — all filter on it, so
 * a body mist can never appear in the Signature grid or claim a `/perfume/…`
 * URL. `productHref()` in `src/lib/routes.ts` also routes on it, which is why a
 * new member is a compile error there rather than a dead link in production.
 *
 * Becomes a Postgres enum alongside `Concentration` (AGENTS.md §9).
 */
export type CollectionKind =
  | "FRAGRANCE"
  | "BODY"
  | "HOME"
  | "DISCOVERY"
  | "GIFT";

/**
 * Merchandising flags a product can carry, independent of its collection.
 *
 * Only what cannot be derived from a column that already exists: "best seller"
 * is `Product.isBestseller` (AGENTS.md §9) and every category facet is the
 * parent collection's {@link CollectionKind}. Combining the three into the
 * filter chips on `/collections` happens in exactly one place —
 * `productFacets()` in `src/lib/facets.ts`.
 *
 * Becomes a Postgres enum array, stored like `topNotes`.
 */
export type ProductTag = "NEW_ARRIVAL" | "LIMITED_EDITION";

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
  /** Landscape. The hero on `/collections/[slug]` and the category routes. */
  bannerUrl: string;
  bannerAlt: string;
  /**
   * Portrait. What `<CollectionCard>` renders in the home page grid.
   *
   * Never null at this level: `toCollection()` has already fallen back to the
   * banner for a collection with no card crop of its own, so no component
   * carries that decision — see `src/schemas/db/catalog.ts`.
   */
  cardUrl: string;
  cardAlt: string;
  isFeatured: boolean;
  /** What this collection sells — see {@link CollectionKind}. */
  kind: CollectionKind;
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
  /**
   * `null` for anything that is not a fragrance: a room spray has no *eau de
   * parfum* concentration. Those products carry {@link Product.format} instead,
   * and every display site prints one or the other.
   */
  concentration: Concentration | null;
  /**
   * Human format line for non-fragrances — "Room Spray", "6 × 3 ML Vials".
   *
   * `null` for fragrances, whose format line is the *translated*
   * `dict.product.concentrations[…]` copy rather than a stored English string.
   */
  format: string | null;
  /**
   * What a set contains, one line per item. Empty for a single product.
   *
   * Free text rather than a product-id join: a discovery vial is not a
   * sellable SKU, so there is nothing to point at.
   */
  includes: string[];
  /** Merchandising flag — "Most Popular", "Limited", "Exclusive". */
  badge: string | null;
  /**
   * Merchandising tags — see {@link ProductTag}. Empty for most of the catalog.
   *
   * A displayed `badge` is free editorial text; these are the machine-readable
   * flags the `/collections` filter and `/new-arrival` query on, which is why a
   * set can read "Limited" on its card and still be absent from the limited
   * facet unless it is tagged.
   */
  tags: ProductTag[];
  /**
   * Three notes per tier for a fragrance; empty for body, home, and discovery
   * goods, which have no pyramid to display.
   */
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  volumeMl: number;
  /**
   * Smallest unit of the base currency — Egyptian piastres (147000 = EGP
   * 1,470.00).
   *
   * The field keeps the `priceInCents` name because it mirrors the Prisma
   * column in AGENTS.md §9, and the seed data exists to prefigure that schema.
   * "Cents" there means "minor units", and the minor unit is the piastre:
   * `src/lib/currency.ts` holds the base, and `formatPrice` is the only place
   * that converts to anything else.
   */
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
  /*
   * The next four serve the body-care, home-fragrance, and discovery grids,
   * which sell straight from the card because those goods have no detail page.
   * A card there prints the description, states its format in place of a
   * concentration, lists a set's contents, and carries its merchandising badge
   * — so a list query has to select them.
   */
  | "description"
  | "format"
  | "includes"
  | "badge"
  /*
   * The merchandising flags the `/collections` `?facet=` cuts filter on — the
   * best-sellers and limited-edition views the Nav and Footer link to. Carried
   * on the card projection because the filter runs over the cards already in
   * hand — a list query selects the column rather than the grid re-fetching.
   */
  | "isBestseller"
  | "tags"
> & {
  /** Resolved display name of the parent collection (a join in SQL terms). */
  collectionName: string;
  /**
   * Resolved kind of the parent collection — the same join. Carried on the
   * card projection so `productHref()` can route a cart or wishlist line
   * without a second query for one column.
   */
  collectionKind: CollectionKind;
  /** The single `isPrimary` image; a list query never needs the full gallery. */
  primaryImage: ProductImage;
};
