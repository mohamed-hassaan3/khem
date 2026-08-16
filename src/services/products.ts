/**
 * Catalog query layer.
 *
 * Every function here is the seam between the UI and the database. They are
 * already `async` and already return exactly the projection the UI consumes, so
 * migrating to Supabase means replacing the body of each function — never a
 * component, never a page.
 *
 * Each function carries the Supabase query it will become. Keep those comments
 * accurate; they are the migration checklist.
 */

// NOTE: once the `server-only` package is installed, add `import "server-only"`
// here so a stray client import of this module fails at build time instead of
// shipping query logic (and later, credentials) to the browser.

import { COLLECTIONS, FEATURED_PRODUCT_SLUG, PRODUCTS } from "@/src/data/products";
import type {
  Collection,
  CollectionKind,
  Product,
  ProductCardData,
  ProductImage,
} from "@/src/types/catalog";

/** Fallback used when a product has no image flagged `isPrimary`. */
const PLACEHOLDER_IMAGE: ProductImage = {
  url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=600&h=800&fit=crop&auto=format",
  alt: "KHEM fragrance flacon",
  isPrimary: true,
  sortOrder: 0,
};

function resolvePrimaryImage(product: Product): ProductImage {
  const sorted = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((image) => image.isPrimary) ?? sorted[0] ?? PLACEHOLDER_IMAGE;
}

/** The two columns a card projection needs from the joined collection row. */
type CollectionRef = Pick<Collection, "name" | "kind">;

function toCardData(product: Product, collection: CollectionRef): ProductCardData {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    subtitle: product.subtitle,
    description: product.description,
    topNotes: product.topNotes,
    heartNotes: product.heartNotes,
    baseNotes: product.baseNotes,
    volumeMl: product.volumeMl,
    priceInCents: product.priceInCents,
    collectionSlug: product.collectionSlug,
    inventory: product.inventory,
    concentration: product.concentration,
    format: product.format,
    includes: product.includes,
    badge: product.badge,
    isBestseller: product.isBestseller,
    tags: product.tags,
    collectionName: collection.name,
    collectionKind: collection.kind,
    primaryImage: resolvePrimaryImage(product),
  };
}

/**
 * Placeholder parent for a product whose collection is missing — a foreign key
 * this seed data cannot violate, but a join in Postgres eventually can.
 */
const ORPHAN_COLLECTION: CollectionRef = { name: "KHEM", kind: "FRAGRANCE" };

/** Index of the collections, built once per call and shared by the mappers. */
function collectionsBySlug(): Map<string, Collection> {
  return new Map(COLLECTIONS.map((collection) => [collection.slug, collection]));
}

/**
 * Map products to card projections, resolving each one's parent collection —
 * the join every list query performs.
 */
function toCardList(products: readonly Product[]): ProductCardData[] {
  const bySlug = collectionsBySlug();

  return products.map((product) =>
    toCardData(product, bySlug.get(product.collectionSlug) ?? ORPHAN_COLLECTION),
  );
}

/** Products whose collection sells fragrances. */
function fragranceProducts(): Product[] {
  const bySlug = collectionsBySlug();

  return PRODUCTS.filter(
    (product) => bySlug.get(product.collectionSlug)?.kind === "FRAGRANCE",
  );
}

/**
 * Collections shown on the home page.
 *
 * → supabase.from('Collection').select('*').eq('isFeatured', true).order('name')
 */
export async function getFeaturedCollections(): Promise<Collection[]> {
  return COLLECTIONS.filter((collection) => collection.isFeatured);
}

/**
 * Every collection, of every kind. Used where the caller genuinely means all
 * of them — resolving a stored cart line, for instance.
 *
 * → supabase.from('Collection').select('*').order('name')
 */
export async function getCollections(): Promise<Collection[]> {
  return COLLECTIONS;
}

/**
 * Fragrance collections only — the `/collections` overview and its tab bar.
 *
 * Body care, home fragrance, and discovery sets are collections too, but they
 * are not chapters of the perfume library and each has its own route; listing
 * them beside Signature and Noir would offer two URLs for the same goods.
 *
 * → supabase.from('Collection').select('*').eq('kind', 'FRAGRANCE').order('name')
 */
