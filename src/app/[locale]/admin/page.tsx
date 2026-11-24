import { Check, ChevronRight } from "lucide-react";

import AdminLink from "@/src/components/admin/AdminLink";
import AdminOrderList from "@/src/components/admin/AdminOrderList";
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
import { SHOP_TIME_ZONE } from "@/src/lib/shop-time";

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

/** A figure in the period band: two-up on a phone, four across on desktop. */
function Figure({
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
    <AdminLink
      href={href}
      className="block min-w-0 rounded-lg border border-ground-border bg-stone p-3 no-underline transition-colors duration-300 hover:border-gold/40 lg:p-5"
    >
      <p className="truncate text-[12px] text-ground-muted">{label}</p>
      <p className="mt-1 truncate font-heading text-[20px] text-ground-accent lg:text-[26px]">{value}</p>
      {note ? <p className="mt-0.5 truncate text-[11px] text-ground-muted lg:text-[12px]">{note}</p> : null}
    </AdminLink>
  );
}

/** "Needs you": the work waiting, as a card that opens it. */
function Task({
  count,
  label,
  note,
  href,
  strong = false,
}: {
  count: number;
  label: string;
  note: string;
  href: string;
  strong?: boolean;
}) {
  if (count === 0) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-lg border border-dashed border-ground-border px-4 py-3 text-[13px] text-ground-muted">
        <Check size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
        {note}
      </div>
    );
  }

  return (
    <AdminLink
      href={href}
      className={[
        "flex min-h-16 items-center gap-3 rounded-lg px-4 py-3 no-underline transition-colors duration-300",
        strong
          ? "bg-ground text-ground-bg hover:bg-ground/90"
          : "border border-ground-border bg-stone text-ground hover:border-gold/40",
      ].join(" ")}
    >
      <span className={`min-w-9 font-heading text-[28px] leading-none ${strong ? "text-gold-soft" : "text-ground-accent"}`}>
        {count}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px]">{label}</span>
        <span className={`block text-[12px] ${strong ? "text-ground-bg/70" : "text-ground-muted"}`}>{note}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 opacity-70 rtl:rotate-180" />
    </AdminLink>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-4">
      <h2 className="font-heading text-[16px] font-normal text-ground">{children}</h2>
      {action}
    </div>
  );
}

