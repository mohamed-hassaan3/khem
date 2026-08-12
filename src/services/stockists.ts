/**
 * Stockist directory query layer.
 *
 * Same contract as `contact.ts`: the UI awaits these functions, so swapping the
 * source (a Supabase `Stockist` table or CMS globals) is a change of function
 * bodies only.
 */

// NOTE: add `import "server-only"` here once that package is installed.

import {
  STOCKISTS,
  STOCKIST_REGIONS,
  WHOLESALE_EMAIL,
} from "@/src/data/stockists";
import type { Stockist, StockistRegion } from "@/src/types/stockist";

/**
 * Every published location, open or announced.
 *
 * The directory lists both — an announced boutique is news worth carrying — so
 * this is what the map panel and the location list read.
 *
 * → supabase.from('Stockist').select('*').eq('isPublished', true).order('sortOrder')
 */
export async function getStockists(): Promise<Stockist[]> {
  return STOCKISTS;
}

/**
 * Locations trading today.
 *
 * The "locations worldwide" count and the retail-partner section read this
 * rather than the full list: a boutique that has not opened is not somewhere a
 * visitor can go, and is not yet a retail partner.
 *
 * → supabase.from('Stockist').select('*').eq('status', 'open').order('sortOrder')
 */
export async function getOpenStockists(): Promise<Stockist[]> {
  return STOCKISTS.filter((stockist) => stockist.status === "open");
}

/**
 * Regions that actually contain a stockist, in taxonomy order.
 *
 * Derived from the records rather than listed by hand, so an empty region
 * never renders a dead tab — and a region gains its tab the moment a store
 * lands in it.
 *
 * → supabase.rpc('distinct_stockist_regions')
 */
export async function getStockistRegions(): Promise<StockistRegion[]> {
  const present = new Set(STOCKISTS.map((stockist) => stockist.region));
  return STOCKIST_REGIONS.filter((region) => present.has(region));
}

/** → supabase.from('BoutiqueSetting').select('wholesaleEmail').single() */
export async function getWholesaleEmail(): Promise<string> {
  return WHOLESALE_EMAIL;
}
