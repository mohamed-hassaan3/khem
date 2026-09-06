import Link from "next/link";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import FinancePeriodTabs from "@/src/components/admin/FinancePeriodTabs";
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import BreakdownBars from "@/src/components/admin/charts/BreakdownBars";
import ChartPanel from "@/src/components/admin/charts/ChartPanel";
import FinanceChart from "@/src/components/admin/charts/FinanceChart";
import {
  FINANCE_PERIOD_LABEL,
  changePercent,
  financeWindow,
  formatChange,
  parseFinancePeriod,
  parseGranularity,
  parseIsoDate,
  previousWindow,
  resolveGranularity,
} from "@/src/lib/admin/finance";
import { egp, egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  ensureRecurringExpenses,
  getExpenseBreakdown,
  getFinanceSeries,
  getFinanceSummary,
} from "@/src/services/admin/finance";
import type { FinancePoint } from "@/src/types/finance";
import type { OrderChannel } from "@/src/types/order";

/**
 * Finance reports — the same figures as the dashboard, over time and against
 * the period before.
 *
 * ## Gaps, not zeros
 *
 * The gross- and net-profit series pass `null` for a period whose sales carried
 * no product cost, and `<FinanceChart>` draws those as whitespace. A line that
 * dived to the axis instead would say the boutique made nothing that month,
 * which is a claim; a gap says nobody has costed it, which is the truth.
 *
 * ## Why a long window becomes monthly on its own
 *
 * A daily series over a year is 365 points on a 900px canvas. `resolveGranularity`
 * promotes anything past four months to months and the caption says it did,
 * rather than rendering a chart that is technically correct and unreadable.
 *
 * ## What the comparison compares against
 *
 * A whole calendar month compares against the calendar month before it — 31
 * days against 28, which is what "September vs August" means to a desk. Any
 * other window compares against the same number of days ending the day before
 * it starts. A previous period of zero produces an em dash, never "+100%":
 * growth from nothing is a comparison that does not exist.
 */

export const dynamic = "force-dynamic";

/** Piastres to pounds, with null preserved as the gap it is. */
function toPounds(
  series: readonly FinancePoint[],
  pick: (point: FinancePoint) => number | null,
): { time: string; value: number | null }[] {
  return series.map((point) => {
    const value = pick(point);
    return { time: point.period, value: value === null ? null : value / 100 };
  });
}