export async function getFragranceCollections(): Promise<Collection[]> {
  return COLLECTIONS.filter((collection) => collection.kind === "FRAGRANCE");
}

/**
 * A single collection by slug. Returns `null` when absent so the route can call
 * `notFound()` rather than throwing (AGENTS.md §1.7).
 *
 * → supabase.from('Collection').select('*').eq('slug', slug).maybeSingle()
 */
export async function getCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  return COLLECTIONS.find((collection) => collection.slug === slug) ?? null;
}

/**
 * A single fragrance collection by slug, for `/collections/[slug]`.
 *
 * Scoped to `FRAGRANCE` so `/collections/body-care` 404s rather than rendering
 * a second, tab-less copy of `/body-care`.
 *
 * → …select('*').eq('slug', slug).eq('kind', 'FRAGRANCE').maybeSingle()
 */
export async function getFragranceCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  const collection = await getCollectionBySlug(slug);
  return collection?.kind === "FRAGRANCE" ? collection : null;
}

/**
 * Card projections for a collection listing. Omitting `collectionSlug` returns
 * the whole catalog, which is what `/collections` renders.
 *
 * → supabase
 *     .from('Product')
 *     .select('id,name,slug,subtitle,topNotes,heartNotes,baseNotes,volumeMl,priceInCents,inventory,concentration,collection:Collection(name,slug),images:ProductImage(url,alt,isPrimary,sortOrder)')
 *     .eq('isArchived', false).is('deletedAt', null)
 *     [+ .eq('collectionSlug', collectionSlug) when given]
 */
export async function getProductCardsByCollection(
  collectionSlug?: string,
): Promise<ProductCardData[]> {
  /*
   * Omitting the slug deliberately returns EVERY kind, not just fragrances:
   * `/cart` and `/wishlist` resolve persisted ids against this projection, and
   * a body-care line whose id is missing from it would silently vanish from
   * the visitor's bag.
   */
  return toCardList(
    PRODUCTS.filter(
      (product) =>
        collectionSlug === undefined ||
        product.collectionSlug === collectionSlug,
    ),
  );
}

/**
 * Card projections for one category — `/body-care`, `/room-fragrance`, and
 * `/discovery` each render exactly one kind.
 *
 * → supabase
 *     .from('Product')
 *     .select('<the column list above>, collection:Collection!inner(name,slug,kind)')
 *     .eq('collection.kind', kind)
 *     .eq('isArchived', false).is('deletedAt', null)
 */
export async function getProductCardsByKind(
  kind: CollectionKind,
): Promise<ProductCardData[]> {
  const bySlug = new Map(
    COLLECTIONS.map((collection) => [collection.slug, collection]),
  );

  return toCardList(
    PRODUCTS.filter(
      (product) => bySlug.get(product.collectionSlug)?.kind === kind,
    ),
  );
}

/**
 * The entire catalog as cards — every kind — for the `/collections` overview.
 *
 * That page is the one screen a visitor can reach every product from, so it
 * deliberately crosses the fragrance boundary the rest of the fragrance
 * surfaces hold: body care, home fragrance, discovery sets, and gift sets all
 * appear, reachable through the facet chips. Their dedicated routes stay the
 * canonical place to buy them — a card here links back to its category page via
 * `productHref()` — so no second checkout URL is created.
 *
 * → supabase
 *     .from('Product')
 *     .select('<the column list above>, collection:Collection(name,slug,kind)')
 *     .eq('isArchived', false).is('deletedAt', null)
 */
export async function getCatalogProductCards(): Promise<ProductCardData[]> {
  return toCardList(PRODUCTS);
}

/**
 * The fragrances flagged as new, for the `/new-arrival` showroom.
 *
 * Returns full `Product` rows rather than card projections: each arrival gets
 * an editorial panel carrying its story and its complete note pyramid, which is
 * exactly what the narrow card projection omits.
 *
 * Fragrances only — the panel links to a detail page, and body care, home
 * fragrance, and sets have none.
 *
 * → supabase
 *     .from('Product')
 *     .select('*, images:ProductImage(*), collection:Collection!inner(kind)')
 *     .eq('collection.kind', 'FRAGRANCE')
 *     .contains('tags', ['NEW_ARRIVAL'])
 *     .eq('isArchived', false).is('deletedAt', null)
 */
