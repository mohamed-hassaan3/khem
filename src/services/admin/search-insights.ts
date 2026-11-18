/**
 * `/admin/search` — what visitors look for.
 *
 * SERVER ONLY. Reads `search_events` (supabase/sql/0074_search_events.sql)
 * through the service-role client; the aggregates come from three SQL
 * functions so the page receives counts, never the raw table. Every reader
 * fails soft to an empty result, like the rest of the admin services.
 */

import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { SalesRange } from "@/src/services/admin/analytics";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** Postgres `bigint`/`numeric` arrive as strings or numbers depending on size. */
const count = z.coerce.number().int().nonnegative();
const ratio = z.coerce.number().min(0).max(1);
const locales = z.array(z.enum(["en", "ar"]));

const totalsSchema = z.object({
  searches: count,
  distinct_queries: count,
  zero_result_searches: count,
  hybrid_share: ratio,
  ar_share: ratio,
});

const topSchema = z.object({
  query: z.string(),
  searches: count,
  avg_results: z.coerce.number().nonnegative(),
  zero_result_share: ratio,
  last_searched_at: z.string(),
  locales,
});

const zeroSchema = z.object({
  query: z.string(),
  searches: count,
  last_searched_at: z.string(),
  locales,
});

const recentSchema = z.object({
  id: count,
  query: z.string(),
  locale: z.enum(["en", "ar"]),
  result_count: count,
  mode: z.enum(["hybrid", "lexical"]),
  searched_at: z.string(),
});

export interface SearchTotals {
  searches: number;
  distinctQueries: number;
  zeroResultSearches: number;
  hybridShare: number;
  arShare: number;
}

export interface TopSearch {
  query: string;
  searches: number;
  avgResults: number;
  zeroResultShare: number;
  lastSearchedAt: string;
  locales: ("en" | "ar")[];
}

export interface ZeroResultSearch {
  query: string;
  searches: number;
  lastSearchedAt: string;
  locales: ("en" | "ar")[];
}

export interface RecentSearch {
  id: number;
  query: string;
  locale: "en" | "ar";
  resultCount: number;
  mode: "hybrid" | "lexical";
  searchedAt: string;
}

const EMPTY_TOTALS: SearchTotals = {
  searches: 0,
  distinctQueries: 0,
  zeroResultSearches: 0,
  hybridShare: 0,
  arShare: 0,
};

function parseRows<S extends z.ZodTypeAny>(rows: unknown, schema: S): z.infer<S>[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function getSearchTotals(days: SalesRange): Promise<SearchTotals> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_TOTALS;

  const { data, error } = await supabase.rpc("search_totals", { days });
  if (error) {
    logFailure("getSearchTotals", error.message);
    return EMPTY_TOTALS;
  }

  const [row] = parseRows(data, totalsSchema);
  if (!row) return EMPTY_TOTALS;

  return {
    searches: row.searches,
    distinctQueries: row.distinct_queries,
    zeroResultSearches: row.zero_result_searches,
    hybridShare: row.hybrid_share,
    arShare: row.ar_share,
  };
}

export async function getTopSearches(days: SalesRange, limit = 20): Promise<TopSearch[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("search_top_queries", { days, lim: limit });
  if (error) {
    logFailure("getTopSearches", error.message);
    return [];
  }

  return parseRows(data, topSchema).map((row) => ({
    query: row.query,
    searches: row.searches,
    avgResults: row.avg_results,
    zeroResultShare: row.zero_result_share,
    lastSearchedAt: row.last_searched_at,
    locales: row.locales,
  }));
}

export async function getZeroResultSearches(
  days: SalesRange,
  limit = 20,
): Promise<ZeroResultSearch[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("search_zero_result_queries", {
    days,
    lim: limit,
  });
  if (error) {
    logFailure("getZeroResultSearches", error.message);
    return [];
  }

  return parseRows(data, zeroSchema).map((row) => ({
    query: row.query,
    searches: row.searches,
    lastSearchedAt: row.last_searched_at,
    locales: row.locales,
  }));
}

/** The latest searches, newest first, regardless of the range tabs. */
export async function getRecentSearches(limit = 50): Promise<RecentSearch[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("search_events")
    .select("id, query, locale, result_count, mode, searched_at")
    .order("searched_at", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("getRecentSearches", error.message);
    return [];
  }

  return parseRows(data, recentSchema).map((row) => ({
    id: row.id,
    query: row.query,
    locale: row.locale,
    resultCount: row.result_count,
    mode: row.mode,
    searchedAt: row.searched_at,
  }));
}
