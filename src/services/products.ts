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
 * Bestsellers for the "Signature Fragrances" grid.
 *
 * → supabase
 *     .from('Product')
 *     .select('id,name,slug,subtitle,topNotes,heartNotes,baseNotes,volumeMl,priceInCents,collection:Collection(name,slug),images:ProductImage(url,alt,isPrimary,sortOrder)')
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
