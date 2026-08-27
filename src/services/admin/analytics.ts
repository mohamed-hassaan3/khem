import "server-only";

/**
 * What the boutique sold, and what is left on the shelf.
 *
 * ## Why the arithmetic is not here
 *
 * Every figure on the dashboard comes back already aggregated, from the views
 * and functions in `supabase/sql/0015_orders.sql`. Summing orders in
 * TypeScript would mean fetching every line of every order to print four
 * numbers, and getting slower with each sale — the same arithmetic, performed
 * further from the data, over a payload nobody renders.
 *
 * The one thing TypeScript does do is **gap-filling**. Postgres returns the
 * days that had sales; a chart needs every day in the window, because a
 * quiet Tuesday is a zero and drawing a straight line from Monday to Wednesday
 * invents a trend that did not happen.
 *
 * Same authority and same failure posture as `./orders.ts`: the secret key,
 * behind `requireAdmin()`, returning an empty projection rather than throwing.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  parseList,
  toChannelSplitRow,
  toProductSalesRow,
  toSalesPoint,
} from "@/src/schemas/db/orders";
import { listAdminProducts } from "@/src/services/admin/catalog";
import { stockState } from "@/src/lib/inventory";
import type {
  ChannelSplitRow,
  InventoryRow,
  ProductSalesRow,
  SalesPoint,
  SalesTotals,
} from "@/src/types/order";

import { countOpenOrders, countUnopenedOrders } from "./orders";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** The windows the range switch offers. Anything else is not a valid URL. */
export const SALES_RANGES = [7, 30, 90] as const;
export type SalesRange = (typeof SALES_RANGES)[number];

export const DEFAULT_RANGE: SalesRange = 30;

/** Read `?range=` without trusting it — an unknown value is the default. */
export function parseRange(value: string | string[] | undefined): SalesRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  return (SALES_RANGES as readonly number[]).includes(days)
    ? (days as SalesRange)
    : DEFAULT_RANGE;
}

/** `YYYY-MM-DD` in UTC — the form `daily_sales()` returns and the chart reads. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Every day in the window, in ascending order, zeros included.
 *
 * lightweight-charts requires ascending, unique, gapless-enough time values;
 * feeding it the sparse rows Postgres returns produces a chart that reads as a
 * smooth climb across a week with no sales in it.
 */
function fillDays(rows: readonly SalesPoint[], days: number): SalesPoint[] {
  const bySlot = new Map(rows.map((row) => [row.day, row]));
  const filled: SalesPoint[] = [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const day = isoDay(date);

    filled.push(
      bySlot.get(day) ?? { day, orderCount: 0, units: 0, revenueInCents: 0 },
    );
  }

  return filled;
}

/** The daily series behind both charts, gap-filled. */
export async function getSalesSeries(days: SalesRange): Promise<SalesPoint[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return fillDays([], days);

  const { data, error } = await supabase.rpc("daily_sales", { days });

  if (error) {
    logFailure("getSalesSeries", error.message);
    return fillDays([], days);
  }

  return fillDays(parseList(data, toSalesPoint), days);
}

/**
 * The headline tiles.
 *
 * Derived from the same series the chart draws, so a tile and the curve beside
 * it can never disagree — the alternative is a second query with a second
 * definition of "the last 30 days". `awaitingFulfilment` and `unopened` are the
 * exceptions: both are states rather than windows, and count every order in
 * them however old it is. An order forgotten three weeks ago is precisely the
 * one a thirty-day window would stop mentioning.
 */
export async function getSalesTotals(days: SalesRange): Promise<SalesTotals> {
  const [series, awaitingFulfilment, unopened] = await Promise.all([
    getSalesSeries(days),
    countOpenOrders(),
    countUnopenedOrders(),
  ]);

  return {
    revenueInCents: series.reduce((sum, point) => sum + point.revenueInCents, 0),
    orderCount: series.reduce((sum, point) => sum + point.orderCount, 0),
    units: series.reduce((sum, point) => sum + point.units, 0),
    awaitingFulfilment,
    unopened,
  };
}

/** What sold most in the window, by revenue. */
export async function getTopProducts(
  days: SalesRange,
  limit = 8,
): Promise<ProductSalesRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("product_sales", {
    days,
    row_limit: limit,
  });

  if (error) {
    logFailure("getTopProducts", error.message);
    return [];
  }

  return parseList(data, toProductSalesRow);
}

/** Online versus offline for the window. */
export async function getChannelSplit(days: SalesRange): Promise<ChannelSplitRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("channel_split", { days });

  if (error) {
    logFailure("getChannelSplit", error.message);
    return [];
  }

  return parseList(data, toChannelSplitRow);
}

/**
 * The inventory screen's rows.
 *
 * Two reads joined in memory rather than one query: the catalog list already
 * exists and is already parsed, and `product_sales()` returns at most a few
 * dozen rows. A PostgREST embed would have to reach across `OrderItem` to
 * `Order` to apply the date filter, which is exactly the kind of nested filter
 * string this codebase avoids building by hand.
 *
 * Ordering is the point of the screen: what is out, then what is nearly out,
 * then everything else. An editor opens this to find the problem, not to
 * browse the catalog alphabetically.
 */
export async function listInventoryRows(days: SalesRange): Promise<InventoryRow[]> {
  const [products, sales] = await Promise.all([
    listAdminProducts(),
    getTopProducts(days, 500),
  ]);

  const soldBySlug = new Map(sales.map((row) => [row.productSlug, row.units]));

  const rows: InventoryRow[] = products
    .filter((product) => !product.isArchived)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      collectionSlug: product.collectionSlug,
      priceInCents: product.priceInCents,
      inventory: product.inventory,
      isArchived: product.isArchived,
      unitsSoldRecently: soldBySlug.get(product.slug) ?? 0,
    }));

  const rank = { out: 0, low: 1, in: 2 } as const;

  return rows.sort((a, b) => {
    const byState = rank[stockState(a.inventory)] - rank[stockState(b.inventory)];
    if (byState !== 0) return byState;
    return a.name.localeCompare(b.name);
  });
}
