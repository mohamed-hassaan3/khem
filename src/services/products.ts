/**
 * Catalog query layer.
 *
 * Every function here is the seam between the UI and the database. They return
 * exactly the projection the UI consumes, which is what let the catalog move
 * from `src/data/products.ts` into Postgres without a single component or page
 * changing.
 *
 * ## Rules this file keeps
 *
 * - Reads go through {@link getSupabasePublic}, the **publishable** key, so row
 *   level security applies. The policies in `supabase/sql/0001_catalog.sql`
 *   already exclude archived and soft-deleted rows; the explicit filters below
 *   are belt and braces, and neither is trusted alone.
 * - Explicit column lists, never `select('*')`. `ProductCardData` is
 *   deliberately narrow and a list query honours that — and `select('*')` on
 *   `"Product"` would drag a 1536-float embedding into the page payload.
 * - Rows are parsed, never asserted (`src/schemas/db/catalog.ts`). One
 *   malformed row is dropped; it does not blank the grid.
 * - Failure returns `[]` or `null` and logs the provider's message. A database
 *   outage degrades a page to its empty state; it does not 500 the site.
 */

import "server-only";

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabasePublic } from "@/src/lib/supabase";
import {
  COLLECTION_COLUMNS,
  PRODUCT_CARD_COLUMNS,
  PRODUCT_WITH_IMAGES_COLUMNS,
  parseList,
  toCollection,
  toProduct,
  toProductCard,
} from "@/src/schemas/db/catalog";
import { BOUTIQUE_SETTING_COLUMNS, toBoutiqueSetting } from "@/src/schemas/db/directory";
import type {
  Collection,
  CollectionKind,
  Product,
  ProductCardData,
} from "@/src/types/catalog";

/** One log shape for the whole module: provider message, never row contents. */
function logFailure(query: string, message: string): void {
  console.error(`[catalog] ${query} failed: ${message}`);
}

/**
 * Collections shown on the home page.
 *
 * Ordered by `sortOrder`, not by name: the seed order is editorial — Signature
 * reads before Noir because that is the story, not the alphabet.
 */
export async function getFeaturedCollections(
  locale: Locale,
): Promise<Collection[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Collection")
    .select(COLLECTION_COLUMNS)
    .eq("isFeatured", true)
    .order("sortOrder");

  if (error) {
    logFailure("getFeaturedCollections", error.message);
    return [];
  }

  return parseList(data, (row) => toCollection(row, locale));
}

/**
 * Every collection, of every kind. Used where the caller genuinely means all of
 * them — resolving a stored cart line, for instance.
 */
export async function getCollections(locale: Locale): Promise<Collection[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Collection")
    .select(COLLECTION_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("getCollections", error.message);
    return [];
  }

  return parseList(data, (row) => toCollection(row, locale));
}

/**
 * Fragrance collections only — the `/collections` overview and its tab bar.
 *
 * Body care, home fragrance, and discovery sets are collections too, but they
 * are not chapters of the perfume library and each has its own route; listing
 * them beside Signature and Noir would offer two URLs for the same goods.
 */
export async function getFragranceCollections(
  locale: Locale,
): Promise<Collection[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Collection")
    .select(COLLECTION_COLUMNS)
    .eq("kind", "FRAGRANCE")
    .order("sortOrder");

  if (error) {
    logFailure("getFragranceCollections", error.message);
    return [];
  }

  return parseList(data, (row) => toCollection(row, locale));
}

/**
 * A single collection by slug. Returns `null` when absent so the route can call
 * `notFound()` rather than throwing (AGENTS.md §1.7).
 */
export async function getCollectionBySlug(
  locale: Locale,
  slug: string,
): Promise<Collection | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Collection")
    .select(COLLECTION_COLUMNS)
    // Parameterised by the client, never interpolated into SQL.
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getCollectionBySlug", error.message);
    return null;
  }

  return toCollection(data, locale);
}

/**
 * A single fragrance collection by slug, for `/collections/[slug]`.
 *
 * Scoped to `FRAGRANCE` so `/collections/body-care` 404s rather than rendering
 * a second, tab-less copy of `/body-care`.
 */
export async function getFragranceCollectionBySlug(
  locale: Locale,
  slug: string,
): Promise<Collection | null> {
  const collection = await getCollectionBySlug(locale, slug);
  return collection?.kind === "FRAGRANCE" ? collection : null;
}

/**
 * The base card select: published products with their parent collection and
 * their gallery. Filters are appended by the caller, `.order()` last — the
 * builder stops accepting `.eq()` once a transform has been applied.
 *
 * Returns `null` when Supabase is unconfigured, which every caller reads as
 * "render the empty state".
 */
function cardQuery() {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  return supabase
    .from("Product")
    .select(PRODUCT_CARD_COLUMNS)
    .eq("isArchived", false)
    .is("deletedAt", null);
}

/** Shared tail: log a failure as `[]`, parse a success into cards. */
function toCards(
  locale: Locale,
  label: string,
  result: { data: unknown[] | null; error: { message: string } | null },
): ProductCardData[] {
  if (result.error) {
    logFailure(label, result.error.message);
    return [];
  }

  return parseList(result.data, (row) => toProductCard(row, locale));
}

/**
 * Card projections for a collection listing. Omitting `collectionSlug` returns
 * the whole catalog, which is what `/collections` renders.
 */
