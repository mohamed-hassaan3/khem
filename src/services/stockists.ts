/**
 * Stockist directory query layer.
 *
 * Same contract as `content.ts`. Note that "published" is enforced by the RLS
 * policy on `"Stockist"`, not by a filter here: an unpublished location is
 * invisible to the publishable key whatever this file asks for.
 */

import "server-only";

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabasePublic } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import { STOCKIST_COLUMNS, toStockist } from "@/src/schemas/db/directory";
import { getBoutiqueSettings } from "@/src/services/settings";
import type { Stockist, StockistRegion } from "@/src/types/stockist";

/**
 * Canonical region order for the filter bar.
 *
 * The taxonomy sets the order; the data sets the membership. Kept in code
 * rather than in a table because the union it mirrors is a compile-time
 * contract with `dict.stockists.regions` — adding a region without translating
 * it must be a type error, and a row in a table cannot be that.
 */
const STOCKIST_REGIONS: readonly StockistRegion[] = [
  "middleEast",
  "europe",
  "americas",
  "asiaPacific",
];

function logFailure(query: string, message: string): void {
  console.error(`[stockists] ${query} failed: ${message}`);
}

/**
 * Every published location, open or announced.
 *
 * The directory lists both — an announced boutique is news worth carrying — so
 * this is what the map panel and the location list read.
 */
export async function getStockists(locale: Locale): Promise<Stockist[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Stockist")
    .select(STOCKIST_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("getStockists", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, (row) => toStockist(row, locale));
}

/**
 * Locations trading today.
 *
 * The "locations worldwide" count and the retail-partner section read this
 * rather than the full list: a boutique that has not opened is not somewhere a
 * visitor can go, and is not yet a retail partner.
 */
export async function getOpenStockists(locale: Locale): Promise<Stockist[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Stockist")
    .select(STOCKIST_COLUMNS)
    .eq("status", "open")
    .order("sortOrder");

  if (error) {
    logFailure("getOpenStockists", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, (row) => toStockist(row, locale));
}

/**
 * Regions that actually contain a stockist, in taxonomy order.
 *
 * Derived from the records rather than listed by hand, so an empty region never
 * renders a dead tab — and a region gains its tab the moment a store lands in
 * it.
 */
export async function getStockistRegions(
  locale: Locale,
): Promise<StockistRegion[]> {
  const stockists = await getStockists(locale);
  const present = new Set(stockists.map((stockist) => stockist.region));
  return STOCKIST_REGIONS.filter((region) => present.has(region));
}

/** Where wholesale and partnership enquiries reach. */
export async function getWholesaleEmail(): Promise<string> {
  return (await getBoutiqueSettings()).wholesaleEmail;
}
