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
import { getProductPromotions } from "@/src/services/marketing";
import type { MerchPageSlug } from "@/src/lib/facets";
import type { ScentProfileSlug } from "@/src/lib/scent-profiles";
import type { LinkableProduct } from "@/src/lib/routes";
import {
  CATEGORY_COLUMNS,
  COLLECTION_COLUMNS,
  MERCH_PAGE_COLUMNS,
  PRODUCT_CARD_COLUMNS,
  PRODUCT_WITH_IMAGES_COLUMNS,
  SCENT_PROFILE_COLUMNS,
  parseList,
  toCategory,
  toCollection,
  toDetailPageTarget,
  toMerchPage,
  toProduct,
  toScentProfile,
  toProductCard,
} from "@/src/schemas/db/catalog";
import { BOUTIQUE_SETTING_COLUMNS, toBoutiqueSetting } from "@/src/schemas/db/directory";
import type {
  Category,
  Collection,
  CollectionKind,
  MerchPage,
  Product,
  ProductCardData,
  ScentProfile,
} from "@/src/types/catalog";

/** One log shape for the whole module: provider message, never row contents. */
function logFailure(query: string, message: string): void {
  console.error(`[catalog] ${query} failed: ${message}`);
}

/**
 * The collection kinds served by `/ritual/[slug]`.
 *
 * Body care and home fragrance are one page shape — three photographs, three
 * captions, a story, a buy block — so they share one route, and the kind only
 * decides which eyebrow it opens with.
 *
 * Typed as `CollectionKind[]` rather than left to inference so a renamed member
 * of the union is a compile error here, in the file that queries on it.
 */
const RITUAL_KINDS: readonly CollectionKind[] = ["BODY", "HOME"];

/**
 * The collection kinds served by `/set/[slug]`.
 *
 * Discovery and gift sets are one page shape — a boxed composition, a contents
 * list, a story, a buy block — so they share one route the way body care and
 * home fragrance share `/ritual/[slug]`.
 */
const SET_KINDS: readonly CollectionKind[] = ["DISCOVERY", "GIFT"];

/**
 * Every kind with a detail page of its own.
 *
 * The query-side statement of `hasDetailPage()` in `src/lib/routes.ts`, and the
 * two must agree: this is what decides whether a slug can be commented on and
 * what a related rail is allowed to link to.
 *
 * The sets used to be absent, because they sold from a category grid and had
 * nowhere for a comment to appear. They have `/set/[slug]` now, so all five
 * kinds are here and this list is the union — which is the shape it should have
 * had all along, and the reason it is spelled out rather than replaced by a
 * `true`: a sixth kind must still make a decision here.
 */
const DETAIL_PAGE_KINDS: readonly CollectionKind[] = [
  "FRAGRANCE",
  ...RITUAL_KINDS,
  ...SET_KINDS,
];

/**
 * What a ritual page's related rail may draw from.
 *
 * Deliberately identical to {@link DETAIL_PAGE_KINDS} rather than an alias of
 * it: a rail may only ever offer pages that exist, so if a sixth kind gains a
 * detail page these should move together — but they answer different questions,
 * and collapsing them would hide the day one needs to change without the other.
 *
 * A body mist's neighbours are its own room-spray twin, the other mists, and
 * the eau de parfum it was drawn from. `related_products()` breaks ties toward
 * the same kind first, so the rail opens on the shelf the visitor is standing
 * at before it reaches across to the perfumes.
 */
export const RITUAL_RELATED_KINDS: readonly CollectionKind[] = [
  "FRAGRANCE",
  ...RITUAL_KINDS,
];

/**
 * What a set page's related rail may draw from.
 *
 * The fragrances first — a discovery set exists to introduce them, so the
 * neighbour a visitor most wants next is a full bottle of something in the box
 * — and the other sets, so gifting can be compared. `related_products()` breaks
 * ties toward the same kind, which puts the other sets first on a gift page and
 * lets the perfumes follow.
 *
 * The ritual goods are deliberately absent: a body mist is neither what a
 * discovery set contains nor an alternative to one.
 */
export const SET_RELATED_KINDS: readonly CollectionKind[] = [
  "FRAGRANCE",
  ...SET_KINDS,
];

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
 * Every category the house offers, in curated order.
 *
 * Disabled categories are dropped here rather than at each call site: a
 * category switched off is one the storefront must stop offering everywhere at
 * once, and leaving that to be remembered per surface is how one grid keeps
 * printing a shelf the menu has withdrawn. The dashboard reads its own list —
 * see `src/services/admin/catalog.ts` — because it must still show what it can
 * switch back on.
 */
export async function getCategories(locale: Locale): Promise<Category[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Category")
    .select(CATEGORY_COLUMNS)
    .eq("isEnabled", true)
    .order("sortOrder");

  if (error) {
    logFailure("getCategories", error.message);
    return [];
  }

  return parseList(data, (row) => toCategory(row, locale));
}

