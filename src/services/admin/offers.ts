import "server-only";

/**
 * Offer reads for the dashboard.
 *
 * `getSupabaseAdmin()` rather than the publishable key, unlike the storefront:
 * `supabase/sql/0060_offers.sql` publishes only **live** offers to `anon`, and
 * the desk has to see the drafts, the lapsed and the switched-off ones too.
 * Every caller sits behind `requireAdmin()`.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { OFFER_COLUMNS, parseList, toOffer } from "@/src/schemas/db/offers";
import type { OfferDetail, OfferTargets } from "@/src/types/offer";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

const NO_TARGETS: OfferTargets = {
  triggerProductSlugs: [],
  triggerCollectionSlugs: [],
  rewardProductSlugs: [],
  rewardCollectionSlugs: [],
};

function slugsFrom(rows: unknown[] | null, key: string): string[] {
  return (rows ?? [])
    .map((row) => (row as Record<string, unknown>)[key])
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
}

/** All four target sets for one offer, in one round of parallel reads. */
async function targetsFor(offerId: string): Promise<OfferTargets> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NO_TARGETS;

  const [tp, tc, rp, rc] = await Promise.all([
    supabase.from("offer_trigger_products").select("productSlug").eq("offerId", offerId),
    supabase
      .from("offer_trigger_collections")
      .select("collectionSlug")
      .eq("offerId", offerId),
    supabase.from("offer_reward_products").select("productSlug").eq("offerId", offerId),
    supabase
      .from("offer_reward_collections")
      .select("collectionSlug")
      .eq("offerId", offerId),
  ]);

  return {
    triggerProductSlugs: slugsFrom(tp.data, "productSlug"),
    triggerCollectionSlugs: slugsFrom(tc.data, "collectionSlug"),
    rewardProductSlugs: slugsFrom(rp.data, "productSlug"),
    rewardCollectionSlugs: slugsFrom(rc.data, "collectionSlug"),
  };
}

/**
 * Live redemptions per offer — what the caps are actually counting.
 *
 * One query for the whole list rather than one per row: a released redemption
 * does not count, and the partial index `offer_redemption_counting_idx` is on
 * exactly this predicate.
 */
async function redemptionCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  const supabase = getSupabaseAdmin();
  if (!supabase) return counts;

  const { data, error } = await supabase
    .from("offer_redemptions")
    .select("offerId")
    .is("releasedAt", null);

  if (error) {
    logFailure("redemptionCounts", error.message);
    return counts;
  }

  for (const row of data ?? []) {
    const id = (row as { offerId?: unknown }).offerId;
    if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

/** Every offer, highest priority first, with how often it has been used. */
export async function listOffers(): Promise<OfferDetail[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("offers")
      .select(OFFER_COLUMNS)
      .order("priority", { ascending: false })
      .order("createdAt", { ascending: false }),
    redemptionCounts(),
  ]);

  if (error) {
    logFailure("listOffers", error.message);
    return [];
  }

  return parseList(data, (row) => {
    const offer = toOffer(row);
    if (!offer) return null;

    return {
      ...offer,
      // The list prints the counts, not the selections. Fetching four junctions
      // per row would be an N+1 for columns nothing on this screen shows.
      targets: NO_TARGETS,
      redemptionCount: counts.get(offer.id) ?? 0,
    };
  });
}

/** One offer, with its four selections, for the editor. */
export async function getOffer(id: string): Promise<OfferDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getOffer", error.message);
    return null;
  }

  const offer = toOffer(data);
  if (!offer) return null;

  const [targets, counts] = await Promise.all([
    targetsFor(offer.id),
    redemptionCounts(),
  ]);

  return { ...offer, targets, redemptionCount: counts.get(offer.id) ?? 0 };
}
