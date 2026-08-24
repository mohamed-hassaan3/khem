/**
 * Catalog types — a 1:1 mirror of the Prisma models defined in AGENTS.md §9.
 *
 * These shapes are identical (field names, casing, units) to the Postgres
 * tables in `supabase/sql/0001_catalog.sql`, which is what made moving the
 * catalog out of local seed data a change to `src/services/` alone — no
 * component and no page was edited.
 *
 * Deviations from Prisma, and why:
 *  - `id` values are stable slugs rather than uuids, because the cart persists
 *    product ids in `localStorage` and uuids would have emptied every
 *    returning visitor's bag. See the SQL file's header.
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
 * parent collection's {@link CollectionKind}. Combining them into the filter
 * chips on `/collections` happens in exactly one place — `productFacets()` in
 * `src/lib/facets.ts`.
 *
 * A union of one since the Limited Edition cut was withdrawn. Becomes a
 * Postgres enum array, stored like `topNotes`.
 */
export type ProductTag = "NEW_ARRIVAL";

/** Mirrors the `ProductImage` model. */
export interface ProductImage {
  url: string;
  alt: string;
  /**
   * One line of story, told by this photograph — the triptych on
   * `/ritual/[slug]` (`supabase/sql/0013_product_image_caption.sql`).
   *
   * `null` everywhere else, and the fragrance gallery is deliberately left that
   * way: a caption belongs *to* a picture, which is why it is a column here
   * rather than three nullable `story2`/`story3` columns on the product that
   * nothing would keep in step with the photographs they describe.
   *
   * Not the alt text reworded. `alt` narrates the image to somebody who cannot
   * see it; this is printed beside the image for somebody who can.
   */
  caption: string | null;
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

/**
 * The presentation of a merchandising page — `/collections/best-sellers`.
 *
 * Mirrors `"MerchPage"` (`supabase/sql/0012_merch_page.sql`), which stores how
 * such a page introduces itself and nothing about what is *in* it: membership
 * is derived by `productFacets()` from a product's own flags, because a product
 * already points at exactly one collection and these cuts run across all of
 * them.
 *
 * `slug` is typed as a plain string here even though the set is closed.
 * The narrow union lives in `src/lib/facets.ts`, and importing it back into
 * this module would close a cycle — `facets.ts` already reads
 * {@link ProductCardData} from here — which is not a style objection: an
 * erased-looking type edge between two modules that also exchange *values* is
 * exactly how `MERCH_PAGE_FACETS` ends up undefined inside a Zod schema at
 * module-evaluation time. `toMerchPage()` narrows the value at the boundary,
 * which is where the guarantee belongs anyway.
 */
export interface MerchPage {
  slug: string;
  name: string;
  description: string;
  /** Landscape. The hero on the merchandising page. */
  bannerUrl: string;
  bannerAlt: string;
}

/**
 * The presentation of a scent-profile page — `/collections/oriental` and its
 * four siblings.
 *
 * Mirrors `"ScentProfile"` (`supabase/sql/0020_scent_profile.sql`), which stores
 * how such a page introduces itself and **which olfactive families it spans**,
 * and nothing about what is in it: membership is derived by walking
 * `families → "Ingredient" → "IngredientUsage" → "Product"`, because a product
 * already points at exactly one collection and a profile runs across all of
 * them.
 *
 * `slug` and `families` are plain strings here, for the reason {@link MerchPage}
 * gives at length: the narrow unions live in `src/lib/scent-profiles.ts` and
 * `src/types/content.ts`, and importing the first of those back into this module
 * would close a cycle. `toScentProfile()` narrows the slug at the boundary,
 * which is where the guarantee belongs.
 */
export interface ScentProfile {
  slug: string;
  name: string;
  description: string;
  /** Landscape. The hero on the profile page. */
  bannerUrl: string;
  bannerAlt: string;
  /** The olfactive families this profile gathers — see `"IngredientFamily"`. */
  families: string[];
  sortOrder: number;
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
  /** Merchandising flag — "Most Popular", "New", "Exclusive". */
  badge: string | null;
  /**
   * Merchandising tags — see {@link ProductTag}. Empty for most of the catalog.
   *
   * A displayed `badge` is free editorial text; these are the machine-readable
   * flags the `/collections` filter and `/new-arrival` query on, which is why a
   * set can read "New" on its card and still be absent from the New Arrival
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
   * The last two are not read for the card's own body — they are here for the
   * cart, which resolves stored product ids against this same projection, and
   * for the add-to-bag control the grid overlays on each card. `inventory`
   * caps the quantity stepper and disables that control when a product is out
   * of stock; `concentration` prints the format line beside the price. Neither
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
   * best-sellers view the Nav and Footer link to. Carried
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
   * card projection so `productHref()` can route a cart line without a second
   * query for one column.
   */
  collectionKind: CollectionKind;
  /** The single `isPrimary` image; a list query never needs the full gallery. */
  primaryImage: ProductImage;
  /**
   * The second photograph, which a card cross-fades to on hover.
   *
   * `null` for a product whose gallery holds one image only, and the card then
   * simply does not cross-fade — deliberately *not* {@link PLACEHOLDER_IMAGE},
   * because a stock crop fading in over a real flacon reads worse than no
   * effect at all.
   *
   * Free to carry: the card query already selects the whole `ProductImage`
   * relation to find the primary, so this is a row that was being fetched and
   * discarded rather than a second round trip.
   */
  hoverImage: ProductImage | null;
};
