import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import RangeTabs from "@/src/components/admin/charts/RangeTabs";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { RESULTS_LIMIT } from "@/src/lib/search/config";
import { parseRange } from "@/src/services/admin/analytics";
import {
  getRecentSearches,
  getSearchTotals,
  getTopSearches,
  getZeroResultSearches,
} from "@/src/services/admin/search-insights";
import { SHOP_TIME_ZONE, SHOP_ZONE_LABEL } from "@/src/lib/shop-time";

/**
 * What visitors look for.
 *
 * Read from `search_events` (supabase/sql/0074_search_events.sql): one
 * anonymous row per committed search on `/search`. Built on the same shell,
 * range tabs and table primitives as `/admin/analytics`, so it reads as part
 * of the same suite. The admin layout's guard already answers 404 to anyone
 * who is not an administrator.
 */

export const dynamic = "force-dynamic";

function stamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso)) + ` ${SHOP_ZONE_LABEL}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function resultsLabel(count: number): string {
  return count >= RESULTS_LIMIT ? `${RESULTS_LIMIT}+` : String(count);
}

function Badge({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-heading text-[8px] uppercase tracking-[0.2em] ${
        accent ? "border-gold/40 text-ground-accent" : "border-ground-border text-ground-muted"
      }`}
    >
      {children}
    </span>
  );
}

function LocaleBadges({ locales }: { locales: readonly ("en" | "ar")[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {locales.map((locale) => (
        <Badge key={locale}>{locale.toUpperCase()}</Badge>
      ))}
    </span>
  );
}

/** Visitor-typed text of either script. `dir="auto"` lets Arabic read RTL. */
function QueryText({ children }: { children: string }) {
  return (
    <span dir="auto" className="font-medium text-ground">
      {children}
    </span>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="border border-ground-border bg-ivory/2 p-6">
      <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {label}
      </p>
      <p className="mt-3 font-heading text-2xl tracking-[0.1em] text-ground-accent">{value}</p>
      {caption ? (
        <p className="mt-2 text-[11px] tracking-wide text-ground-muted">{caption}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-6 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
      {children}
    </h2>
  );
}

export default async function AdminSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";
  const range = parseRange(query.range);

  const [totals, top, zero, recent] = await Promise.all([
    getSearchTotals(range),
    getTopSearches(range),
    getZeroResultSearches(range),
    getRecentSearches(),
  ]);

  const zeroRate =
    totals.searches > 0 ? totals.zeroResultSearches / totals.searches : 0;

  return (
    <>
      <AdminPageHeader
        title="Search"
        description="What visitors look for. Committed searches only — the results page, not the overlay's suggestions as someone types, so a visitor who clicks a suggestion directly is not counted. No personal data is stored, and every record is deleted after 90 days."
        action={
          <RangeTabs
            basePath={localizePath(activeLocale, "/admin/search")}
            active={range}
            query={query}
          />
        }
      />

      <div className="space-y-6 md:space-y-10">
        <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
          <Stat
            label={`Searches · ${range} days`}
            value={totals.searches.toLocaleString("en-US")}
            caption={`${percent(totals.arShare)} in Arabic`}
          />
          <Stat
            label="Distinct queries"
            value={totals.distinctQueries.toLocaleString("en-US")}
          />
          <Stat
            label="No-result rate"
            value={percent(zeroRate)}
            caption={`${totals.zeroResultSearches.toLocaleString("en-US")} found nothing`}
          />
          <Stat
            label="Semantic share"
            value={percent(totals.hybridShare)}
            caption="Ranked by meaning as well as words"
          />
        </div>

        <section>
          <SectionTitle>{`Top searches · last ${range} days`}</SectionTitle>
          {top.length === 0 ? (
            <AdminEmpty message={`No searches recorded in the last ${range} days.`} />
          ) : (
            <AdminTable
              headers={["Query", "Searches", "Avg. results", "No results", "Language", "Last searched"]}
            >
              {top.map((row) => (
                <AdminRow key={row.query}>
                  <AdminCell>
                    <QueryText>{row.query}</QueryText>
                  </AdminCell>
                  <AdminCell>{row.searches.toLocaleString("en-US")}</AdminCell>
                  <AdminCell muted>{resultsLabel(Math.round(row.avgResults))}</AdminCell>
                  <AdminCell muted>{percent(row.zeroResultShare)}</AdminCell>
                  <AdminCell>
                    <LocaleBadges locales={row.locales} />
                  </AdminCell>
                  <AdminCell muted>{stamp(row.lastSearchedAt)}</AdminCell>
                </AdminRow>
              ))}
            </AdminTable>
          )}
        </section>

        <section>
          <SectionTitle>{`Searches with no results · last ${range} days`}</SectionTitle>
          {zero.length === 0 ? (
            <AdminEmpty message="Every search in this window found something." />
          ) : (
            <AdminTable headers={["Query", "Searches", "Language", "Last searched"]}>
              {zero.map((row) => (
                <AdminRow key={row.query}>
                  <AdminCell>
                    <QueryText>{row.query}</QueryText>
                  </AdminCell>
                  <AdminCell>{row.searches.toLocaleString("en-US")}</AdminCell>
                  <AdminCell>
                    <LocaleBadges locales={row.locales} />
                  </AdminCell>
                  <AdminCell muted>{stamp(row.lastSearchedAt)}</AdminCell>
                </AdminRow>
              ))}
            </AdminTable>
          )}
        </section>

        <section>
          <SectionTitle>Recent searches</SectionTitle>
          {recent.length === 0 ? (
            <AdminEmpty message="No searches recorded yet." />
          ) : (
            <AdminTable headers={["Time (UTC)", "Query", "Language", "Results", "Mode"]}>
              {recent.map((row) => (
                <AdminRow key={row.id}>
                  <AdminCell muted>{stamp(row.searchedAt)}</AdminCell>
                  <AdminCell>
                    <QueryText>{row.query}</QueryText>
                  </AdminCell>
                  <AdminCell>
                    <Badge>{row.locale.toUpperCase()}</Badge>
                  </AdminCell>
                  <AdminCell muted>{resultsLabel(row.resultCount)}</AdminCell>
                  <AdminCell>
                    <Badge accent={row.mode === "hybrid"}>
                      {row.mode === "hybrid" ? "Semantic" : "Keyword"}
                    </Badge>
                  </AdminCell>
                </AdminRow>
              ))}
            </AdminTable>
          )}
        </section>
      </div>
    </>
  );
}
