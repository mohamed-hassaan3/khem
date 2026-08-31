import "server-only";

/**
 * Promotion reads for the dashboard.
 *
 * ## The product count is counted, never stored
 *
 * `promotions` has no `productCount` column, for the reason `0026` gives about
 * credit balances and `0028` gives about redemption counts: a stored figure and
 * the rows it describes are two records of one fact, and the day they disagree
 * there is no way to tell which is lying. A promotion's reach is a `select` over
 * `active_product_promotions`, which is the same view the storefront prices
 * from — so the number on the list is the number of products actually being
 * repriced, not the number somebody selected.
 *
 * That distinction matters more here than it looks: a collection-scoped promotion
 * that a product-scoped one outranks will show a smaller count than its
 * selection, and that is the truth about what it is doing.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  PROMOTION_COLUMNS,
  parseList,
  toPromotion,
} from "@/src/schemas/db/marketing";
import type { PromotionDetail, PromotionTargets } from "@/src/types/marketing";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** How many products each promotion is currently the winning price for. */
async function reachByPromotion(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  const supabase = getSupabaseAdmin();
  if (!supabase) return counts;

  const { data, error } = await supabase
    .from("active_product_promotions")
    .select("promotionId");

  if (error) {
    logFailure("reachByPromotion", error.message);
    return counts;
  }

  for (const row of data ?? []) {
    const id = (row as { promotionId?: unknown }).promotionId;
    if (typeof id !== "string") continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

/** The target sets for one promotion. */
async function targetsFor(promotionId: string): Promise<PromotionTargets> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { productSlugs: [], collectionSlugs: [] };

  const [products, collections] = await Promise.all([
    supabase
      .from("promotion_products")
      .select("productSlug")
      .eq("promotionId", promotionId),
    supabase
      .from("promotion_collections")
      .select("collectionSlug")
      .eq("promotionId", promotionId),
  ]);

  return {
    productSlugs: (products.data ?? [])
      .map((row) => (typeof row.productSlug === "string" ? row.productSlug : ""))
      .filter((slug) => slug.length > 0),
    collectionSlugs: (collections.data ?? [])
      .map((row) =>
        typeof row.collectionSlug === "string" ? row.collectionSlug : "",
      )
      .filter((slug) => slug.length > 0),
  };
}

/** Every promotion, newest first, with what it is currently repricing. */
export async function listPromotions(): Promise<PromotionDetail[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data, error }, reach] = await Promise.all([
    supabase
      .from("promotions")
      .select(PROMOTION_COLUMNS)
      .order("createdAt", { ascending: false }),
    reachByPromotion(),
  ]);

  if (error) {
    logFailure("listPromotions", error.message);
    return [];
  }

  return parseList(data, (row) => {
    const promotion = toPromotion(row);
    if (!promotion) return null;

    return {
      ...promotion,
      // The list does not need the selections — it needs the reach. Fetching
      // both junctions per row would be an N+1 for a column nothing prints.
      targets: { productSlugs: [], collectionSlugs: [] },
      productCount: reach.get(promotion.id) ?? 0,
    };
  });
}

/** One promotion, with its selections, for the editor. */
export async function getPromotion(id: string): Promise<PromotionDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getPromotion", error.message);
    return null;
  }

  const promotion = toPromotion(data);
  if (!promotion) return null;

  const [targets, reach] = await Promise.all([
    targetsFor(promotion.id),
    reachByPromotion(),
  ]);

  return {
    ...promotion,
    targets,
    productCount: reach.get(promotion.id) ?? 0,
  };
}