export async function getNewArrivals(): Promise<Product[]> {
  return fragranceProducts().filter((product) =>
    product.tags.includes("NEW_ARRIVAL"),
  );
}

/**
 * Bestsellers for the "Signature Fragrances" grid — fragrances only, whatever
 * a merchandiser flags on a candle.
 *
 * → supabase
 *     .from('Product')
 *     .select('<the column list above>, collection:Collection!inner(name,slug,kind)')
 *     .eq('collection.kind', 'FRAGRANCE')
 *     .eq('isBestseller', true).eq('isArchived', false).is('deletedAt', null)
 *     .limit(limit)
 */
export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]> {
  return toCardList(
    fragranceProducts()
      .filter((product) => product.isBestseller)
      .slice(0, limit),
  );
}

/**
 * A single **fragrance** by slug — the detail page's query. Returns `null` when
 * absent so the route can call `notFound()` rather than throwing
 * (AGENTS.md §1.7).
 *
 * Scoped to `FRAGRANCE` for the same reason `getProductSlugs()` is: body care,
 * home fragrance, and discovery sets have no detail page, so
 * `/perfume/amber-room-spray` must 404 rather than render a PDP with an empty
 * pyramid — a URL no link on the site ever produces.
 *
 * → supabase.from('Product')
 *     .select('*, images:ProductImage(*), collection:Collection!inner(kind)')
 *     .eq('slug', slug).eq('collection.kind', 'FRAGRANCE').maybeSingle()
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return fragranceProducts().find((product) => product.slug === slug) ?? null;
}

/**
 * The fragrance given the full-bleed feature section on the home page.
 *
 * → supabase.from('Product').select('*, images:ProductImage(*)').eq('slug', FEATURED_PRODUCT_SLUG).maybeSingle()
 */
export async function getFeaturedProduct(): Promise<Product | null> {
  return getProductBySlug(FEATURED_PRODUCT_SLUG);
}

/**
 * Every slug with a detail page, for `/perfume/[slug]`'s `generateStaticParams`.
 *
 * Fragrances only: body care, home fragrance, and discovery sets are sold from
 * their category grid and have no PDP, so prerendering `/perfume/<their slug>`
 * would publish a URL nothing links to and `productHref()` never emits.
 *
 * → supabase.from('Product').select('slug, collection:Collection!inner(kind)')
 *     .eq('collection.kind', 'FRAGRANCE')
 *     .eq('isArchived', false).is('deletedAt', null)
 */
export async function getProductSlugs(): Promise<string[]> {
  return fragranceProducts().map((product) => product.slug);
}

/**
 * "You may also love" cards for a product detail page.
 *
 * Prefers the product's own collection and tops the list up from the rest of
 * the catalog when that collection is too small to fill it — Noir and Gemstone
 * both hold only three fragrances, so without the top-up a visitor would see
 * two suggestions on one page and three on another.
 *
 * Fragrances only — the rail sits on a fragrance detail page under "Explore the
 * Collection", and a body mist is not an alternative to a perfume.
 *
 * → supabase
 *     .from('Product')
 *     .select('<the column list above>, collection:Collection!inner(name,slug,kind)')
 *     .eq('collection.kind', 'FRAGRANCE')
 *     .eq('isArchived', false).is('deletedAt', null).neq('slug', slug)
 *     .order('collectionSlug', { ascending: collectionSlug })  // own collection first
 *     .limit(limit)
 */
export async function getRelatedProductCards(
  slug: string,
  limit = 3,
): Promise<ProductCardData[]> {
  const product = PRODUCTS.find((entry) => entry.slug === slug);
  if (!product) return [];

  const candidates = fragranceProducts().filter(
    (entry) => entry.slug !== slug,
  );
  const sameCollection = candidates.filter(
    (entry) => entry.collectionSlug === product.collectionSlug,
  );
  const others = candidates.filter(
    (entry) => entry.collectionSlug !== product.collectionSlug,
  );

  return toCardList([...sameCollection, ...others].slice(0, limit));
}
