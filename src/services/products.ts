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

function toCardData(product: Product, collectionName: string): ProductCardData {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    subtitle: product.subtitle,
    topNotes: product.topNotes,
    heartNotes: product.heartNotes,
    baseNotes: product.baseNotes,
    volumeMl: product.volumeMl,
    priceInCents: product.priceInCents,
    collectionSlug: product.collectionSlug,
    inventory: product.inventory,
    concentration: product.concentration,
    collectionName,
    primaryImage: resolvePrimaryImage(product),
  };
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
 * Every collection, for the `/collections` tab bar and overview.
 *
 * → supabase.from('Collection').select('*').order('name')
 */
export async function getCollections(): Promise<Collection[]> {
  return COLLECTIONS;
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
  const collectionNameBySlug = new Map(
    COLLECTIONS.map((collection) => [collection.slug, collection.name]),
  );

  return PRODUCTS.filter(
    (product) =>
      collectionSlug === undefined ||
      product.collectionSlug === collectionSlug,
  ).map((product) =>
    toCardData(
      product,
      collectionNameBySlug.get(product.collectionSlug) ?? "KHEM",
    ),
  );
}

/**
 * Bestsellers for the "Signature Fragrances" grid.
 *
 * → supabase
 *     .from('Product')
 *     .select('id,name,slug,subtitle,topNotes,heartNotes,baseNotes,volumeMl,priceInCents,inventory,concentration,collection:Collection(name,slug),images:ProductImage(url,alt,isPrimary,sortOrder)')
 *     .eq('isBestseller', true).eq('isArchived', false).is('deletedAt', null)
 *     .limit(limit)
 */
export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]> {
  const collectionNameBySlug = new Map(
    COLLECTIONS.map((collection) => [collection.slug, collection.name]),
  );

  return PRODUCTS.filter((product) => product.isBestseller)
    .slice(0, limit)
    .map((product) =>
      toCardData(
        product,
        collectionNameBySlug.get(product.collectionSlug) ?? "KHEM",
      ),
    );
}

/**
 * A single product by slug. Returns `null` when absent so callers can render an
 * empty state rather than throwing (AGENTS.md §1.7).
 *
 * → supabase.from('Product').select('*, images:ProductImage(*)').eq('slug', slug).maybeSingle()
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return PRODUCTS.find((product) => product.slug === slug) ?? null;
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
 * Every sellable product slug, for `/perfume/[slug]`'s `generateStaticParams`.
 *
 * → supabase.from('Product').select('slug').eq('isArchived', false).is('deletedAt', null)
 */
export async function getProductSlugs(): Promise<string[]> {
  return PRODUCTS.map((product) => product.slug);
}

/**
 * "You may also love" cards for a product detail page.
 *
 * Prefers the product's own collection and tops the list up from the rest of
 * the catalog when that collection is too small to fill it — Noir and Gemstone
 * both hold only three fragrances, so without the top-up a visitor would see
 * two suggestions on one page and three on another.
 *
 * → supabase
 *     .from('Product')
 *     .select(<the column list used by getProductCardsByCollection>)
 *     .eq('isArchived', false).is('deletedAt', null).neq('slug', slug)
 *     .order('collectionSlug', { ascending: collectionSlug })  // own collection first
 *     .limit(limit)
 */
export async function getRelatedProductCards(
  slug: string,
  limit = 3,
): Promise<ProductCardData[]> {
  const collectionNameBySlug = new Map(
    COLLECTIONS.map((collection) => [collection.slug, collection.name]),
  );

  const product = PRODUCTS.find((entry) => entry.slug === slug);
  if (!product) return [];

  const candidates = PRODUCTS.filter((entry) => entry.slug !== slug);
  const sameCollection = candidates.filter(
    (entry) => entry.collectionSlug === product.collectionSlug,
  );
  const others = candidates.filter(
    (entry) => entry.collectionSlug !== product.collectionSlug,
  );

  return [...sameCollection, ...others]
    .slice(0, limit)
    .map((entry) =>
      toCardData(
        entry,
        collectionNameBySlug.get(entry.collectionSlug) ?? "KHEM",
      ),
    );
}
