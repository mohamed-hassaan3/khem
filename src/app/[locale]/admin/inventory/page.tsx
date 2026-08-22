import Link from "next/link";

import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import FilterChips from "@/src/components/admin/FilterChips";
import InventoryEditor from "@/src/components/admin/InventoryEditor";
import StockChip from "@/src/components/admin/StockChip";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { egp } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { LOW_STOCK_THRESHOLD, stockState } from "@/src/lib/inventory";
import { listInventoryRows, parseRange } from "@/src/services/admin/analytics";

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
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const range = parseRange(query.range);
  const term = searchTerm(query);
  const state = readParam(query.state);

  const all = await listInventoryRows(range);

  const rows = all
    .filter((row) =>
      state === "low"
        ? stockState(row.inventory) === "low"
        : state === "out"
          ? stockState(row.inventory) === "out"
          : true,
    )
    .filter((row) => matchesTerm(term, [row.name, row.slug, row.sku, row.collectionSlug]));

  const counts = {
    low: all.filter((row) => stockState(row.inventory) === "low").length,
    out: all.filter((row) => stockState(row.inventory) === "out").length,
  };

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description={`One stock figure per product, and it is the website's. Below ${LOW_STOCK_THRESHOLD} the storefront stops saying “in stock” and names the number instead; at zero it says sold out and the add-to-cart is refused.`}
      />

      <FilterChips
        basePath={localizePath(activeLocale, "/admin/inventory")}
        param="state"
        active={state}
        query={query}
        chips={[
          { value: "", label: "All", count: all.length },
          { value: "out", label: "Out of stock", count: counts.out },
          { value: "low", label: "Low", count: counts.low },
        ]}
      />

      <AdminSearch placeholder="Search by name, slug, SKU or collection" />

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
        <AdminTable
          headers={[
            "Product",
            "SKU",
            "Price",
            `Sold (${range}d)`,
            "State",
            { label: "Set stock", hidden: true },
          ]}
        >
          {rows.map((row) => (
            <AdminRow key={row.slug}>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, `/admin/products/${row.slug}`)}
                  className="block transition-colors duration-300 hover:text-gold"
                >
                  {row.name}
                </Link>
                <span className="mt-1 block text-[10px] tracking-wide text-ivory/25">
                  {row.collectionSlug}
                </span>
              </AdminCell>
              <AdminCell muted>{row.sku}</AdminCell>
              <AdminCell muted>{egp(row.priceInCents)}</AdminCell>
              <AdminCell muted>{row.unitsSoldRecently}</AdminCell>
              <AdminCell>
                <StockChip inventory={row.inventory} />
              </AdminCell>
              <AdminCell>
                <InventoryEditor slug={row.slug} inventory={row.inventory} />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