export async function getProductCardsByCollection(
  locale: Locale,
  collectionSlug?: string,
): Promise<ProductCardData[]> {
  /*
   * Omitting the slug deliberately returns EVERY kind, not just fragrances:
   * `/cart` and `/wishlist` resolve persisted ids against this projection, and
   * a body-care line whose id is missing from it would silently vanish from
   * the visitor's bag.
   */
  const query = cardQuery();
  if (!query) return [];

  const scoped =
    collectionSlug === undefined
      ? query
      : query.eq("collectionSlug", collectionSlug);

  return toCards(
    locale,
    "getProductCardsByCollection",
    await scoped.order("sortOrder"),
  );
}

/**
 * Card projections for one category — `/body-care`, `/room-fragrance`, and
 * `/discovery` each render exactly one kind.
 */
export async function getProductCardsByKind(
  locale: Locale,
  kind: CollectionKind,
): Promise<ProductCardData[]> {
  const query = cardQuery();
  if (!query) return [];

  // The `!inner` in `PRODUCT_CARD_COLUMNS` is what makes filtering on the
  // embedded collection a join condition rather than a post-filter.
  return toCards(
    locale,
    "getProductCardsByKind",
    await query.eq("collection.kind", kind).order("sortOrder"),
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
 */
export async function getCatalogProductCards(
  locale: Locale,
): Promise<ProductCardData[]> {
  const query = cardQuery();
  if (!query) return [];

  return toCards(locale, "getCatalogProductCards", await query.order("sortOrder"));
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
 */
export async function getNewArrivals(locale: Locale): Promise<Product[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select(`${PRODUCT_WITH_IMAGES_COLUMNS}, collection:Collection!inner(kind)`)
    .eq("collection.kind", "FRAGRANCE")
    .contains("tags", ["NEW_ARRIVAL"])
    .eq("isArchived", false)
    .is("deletedAt", null)
    .order("sortOrder");

  if (error) {
    logFailure("getNewArrivals", error.message);
    return [];
  }

  return parseList(data, (row) => toProduct(row, locale));
}

/**
 * Bestsellers for the "Signature Fragrances" grid — fragrances only, whatever a
 * merchandiser flags on a candle.
 */
export async function getFeaturedProducts(
  locale: Locale,
  limit = 4,
): Promise<ProductCardData[]> {
  const query = cardQuery();
  if (!query) return [];

  return toCards(
    locale,
    "getFeaturedProducts",
    await query
      .eq("collection.kind", "FRAGRANCE")
      .eq("isBestseller", true)
      .order("sortOrder")
      .limit(limit),
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
 */
export async function getProductBySlug(
  locale: Locale,
  slug: string,
): Promise<Product | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Product")
    .select(`${PRODUCT_WITH_IMAGES_COLUMNS}, collection:Collection!inner(kind)`)
    .eq("slug", slug)
    .eq("collection.kind", "FRAGRANCE")
    .eq("isArchived", false)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    logFailure("getProductBySlug", error.message);
    return null;
  }

  return toProduct(data, locale);
}

/**
 * The fragrance given the full-bleed feature section on the home page.
 *
 * Which one that is now lives in `"BoutiqueSetting"."featuredProductSlug"`
 * rather than in a constant — it is a merchandising decision, and merchandising
 * decisions should not require a deploy.
 */
export async function getFeaturedProduct(locale: Locale): Promise<Product | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("BoutiqueSetting")
    .select(BOUTIQUE_SETTING_COLUMNS)
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    logFailure("getFeaturedProduct", error.message);
    return null;
  }

  const slug = toBoutiqueSetting(data)?.featuredProductSlug;
  return slug ? getProductBySlug(locale, slug) : null;
}

/**
 * Every slug with a detail page, for `/perfume/[slug]`'s `generateStaticParams`.
 *
 * Fragrances only: body care, home fragrance, and discovery sets are sold from
 * their category grid and have no PDP, so prerendering `/perfume/<their slug>`
 * would publish a URL nothing links to and `productHref()` never emits.
 */
export async function getProductSlugs(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select("slug, collection:Collection!inner(kind)")
    .eq("collection.kind", "FRAGRANCE")
    .eq("isArchived", false)
    .is("deletedAt", null)
    .order("sortOrder");

  if (error) {
    logFailure("getProductSlugs", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (typeof row.slug === "string" ? row.slug : null))
    .filter((slug): slug is string => slug !== null);
}

/**
 * "You may also love" cards for a product detail page.
 *
 * Ranked by **scent**, not by shelf: `related_products()` orders candidates by
 * cosine distance between their `search_document` embeddings, so a resinous
 * Signature fragrance can surface beside a resinous Noir one instead of
 * whichever three happen to share a collection.
 *
 * Two things it deliberately keeps from the previous implementation. It prefers
 * the product's own collection whenever vectors cannot decide — which is the
 * whole ordering until `npm run embed` has run, so the rail is never empty on a
 * fresh database. And it tops the list up from the rest of the catalog: Noir
 * and Gemstone hold only three fragrances each, and without the top-up a
 * visitor would see two suggestions on one page and three on another.
 */
export async function getRelatedProductCards(
  locale: Locale,
  slug: string,
  limit = 3,
): Promise<ProductCardData[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .rpc("related_products", { product_slug: slug, match_limit: limit })
    // The function returns `setof "Product"`, so the projection is applied on
    // top of it — without this the response would carry every column,
    // embedding included.
    .select(PRODUCT_CARD_COLUMNS);

  // `data` is typed loosely for an RPC projection; the row schema is what
  // actually decides whether each row is a card.
  return toCards(locale, "getRelatedProductCards", {
    data: data as unknown[] | null,
    error,
  });
}