/**
 * A single category by slug, or `null` so the route can call `notFound()`.
 *
 * A disabled category answers `null` too: its page is withdrawn along with its
 * menu entries, which is what switching it off means.
 */
export async function getCategoryBySlug(
  locale: Locale,
  slug: string,
): Promise<Category | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Category")
    .select(CATEGORY_COLUMNS)
    // Parameterised by the client, never interpolated into SQL.
    .eq("slug", slug)
    .eq("isEnabled", true)
    .maybeSingle();

  if (error) {
    logFailure("getCategoryBySlug", error.message);
    return null;
  }

  return toCategory(data, locale);
}

/**
 * The collections standing under one category, in their curated order.
 *
 * What a category page lists above its grid, and what the Nav prints inside a
 * disclosure.
 */
export async function getCollectionsByCategory(
  locale: Locale,
  categorySlug: string,
): Promise<Collection[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Collection")
    .select(COLLECTION_COLUMNS)
    .eq("categorySlug", categorySlug)
    .order("sortOrder");

  if (error) {
    logFailure("getCollectionsByCategory", error.message);
    return [];
  }

  return parseList(data, (row) => toCollection(row, locale));
}

/**
 * Every product beneath a category — through its collections, not around them.
 *
 * A product points at a collection and a collection points at a category, so
 * this is one join rather than a second edge on `"Product"` that would have to
 * be kept in step with the first. PostgREST expresses it as a filter on the
 * embedded parent, and `!inner` is what makes it a join rather than a left
 * join returning every product with a null collection attached.
 *
 * This is what keeps `/collections/body-care` showing the same four mists it
 * showed when it was a collection of its own: the products moved down one
 * level, and the page reaches through.
 */
export async function getProductCardsByCategory(
  locale: Locale,
  categorySlug: string,
): Promise<ProductCardData[]> {
  const query = cardQuery();
  if (!query) return [];

  return toCards(
    locale,
    "getProductCardsByCategory",
    // The embed is aliased `collection:` in `PRODUCT_CARD_COLUMNS`, and a
    // filter on an embedded resource is addressed by its alias.
    await query.eq("collection.categorySlug", categorySlug).order("sortOrder"),
  );
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
 * Fragrance collections only — what the search panel offers to browse.
 *
 * Body care, home fragrance and the sets are collections too, and since their
 * category routes were folded into `/collections/[slug]` they sit beside
 * Signature and Noir in the tab bar. They are still not chapters of the perfume
 * library, which is what this narrower list means.
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
 * The stored presentation of a merchandising page.
 *
 * `null` when there is no row, when the row cannot be parsed, or when the read
 * fails — and the route treats all three the same way, by falling back to the
 * dictionary copy and the banner constants it used before this table existed.
 * That is deliberate: the Nav links straight at these pages, so one must never
 * fail to render because a table is empty.
 */
export async function getMerchPage(
  locale: Locale,
  facet: MerchPageSlug,
): Promise<MerchPage | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("MerchPage")
    .select(MERCH_PAGE_COLUMNS)
    // Parameterised by the client, and already narrowed to the two-member
    // union by `parseMerchPageFacet()` before it reaches here.
    .eq("slug", facet)
    .maybeSingle();

  if (error) {
    logFailure("getMerchPage", error.message);
    return null;
  }

  return toMerchPage(data, locale);
}

/**
 * The stored presentation of a scent-profile page, and the families it spans.
 *
 * `null` on a missing row, an unparseable row, or a failed read — the route
 * treats all three alike and falls back to the dictionary copy and the constants
 * in `src/lib/scent-profiles.ts`, for the reason {@link getMerchPage} gives: the
 * Nav links straight at these five pages, so one must never fail to render
 * because a table is empty.
 */
export async function getScentProfile(
  locale: Locale,
  slug: ScentProfileSlug,
): Promise<ScentProfile | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ScentProfile")
    .select(SCENT_PROFILE_COLUMNS)
    // Parameterised by the client, and already narrowed to the five-member
    // union by `parseScentProfileSlug()` before it reaches here.
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getScentProfile", error.message);
    return null;
  }

  return toScentProfile(data, locale);
}

/**
 * The product slugs built on materials of the given olfactive families.
 *
 * Two hops of a relation that already exists: `"Ingredient".families` overlaps
 * the profile's families, and `"IngredientUsage"` names the perfumes each of
 * those materials is used in — a real foreign key to `"Product".slug`
 * (`supabase/sql/0002_content.sql`). Nothing derives membership from the note
 * pyramid, which names accords rather than sourced materials.
 *
 * `!inner` is deliberately *not* used: a catalogued material with no usage rows
 * yet should contribute nothing rather than exclude the query, and an empty
 * embedded array does exactly that.
 */
