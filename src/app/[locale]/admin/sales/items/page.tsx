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
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import SalesPeriodTabs from "@/src/components/admin/SalesPeriodTabs";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { egp } from "@/src/lib/admin/money";
import {
  DISCOUNT_SOURCES,
  DISCOUNT_SOURCE_LABEL,
  SALE_STATUSES,
  SALE_STATUS_LABEL,
  formatMargin,
  marginPercent,
  parseDiscountSource,
  parseGiveaway,
  parseIsoDate,
  parseSaleStatus,
  parseSalesPeriod,
  salesWindow,
} from "@/src/lib/admin/sales";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminCollections } from "@/src/services/admin/catalog";
import { listSalesLedger } from "@/src/services/admin/sales";
import type { OrderChannel } from "@/src/types/order";

/**
 * Items Sold — one row per line the boutique has ever sold.
 *
 * The detail behind `/admin/sales`. Every figure is the snapshot
 * `order_item_sales_ledger` took when the sale happened, so a product renamed
 * or repriced since then still prints here as it was sold.
 *
 * ## Where each filter runs
 *
 * Date, channel, status, product, collection, instrument and free/paid are all
 * columns on `"SalesLedgerRow"`, so they narrow in Postgres — the ledger gains a
 * row per sold line and would otherwise be the one screen that got slower every
 * day. The free-text box is the exception, for `src/lib/admin/filter.ts`'s
 * reason: matching a product, a SKU, an order number and a customer at once
 * through PostgREST means assembling a filter expression out of somebody's
 * keystrokes, so it runs in memory over rows the database has already narrowed.
 *
 * ## The order column is a link, not a second bill
 *
 * It goes to `/admin/orders/[orderNumber]` — the order screen that already
 * exists. This table is an analytical layer over those orders, and building a
 * second place to read one would be two records of the same sale, disagreeing
 * eventually.
 */

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export default async function AdminItemsSoldPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const period = parseSalesPeriod(query.period);
  const from = parseIsoDate(query.from);
  const to = parseIsoDate(query.to);
  const window = salesWindow(period, from, to);

  const rawChannel = readParam(query.channel);
  const channel: OrderChannel | undefined =
    rawChannel === "ONLINE" || rawChannel === "OFFLINE" ? rawChannel : undefined;

  const status = parseSaleStatus(readParam(query.status));
  const source = parseDiscountSource(readParam(query.source));
  const giveaway = parseGiveaway(readParam(query.give));
  const productSlug = readParam(query.product);
  const collectionSlug = readParam(query.collection);
  const term = searchTerm(query);

  const [rows, collections] = await Promise.all([
    listSalesLedger({
      from: window.from,
      to: window.to,
      channel,
      status: status ?? undefined,
      source: source ?? undefined,
      giveaway: giveaway ?? undefined,
      productSlug: productSlug || undefined,
      collectionSlug: collectionSlug || undefined,
    }),
    listAdminCollections(),
  ]);

  /*
   * One box, four columns. An editor looking for a sale types part of a product
   * name, a SKU, an order number or a customer, and should not have to know
   * which of those this field searches.
   */
  const visible =
    term.length === 0
      ? rows
      : rows.filter((row) =>
          matchesTerm(term, [
            row.productName,
            row.productSlug,
            row.sku,
            row.orderNumber,
            row.customerName,
            row.discountCode,
          ]),
        );

  const base = localizePath(activeLocale, "/admin/sales/items");
  const isCustom = Boolean(from || to);

  // Carried across every chip row, so choosing a channel does not silently wipe
  // the window, the instrument, or the term somebody typed.
  const carried = {
    ...(isCustom ? {} : { period }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(giveaway ? { give: giveaway } : {}),
    ...(productSlug ? { product: productSlug } : {}),
    ...(collectionSlug ? { collection: collectionSlug } : {}),
    ...(term ? { q: term } : {}),
  };

  const isFiltered =
    Boolean(channel || status || source || giveaway || productSlug || collectionSlug || term) ||
    isCustom;

  return (
    <>
      <AdminPageHeader
        title="Items Sold"
        description="Every line the boutique has sold, exactly as it was sold. Original price, what each benefit took off, what was actually paid, what the goods cost, and the profit that left. Nothing here is recalculated from today's catalogue."
        action={
          <SalesPeriodTabs
            basePath={base}
            active={period}
            query={query}
            overridden={isCustom}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href={localizePath(activeLocale, "/admin/sales")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          Back to Sales &amp; Profitability
        </Link>

        {isFiltered ? (
          <Link
            href={base}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <FilterChips
        basePath={base}
        param="channel"
        active={channel ?? ""}
        query={{ ...carried, channel: undefined }}
        chips={[
          { value: "", label: "Both channels" },
          { value: "ONLINE", label: "Online" },
          { value: "OFFLINE", label: "Offline" },
        ]}
      />

      <FilterChips
        basePath={base}
        param="status"
        active={status ?? ""}
        query={{ ...carried, status: undefined }}
        chips={[
          { value: "", label: "Every state" },
          ...SALE_STATUSES.map((value) => ({
            value,
            label: SALE_STATUS_LABEL[value],
          })),
        ]}
      />

      <FilterChips
        basePath={base}
        param="source"
        active={source ?? ""}
        query={{ ...carried, source: undefined }}
        chips={[
          { value: "", label: "Any instrument" },
          ...DISCOUNT_SOURCES.map((value) => ({
            value,
            label: DISCOUNT_SOURCE_LABEL[value],
          })),
        ]}
      />

      <FilterChips
        basePath={base}
        param="give"
        active={giveaway ?? ""}
        query={{ ...carried, give: undefined }}
        chips={[
          { value: "", label: "Free and paid" },
          { value: "free", label: "Given free" },
          { value: "paid", label: "Paid for" },
        ]}
      />

      <FilterChips
        basePath={base}
        param="collection"
        active={collectionSlug}
        query={{ ...carried, collection: undefined }}
        chips={[
          { value: "", label: "Every collection" },
          ...collections.map((collection) => ({
            value: collection.slug,
            label: collection.name,
          })),
        ]}
      />

      <MovementDateRange basePath={base} from={from ?? ""} to={to ?? ""} />

      <AdminSearch
        placeholder="Search items sold"
        label="Search items sold by product, SKU, order number, customer or discount code"
      />

      {visible.length === 0 ? (
        <AdminEmpty
          message={
            isFiltered
              ? "No sold items match those filters."
              : "Nothing has been sold yet. The first order writes the first row here."
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Date",
            "Order",
            "Product",
            "SKU",
            "Qty",
            "Original",
            "Discount",
            "Paid",
            "Cost",
            "Profit",
            "Margin",
            "Status",
          ]}
        >
          {visible.map((row) => {
            const rowMargin = marginPercent(row.grossProfitInCents, row.paidInCents);

            return (
              <AdminRow key={row.id}>
                <AdminCell muted>
                  {new Date(row.soldAt).toLocaleDateString("en-GB", {
                    dateStyle: "medium",
                  })}
                </AdminCell>

                <AdminCell>
                  {/*
                    Into the order screen that already exists. The ledger is an
                    analytical layer over an order, not a second bill.
                  */}
                  <Link
                    href={localizePath(
                      activeLocale,
                      `/admin/orders/${row.orderNumber}`,
                    )}
                    className="transition-colors duration-300 hover:text-ground-accent"
                  >
                    {row.orderNumber}
                  </Link>
                  <span className="block text-[10px] tracking-wide text-ground-subtle">
                    {row.channel === "OFFLINE" ? "Offline" : "Online"}
                  </span>
                </AdminCell>

                <AdminCell>
                  <Link
                    href={localizePath(
                      activeLocale,
                      `/admin/products/${row.productSlug}`,
                    )}
                    className="transition-colors duration-300 hover:text-ground-accent"
                  >
                    {row.productName}
                  </Link>

                  {/*
                    Which instruments touched this line. Derived in the database
                    from the five amounts, so a pill can never claim a reduction
                    the columns do not show.
                  */}
                  {(row.isFree || row.discountSources.length > 0) && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.isFree ? (
                        <span className="border border-gold/50 bg-gold/10 px-2 py-0.5 font-heading text-[8px] uppercase tracking-[0.2em] text-ground-accent">
                          Free
                        </span>
                      ) : null}
                      {row.discountSources.map((entry) => (
                        <span
                          key={entry}
                          className="border border-ground-border px-2 py-0.5 font-heading text-[8px] uppercase tracking-[0.2em] text-ground-muted"
                        >
                          {DISCOUNT_SOURCE_LABEL[entry]}
                        </span>
                      ))}
                    </span>
                  )}
                </AdminCell>

                <AdminCell muted>{row.sku ?? "—"}</AdminCell>
                <AdminCell muted>{row.quantity}</AdminCell>
                <AdminCell muted>{egp(row.originalLineTotalInCents)}</AdminCell>

                <AdminCell muted>
                  {row.totalDiscountInCents > 0
                    ? `−${egp(row.totalDiscountInCents)}`
                    : "—"}
                </AdminCell>

                <AdminCell>
                  {row.paidInCents === 0 ? (
                    <span className="text-ground-accent">Free</span>
                  ) : (
                    egp(row.paidInCents)
                  )}
                </AdminCell>

                <AdminCell muted>
                  {row.totalCostInCents === null
                    ? "Cost unavailable"
                    : egp(row.totalCostInCents)}
                </AdminCell>

                <AdminCell>
                  {row.grossProfitInCents === null ? (
                    <span className="text-ground-muted">—</span>
                  ) : (
                    <span
                      className={
                        row.grossProfitInCents < 0
                          ? "text-danger"
                          : "text-ground-accent"
                      }
                    >
                      {egp(row.grossProfitInCents)}
                    </span>
                  )}
                </AdminCell>

                <AdminCell muted>{formatMargin(rowMargin)}</AdminCell>

                <AdminCell muted>
                  <span
                    className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] ${
                      row.countsAsRevenue
                        ? "border-gold/40 text-ground-accent"
                        : "border-ground-border text-ground-muted"
                    }`}
                  >
                    {SALE_STATUS_LABEL[row.saleStatus]}
                  </span>
                </AdminCell>
              </AdminRow>
            );
          })}
        </AdminTable>
      )}

      {visible.length > 0 ? (
        <p className="mt-6 text-[11px] tracking-wide text-ground-muted">
          {visible.length} line{visible.length === 1 ? "" : "s"} shown
          {rows.length >= 500
            ? " — capped at the 500 most recent; narrow the window to see further back."
            : "."}{" "}
          Refunded and cancelled lines are kept here and counted in no total on
          Sales &amp; Profitability.
        </p>
      ) : null}
    </>
  );
}
