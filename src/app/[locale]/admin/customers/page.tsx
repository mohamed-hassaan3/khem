import { Download, UserPlus } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";
import FilterChips from "@/src/components/admin/FilterChips";

import AdminSearch from "@/src/components/admin/AdminSearch";
import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
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
  listAllAdminCustomers,
} from "@/src/services/admin/customers";
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";
import { requireAdmin } from "@/src/lib/admin/auth";

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

/** How many rows an account-filtered view reads before paging them itself. */
const FILTER_WINDOW = 2000;

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
    timeZone: SHOP_TIME_ZONE,
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
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const page = readPage(query.page);
  const accountParam = readParam(query.account);
  const account = accountParam === "registered" || accountParam === "walkin" ? accountParam : null;

  /*
   * `customer_summary` pages and searches but cannot filter by account, and
   * changing it is a migration. With an account filter the page reads up to
   * FILTER_WINDOW rows and pages them here instead — exact while the house has
   * fewer customers than that, which it does by a wide margin.
   */
  const source = account
    ? { customers: await listAllAdminCustomers(term, FILTER_WINDOW), total: 0 }
    : await listAdminCustomers({
        search: term,
        offset: (page - 1) * CUSTOMERS_PER_PAGE,
        limit: CUSTOMERS_PER_PAGE,
      });
  const matching = account
    ? source.customers.filter((customer) =>
        account === "registered" ? customer.hasAccount : !customer.hasAccount,
      )
    : source.customers;
  const customers = account
    ? matching.slice((page - 1) * CUSTOMERS_PER_PAGE, page * CUSTOMERS_PER_PAGE)
    : matching;
  const total = account ? matching.length : source.total;

  const basePath = localizePath(activeLocale, "/admin/customers");
  const invitePath = localizePath(activeLocale, "/admin/customers/invitations");
  const lastPage = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE));

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everyone with an account, and everyone who bought in store or as a guest. Spend leaves out cancelled and refunded orders."
        action={
          <div className="flex flex-wrap gap-2">
            {/* A plain link: the CSV is a download, not a page. */}
            <a
              href={`${basePath}/export`}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-ground-border px-4 text-[13px] text-ground no-underline transition-colors duration-300 hover:border-gold/40"
            >
              <Download size={14} strokeWidth={1.5} aria-hidden="true" />
              Download CSV
            </a>
            <AdminLinkButton href={invitePath}>
              <UserPlus size={14} strokeWidth={1.5} />
              Invite someone
            </AdminLinkButton>
          </div>
        }
      />

      <AdminSearch placeholder="Name, email or phone" label="Search customers by name, email or phone" />

      <FilterChips
        basePath={basePath}
        param="account"
        active={account ?? ""}
        query={query}
        chips={[
          { value: "", label: "Everyone" },
          { value: "registered", label: "Registered" },
          { value: "walkin", label: "Walk-in" },
        ]}
      />

      {customers.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0 || account
              ? "Nobody matches."
              : "No customers yet. Record an order or invite someone and they appear here."
          }
        />
      ) : (
        <>
          <p className="mb-2.5 text-[12px] text-ground-muted">
            {total} {total === 1 ? "customer" : "customers"}
            {term.length > 0 || account ? " matching" : ""}
          </p>

          <AdminTable
            headers={[
              "Customer",
              "Email",
              "Account",
              "Orders",
              "Lifetime spend",
              "Joined",
              { label: "Actions", hidden: true },
            ]}
          >
            {customers.map((customer) => (
              <AdminRow key={customer.id}>
                <AdminCell>
                  <span className="block">
                    <bdi>{customer.name ?? "Unnamed"}</bdi>
                  </span>
                  {customer.phone ? (
                    <span dir="ltr" className="mt-0.5 block text-[12px] text-ground-muted">
                      {customer.phone}
                    </span>
                  ) : null}
                  {customer.marketingOptIn ? (
                    <span className="mt-1 inline-flex h-5 items-center rounded-full border border-gold/40 px-2 text-[10px] text-ground-accent">
                      Subscribed
                    </span>
                  ) : null}
                </AdminCell>

                <AdminCell>
                  {customer.email ? (
                    <span dir="ltr" className="break-all">{customer.email}</span>
                  ) : (
                    <span className="text-ground-muted">No email</span>
                  )}
                </AdminCell>

                <AdminCell>
                  <span
                    className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${
                      customer.hasAccount
                        ? "border-gold/50 text-ground-accent"
                        : "border-ground-border text-ground-muted"
                    }`}
                  >
                    {customer.hasAccount ? "Registered" : "Walk-in"}
                  </span>
                </AdminCell>

                <AdminCell muted>{customer.orderCount}</AdminCell>
                <AdminCell>{egp(customer.lifetimeSpendInCents)}</AdminCell>
                <AdminCell muted>{joinedOn(customer.joinedAt)}</AdminCell>

                <AdminCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <AdminLink
                      href={`${basePath}/${encodeURIComponent(customer.id)}`}
                      className="inline-flex h-9 items-center rounded-lg border border-ground-border px-3 text-[12px] text-ground no-underline hover:border-gold/40"
                    >
                      Open
                    </AdminLink>
                    {!customer.hasAccount && customer.email ? (
                      <AdminLink
                        href={`${invitePath}?email=${encodeURIComponent(customer.email)}`}
                        className="inline-flex h-9 items-center rounded-lg border border-ground-border px-3 text-[12px] text-ground-accent no-underline hover:border-gold/40"
                      >
                        Invite
                      </AdminLink>
                    ) : null}
                  </span>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>

          {lastPage > 1 ? (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
              {page > 1 ? (
                <AdminLink
                  href={pageHref(basePath, query, page - 1)}
                  className="inline-flex h-10 items-center rounded-lg border border-ground-border px-4 text-[13px] text-ground no-underline hover:border-gold/40"
                >
                  Previous
                </AdminLink>
              ) : (
                <span />
              )}
              <span className="text-[12px] text-ground-muted">
                Page {page} of {lastPage}
              </span>
              {page < lastPage ? (
                <AdminLink
                  href={pageHref(basePath, query, page + 1)}
                  className="inline-flex h-10 items-center rounded-lg border border-ground-border px-4 text-[13px] text-ground no-underline hover:border-gold/40"
                >
                  Next
                </AdminLink>
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
