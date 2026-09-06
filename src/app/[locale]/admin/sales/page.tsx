import Link from "next/link";

import {
  AdminCell,
  AdminEmpty,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import SalesFigure from "@/src/components/admin/SalesFigure";
import SalesPeriodTabs from "@/src/components/admin/SalesPeriodTabs";
import { egp, egpCompact } from "@/src/lib/admin/money";
import {
  formatMargin,
  marginPercent,
  parseIsoDate,
  parseSalesPeriod,
  salesWindow,
  SALES_PERIOD_LABEL,
} from "@/src/lib/admin/sales";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  countProductsMissingCost,
  getSalesSummary,
  listProductPerformance,
} from "@/src/services/admin/sales";
import type { OrderChannel } from "@/src/types/order";

/**
 * Sales & Profitability — what came in, what was given away, and what was kept.
 *
 * ## Why this is not `/admin/analytics`
 *
 * That screen answers "how are we trading": a rolling curve of revenue and
 * units at the prices actually charged. This one answers "are we making money",
 * which needs three things that one does not have — the list value before any
 * benefit, the reduction each instrument took off, and the cost of the goods.
 * Every figure below is read from `order_item_sales_ledger`, which snapshots all
 * three at the moment of sale, so a repriced catalogue never rewrites a closed
 * month.
 *
 * ## The vocabulary, which is load-bearing
 *
 * **Original Sales Value** is the list value of what was sold.
 * **Discounts** is what was given away, across all five instruments.
 * **Actual Revenue** is what customers actually paid for merchandise.
 * **Product Cost** is what those goods cost the house.
 * **Gross Profit** is Actual Revenue minus Product Cost.
 *
 * Actual Revenue is *not* profit, and the tiles say so rather than leaving it
 * to be inferred. Delivery is in none of them: it is a cost recovered, not
 * something sold, and folding it in would make every margin here disagree with
 * the order it came from.
 *
 * Cancelled and refunded orders are excluded from all of it — the same
 * definition `DailySales` has used since 0015 — and reported separately below,
 * because money given back is a fact about the month, not an absence.
 */

export const dynamic = "force-dynamic";