async function scentProfileProductSlugs(
  families: readonly string[],
): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase || families.length === 0) return [];

  const { data, error } = await supabase
    .from("Ingredient")
    // The same embedded-relation alias `INGREDIENT_COLUMNS` uses, narrowed to
    // the one column this needs — the profile page renders products, not
    // materials.
    .select("usedIn:IngredientUsage(productSlug)")
    .overlaps("families", [...families]);

  if (error) {
    logFailure("scentProfileProductSlugs", error.message);
    return [];
  }

  const slugs = new Set<string>();

  for (const row of (data ?? []) as { usedIn?: { productSlug?: unknown }[] }[]) {
    for (const usage of row.usedIn ?? []) {
      if (typeof usage.productSlug === "string") slugs.add(usage.productSlug);
    }
  }

  return [...slugs];
}

/**
 * Card projections for a scent-profile page.
 *
 * Every kind, not fragrances alone: an ingredient can be used in a body oil or
 * a candle, and a cedar candle is woody by the same rule a cedar perfume is.
 * Catalogue order is preserved — `sortOrder`, like every other listing — so the
 * profile pages read in the same sequence as the collections they draw from.
 */
export async function getProductCardsByScentProfile(
  locale: Locale,
  families: readonly string[],
): Promise<ProductCardData[]> {
  const slugs = await scentProfileProductSlugs(families);
  if (slugs.length === 0) return [];

  const query = cardQuery();
  if (!query) return [];

  return toCards(
    locale,
    "getProductCardsByScentProfile",
    await query.in("slug", slugs).order("sortOrder"),
  );
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

/**
 * Shared tail: log a failure as `[]`, parse a success into cards.
 *
 * Every card projection in this module funnels through here, which is why the
 * promotion map is fetched *here* rather than in each of the five callers — a
 * grid that forgot to ask would print list prices beside a checkout charging
 * campaign ones, and there is now no place to forget. `getProductPromotions()`
 * is request-memoised, so five grids on one page are one query.
 */
async function toCards(
  locale: Locale,
  label: string,
  result: { data: unknown[] | null; error: { message: string } | null },
): Promise<ProductCardData[]> {
  if (result.error) {
    logFailure(label, result.error.message);
    return [];
  }

  const promotions = await getProductPromotions(locale);

  return parseList(result.data, (row) => toProductCard(row, locale, promotions));
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
   * `/cart` and the cart panel resolve persisted ids against this projection,
   * and a body-care line whose id is missing from it would silently vanish
   * from the visitor's bag.
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
 * The entire catalog as cards — every kind — for the `/collections` overview.
 *
 * That page is the one screen a visitor can reach every product from, so it
 * deliberately crosses the fragrance boundary the rest of the fragrance
 * surfaces hold: body care, home fragrance, discovery sets, and gift sets all
 * appear, reachable through the facet chips. Each collection's own page under
 * `/collections/[slug]` stays the canonical place to buy from — a card here
 * links back to it via `productHref()` — so no second checkout URL is created.
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

  const promotions = await getProductPromotions(locale);

  return parseList(data, (row) =>
    toProduct(row, locale, promotions),
  );
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

  return toProduct(data, locale, await getProductPromotions(locale));
}

/**
 * A single **ritual** product by slug — the body-care and home-fragrance detail
 * page (`/ritual/[slug]`). Returns `null` when absent so the route can call
 * `notFound()` rather than throwing (AGENTS.md §1.7).
 *
 * A separate function rather than a widened {@link getProductBySlug}, and the
 * `in` filter is the reason: each detail page is scoped to the kinds it can
 * actually render. A fragrance under `/ritual/…` would print a triptych with no
 * captions and no pyramid at all; a body mist under `/perfume/…` would print an
 * empty pyramid. Both are 404s, and one URL space per page shape is what keeps
 * them that way.
 *
 * Discovery and gift sets are deliberately absent: they sell a boxed
 * composition from `<DiscoverySetCard>` on their category page and have no
 * detail page — `productHref()` still routes them there.
 */
export async function getRitualProductBySlug(
  locale: Locale,
  slug: string,
): Promise<Product | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Product")
    .select(`${PRODUCT_WITH_IMAGES_COLUMNS}, collection:Collection!inner(kind)`)
    .eq("slug", slug)
    .in("collection.kind", RITUAL_KINDS)
    .eq("isArchived", false)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    logFailure("getRitualProductBySlug", error.message);
    return null;
  }

  return toProduct(data, locale, await getProductPromotions(locale));
}

