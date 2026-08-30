import Link from "next/link";
import { Plus } from "lucide-react";

import AdminSearch from "@/src/components/admin/AdminSearch";
import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import StockistPublishToggle from "@/src/components/admin/StockistPublishToggle";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminStockists } from "@/src/services/admin/directory";
import type { StockistRegion } from "@/src/types/stockist";

/**
 * The stockist directory, as the house edits it.
 *
 * Shows **unpublished locations too**, which the public page cannot: RLS on
 * `"Stockist"` hides them from the publishable key entirely, so an editor
 * drafting a boutique that has not been announced would otherwise be unable to
 * find their own work. See `src/services/admin/directory.ts`.
 *
 * Searching happens in memory rather than in the query — the trade
 * `src/lib/admin/filter.ts` documents. A boutique has tens of stockists, and
 * unlike the customer directory this list does not grow with every sale.
 */

export const dynamic = "force-dynamic";

const REGIONS: readonly StockistRegion[] = [
  "middleEast",
  "europe",
  "americas",
  "asiaPacific",
];

const REGION_LABELS: Record<StockistRegion, string> = {
  middleEast: "Middle East",
  europe: "Europe",
  americas: "Americas",
  asiaPacific: "Asia Pacific",
};

const TYPE_LABELS: Record<string, string> = {
  flagship: "Flagship",
  boutique: "Boutique",
  retailPartner: "Retail partner",
  departmentStore: "Department store",
};

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export default async function AdminStockistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const regionParam = readParam(query.region);
  const region = REGIONS.find((value) => value === regionParam);

  const all = await listAdminStockists();

  const stockists = all.filter((stockist) => {
    if (region && stockist.region !== region) return false;
    return matchesTerm(term, [
      stockist.name,
      stockist.name_ar,
      stockist.city,
      stockist.city_ar,
      stockist.country,
      stockist.country_ar,
      stockist.id,
    ]);
  });

  const basePath = localizePath(activeLocale, "/admin/stockists");
  const hidden = all.filter((stockist) => !stockist.isPublished).length;

  return (
    <>
      <AdminPageHeader
        title="Stockists"
        description="Every boutique and retail partner on the public directory — and the ones not announced yet, which only this screen can see."
        action={
          <AdminLinkButton href={`${basePath}/new`}>
            <Plus size={13} strokeWidth={1.25} />
            Add location
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by name, city or country" />

      <FilterChips
        basePath={basePath}
        param="region"
        active={region ?? ""}
        query={query}
        chips={[
          { value: "", label: "Every region" },
          ...REGIONS.map((value) => ({
            value,
            label: REGION_LABELS[value],
            count: all.filter((stockist) => stockist.region === value).length,
          })),
        ]}
      />

      {all.length > 0 ? (
        <p className="mb-5 text-[11px] tracking-wide text-ground-muted">
          {all.length} location{all.length === 1 ? "" : "s"}
          {hidden > 0 ? ` · ${hidden} not on the public directory` : ""}
        </p>
      ) : null}

      {stockists.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0 || region
              ? "No locations match that filter."
              : "No stockists yet. Add the flagship and it appears on /stockists within the hour."
          }
          action={
            term.length > 0 || region ? undefined : (
              <AdminLinkButton href={`${basePath}/new`}>
                Add the first location
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Location",
            "Where",
            "Type",
            "Status",
            "Public",
            "Order",
            { label: "Edit", hidden: true },
          ]}
        >
          {stockists.map((stockist) => (
            <AdminRow key={stockist.id}>
              <AdminCell>
                <span className="block tracking-wide">{stockist.name}</span>
                <span className="mt-1 block text-[10px] tracking-wide text-ground-subtle">
                  {stockist.id}
                </span>
                {stockist.name_ar === null ? (
                  <span
                    title="No Arabic name — the Arabic site falls back to the Latin one"
                    className="mt-2 inline-block border border-ground-border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted"
                  >
                    No Arabic
                  </span>
                ) : null}
              </AdminCell>

              <AdminCell muted>
                <span className="block">{stockist.city}</span>
                <span className="mt-1 block text-[11px] text-ground-subtle">
                  {stockist.country} · {REGION_LABELS[stockist.region]}
                </span>
              </AdminCell>

              <AdminCell muted>
                {TYPE_LABELS[stockist.type] ?? stockist.type}
              </AdminCell>

              <AdminCell>
                <span
                  className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                    stockist.status === "open"
                      ? "border-success/40 text-success"
                      : "border-gold/40 text-ground-accent"
                  }`}
                >
                  {stockist.status === "open" ? "Open" : "Announced"}
                </span>
              </AdminCell>

              <AdminCell>
                <StockistPublishToggle
                  id={stockist.id}
                  isPublished={stockist.isPublished}
                />
              </AdminCell>

              <AdminCell muted>{stockist.sortOrder}</AdminCell>

              <AdminCell>
                <Link
                  href={`${basePath}/${stockist.id}`}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