export default async function AdminSalesPage({
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

  const rawChannel = Array.isArray(query.channel) ? query.channel[0] : query.channel;
  const channel: OrderChannel | undefined =
    rawChannel === "ONLINE" || rawChannel === "OFFLINE" ? rawChannel : undefined;

  const [summary, products, missingCost] = await Promise.all([
    getSalesSummary(window, channel),
    listProductPerformance(window, channel),
    countProductsMissingCost(),
  ]);

  const base = localizePath(activeLocale, "/admin/sales");
  const isCustom = Boolean(from || to);

  const carried = {
    ...(isCustom ? {} : { period }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(channel ? { channel } : {}),
  };

  /*
   * The margin denominator is the revenue of the **costed** lines, not total
   * revenue. Dividing a partial profit by a whole revenue understates every
   * margin by the share of sales nobody has costed yet — which would be a
   * quietly wrong number rather than a visibly missing one.
   */
  const margin = marginPercent(summary.profitInCents, summary.costedRevenueInCents);

  const windowLabel = isCustom
    ? `${from ?? "the beginning"} → ${to ?? "now"}`
    : SALES_PERIOD_LABEL[period].toLowerCase();

  const hasSales = summary.lineCount > 0;

  return (
    <>
      <AdminPageHeader
        title="Sales & Profitability"
        description="What was sold, what was given away, and what was left after the goods cost. Every figure is a snapshot taken when the sale happened, so changing a price today never rewrites a closed month. Cancelled and refunded orders are excluded."
        action={
          <SalesPeriodTabs
            basePath={base}
            active={period}
            query={query}
            overridden={isCustom}
          />
        }
      />

      <FilterChips
        basePath={base}
        param="channel"
        active={channel ?? ""}
        query={{ ...carried, channel: undefined }}
        chips={[
          { value: "", label: "Both channels" },
          { value: "ONLINE", label: "Online" },
          { value: "OFFLINE", label: "Offline — the boutique" },
        ]}
      />

      <MovementDateRange basePath={base} from={from ?? ""} to={to ?? ""} />

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          href={`${localizePath(activeLocale, "/admin/sales/items")}?${new URLSearchParams(
            carried as Record<string, string>,
          ).toString()}`}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
        >
          Open Items Sold →
        </Link>

        {isCustom ? (
          <Link
            href={base}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            Clear range
          </Link>
        ) : null}
      </div>

      {!hasSales ? (
        <AdminEmpty
          message={`Nothing was sold ${windowLabel}. Record an order, or widen the window.`}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-4 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              The book · {windowLabel}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SalesFigure
                label="Orders"
                value={String(summary.orderCount)}
                note={`${summary.lineCount} line${summary.lineCount === 1 ? "" : "s"}`}
              />
              <SalesFigure
                label="Items sold"
                value={String(summary.units)}
                note={
                  summary.freeLineCount > 0
                    ? `${summary.freeLineCount} line${summary.freeLineCount === 1 ? "" : "s"} given free`
                    : "Nothing was given away"
                }
              />
              <SalesFigure
                label="Original sales value"
                value={egpCompact(summary.originalInCents)}
                note="Before any promotion, coupon, offer, reward or credit."
              />
              <SalesFigure
                label="Discounts"
                value={`−${egpCompact(summary.discountInCents)}`}
                tone="muted"
                note="Everything given away, across all five instruments."
              />
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Revenue is not profit
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SalesFigure
                label="Actual revenue"
                value={egpCompact(summary.revenueInCents)}
                note="What customers actually paid for merchandise. Delivery is not counted."
              />
              <SalesFigure
                label="Product cost · COGS"
                value={
                  summary.costInCents === null
                    ? "Cost unavailable"
                    : egpCompact(summary.costInCents)
                }
                tone={summary.costInCents === null ? "muted" : "plain"}
                note={
                  summary.linesMissingCost > 0
                    ? `${summary.linesMissingCost} line${summary.linesMissingCost === 1 ? "" : "s"} sold with no cost recorded.`
                    : "Every line sold in this window carries a cost."
                }
              />
              <SalesFigure
                label="Gross profit"
                value={
                  summary.profitInCents === null
                    ? "Cost unavailable"
                    : egpCompact(summary.profitInCents)
                }
                tone={
                  summary.profitInCents === null
                    ? "muted"
                    : summary.profitInCents < 0
                      ? "danger"
                      : "accent"
                }
                note="Actual revenue minus what the goods cost."
              />
              <SalesFigure
                label="Gross margin"
                value={formatMargin(margin)}
                tone={margin === null ? "muted" : "accent"}
                note={
                  summary.linesMissingCost > 0
                    ? `Of ${egpCompact(summary.costedRevenueInCents)} costed revenue only.`
                    : "Gross profit ÷ actual revenue."
                }
              />
            </div>
          </section>

          {(summary.refundedOrderCount > 0 || missingCost > 0) && (
            <section className="grid gap-4 sm:grid-cols-2">
              {summary.refundedOrderCount > 0 ? (
                <SalesFigure
                  label="Given back"
                  value={egpCompact(summary.refundedRevenueInCents)}
                  tone="muted"
                  note={`${summary.refundedOrderCount} cancelled or refunded order${summary.refundedOrderCount === 1 ? "" : "s"} in this window, counted in none of the figures above.`}
                />
              ) : null}

              {missingCost > 0 ? (
                <div className="border border-gold/25 bg-gold/5 p-6">
                  <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent">
                    Costs still to enter
                  </p>
                  <p className="mt-3 text-[12px] leading-relaxed text-ground-muted">
                    {missingCost} live product
                    {missingCost === 1 ? " has" : "s have"} no cost recorded, so
                    nothing sold from{" "}
                    {missingCost === 1 ? "it" : "them"} can be reported as
                    profit. Set{" "}
                    <span className="text-ground">Cost (EGP)</span> on the
                    product to close the gap — it applies from the next sale
                    onwards, never retroactively.
                  </p>
                  <Link
                    href={localizePath(activeLocale, "/admin/products")}
                    className="mt-4 inline-block font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
                  >
                    Open products →
                  </Link>
                </div>
              ) : null}
            </section>
          )}

          {/* ── Product performance ─────────────────────────── */}
          <section>
            <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
              Which products actually make money
            </h2>
            <p className="mb-6 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
              Ranked by gross profit. A product with no cost recorded cannot be
              ranked against one that has, so it sorts last rather than
              appearing to be all profit.
            </p>

            {products.length === 0 ? (
              <AdminEmpty message="Nothing sold in this window, so there is nothing to rank." />
            ) : (
              <AdminTable
                headers={[
                  "Product",
                  "Units",
                  "Original",
                  "Discounts",
                  "Revenue",
                  "Cost",
                  "Profit",
                  "Margin",
                ]}
              >
                {products.map((row) => {
                  const rowMargin = marginPercent(
                    row.profitInCents,
                    row.costedRevenueInCents,
                  );

                  return (
                    <AdminRow key={row.productSlug}>
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
                        <span className="block text-[10px] tracking-wide text-ground-subtle">
                          {row.sku ?? row.productSlug}
                          {row.collectionName ? ` · ${row.collectionName}` : ""}
                        </span>
                      </AdminCell>
                      <AdminCell muted>{row.units}</AdminCell>
                      <AdminCell muted>{egp(row.originalInCents)}</AdminCell>
                      <AdminCell muted>
                        {row.discountInCents > 0
                          ? `−${egp(row.discountInCents)}`
                          : "—"}
                      </AdminCell>
                      <AdminCell>{egp(row.revenueInCents)}</AdminCell>
                      <AdminCell muted>
                        {row.costInCents === null
                          ? "Cost unavailable"
                          : egp(row.costInCents)}
                      </AdminCell>
                      <AdminCell>
                        {row.profitInCents === null ? (
                          <span className="text-ground-muted">—</span>
                        ) : (
                          <span
                            className={
                              row.profitInCents < 0
                                ? "text-danger"
                                : "text-ground-accent"
                            }
                          >
                            {egp(row.profitInCents)}
                          </span>
                        )}
                      </AdminCell>
                      <AdminCell muted>{formatMargin(rowMargin)}</AdminCell>
                    </AdminRow>
                  );
                })}
              </AdminTable>
            )}
          </section>
        </div>
      )}
    </>
  );
}