function ComparisonRow({
  label,
  current,
  previous,
  note,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  note?: string;
}) {
  const change = changePercent(current, previous);
  const tone =
    change === null
      ? "text-ground-muted"
      : change > 0
        ? "text-ground-accent"
        : change < 0
          ? "text-danger"
          : "text-ground-muted";

  return (
    <div className="border border-ground-border p-5">
      <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
        {label}
      </p>
      <p className={`mt-3 font-heading text-lg tracking-[0.08em] ${tone}`}>
        {formatChange(change)}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed tracking-wide text-ground-muted">
        {current === null ? "—" : egpCompact(current)} against{" "}
        {previous === null ? "—" : egpCompact(previous)}
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}

export default async function AdminFinanceReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const period = parseFinancePeriod(query.period);
  const from = parseIsoDate(query.from);
  const to = parseIsoDate(query.to);
  const window = financeWindow(period, from, to);

  const rawChannel = Array.isArray(query.channel) ? query.channel[0] : query.channel;
  const channel: OrderChannel | undefined =
    rawChannel === "ONLINE" || rawChannel === "OFFLINE" ? rawChannel : undefined;

  const asked = parseGranularity(query.grain);
  const granularity = resolveGranularity(asked, window);
  const promoted = asked === "daily" && granularity === "monthly";

  const previous = previousWindow(window);

  await ensureRecurringExpenses();

  const [summary, series, breakdown, before] = await Promise.all([
    getFinanceSummary(window, channel),
    getFinanceSeries(window, granularity, channel),
    getExpenseBreakdown(window),
    previous ? getFinanceSummary(previous, channel) : Promise.resolve(null),
  ]);

  const base = localizePath(activeLocale, "/admin/finance/reports");
  const isCustom = Boolean(from || to);

  const carried = {
    ...(isCustom ? {} : { period }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(channel ? { channel } : {}),
    ...(asked === "monthly" ? { grain: "monthly" } : {}),
  };

  const windowLabel = isCustom
    ? `${from ?? "the beginning"} → ${to ?? "now"}`
    : FINANCE_PERIOD_LABEL[period].toLowerCase();

  const hasActivity = summary.orderCount > 0 || summary.expenseCount > 0;
  const hasCost = summary.grossProfitInCents !== null;
  const grainNote =
    granularity === "daily" ? "One point per period day." : "Grouped by calendar month.";

  const revenuePoints = toPounds(series, (point) => point.revenueInCents);
  const expensePoints = toPounds(series, (point) => point.expenseInCents);

  return (
    <>
      <AdminPageHeader
        title="Financial reports"
        description="Revenue, product cost, expenses and what is left, over time and against the period before. Every figure is the one the dashboard prints — this screen only changes the shape it is in."
        action={
          <FinancePeriodTabs
            basePath={base}
            active={period}
            query={query}
            overridden={isCustom}
          />
        }
      />

      <FilterChips
        basePath={base}
        param="grain"
        active={asked}
        query={{ ...carried, grain: undefined }}
        chips={[
          { value: "daily", label: "Daily" },
          { value: "monthly", label: "Monthly" },
        ]}
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
          href={localizePath(activeLocale, "/admin/finance")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          ← Finance dashboard
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

      {promoted ? (
        <p className="mb-6 border border-ground-border px-4 py-3 text-[11px] leading-relaxed text-ground-muted">
          {windowLabel} is too long to read a day at a time, so these charts are
          grouped by month. Narrow the range for a daily view.
        </p>
      ) : null}

      <div className="space-y-6">
        <ChartPanel
          title={`Revenue · ${windowLabel}`}
          figure={egpCompact(summary.revenueInCents)}
          caption={`Merchandise revenue, delivery excluded. ${grainNote}`}
          isEmpty={summary.revenueInCents === 0}
          emptyMessage="Nothing was sold in this window."
        >
          <FinanceChart
            series={[
              { label: "Revenue", kind: "area", tone: "gold", points: revenuePoints },
            ]}
          />
        </ChartPanel>

        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Gross profit"
            figure={
              summary.grossProfitInCents === null
                ? "—"
                : egpCompact(summary.grossProfitInCents)
            }
            caption="Revenue less what the goods cost. A break in the line is a period with no product cost recorded — unknown, not zero."
            isEmpty={!hasCost}
            emptyMessage="No product costs recorded against anything sold in this window. Set a cost on each product and this becomes a real curve."
          >
            <FinanceChart
              series={[
                {
                  label: "Gross profit",
                  kind: "line",
                  tone: "gold",
                  points: toPounds(series, (point) => point.grossProfitInCents),
                },
              ]}
              height={220}
            />
          </ChartPanel>

          <ChartPanel
            title="Net profit"
            figure={
              summary.netProfitInCents === null
                ? "—"
                : egpCompact(summary.netProfitInCents)
            }
            caption="Gross profit less operating expenses. This is what the house actually kept."
            isEmpty={!hasCost}
            emptyMessage="Net profit needs a product cost to build on. Operating expenses below are exact regardless."
          >
            <FinanceChart
              series={[
                {
                  label: "Net profit",
                  kind: "line",
                  tone: "gold",
                  points: toPounds(series, (point) => point.netProfitInCents),
                },
              ]}
              height={220}
            />
          </ChartPanel>
        </div>

        <ChartPanel
          title="Operating expenses"
          figure={egpCompact(summary.expenseInCents)}
          caption={`What it cost to trade. ${grainNote} Voided expenses are excluded.`}
          isEmpty={summary.expenseInCents === 0}
          emptyMessage="No expenses recorded in this window."
        >
          <FinanceChart
            series={[
              {
                label: "Expenses",
                kind: "histogram",
                tone: "danger",
                points: expensePoints,
              },
            ]}
            height={220}
          />
        </ChartPanel>

        <ChartPanel
          title="Revenue, expenses and what is left"
          figure={
            summary.netProfitInCents === null
              ? "—"
              : egpCompact(summary.netProfitInCents)
          }
          caption="Gold is revenue, claret is what went out, and the muted line is what remained. The gap between the first two is not profit — the goods still have to be paid for."
          isEmpty={!hasActivity}
          emptyMessage="Nothing sold and nothing spent in this window."
        >
          <FinanceChart
            series={[
              { label: "Revenue", kind: "area", tone: "gold", points: revenuePoints },
              {
                label: "Expenses",
                kind: "line",
                tone: "danger",
                points: expensePoints,
              },
              {
                label: "Net profit",
                kind: "line",
                tone: "muted",
                points: toPounds(series, (point) => point.netProfitInCents),
              },
            ]}
            height={300}
          />
        </ChartPanel>

        <section className="border border-ground-border bg-ivory/2 p-6 sm:p-8">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Expense breakdown
          </h2>
          <p className="mt-3 font-heading text-3xl tracking-[0.1em] text-ground-accent">
            {egpCompact(summary.expenseInCents)}
          </p>
          <p className="mt-2 mb-6 text-[11px] tracking-wide text-ground-muted">
            By the category each expense was recorded under. Renaming a category
            never re-labels what has already been reported.
          </p>

          {breakdown.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ground-muted">
              Nothing was spent in this window, so there is nothing to break down.
            </p>
          ) : (
            <BreakdownBars rows={breakdown} totalInCents={summary.expenseInCents} />
          )}
        </section>

        <section className="border border-ground-border bg-ivory/2 p-6 sm:p-8">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Against the period before
          </h2>

          {before === null || previous === null ? (
            <p className="mt-4 text-[12px] leading-relaxed text-ground-muted">
              An unbounded window has nothing before it. Choose a month, a year
              or a custom range and this compares it against the period that
              preceded it.
            </p>
          ) : (
            <>
              <p className="mt-3 mb-6 text-[11px] tracking-wide text-ground-muted">
                {window.from} → {window.to} against {previous.from} → {previous.to}.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ComparisonRow
                  label="Revenue"
                  current={summary.revenueInCents}
                  previous={before.revenueInCents}
                />
                <ComparisonRow
                  label="Gross profit"
                  current={summary.grossProfitInCents}
                  previous={before.grossProfitInCents}
                  note={
                    summary.grossProfitInCents === null ||
                    before.grossProfitInCents === null
                      ? "one side has no product cost"
                      : undefined
                  }
                />
                <ComparisonRow
                  label="Expenses"
                  current={summary.expenseInCents}
                  previous={before.expenseInCents}
                  note="rising is not automatically bad"
                />
                <ComparisonRow
                  label="Net profit"
                  current={summary.netProfitInCents}
                  previous={before.netProfitInCents}
                />
              </div>
            </>
          )}
        </section>

        <section className="border border-ground-border p-6 sm:p-8">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            The window in full
          </h2>

          <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Original sales value", egp(summary.originalInCents)],
              ["Discounts given", egp(summary.discountInCents)],
              ["Actual revenue", egp(summary.revenueInCents)],
              [
                "Product cost",
                summary.cogsInCents === null ? "—" : egp(summary.cogsInCents),
              ],
              [
                "Gross profit",
                summary.grossProfitInCents === null
                  ? "—"
                  : egp(summary.grossProfitInCents),
              ],
              ["Operating expenses", egp(summary.expenseInCents)],
              [
                "Net profit",
                summary.netProfitInCents === null
                  ? "—"
                  : egp(summary.netProfitInCents),
              ],
              ["Orders", String(summary.orderCount)],
              ["Units", String(summary.units)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                  {label}
                </dt>
                <dd className="mt-1.5 text-[12px] tracking-wide text-ground">{value}</dd>
              </div>
            ))}
          </dl>

          {summary.refundedOrderCount > 0 ? (
            <p className="mt-6 text-[11px] leading-relaxed text-ground-muted">
              {summary.refundedOrderCount} order
              {summary.refundedOrderCount === 1 ? " was" : "s were"} cancelled or
              refunded in this window and {summary.refundedOrderCount === 1 ? "is" : "are"}{" "}
              excluded from every figure above.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