function todayInCairo(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date());
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

  /*
   * The online counter, as the Stock page and the storefront read it — not
   * `inventory`, the online + in-store total. A bottle with 2 left online and
   * 55 on the shelf is "running low" to every visitor, and the total (57) hid
   * it from this screen.
   */
  const needsStock = inventory.filter((row) => stockState(row.inventoryOnline) !== "in");
  const outOfStock = needsStock.filter((row) => row.inventoryOnline === 0).length;

  const revenuePoints = series.map((point) => ({
    time: point.day,
    value: point.revenueInCents / 100,
  }));

  const href = (path: string) => localizePath(activeLocale, path);
  const ordersPath = href("/admin/orders");

  const glance = [
    { label: "Customers", value: String(customerCount), href: href("/admin/customers") },
    {
      label: "Products live",
      value: products.length - live > 0 ? `${live} · ${products.length - live} archived` : String(live),
      href: href("/admin/products"),
    },
    { label: "Collections", value: String(collections.length), href: href("/admin/collections") },
    {
      label: "Journal",
      value: drafts > 0 ? `${articles.length} · ${drafts} unpublished` : String(articles.length),
      href: href("/admin/journal"),
    },
    {
      label: "Discovery credits",
      value: `${creditTotals.issuedCount} issued · ${creditTotals.redeemedCount} redeemed`,
      href: href("/admin/credits"),
    },
  ];

  const quick = [
    { label: "Manual order", href: href("/admin/orders/new") },
    { label: "Product", href: href("/admin/products/new") },
    { label: "Email campaign", href: href("/admin/campaigns/new") },
    { label: "Discount code", href: href("/admin/discounts/new") },
  ];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end gap-4 lg:mb-8">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ground-accent">{todayInCairo()}</p>
          <h1 className="mt-1.5 font-heading text-[28px] font-normal leading-[1.1] text-ground lg:text-[36px]">
            Today
          </h1>
        </div>
        <div className="ms-auto hidden gap-2 lg:flex">
          <AdminLink
            href={href("/admin/products/new")}
            className="inline-flex h-10 items-center rounded-lg border border-ground-border px-4 text-[13px] text-ground no-underline transition-colors duration-300 hover:border-gold/40"
          >
            + Product
          </AdminLink>
          <AdminLink
            href={href("/admin/orders/new")}
            className="inline-flex h-10 items-center rounded-lg bg-ground px-4 text-[13px] text-ground-bg no-underline transition-colors duration-300 hover:bg-ground/85"
          >
            + Manual order
          </AdminLink>
        </div>
      </header>

      {/* ── Needs you ────────────────────────────────────── */}
      <section aria-labelledby="needs-you">
        <h2 id="needs-you" className="sr-only">Needs you</h2>
        <div className="grid gap-2 lg:grid-cols-3 lg:gap-3">
          <Task
            strong
            count={totals.unopened}
            label={totals.unopened === 1 ? "New order to open" : "New orders to open"}
            note={totals.unopened > 0 ? "Nobody has looked at them yet" : "Every order has been seen"}
            href={`${ordersPath}?seen=new`}
          />
          <Task
            count={totals.awaitingFulfilment}
            label="To prepare and ship"
            note={totals.awaitingFulfilment > 0 ? "Being prepared" : "Nothing waiting to ship"}
            href={`${ordersPath}?status=PROCESSING`}
          />
          <Task
            count={needsStock.length}
            label={needsStock.length === 1 ? "Product running low" : "Products running low"}
            note={
              needsStock.length > 0
                ? outOfStock > 0
                  ? `${outOfStock} sold out`
                  : `Below ${LOW_STOCK_THRESHOLD} left`
                : "Stock is fine — nothing running low"
            }
            href={href("/admin/inventory")}
          />
        </div>
      </section>

      {/* ── The period ───────────────────────────────────── */}
      <section aria-labelledby="period" className="mt-7">
        <SectionTitle
          action={
            <RangeTabs basePath={href("/admin")} active={range} query={query} />
          }
        >
          <span id="period">Last {range} days</span>
        </SectionTitle>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          <Figure
            label="Revenue"
            value={egpCompact(totals.revenueInCents)}
            note="Goods only, no delivery"
            href={href("/admin/analytics")}
          />
          <Figure
            label="Orders"
            value={totals.orderCount}
            note={`${totals.units} unit${totals.units === 1 ? "" : "s"} sold`}
            href={ordersPath}
          />
          <Figure
            label="Customers"
            value={customerCount}
            note="Registered and walk-in"
            href={href("/admin/customers")}
          />
          <Figure
            label="Credits redeemed"
            value={egp(creditTotals.redeemedInCents)}
            note={`${creditTotals.redeemedCount} of ${creditTotals.issuedCount} issued`}
            href={href("/admin/credits")}
          />
        </div>

        <div className="mt-2 lg:mt-3">
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
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-12 lg:gap-6">
        {/* ── Latest orders ──────────────────────────────── */}
        <section aria-labelledby="latest-orders" className="lg:col-span-8">
          <SectionTitle
            action={
              <AdminLink href={ordersPath} className="text-[13px] text-ground-accent no-underline hover:text-ground">
                All orders
              </AdminLink>
            }
          >
            <span id="latest-orders">Latest orders</span>
          </SectionTitle>

          {recentOrders.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ground-border px-5 py-8 text-center text-[13px] text-ground-muted">
              No orders yet. Record a sale under{" "}
              <AdminLink href={`${ordersPath}/new`} className="text-ground-accent">
                Manual order
              </AdminLink>{" "}
              and it appears here and on the curve.
            </p>
          ) : (
            <AdminOrderList orders={recentOrders} locale={activeLocale} />
          )}
        </section>

        <div className="flex flex-col gap-7 lg:col-span-4">
          {/* ── Running out ──────────────────────────────── */}
          {needsStock.length > 0 ? (
            <section aria-labelledby="running-out">
              <SectionTitle
                action={
                  <AdminLink href={href("/admin/inventory")} className="text-[13px] text-ground-accent no-underline hover:text-ground">
                    Stock
                  </AdminLink>
                }
              >
                <span id="running-out">Running out</span>
              </SectionTitle>
              <ul className="overflow-hidden rounded-lg border border-warning/40 bg-warning/5">
                {needsStock.slice(0, 6).map((row) => (
                  <li key={row.slug} className="border-b border-warning/20 last:border-b-0">
                    <AdminLink
                      href={href(`/admin/products/${row.slug}`)}
                      className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[13px] text-ground no-underline hover:bg-warning/10"
                    >
                      <span className="truncate">{row.name}</span>
                      <StockChip inventory={row.inventoryOnline} />
                    </AdminLink>
                  </li>
                ))}
              </ul>
              {needsStock.length > 6 ? (
                <p className="mt-2 text-[12px] text-ground-muted">
                  {needsStock.length - 6} more on the Stock page.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ── At a glance ──────────────────────────────── */}
          <section aria-labelledby="glance">
            <SectionTitle>
              <span id="glance">At a glance</span>
            </SectionTitle>
            <ul className="overflow-hidden rounded-lg border border-ground-border bg-stone">
              {glance.map((item) => (
                <li key={item.label} className="border-b border-ground-border last:border-b-0">
                  <AdminLink
                    href={item.href}
                    className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[13px] text-ground no-underline hover:bg-ground-bg/60"
                  >
                    <span className="text-ground-muted">{item.label}</span>
                    <span className="text-end">{item.value}</span>
                  </AdminLink>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Quick actions (phones; desktop has them in the header) ── */}
          <section aria-labelledby="quick" className="lg:hidden">
            <SectionTitle>
              <span id="quick">Quick actions</span>
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {quick.map((item) => (
                <AdminLink
                  key={item.label}
                  href={item.href}
                  className="flex min-h-12 items-center rounded-lg border border-ground-border px-3 text-[13px] text-ground no-underline hover:border-gold/40"
                >
                  + {item.label}
                </AdminLink>
              ))}
            </div>
          </section>
        </div>
      </div>

      {missingEmbeddings > 0 ? (
        <p className="mt-7 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-[12px] leading-relaxed text-ground-muted">
          <span className="text-warning">Search: </span>
          {missingEmbeddings} live product{missingEmbeddings === 1 ? " has" : "s have"} no
          embedding — still found by keyword, but not by meaning, and missing from
          &ldquo;you may also love&rdquo;. Run{" "}
          <code className="text-ground-accent">npm run embed</code> to fill them in.
        </p>
      ) : null}
    </>
  );
}