/**
 * A single **set** by slug — the discovery and gift detail page
 * (`/set/[slug]`). Returns `null` when absent so the route can call
 * `notFound()` rather than throwing (AGENTS.md §1.7).
 *
 * A separate function rather than a widened {@link getRitualProductBySlug},
 * and the `in` filter is the reason: each detail page is scoped to the kinds it
 * can actually render, so `/set/<a-perfume>` and `/perfume/<a-set>` are both
 * 404s at the query rather than pages that render the wrong shape. One URL
 * space per page shape is what keeps them that way.
 */
export async function getSetProductBySlug(
  locale: Locale,
  slug: string,
): Promise<Product | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Product")
    .select(`${PRODUCT_WITH_IMAGES_COLUMNS}, collection:Collection!inner(kind)`)
    .eq("slug", slug)
    .in("collection.kind", SET_KINDS)
    .eq("isArchived", false)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    logFailure("getSetProductBySlug", error.message);
    return null;
  }

  return toProduct(data, locale, await getProductPromotions(locale));
}

/**
 * Every discovery and gift-set slug, for `/set/[slug]`'s
 * `generateStaticParams` and for the sitemap.
 *
 * The list twin of {@link getSetProductBySlug}, scoped by the same `in` filter
 * — so the routes that get prerendered are exactly the routes that resolve, and
 * nothing in the sitemap can 404.
 */
export async function getSetProductSlugs(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select("slug, collection:Collection!inner(kind)")
    .in("collection.kind", SET_KINDS)
    .eq("isArchived", false)
    .is("deletedAt", null)
    .order("sortOrder");

  if (error) {
    logFailure("getSetProductSlugs", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (typeof row.slug === "string" ? row.slug : null))
    .filter((slug): slug is string => slug !== null);
}

/**
 * Where a product's detail page is, by slug — or `null` when it has none.
 *
 * The lookup a *page-agnostic* caller needs, and `actions/comments.ts` is the
 * one that exists. It is not {@link getProductBySlug}, which is
 * fragrance-scoped by design: validating a comment through that rejected every
 * body-care and home-fragrance slug with `slugInvalid` the moment
 * `/ritual/[slug]` began rendering the form.
 *
 * Returns a {@link LinkableProduct} rather than a `Product` because that is
 * genuinely all the caller wants — does this exist, and which page does it live
 * on. Selecting a full row with its gallery to answer an existence check would
 * be the over-selection this file's header rules out, on a write path at that.
 *
 * Still scoped, not unscoped: a slug whose kind has no detail page is rejected
 * as firmly as an unknown one, because there would be no page for the comment
 * to appear on. That is the same rule as `hasDetailPage()`, asked of the
 * database. All five kinds qualify today — the sets joined when `/set/[slug]`
 * landed — but the scoping stays, because a sixth kind should have to opt in.
 */
export async function getDetailPageTarget(
  slug: string,
): Promise<LinkableProduct | null> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Product")
    .select("slug, collection:Collection!inner(kind)")
    .eq("slug", slug)
    .in("collection.kind", DETAIL_PAGE_KINDS)
    .eq("isArchived", false)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    logFailure("getDetailPageTarget", error.message);
    return null;
  }

  // The embed arrives as an object or a single-element array depending on how
  // PostgREST resolves the relationship; `detailPageTargetSchema` accepts both
  // and rejects anything else rather than asserting a shape onto `unknown`.
  return toDetailPageTarget(data);
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
 * Every body-care and home-fragrance slug, for `/ritual/[slug]`'s
 * `generateStaticParams` and for the sitemap.
 *
 * The list twin of {@link getRitualProductBySlug}, scoped by the same `in`
 * filter — so the routes that get prerendered are exactly the routes that
 * resolve, and nothing in the sitemap can 404.
 */
export async function getRitualProductSlugs(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select("slug, collection:Collection!inner(kind)")
    .in("collection.kind", RITUAL_KINDS)
    .eq("isArchived", false)
    .is("deletedAt", null)
    .order("sortOrder");

  if (error) {
    logFailure("getRitualProductSlugs", error.message);
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
 * holds two fragrances and Gemstone six, so without the top-up a visitor would
 * see one suggestion on one page and four on another. The rail asks for four —
 * the width `<RelatedProducts>` grids to at `lg:` — and the top-up is what
 * makes four reachable from a two-product collection.
 *
 * `kinds` is what the rail is allowed to draw from, and it defaults to the
 * fragrances so `/perfume/[slug]` reads exactly as it did before the argument
 * existed. Only `/ritual/[slug]` widens it — see {@link RITUAL_RELATED_KINDS}.
 * It is a server-side constant at every call site and never request-derived:
 * this is the one parameter that decides what a visitor is shown, so it must
 * not be something they can set.
 */
export async function getRelatedProductCards(
  locale: Locale,
  slug: string,
  limit = 4,
  kinds: readonly CollectionKind[] = ["FRAGRANCE"],
): Promise<ProductCardData[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .rpc("related_products", {
      product_slug: slug,
      match_limit: limit,
      kinds,
    })
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
