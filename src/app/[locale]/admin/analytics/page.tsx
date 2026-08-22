import { AdminEmpty, AdminPageHeader } from "@/src/components/admin/AdminTable";
import ChartPanel from "@/src/components/admin/charts/ChartPanel";
import RangeTabs from "@/src/components/admin/charts/RangeTabs";
import SalesChart from "@/src/components/admin/charts/SalesChart";
import TopProductsBars from "@/src/components/admin/charts/TopProductsBars";
import { egp, egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  getChannelSplit,
  getSalesSeries,
  getSalesTotals,
  getTopProducts,
  parseRange,
} from "@/src/services/admin/analytics";

/**
 * Sales, read properly.
 *
 * Every figure comes from `supabase/sql/0015_orders.sql` — the daily view for
 * the curves, `product_sales()` for the ranking, `channel_split()` for the
 * counter-versus-site share. Cancelled and refunded orders are excluded by
 * those definitions, so nothing on this screen counts money the boutique
 * gave back.
 *
 * Revenue is merchandise revenue: delivery is a cost recovered, not something
 * sold, and folding it in would make the top-products figures disagree with
 * the daily total above them.
 */

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const range = parseRange(query.range);

  const [series, totals, top, channels] = await Promise.all([
    getSalesSeries(range),
    getSalesTotals(range),
    getTopProducts(range),
    getChannelSplit(range),
  ]);

  const hasSales = totals.units > 0;

  // Piastres become pounds once, here, so the chart component performs no
  // arithmetic on money.
  const revenuePoints = series.map((point) => ({
    time: point.day,
    value: point.revenueInCents / 100,
  }));

  const unitPoints = series.map((point) => ({
    time: point.day,
    value: point.units,
  }));

  const totalOrders = channels.reduce((sum, row) => sum + row.orderCount, 0);

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Merchandise revenue, excluding delivery, and excluding orders that were cancelled or refunded. Every figure is read from the orders themselves — nothing here is estimated."
        action={
          <RangeTabs
            basePath={localizePath(activeLocale, "/admin/analytics")}
            active={range}
            query={query}
          />
        }
      />

      <div className="space-y-6">
        <ChartPanel
          title={`Revenue · last ${range} days`}
          figure={egpCompact(totals.revenueInCents)}
          caption={`${totals.orderCount} order${totals.orderCount === 1 ? "" : "s"} · ${totals.units} unit${totals.units === 1 ? "" : "s"}`}
          isEmpty={!hasSales}
          emptyMessage="No sales in this window yet. Record an order and the curve starts here."
        >
          <SalesChart points={revenuePoints} kind="area" unit="egp" />
        </ChartPanel>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartPanel
            title={`Units sold · last ${range} days`}
            figure={String(totals.units)}
            caption="One bar per day, not a rolling average."
            isEmpty={!hasSales}
            emptyMessage="Nothing has been sold in this window."
          >
            <SalesChart points={unitPoints} kind="histogram" unit="units" height={220} />
          </ChartPanel>

          <section className="border border-border bg-ivory/2 p-6 sm:p-8">
            <h2 className="mb-6 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              Best sellers · last {range} days
            </h2>

            {top.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-ivory/30">
                Nothing has sold in this window, so there is nothing to rank.
              </p>
            ) : (
              <TopProductsBars
                rows={top}
                hrefFor={(slug) =>
                  localizePath(activeLocale, `/admin/products/${slug}`)
                }
              />
            )}
          </section>
        </div>

        <section className="border border-border bg-ivory/2 p-6 sm:p-8">
          <h2 className="mb-6 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            Where the sales came from
          </h2>

          {channels.length === 0 ? (
            <AdminEmpty message="No orders in this window." />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {channels.map((row) => {
                const share =
                  totalOrders > 0
                    ? Math.round((row.orderCount / totalOrders) * 100)
                    : 0;

                return (
                  <div key={row.channel} className="border border-border p-6">
                    <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/25">
                      {row.channel === "OFFLINE"
                        ? "Offline — the boutique"
                        : "Online — the website"}
                    </p>
                    <p className="mt-3 font-heading text-2xl tracking-[0.1em] text-gold">
                      {egp(row.revenueInCents)}
                    </p>
                    <p className="mt-2 text-[11px] tracking-wide text-ivory/30">
                      {row.orderCount} order{row.orderCount === 1 ? "" : "s"} · {share}%
                      of the book
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
