import Link from "next/link";

import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import ChartPanel from "@/src/components/admin/charts/ChartPanel";
import RangeTabs from "@/src/components/admin/charts/RangeTabs";
import SalesChart from "@/src/components/admin/charts/SalesChart";
import StockChip from "@/src/components/admin/StockChip";
import { egp, egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { LOW_STOCK_THRESHOLD, stockState } from "@/src/lib/inventory";
import {
  getSalesSeries,
  getSalesTotals,
  listInventoryRows,
  parseRange,
} from "@/src/services/admin/analytics";
import {
  countProductsMissingEmbedding,
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";
import { getCreditTotals } from "@/src/services/admin/credits";
import { countCustomers } from "@/src/services/admin/customers";
import { listAdminArticles } from "@/src/services/admin/journal";
import { listAdminOrders } from "@/src/services/admin/orders";

/**
 * Dashboard index — the desk's first screen.
 *
 * It answers three questions in the order they get asked: what has been
 * selling, what is about to run out, and what is waiting to be edited.
 *
 * `force-dynamic` because an editor must never be shown a cached copy of a
 * number they just changed — that is the whole reason a dashboard exists
 * beside a set of ISR pages.
 *
 * Two figures earn their place by being invisible problems everywhere else:
 *
 *  - **Low stock.** A product at 2 still sells; it just tells every visitor it
 *    is nearly gone, and nothing on the storefront tells the boutique.
 *  - **Missing embeddings.** A product with no vector is fully visible in
 *    keyword search and completely absent from "you may also love", so a
 *    number here is the only thing that turns it into something anyone
 *    notices.
 */

export const dynamic = "force-dynamic";

/** How many recent orders the desk sees before it should open the order book. */
const RECENT_ORDERS = 5;

function Tile({
  label,
  value,
  href,
  note,
}: {
  label: string;
  value: number | string;
  href: string;
  note?: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-ground-border bg-ivory/2 p-6 transition-colors sm:p-8 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/30"
    >
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
        {label}
      </p>
      <p className="mt-4 font-heading text-3xl tracking-[0.1em] text-ground-accent sm:text-4xl">
        {value}
      </p>
      {note ? <p className="mt-3 text-[11px] text-ground-muted">{note}</p> : null}
    </Link>
  );
}

function placedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const range = parseRange(query.range);

  const [
    collections,
    products,
    articles,
    missingEmbeddings,
    customerCount,
    creditTotals,
    totals,
    series,
    inventory,
    recentOrders,
  ] = await Promise.all([
    listAdminCollections(),
    listAdminProducts(),
    listAdminArticles(),
    countProductsMissingEmbedding(),
    countCustomers(),
    getCreditTotals(),
    getSalesTotals(range),
    getSalesSeries(range),
    listInventoryRows(range),
    listAdminOrders({ limit: RECENT_ORDERS }),
  ]);

  const live = products.filter((product) => !product.isArchived).length;
  const drafts = articles.filter((article) => !article.isPublished).length;

  const needsStock = inventory.filter((row) => stockState(row.inventory) !== "in");
  const outOfStock = needsStock.filter((row) => row.inventory === 0).length;

  const revenuePoints = series.map((point) => ({
    time: point.day,
    value: point.revenueInCents / 100,
  }));

  const ordersPath = localizePath(activeLocale, "/admin/orders");

  return (
    <>
      <AdminPageHeader
        title="Boutique Desk"
        description="Everything the storefront reads lives in the database. Changes made here are live on the site within a reload — there is no build step and no CMS in between."
        action={
          <RangeTabs
            basePath={localizePath(activeLocale, "/admin")}
            active={range}
            query={query}
          />
        }
      />

      {/* ── Trade ────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Tile
          label={`Revenue · ${range}d`}
          value={egpCompact(totals.revenueInCents)}
          note="Merchandise only, delivery excluded"
          href={localizePath(activeLocale, "/admin/analytics")}
        />
        <Tile
          label={`Orders · ${range}d`}
          value={totals.orderCount}
          note={`${totals.units} unit${totals.units === 1 ? "" : "s"} sold`}
          href={ordersPath}
        />
        <Tile
          label="Awaiting fulfilment"
          value={totals.awaitingFulfilment}
          note={
            totals.awaitingFulfilment > 0
              ? "Pending or being prepared"
              : "Nothing outstanding"
          }
          href={`${ordersPath}?status=PROCESSING`}
        />
        <Tile
          label="New · unopened"
          value={totals.unopened}
          note={
            totals.unopened > 0
              ? "Nobody has opened these yet"
              : "Every order seen"
          }
          href={`${ordersPath}?seen=new`}
        />
        <Tile
          label="Needs stock"
          value={needsStock.length}
          note={
            outOfStock > 0
              ? `${outOfStock} sold out`
              : needsStock.length > 0
                ? `Below ${LOW_STOCK_THRESHOLD}`
                : "Every product in stock"
          }
          href={localizePath(activeLocale, "/admin/inventory")}
        />
      </div>

      {/* ── The curve ────────────────────────────────────── */}
      <div className="mt-6">
        <ChartPanel
          title={`Revenue · last ${range} days`}
          figure={egpCompact(totals.revenueInCents)}
          caption="Cancelled and refunded orders are not counted."
          isEmpty={totals.units === 0}
          emptyMessage="No sales recorded in this window. Record an order and the curve starts here."
        >
          <SalesChart points={revenuePoints} kind="area" unit="egp" />
        </ChartPanel>
      </div>

      {/* ── Recent orders ────────────────────────────────── */}
      <section className="mt-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Latest orders
          </h2>
          <Link
            href={ordersPath}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
          >
            The whole book
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="border border-ground-border px-5 py-12 text-center sm:px-8">
            <p className="text-[12px] leading-relaxed text-ground-muted">
              No orders yet. A sale recorded at{" "}
              <Link href={`${ordersPath}/new`} className="text-ground-accent hover:text-ground-accent">
                Orders → Record order
              </Link>{" "}
              takes its units out of stock and appears on the charts above.
            </p>
          </div>
        ) : (
          <AdminTable
            headers={["Order", "Customer", "Placed", "Total", "Status", { label: "Open", hidden: true }]}
          >
            {recentOrders.map((order) => (
              <AdminRow key={order.id}>
                <AdminCell>
                  <span className="font-heading text-[11px] tracking-[0.1em]">
                    {order.orderNumber}
                  </span>
                  {/* Same marker as the order book, so the tile above, this
                      table and that screen all agree at a glance. */}
                  {order.firstOpenedAt === null ? (
                    <span
                      title="Nobody at the desk has opened this order yet"
                      className="mt-2 block w-fit border border-gold/40 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent"
                    >
                      New
                    </span>
                  ) : null}
                </AdminCell>
                <AdminCell muted>{order.customerName}</AdminCell>
                <AdminCell muted>{placedOn(order.placedAt)}</AdminCell>
                <AdminCell>{egp(order.totalInCents)}</AdminCell>
                <AdminCell muted>
                  {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                </AdminCell>
                <AdminCell>
                  <Link
                    href={`${ordersPath}/${order.orderNumber}`}
                    className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                  >
                    Open
                  </Link>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>
        )}
      </section>

      {/* ── Stock warnings ───────────────────────────────── */}
      {needsStock.length > 0 ? (
        <div className="mt-6 border border-warning/30 bg-warning/5 p-5 sm:p-6">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-warning">
            Running out
          </p>
          <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            These products are below {LOW_STOCK_THRESHOLD} on the website. The
            storefront has already stopped saying &ldquo;in stock&rdquo; on them
            and is naming the remaining count instead.
          </p>

          <ul className="mt-5 space-y-2">
            {needsStock.slice(0, 6).map((row) => (
              <li key={row.slug} className="flex items-center justify-between gap-4">
                <Link
                  href={localizePath(activeLocale, `/admin/products/${row.slug}`)}
                  className="text-[12px] tracking-wide text-ground transition-colors duration-300 hover:text-ground-accent"
                >
                  {row.name}
                </Link>
                <StockChip inventory={row.inventory} />
              </li>
            ))}
          </ul>

          {needsStock.length > 6 ? (
            <Link
              href={localizePath(activeLocale, "/admin/inventory")}
              className="mt-5 inline-block font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
            >
              {needsStock.length - 6} more in inventory
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* ── Catalog ──────────────────────────────────────── */}
      <div className="mt-6 md:mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Tile
          label="Customers"
          value={customerCount}
          note="Registered and walk-in"
          href={localizePath(activeLocale, "/admin/customers")}
        />
        <Tile
          label="Credits issued"
          value={creditTotals.issuedCount}
          note={
            creditTotals.pendingDeliveryCount > 0
              ? `${creditTotals.pendingDeliveryCount} awaiting delivery`
              : `${creditTotals.availableCount} available`
          }
          href={localizePath(activeLocale, "/admin/credits")}
        />
        <Tile
          label="Credits redeemed"
          value={creditTotals.redeemedCount}
          note={egp(creditTotals.redeemedInCents)}
          href={`${localizePath(activeLocale, "/admin/credits")}?status=REDEEMED`}
        />
        <Tile
          label="Collections"
          value={collections.length}
          href={localizePath(activeLocale, "/admin/collections")}
        />
        <Tile
          label="Products"
          value={live}
          note={
            products.length - live > 0
              ? `${products.length - live} archived`
              : "All live"
          }
          href={localizePath(activeLocale, "/admin/products")}
        />
        <Tile
          label="Journal"
          value={articles.length}
          note={drafts > 0 ? `${drafts} unpublished` : "All published"}
          href={localizePath(activeLocale, "/admin/journal")}
        />
      </div>

      {missingEmbeddings > 0 ? (
        <div className="mt-8 border border-warning/30 bg-warning/5 p-5 sm:p-6">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-warning">
            Search vectors
          </p>
          <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
            {missingEmbeddings} live product{missingEmbeddings === 1 ? " has" : "s have"} no
            embedding. Those products are still searchable by keyword, but not by
            meaning, and they will not appear in the &ldquo;you may also love&rdquo;
            rail. Run <code className="text-ground-accent-soft">npm run embed</code> to fill
            them in.
          </p>
        </div>
      ) : null}
    </>
  );
}
