import "server-only";

/**
 * Stockist reads for the dashboard.
 *
 * Uses {@link getSupabaseAdmin} for the reason the catalog service does rather
 * than the reason the customer one does: `supabase/sql/0003_directory.sql`
 * publishes stockists through an RLS policy gated on `isPublished`, so the
 * publishable key cannot see an unpublished row *at all*. An editor drafting a
 * location that has not been announced yet would find their own work invisible.
 *
 * These rows are not private — every published one is on `/stockists` — so the
 * secret key here buys visibility, not secrecy. The compensating control is the
 * usual one: every caller sits behind `requireAdmin()`.
 *
 * House rules unchanged: explicit column lists, rows parsed rather than
 * asserted, failures that return an empty projection and log the provider's
 * message rather than throwing into a page.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import {
  ADMIN_STOCKIST_COLUMNS,
  toAdminStockist,
} from "@/src/schemas/db/directory";
import type { AdminStockist } from "@/src/types/stockist";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/**
 * Every location, published or not, in the order the directory renders them.
 *
 * Fetched whole and filtered in memory by the page, which is the trade
 * `src/lib/admin/filter.ts` documents: a boutique has tens of stockists, not
 * thousands, and the term never touches a query. The ceiling is real but a long
 * way off — and unlike the customer directory, this list does not grow with
 * every sale.
 */
export async function listAdminStockists(): Promise<AdminStockist[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Stockist")
    .select(ADMIN_STOCKIST_COLUMNS)
    .order("sortOrder")
    .order("name");

  if (error) {
    logFailure("listAdminStockists", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toAdminStockist);
}

/** One location, by the id in the URL. */
export async function getAdminStockist(
  id: string,
): Promise<AdminStockist | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Stockist")
    .select(ADMIN_STOCKIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getAdminStockist", error.message);
    return null;
  }

  return toAdminStockist(data);
}
