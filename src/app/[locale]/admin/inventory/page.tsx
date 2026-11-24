import { ChevronDown } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";

import { AdminEmpty, AdminPageHeader } from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import FilterChips from "@/src/components/admin/FilterChips";
import InventoryEditor from "@/src/components/admin/InventoryEditor";
import StockChip from "@/src/components/admin/StockChip";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { LOW_STOCK_THRESHOLD, stockState } from "@/src/lib/inventory";
import { listInventoryRows, parseRange } from "@/src/services/admin/analytics";
import { requireAdmin } from "@/src/lib/admin/auth";

/**
 * What is on the shelf.
 *
 * One number per product, and it is the website's — there is no second stock
 * anywhere. An order recorded at the desk draws from this same column, which
 * is why a walk-in sale can put a product into the low-stock state the
 * storefront then warns visitors about.
 *
 * Ordering is the whole point: out of stock, then low, then everything else.
 * An editor opens this screen to find the problem, not to browse the catalog.
 */

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export default async function AdminInventoryPage({
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

  const range = parseRange(query.range);
  const term = searchTerm(query);
  const state = readParam(query.state);

  const all = await listInventoryRows(range);

  const rows = all
    .filter((row) =>
      state === "low"
        ? stockState(row.inventoryOnline) === "low"
        : state === "out"
          ? stockState(row.inventoryOnline) === "out"
          : true,
    )
    .filter((row) => matchesTerm(term, [row.name, row.slug, row.sku, row.collectionSlug]));

  const counts = {
    low: all.filter((row) => stockState(row.inventoryOnline) === "low").length,
    out: all.filter((row) => stockState(row.inventoryOnline) === "out").length,
  };

  const hrefFor = (path: string) => localizePath(activeLocale, path);

  return (
    <>
      <AdminPageHeader
        title="Stock"
        description={`Two counts per product. The website sells from Online: below ${LOW_STOCK_THRESHOLD} it shows the number left, at zero it says sold out. In store moves only when a sale, delivery or transfer is recorded. Every change is kept in the history.`}
      />

      <AdminSearch
        placeholder="Name, SKU or collection"
        label="Search stock by product name, slug, SKU or collection"
      />

      <FilterChips
        basePath={hrefFor("/admin/inventory")}
        param="state"
        active={state}
        query={query}
        chips={[
          { value: "", label: "All", count: all.length },
          { value: "out", label: "Sold out", count: counts.out },
          { value: "low", label: "Running low", count: counts.low },
        ]}
      />

      {rows.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? `Nothing matches “${term}”.`
              : state.length > 0
                ? "Nothing is in that state — which is the good outcome."
                : "No products yet."
          }
        />
      ) : (
        /*
         * One row per product, with the add / correct controls folded into a
         * native <details>: the table put every editor on screen at once,
         * which made this page 12,000px tall on a phone. Open only the product
         * you are counting. (prompts/admin-redesign-stage-6.md, 6b)
         */
        <ul data-admin-results="" className="overflow-hidden rounded-lg border border-ground-border bg-stone">
          {rows.map((row) => (
            <li key={row.slug} className="border-b border-ground-border last:border-b-0">
              <details className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-ground-bg/60 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ground">{row.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-ground-muted">
                      {row.collectionSlug} · <span dir="ltr">{row.sku}</span> · {egp(row.priceInCents)} ·{" "}
                      {row.unitsSoldRecently} sold in {range}d
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StockChip inventory={row.inventoryOnline} />
                    <span className="text-[11px] text-ground-muted">In store {row.inventoryOffline}</span>
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0 text-ground-subtle transition-transform duration-300 group-open:rotate-180"
                  />
                </summary>

                <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-ground-border bg-ground-bg/60 px-4 py-4">
                  <InventoryEditor
                    slug={row.slug}
                    inventoryOnline={row.inventoryOnline}
                    inventoryOffline={row.inventoryOffline}
                  />
                  <span className="flex flex-col gap-2 text-[13px]">
                    <AdminLink href={hrefFor(`/admin/inventory/${row.slug}`)} className="text-ground-accent no-underline hover:text-ground">
                      Stock history
                    </AdminLink>
                    <AdminLink href={hrefFor(`/admin/products/${row.slug}`)} className="text-ground-accent no-underline hover:text-ground">
                      Edit product
                    </AdminLink>
                  </span>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
