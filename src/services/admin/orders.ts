import "server-only";

/**
 * Order reads for the dashboard.
 *
 * Uses {@link getSupabaseAdmin} for a reason the catalog service only half
 * shares. There, the secret key is needed because the public policies hide the
 * archived rows an editor came to fix. Here it is needed because
 * `supabase/sql/0015_orders.sql` grants the public roles nothing at all: an
 * order carries a customer's name, email and phone, and the publishable key —
 * which ships in every browser — must not be able to read one. There is no
 * "published order" to fall back to.
 *
 * The compensating control is the same: every caller sits behind
 * `requireAdmin()`, checked in the admin layout and again in every action.
 *
 * House rules unchanged: explicit column lists, rows parsed rather than
 * asserted, failures that return an empty projection and log the provider's
 * message rather than throwing into a page.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  ORDER_DETAIL_COLUMNS,
  ORDER_SUMMARY_COLUMNS,
  parseList,
  toAdminOrderDetail,
  toAdminOrderSummary,
} from "@/src/schemas/db/orders";
import type { OrderStatus } from "@/src/types/account";
import type { AdminOrderDetail, AdminOrderSummary, OrderChannel } from "@/src/types/order";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/**
 * Statuses the desk still owes something on.
 *
 * One member since 0051 retired `PENDING`, and still a list rather than a
 * scalar: `SHIPPED` is a plausible future member, and the two call sites both
 * use `.in()`.
 */
export const OPEN_STATUSES: readonly OrderStatus[] = ["PROCESSING"];

/**
 * Whether the desk has opened the order yet.
 *
 * Not a status and not stored as one — see
 * `supabase/sql/0023_order_opened.sql` for why the two are kept apart.
 */
export type OrderSeenFilter = "new" | "opened";

export interface OrderListFilter {
  status?: OrderStatus;
  channel?: OrderChannel;
  seen?: OrderSeenFilter;
  /** Newest first, capped. A desk screen is not a data export. */
  limit?: number;
}

/**
 * Orders, newest first.
 *
 * The limit is a real one rather than a page size: nothing on this screen
 * paginates yet, and fetching the whole table to render fifty rows is the
 * mistake `src/lib/admin/filter.ts` documents the ceiling of. When the boutique
 * outgrows it, the answer is a range request here — not a bigger number.
 */
export async function listAdminOrders(
  filter: OrderListFilter = {},
): Promise<AdminOrderSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase
    .from("Order")
    .select(ORDER_SUMMARY_COLUMNS)
    .order("placedAt", { ascending: false })
    .limit(filter.limit ?? 200);

  // `.eq` binds its value; this is not the string-built filter syntax
  // `src/lib/admin/filter.ts` refuses, and both values are enum members
  // validated before they arrive here.
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.channel) query = query.eq("channel", filter.channel);

  // Null-ness, so `.is` / `.not(..., "is", null)` rather than a comparison —
  // `= null` is never true in SQL and would silently return nothing.
  if (filter.seen === "new") query = query.is("firstOpenedAt", null);
  if (filter.seen === "opened") query = query.not("firstOpenedAt", "is", null);

  const { data, error } = await query;

  if (error) {
    logFailure("listAdminOrders", error.message);
    return [];
  }

  return parseList(data, toAdminOrderSummary);
}

/** One order, by its human-facing number — the value that is in the URL. */
export async function getAdminOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Order")
    .select(ORDER_DETAIL_COLUMNS)
    .eq("orderNumber", orderNumber)
    .maybeSingle();

  if (error) {
    logFailure("getAdminOrder", error.message);
    return null;
  }

  return toAdminOrderDetail(data);
}

/**
 * The same order, by its opaque id.
 *
 * The status controls hold an id rather than a number because the id is what
 * every function in `0015_orders.sql` takes, and passing the display string to
 * an endpoint that then has to resolve it is one more place for the two to
 * disagree.
 */
export async function getAdminOrderById(id: string): Promise<AdminOrderDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Order")
    .select(ORDER_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getAdminOrderById", error.message);
    return null;
  }

  return toAdminOrderDetail(data);
}

/**
 * How many orders are still open.
 *
 * A `head: true` count rather than a list: the dashboard tile prints a number
 * and never the rows behind it.
 */
export async function countOpenOrders(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("Order")
    .select("id", { count: "exact", head: true })
    .in("status", OPEN_STATUSES as string[]);

  if (error) {
    logFailure("countOpenOrders", error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * How many orders nobody at the desk has opened yet.
 *
 * The count the dashboard tile and the order book's "New" chip both print, so
 * the two cannot disagree. Backed by the partial index in
 * `supabase/sql/0023_order_opened.sql`, which carries only these rows.
 *
 * Fails the way every read in this module fails: log the provider's message,
 * return a figure the screen can render. Zero under-reports rather than
 * blanking the desk, and the rows themselves still show their own markers.
 */
export async function countUnopenedOrders(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("Order")
    .select("id", { count: "exact", head: true })
    .is("firstOpenedAt", null);

  if (error) {
    logFailure("countUnopenedOrders", error.message);
    return 0;
  }

  return count ?? 0;
}
