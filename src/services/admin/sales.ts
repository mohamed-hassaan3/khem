import "server-only";

/**
 * What the boutique sold, what it gave away, and what it kept.
 *
 * ## Why the arithmetic is not here
 *
 * `./analytics.ts`'s reason, one layer deeper. Every total comes back already
 * aggregated from `sales_ledger_summary()` and `sales_ledger_by_product()`:
 * summing the ledger in TypeScript would mean fetching every line ever sold to
 * print eight numbers, and getting slower with each sale. The detail table is
 * the one read that returns rows, and it is capped.
 *
 * ## Authority and failure posture
 *
 * `getSupabaseAdmin()`, behind the admin layout's `requireAdmin()`, because
 * `supabase/sql/0062_sales_ledger.sql` grants the public roles nothing at all —
 * these rows carry the house's cost and margin as well as its revenue. There is
 * no "published" fallback and there should not be one.
 *
 * A failed read logs the provider's message and returns an empty projection
 * rather than throwing into a page, exactly as every other service here does.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  EMPTY_SALES_SUMMARY,
  SALES_LEDGER_COLUMNS,
  parseList,
  toSalesLedgerProductRow,
  toSalesLedgerRow,
  toSalesLedgerSummary,
} from "@/src/schemas/db/sales";
import type { SalesWindow } from "@/src/lib/admin/sales";
import type { OrderChannel } from "@/src/types/order";
import type {
  DiscountSource,
  SaleStatus,
  SalesLedgerProductRow,
  SalesLedgerRow,
  SalesLedgerSummary,
} from "@/src/types/sales";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/**
 * The overview tiles for one window.
 *
 * Channel is passed down rather than filtered afterwards so the tiles and the
 * product table below them are narrowed by the same predicate, in the same
 * place.
 */
export async function getSalesSummary(
  window: SalesWindow,
  channel?: OrderChannel,
): Promise<SalesLedgerSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_SALES_SUMMARY;

  const { data, error } = await supabase.rpc("sales_ledger_summary", {
    p_from: window.from,
    p_to: window.to,
    p_channel: channel ?? null,
  });

  if (error) {
    logFailure("getSalesSummary", error.message);
    return EMPTY_SALES_SUMMARY;
  }

  // A set-returning function comes back as an array of one row; a window with
  // no sales in it comes back as an array of one row of zeros, not as nothing.
  const rows = parseList(data, toSalesLedgerSummary);
  return rows[0] ?? EMPTY_SALES_SUMMARY;
}

/** Which products actually made money over the window, best first. */
export async function listProductPerformance(
  window: SalesWindow,
  channel?: OrderChannel,
  limit = 100,
): Promise<SalesLedgerProductRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("sales_ledger_by_product", {
    p_from: window.from,
    p_to: window.to,
    p_channel: channel ?? null,
    p_limit: limit,
  });

  if (error) {
    logFailure("listProductPerformance", error.message);
    return [];
  }

  return parseList(data, toSalesLedgerProductRow);
}

/** What the Items Sold screen may narrow by. All optional, and combinable. */
export interface SalesLedgerFilters {
  from?: string | null;
  to?: string | null;
  channel?: OrderChannel;
  status?: SaleStatus;
  /** A slug. The screen resolves the name; the query wants the key. */
  productSlug?: string;
  collectionSlug?: string;
  /** One of the five instruments — the row must carry a reduction from it. */
  source?: DiscountSource;
  /** `free` keeps only the lines that were given away; `paid` drops them. */
  giveaway?: "free" | "paid";
}

/**
 * The Items Sold rows, newest first.
 *
 * Every filter here is a column on `"SalesLedgerRow"`, so all of them narrow in
 * Postgres. The ledger gains a row per sold line and would otherwise be the one
 * admin screen that got slower every day — the same argument
 * `listMovements()` makes about the stock ledger.
 *
 * The free-text search is deliberately *not* a filter: it matches a product
 * name, a SKU and an order number, and those are all on this view, but building
 * an `or` across them means handing PostgREST a filter expression assembled
 * from somebody's keystrokes. `src/lib/admin/filter.ts` explains why this
 * codebase does not do that; the page filters the returned rows instead.
 *
 * Capped rather than paged, like every other list on this dashboard. When the
 * boutique outgrows the cap the answer is a range request here, not a bigger
 * number.
 */
export async function listSalesLedger(
  filters: SalesLedgerFilters = {},
  limit = 500,
): Promise<SalesLedgerRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase.from("SalesLedgerRow").select(SALES_LEDGER_COLUMNS);

  if (filters.from) query = query.gte("soldAt", filters.from);
  if (filters.to) query = query.lte("soldAt", filters.to);
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.status) query = query.eq("saleStatus", filters.status);
  if (filters.productSlug) query = query.eq("productSlug", filters.productSlug);
  if (filters.collectionSlug) {
    query = query.eq("collectionSlug", filters.collectionSlug);
  }
  // `cs` on a `text[]`, with the value bound as an array rather than
  // interpolated — the source vocabulary is a closed union validated before it
  // reaches here.
  if (filters.source) query = query.contains("discountSources", [filters.source]);
  if (filters.giveaway) query = query.eq("isFree", filters.giveaway === "free");

  const { data, error } = await query
    .order("soldAt", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("listSalesLedger", error.message);
    return [];
  }

  return parseList(data, toSalesLedgerRow);
}

/**
 * How many live products still have no cost on them.
 *
 * The one number that says whether the profit column on these screens can be
 * trusted yet. Counted here rather than derived from the ledger because it is a
 * question about the *catalogue* — a product nobody has sold yet is still one
 * whose margin will be unknown the first time somebody does.
 */
export async function countProductsMissingCost(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("Product")
    .select("slug", { count: "exact", head: true })
    .is("costInCents", null)
    .eq("isArchived", false);

  if (error) {
    logFailure("countProductsMissingCost", error.message);
    return 0;
  }

  return count ?? 0;
}
