/**
 * Catalog reads for the dashboard.
 *
 * ## Why this one bypasses RLS
 *
 * Every other read path in `src/services/` goes through
 * {@link getSupabasePublic} on purpose: the policies in `supabase/sql/` are the
 * access control, and reading through a key subject to them is what makes a
 * policy mistake surface instead of hiding behind a `where` clause.
 *
 * The dashboard is the one place where that arrangement is *wrong*. Its whole
 * job includes the rows the public policies hide — the archived product an
 * editor is trying to bring back, the draft article nobody may see yet — so a
 * client that honours those policies would render a list with the interesting
 * half missing and no way to reach it.
 *
 * The compensating control is not weaker, it is elsewhere: every caller of this
 * module sits behind `requireAdmin()` in `src/lib/admin/auth.ts`, checked in the
 * layout and again in every action. Nothing here is reachable from a page a
 * customer can render.
 *
 * Everything else follows the house rules: explicit column lists (never
 * `select('*')`, which would drag a 1536-float embedding into the payload),
 * rows parsed rather than asserted, and a failure that returns `[]`/`null` and
 * logs the provider's message.
 */

import "server-only";

import { MERCH_PAGE_FACETS, type MerchPageFacet } from "@/src/lib/facets";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  ADMIN_COLLECTION_COLUMNS,
  ADMIN_MERCH_PAGE_COLUMNS,
  ADMIN_PRODUCT_COLUMNS,
  ADMIN_PRODUCT_WITH_IMAGES_COLUMNS,
  parseList,
  toAdminCollection,
  toAdminMerchPage,
  toAdminProduct,
  type AdminCollection,
  type AdminMerchPage,
  type AdminProduct,
} from "@/src/schemas/db/admin";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** Every collection, of every kind, in editorial order. */
export async function listAdminCollections(): Promise<AdminCollection[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Collection")
    .select(ADMIN_COLLECTION_COLUMNS)
    .order("kind")
    .order("sortOrder");

  if (error) {
    logFailure("listAdminCollections", error.message);
    return [];
  }

  return parseList(data, toAdminCollection);
}

export async function getAdminCollection(
  slug: string,
): Promise<AdminCollection | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Collection")
    .select(ADMIN_COLLECTION_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getAdminCollection", error.message);
    return null;
  }

  return toAdminCollection(data);
}

/**
 * How many products point at a collection — archived ones included.
 *
 * Drives the "you cannot delete a collection that still has products" guard.
 * Archived rows count: the foreign key does not care whether a product is on
 * sale, and telling an editor a collection is empty when the database will
 * refuse the delete would be worse than not offering the button.
 */
export async function countProductsInCollection(slug: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("Product")
    .select("slug", { count: "exact", head: true })
    .eq("collectionSlug", slug);

  if (error) {
    logFailure("countProductsInCollection", error.message);
    // Zero would invite a delete the database is about to reject. A non-zero
    // guess keeps the destructive button closed when we cannot see.
    return 1;
  }

  return count ?? 0;
}

/**
 * The two merchandising pages.
 *
 * Ordered by {@link MERCH_PAGE_FACETS} rather than by a `sortOrder` column: the
 * table has no such column because the running order of two fixed pages is not
 * a merchandising decision, and the list they appear in is the same list that
 * routes them.
 */
export async function listAdminMerchPages(): Promise<AdminMerchPage[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("MerchPage")
    .select(ADMIN_MERCH_PAGE_COLUMNS);

  if (error) {
    logFailure("listAdminMerchPages", error.message);
    return [];
  }

  const pages = parseList(data, toAdminMerchPage);

  return [...pages].sort(
    (a, b) => MERCH_PAGE_FACETS.indexOf(a.slug) - MERCH_PAGE_FACETS.indexOf(b.slug),
  );
}

export async function getAdminMerchPage(
  slug: string,
): Promise<AdminMerchPage | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("MerchPage")
    .select(ADMIN_MERCH_PAGE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getAdminMerchPage", error.message);
    return null;
  }

  return toAdminMerchPage(data);
}

/**
 * How many live products each merchandising cut currently holds.
 *
 * The same rule `productFacets()` applies on the storefront, expressed as two
 * count queries rather than by pulling the catalogue into memory: the dashboard
 * only ever prints the number. Archived and soft-deleted rows are excluded
 * because the storefront pages exclude them — a tile that disagreed with the
 * page it links to would be worse than no tile.
 */
export async function countMerchPageProducts(): Promise<
  Record<MerchPageFacet, number>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { "best-sellers": 0, "limited-edition": 0 };

  const live = () =>
    supabase
      .from("Product")
      .select("slug", { count: "exact", head: true })
      .eq("isArchived", false)
      .is("deletedAt", null);

  const [bestSellers, limited] = await Promise.all([
    live().eq("isBestseller", true),
    live().contains("tags", ["LIMITED_EDITION"]),
  ]);

  if (bestSellers.error) {
    logFailure("countMerchPageProducts(best-sellers)", bestSellers.error.message);
  }
  if (limited.error) {
    logFailure("countMerchPageProducts(limited-edition)", limited.error.message);
  }

  return {
    "best-sellers": bestSellers.count ?? 0,
    "limited-edition": limited.count ?? 0,
  };
}

/** The full product list, archived rows included, newest edits first. */
export async function listAdminProducts(): Promise<AdminProduct[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Product")
    .select(ADMIN_PRODUCT_COLUMNS)
    .is("deletedAt", null)
    .order("collectionSlug")
    .order("sortOrder");

  if (error) {
    logFailure("listAdminProducts", error.message);
    return [];
  }

  return parseList(data, toAdminProduct);
}

/** One product with its gallery — the edit screen's projection. */
export async function getAdminProduct(slug: string): Promise<AdminProduct | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Product")
    .select(ADMIN_PRODUCT_WITH_IMAGES_COLUMNS)
    .eq("slug", slug)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    logFailure("getAdminProduct", error.message);
    return null;
  }

  return toAdminProduct(data);
}

/**
 * Live products with no vector.
 *
 * Surfaced on the dashboard because a missing embedding is invisible from the
 * storefront — search still works, it just ranks that product on words alone.
 * A number on screen is what turns that into something somebody notices.
 */
export async function countProductsMissingEmbedding(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("Product")
    .select("slug", { count: "exact", head: true })
    .is("embedding", null)
    .eq("isArchived", false)
    .is("deletedAt", null);

  if (error) {
    logFailure("countProductsMissingEmbedding", error.message);
    return 0;
  }

  return count ?? 0;
}
