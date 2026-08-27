import "server-only";

/**
 * Discount reads for the dashboard.
 *
 * Secret key, behind `requireAdmin()`, same failure posture as its neighbours:
 * log the provider's message and return an empty projection rather than
 * throwing into a page.
 *
 * ## The usage figures are counted, never stored
 *
 * `discounts` has no `timesUsed` column. Both caps and every figure §12 asks
 * for — uses, remaining, what was given away, what the orders were worth — come
 * from `discount_redemptions`, for the reason `0026` gives: a counter beside a
 * list of uses is a second record of one fact.
 *
 * Released redemptions (a refunded order) are excluded from the counts and from
 * revenue, because they returned their use to both caps.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  DISCOUNT_COLUMNS,
  DISCOUNT_GRANT_COLUMNS,
  DISCOUNT_REDEMPTION_COLUMNS,
  parseList,
  redemptionOrderTotal,
  toDiscount,
  toDiscountGrant,
  toDiscountRedemption,
} from "@/src/schemas/db/discounts";
import type {
  DiscountDetail,
  DiscountRestrictions,
  DiscountWithUsage,
} from "@/src/types/discount";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

interface UsageRow {
  discountId: string;
  amountInCents: number;
  orderTotalInCents: number;
}

/** One pass over the ledger, keyed by discount. */
async function usageByDiscount(): Promise<Map<string, UsageRow[]>> {
  const supabase = getSupabaseAdmin();
  const map = new Map<string, UsageRow[]>();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("discount_redemptions")
    .select(`discountId, ${DISCOUNT_REDEMPTION_COLUMNS}`)
    .is("releasedAt", null);

  if (error) {
    logFailure("usageByDiscount", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const parsed = toDiscountRedemption(row);
    const id = (row as { discountId?: unknown }).discountId;
    if (!parsed || typeof id !== "string") continue;

    const entry: UsageRow = {
      discountId: id,
      amountInCents: parsed.amountInCents,
      orderTotalInCents: redemptionOrderTotal(row),
    };

    map.set(id, [...(map.get(id) ?? []), entry]);
  }

  return map;
}

function summarise(
  discount: ReturnType<typeof toDiscount>,
  uses: readonly UsageRow[],
): DiscountWithUsage | null {
  if (!discount) return null;

  const timesUsed = uses.length;

  return {
    ...discount,
    timesUsed,
    remainingUses:
      discount.totalUseLimit === null
        ? null
        : Math.max(0, discount.totalUseLimit - timesUsed),
    discountedInCents: uses.reduce((sum, use) => sum + use.amountInCents, 0),
    revenueInCents: uses.reduce((sum, use) => sum + use.orderTotalInCents, 0),
  };
}

/** Every code, newest first, with its figures. */
export async function listDiscounts(): Promise<DiscountWithUsage[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data, error }, usage] = await Promise.all([
    supabase
      .from("discounts")
      .select(DISCOUNT_COLUMNS)
      .order("createdAt", { ascending: false }),
    usageByDiscount(),
  ]);

  if (error) {
    logFailure("listDiscounts", error.message);
    return [];
  }

  return parseList(data, (row) => {
    const discount = toDiscount(row);
    return summarise(discount, discount ? (usage.get(discount.id) ?? []) : []);
  });
}

/** One code, with its restrictions, its grants and its full usage trail. */
export async function getDiscount(code: string): Promise<DiscountDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("discounts")
    .select(DISCOUNT_COLUMNS)
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    logFailure("getDiscount", error.message);
    return null;
  }

  const discount = toDiscount(data);
  if (!discount) return null;

  const [products, collections, grants, redemptions] = await Promise.all([
    supabase
      .from("discount_products")
      .select("productSlug")
      .eq("discountId", discount.id),
    supabase
      .from("discount_collections")
      .select("collectionSlug")
      .eq("discountId", discount.id),
    supabase
      .from("discount_grants")
      .select(DISCOUNT_GRANT_COLUMNS)
      .eq("discountId", discount.id)
      .order("issuedAt", { ascending: false })
      .limit(200),
    supabase
      .from("discount_redemptions")
      .select(DISCOUNT_REDEMPTION_COLUMNS)
      .eq("discountId", discount.id)
      .order("redeemedAt", { ascending: false })
      .limit(200),
  ]);

  const restrictions: DiscountRestrictions = {
    productSlugs: (products.data ?? [])
      .map((row) => (typeof row.productSlug === "string" ? row.productSlug : ""))
      .filter((slug) => slug.length > 0),
    collectionSlugs: (collections.data ?? [])
      .map((row) =>
        typeof row.collectionSlug === "string" ? row.collectionSlug : "",
      )
      .filter((slug) => slug.length > 0),
  };

  const live = (redemptions.data ?? []).filter(
    (row) => (row as { releasedAt?: unknown }).releasedAt === null,
  );

  const summarised = summarise(
    discount,
    live.map((row) => ({
      discountId: discount.id,
      amountInCents: toDiscountRedemption(row)?.amountInCents ?? 0,
      orderTotalInCents: redemptionOrderTotal(row),
    })),
  );

  if (!summarised) return null;

  return {
    ...summarised,
    restrictions,
    grants: parseList(grants.data, toDiscountGrant),
    redemptions: parseList(redemptions.data, toDiscountRedemption),
  };
}
