import Link from "next/link";

import AdminSearch from "@/src/components/admin/AdminSearch";
import InviteCustomerForm from "@/src/components/admin/InviteCustomerForm";
import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import { egp } from "@/src/lib/admin/money";
import { searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  CUSTOMERS_PER_PAGE,
  listAdminCustomers,
} from "@/src/services/admin/customers";

/**
 * The customer directory.
 *
 * ## Why walk-ins are here
 *
 * Most of this boutique's order book is cash at the counter, and those orders
 * carry a name and an email but no account. A Customers screen driven by the
 * `"User"` table would therefore show almost nobody who has ever bought
 * anything. `customer_directory` in `supabase/sql/0024_customers.sql` unions
 * the two populations and keys them on email, so a customer who orders online
 * once and is served at the desk twice is one person with one lifetime spend.
 *
 * The **Account** column is what distinguishes them, and it is a fact worth
 * showing rather than hiding: it is the difference between somebody the house
 * can email a password reset to and somebody it can only telephone.
 *
 * ## Why searching and paging happen in the query
 *
 * Unlike the catalog lists — small, already fetched whole, filtered in memory
 * by `src/lib/admin/filter.ts` — the directory grows with every sale. That file
 * names the exit: "a `text_search` RPC — a real function with real parameters".
 * `customer_summary()` is it, which is also why a `%` typed into the box is a
 * percent sign rather than a wildcard.
 */

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

/** `?page=` is 1-based for the reader and 0-based for the query. */
function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readParam(value), 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function joinedOn(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Carries the search term across a page change, and vice versa. */
function pageHref(
  basePath: string,
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined) continue;
    params.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }

  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search.length > 0 ? `${basePath}?${search}` : basePath;
}

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const page = readPage(query.page);

  const { customers, total } = await listAdminCustomers({
    search: term,
    offset: (page - 1) * CUSTOMERS_PER_PAGE,
    limit: CUSTOMERS_PER_PAGE,
  });

  const basePath = localizePath(activeLocale, "/admin/customers");
  const lastPage = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE));
  const withAccounts = customers.filter((customer) => customer.hasAccount).length;

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everybody who has bought something, whether they registered or were served at the counter. Spend excludes cancelled and refunded orders — it is what the house actually kept."
      />

      {/*
        * Above the directory rather than below it: inviting somebody is the one
        * thing on this screen that adds a customer, and it belongs beside the
        * list it will eventually appear in.
        */}
      <InviteCustomerForm />

      <AdminSearch placeholder="Search by name, email or phone" />

      {customers.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? `Nobody matches “${term}”.`
              : "No customers yet. Record an order and the person who placed it appears here."
          }
        />
      ) : (
        <>
          <p className="mb-5 text-[11px] tracking-wide text-ivory/30">
            {total} customer{total === 1 ? "" : "s"}
            {term.length > 0 ? " matching" : ""} · {withAccounts} on this page
            {withAccounts === 1 ? " has" : " have"} an account
          </p>

          <AdminTable
            headers={[
              "Customer",
              "Contact",
              "Account",
              "Orders",
              "Lifetime spend",
              "Joined",
              { label: "Open", hidden: true },
            ]}
          >
            {customers.map((customer) => (
              <AdminRow key={customer.id}>
                <AdminCell>
                  <span className="block tracking-wide">
                    {customer.name ?? "Unnamed"}
                  </span>
                  {customer.marketingOptIn ? (
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-gold/60">
                      Subscribed
                    </span>
                  ) : null}
                </AdminCell>

                <AdminCell muted>
                  <span className="block">{customer.email ?? "—"}</span>
                  {customer.phone ? (
                    <span className="mt-1 block text-[11px] text-ivory/25">
                      {customer.phone}
                    </span>
                  ) : null}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      customer.hasAccount
                        ? "border-gold/40 text-gold"
                        : "border-border text-ivory/30"
                    }`}
                  >
                    {customer.hasAccount ? "Registered" : "Walk-in"}
                  </span>
                </AdminCell>

                <AdminCell muted>{customer.orderCount}</AdminCell>
                <AdminCell>{egp(customer.lifetimeSpendInCents)}</AdminCell>
                <AdminCell muted>{joinedOn(customer.joinedAt)}</AdminCell>

                <AdminCell>
                  <Link
                    href={`${basePath}/${encodeURIComponent(customer.id)}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                  >
                    Open
                  </Link>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          {lastPage > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(basePath, query, page - 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}

              <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/30">
                Page {page} of {lastPage}
              </span>

              {page < lastPage ? (
                <Link
                  href={pageHref(basePath, query, page + 1)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
