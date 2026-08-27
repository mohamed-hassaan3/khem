import "server-only";

/**
 * Customer reads for the dashboard.
 *
 * Uses {@link getSupabaseAdmin} for the same reason `./orders.ts` does, one
 * notch more sharply: `supabase/sql/0024_customers.sql` grants the public roles
 * nothing on `"User"` or `"Address"`, because those rows are a person's name,
 * email, phone and home address. There is no "published customer" to fall back
 * to, and the publishable key ships in every browser.
 *
 * The compensating control is unchanged: every caller sits behind
 * `requireAdmin()`, checked in the admin layout and again in every action.
 *
 * ## Why these are RPCs and not queries
 *
 * A customer is not a table here — it is the union of the people who hold
 * accounts and the people who have simply bought something, aggregated across
 * every order they have placed. Assembling that in TypeScript means fetching
 * the whole order book to render fifty rows, which is precisely the N+1 that
 * `supabase/AGENTS.md` §23 forbids and that `src/lib/admin/filter.ts` names a
 * "real function with real parameters" as the answer to.
 *
 * House rules otherwise unchanged: rows parsed rather than asserted, failures
 * that return an empty projection and log the provider's message rather than
 * throwing into a page.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  ADDRESS_COLUMNS,
  parseList,
  toAdminCustomer,
  toAdminCustomerOrder,
  toAdminCustomerWithTotal,
  toCustomerAddress,
} from "@/src/schemas/db/customers";
import type { Credit } from "@/src/types/credit";
import type {
  AdminCustomerDetail,
  AdminCustomerPage,
  AdminCustomerSummary,
} from "@/src/types/customer";

import { creditsForClerkUser } from "./credits";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** A desk screen's worth. The RPC caps it at 200 whatever is asked for. */
export const CUSTOMERS_PER_PAGE = 50;

export interface CustomerListFilter {
  /** Matched against name, email and phone, case-insensitively. */
  search?: string;
  /** Zero-based. */
  offset?: number;
  limit?: number;
}

const EMPTY_PAGE: AdminCustomerPage = { customers: [], total: 0 };

/**
 * One page of the directory, most recent custom first.
 *
 * The search term is passed as a *parameter*, never spliced into a filter
 * string: `customer_summary()` compares with `position()` rather than `ilike`,
 * so a `%` in somebody's search is a percent sign and not a wildcard.
 */
export async function listAdminCustomers(
  filter: CustomerListFilter = {},
): Promise<AdminCustomerPage> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_PAGE;

  const { data, error } = await supabase.rpc("customer_summary", {
    search_term: filter.search ?? "",
    limit_count: filter.limit ?? CUSTOMERS_PER_PAGE,
    offset_count: filter.offset ?? 0,
  });

  if (error) {
    logFailure("listAdminCustomers", error.message);
    return EMPTY_PAGE;
  }

  const rows = parseList(
    Array.isArray(data) ? data : [],
    toAdminCustomerWithTotal,
  );

  return {
    customers: rows.map((row) => row.customer),
    // Every row carries the same window count; an empty page has none, and
    // zero is then the honest answer.
    total: rows[0]?.total ?? 0,
  };
}

/** The directory row for one customer, by the id the list linked to. */
async function getCustomerRow(id: string): Promise<AdminCustomerSummary | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("customer_profile", {
    customer_id: id,
  });

  if (error) {
    logFailure("getCustomerRow", error.message);
    return null;
  }

  // `customer_profile` returns no window count — it is one row by definition —
  // so this parses with the plain schema rather than the paged one.
  const [row] = parseList(Array.isArray(data) ? data : [], toAdminCustomer);

  return row ?? null;
}

/**
 * Everything one customer's screen shows.
 *
 * Three round trips rather than one, and deliberately so: the addresses only
 * exist for somebody who has an account, so that query is skipped entirely for
 * the walk-in trade rather than being joined and discarded.
 */
export async function getAdminCustomer(
  id: string,
): Promise<AdminCustomerDetail | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const customer = await getCustomerRow(id);
  if (!customer) return null;

  const [orders, addresses, credits] = await Promise.all([
    (async () => {
      const { data, error } = await supabase.rpc("customer_orders", {
        customer_id: id,
      });

      if (error) {
        logFailure("getAdminCustomer.orders", error.message);
        return [];
      }

      return parseList(Array.isArray(data) ? data : [], toAdminCustomerOrder);
    })(),

    (async () => {
      // `id` is the `"User"` row id exactly when there is an account; for
      // everyone else there is no address book to read.
      if (!customer.hasAccount) return [];

      const { data, error } = await supabase
        .from("Address")
        .select(ADDRESS_COLUMNS)
        .eq("userId", id)
        .order("isDefault", { ascending: false });

      if (error) {
        logFailure("getAdminCustomer.addresses", error.message);
        return [];
      }

      return parseList(data, toCustomerAddress);
    })(),

    (async (): Promise<readonly Credit[]> => {
      // A credit belongs to a Clerk account, so the walk-in trade has none —
      // and asking would be a query guaranteed to return nothing.
      if (!customer.clerkId) return [];
      return creditsForClerkUser(customer.clerkId);
    })(),
  ]);

  return { ...customer, orders, addresses, credits };
}

/**
 * How many customers the boutique has.
 *
 * A count of the directory rather than of `"User"`, so it agrees with the
 * screen it links to — most of these people have never registered.
 */
export async function countCustomers(): Promise<number> {
  const { total } = await listAdminCustomers({ limit: 1 });
  return total;
}
