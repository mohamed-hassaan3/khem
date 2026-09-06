import Link from "next/link";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import FilterChips from "@/src/components/admin/FilterChips";
import FinancePeriodTabs from "@/src/components/admin/FinancePeriodTabs";
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import SalesFigure from "@/src/components/admin/SalesFigure";
import TargetMeter from "@/src/components/admin/TargetMeter";
import BreakdownBars from "@/src/components/admin/charts/BreakdownBars";
import ChartPanel from "@/src/components/admin/charts/ChartPanel";
import FinanceChart from "@/src/components/admin/charts/FinanceChart";
import {
  FINANCE_PERIOD_LABEL,
  financeWindow,
  formatMargin,
  marginPercent,
  monthBounds,
  monthLabel,
  monthPace,
  parseFinancePeriod,
  parseIsoDate,
  resolveGranularity,
  targetMonthOf,
  targetProgress,
} from "@/src/lib/admin/finance";
import { egp, egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  ensureRecurringExpenses,
  getExpenseBreakdown,
  getFinanceSeries,
  getFinanceSummary,
  getMonthlyActuals,
} from "@/src/services/admin/finance";
import type { OrderChannel } from "@/src/types/order";

/**
 * Finance — what came in, what it cost, what we spent, and what is left.
 *
 * ## Why this is not `/admin/sales`
 *
 * That screen answers "are the goods making money": list value, what each
 * benefit gave away, the cost of the goods, and the gross profit that leaves.
 * It stops there on purpose — rent is not a cost of goods, and folding it in
 * would make every product margin on that screen wrong.
 *
 * This screen takes gross profit as given and asks the next question: after
 * everything it costs to keep the doors open, what did the house actually make?
 * Revenue and COGS below are read from the same ledger `/admin/sales` reads,
 * through `finance_summary()`, filtered on the same `countsAsRevenue`. Nothing
 * here recomputes a sale.
 *
 * ## The vocabulary, which is load-bearing
 *
 * **Revenue** is what customers paid for merchandise.
 * **COGS** is what those goods cost the house.
 * **Gross Profit** is Revenue minus COGS.
 * **Operating Expenses** is everything else it costs to trade.
 * **Net Profit** is Gross Profit minus Operating Expenses.
 *
 * Revenue is not profit and gross profit is not net profit; each tile carries a
 * note saying so, because calling any of them "profit" is how a boutique
 * convinces itself it is making money it is not.
 *
 * Delivery charged to customers is in none of it — it is a cost recovered, not
 * something sold. Delivery *cost* and payment processing fees have no per-order
 * column anywhere in this schema, so neither is estimated: both are recorded as
 * expenses, and the line under the tiles says so rather than leaving it to be
 * discovered.
 */

export const dynamic = "force-dynamic";

export default async function AdminFinancePage({
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

  /*
   * Any recurring occurrence that has fallen due is written before anything is
   * read, so the figures below include this month's rent on the first of the
   * month rather than the first time somebody happens to open the Expenses
   * screen. One idempotent RPC; it returns zero on every call after the first.
   */
  await ensureRecurringExpenses();

  const targetMonth = targetMonthOf(window);
  const monthWindow = monthBounds(targetMonth);
  const granularity = resolveGranularity("daily", window);

  const [summary, series, breakdown, months] = await Promise.all([
    getFinanceSummary(window, channel),
    getFinanceSeries(window, granularity, channel),
    getExpenseBreakdown(window),
    getMonthlyActuals(monthWindow.from ?? targetMonth, monthWindow.to ?? targetMonth, channel),
  ]);

  const base = localizePath(activeLocale, "/admin/finance");
  const isCustom = Boolean(from || to);

  const carried = {
    ...(isCustom ? {} : { period }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(channel ? { channel } : {}),
  };

  /*
   * The margin denominators are different on purpose.
   *
   * Gross margin divides by the revenue of the **costed** lines, because
   * dividing a partial profit by a whole revenue understates it by the share of
   * sales nobody has costed yet. Net margin divides by total revenue, because
   * expenses are complete for the window whatever the catalogue's costing looks
   * like — but it is only shown at all once there is a gross profit to build it
   * from.
   */
  const grossMargin = marginPercent(
    summary.grossProfitInCents,
    summary.costedRevenueInCents,
  );
  const netMargin = marginPercent(summary.netProfitInCents, summary.revenueInCents);

  const windowLabel = isCustom
    ? `${from ?? "the beginning"} → ${to ?? "now"}`
    : FINANCE_PERIOD_LABEL[period].toLowerCase();

  const month = months[0] ?? null;
  const monthName = monthLabel(targetMonth);

  const revenueProgress = targetProgress(
    month?.revenueTargetInCents ?? null,
    month?.revenueInCents ?? 0,
  );
  const grossProgress = targetProgress(
    month?.grossProfitTargetInCents ?? null,
    month?.grossProfitInCents ?? null,
  );
  const netProgress = targetProgress(
    month?.netProfitTargetInCents ?? null,
    month?.netProfitInCents ?? null,
  );

  const pace =
    month && month.revenueTargetInCents
      ? monthPace(targetMonth, month.revenueTargetInCents, month.revenueInCents)
      : null;

  const hasTargets = Boolean(revenueProgress || grossProgress || netProgress);
  const hasActivity = summary.orderCount > 0 || summary.expenseCount > 0;

  // Piastres become pounds once, here, so the chart component performs no
  // arithmetic on money.
  const chartSeries = [
    {
      label: "Revenue",
      kind: "area" as const,
      tone: "gold" as const,
      points: series.map((point) => ({
        time: point.period,
        value: point.revenueInCents / 100,
      })),
    },
    {
      label: "Expenses",
      kind: "line" as const,
      tone: "danger" as const,
      points: series.map((point) => ({
        time: point.period,
        value: point.expenseInCents / 100,
      })),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Finance"
        description="Revenue and product cost come from the Sales & Profit ledger; operating expenses come from the expense ledger below. Net profit is what is left after both. Cancelled and refunded orders are excluded from every figure."
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
          href={`${localizePath(activeLocale, "/admin/finance/expenses")}?${new URLSearchParams(
            carried as Record<string, string>,
          ).toString()}`}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
        >
          Expenses →
        </Link>
        <Link
          href={`${localizePath(activeLocale, "/admin/finance/reports")}?${new URLSearchParams(
            carried as Record<string, string>,
          ).toString()}`}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
        >
          Reports →
        </Link>
        <Link
          href={localizePath(activeLocale, "/admin/finance/targets")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-gold"
        >
          Targets →
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

      <section className="mb-10">
        <h2 className="mb-4 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          {windowLabel}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SalesFigure
            label="Revenue"
            value={egp(summary.revenueInCents)}
            note={`What customers actually paid for merchandise across ${summary.orderCount} order${summary.orderCount === 1 ? "" : "s"}. Delivery excluded.`}
          />

          <SalesFigure
            label="Product cost — COGS"
            value={summary.cogsInCents === null ? "—" : egp(summary.cogsInCents)}
            tone="muted"
            note={
              summary.cogsInCents === null
                ? "No cost recorded against anything sold in this window. Set a cost on each product to see profit."
                : summary.linesMissingCost > 0
                  ? `What the goods cost the house. ${summary.linesMissingCost} sold line${summary.linesMissingCost === 1 ? " has" : "s have"} no cost recorded.`
                  : "What the goods cost the house."
            }
          />

          <SalesFigure
            label="Gross profit"
            value={
              summary.grossProfitInCents === null
                ? "—"
                : egp(summary.grossProfitInCents)
            }
            tone={
              summary.grossProfitInCents !== null && summary.grossProfitInCents < 0
                ? "danger"
                : "plain"
            }
            note={`Revenue less product cost. Margin ${formatMargin(grossMargin)}. This is before rent, salaries and everything else.`}
          />

          <SalesFigure
            label="Operating expenses"
            value={egp(summary.expenseInCents)}
            note={
              summary.expensePendingInCents > 0
                ? `${summary.expenseCount} recorded, of which ${egpCompact(summary.expensePendingInCents)} is still unpaid. Unpaid costs count: they belong to the month they were incurred in.`
                : `${summary.expenseCount} recorded. Rent, salaries, utilities, taxes, marketing — never the cost of the goods themselves.`
            }
          />

          <SalesFigure
            label="Net profit"
            value={
              summary.netProfitInCents === null ? "—" : egp(summary.netProfitInCents)
            }
            tone={
              summary.netProfitInCents === null
                ? "muted"
                : summary.netProfitInCents < 0
                  ? "danger"
                  : "accent"
            }
            note={
              summary.netProfitInCents === null
                ? "Unknown until the goods sold in this window carry a cost. Operating expenses above are exact."
                : "Gross profit less operating expenses. This is what the house actually made."
            }
          />

          <SalesFigure
            label="Net margin"
            value={formatMargin(netMargin)}
            tone="muted"
            note="Net profit as a share of revenue. Shown only once there is a gross profit to build it from."
          />
        </div>

        <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-ground-muted">
          Revenue is merchandise only — delivery charged to customers is a cost
          recovered, not something sold, and is counted nowhere here. Delivery
          cost and payment processing fees are not recorded against individual
          orders anywhere in this system, so neither is estimated: enter them as
          expenses and they will appear in the figures above.
        </p>
      </section>

      {hasTargets ? (
        <section className="mb-10">
          <h2 className="mb-4 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            {monthName} · against target
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {revenueProgress ? (
              <TargetMeter label="Revenue target" progress={revenueProgress} />
            ) : null}
            {grossProgress ? (
              <TargetMeter
                label="Gross profit target"
                progress={grossProgress}
                note={
                  grossProgress.actualInCents === null
                    ? "No product costs recorded for this month yet."
                    : undefined
                }
              />
            ) : null}
            {netProgress ? (
              <TargetMeter
                label="Net profit target"
                progress={netProgress}
                note={
                  netProgress.actualInCents === null
                    ? "Unknown until the month's sales carry a cost."
                    : undefined
                }
              />
            ) : null}
          </div>

          {pace ? (
            <div className="mt-4 border border-ground-border p-6">
              <p className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                Required pace · {monthName}
              </p>
              <p className="mt-3 font-heading text-xl tracking-[0.08em] text-ground sm:text-2xl">
                {pace.requiredPerRemainingDayInCents === null
                  ? revenueProgress && revenueProgress.remainingInCents === 0
                    ? "Target met"
                    : "The month is over"
                  : `${egpCompact(pace.requiredPerRemainingDayInCents)} / day`}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed tracking-wide text-ground-muted">
                {pace.daysElapsed} of {pace.daysInMonth} days elapsed ·{" "}
                {pace.daysRemaining} remaining · a flat month would have needed{" "}
                {egpCompact(pace.averageDailyTargetInCents)} a day.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mb-10 border border-dashed border-ground-border p-6">
          <p className="text-[12px] leading-relaxed text-ground-muted">
            No targets set for {monthName}.{" "}
            <Link
              href={localizePath(activeLocale, "/admin/finance/targets")}
              className="text-ground-accent transition-colors duration-300 hover:text-gold"
            >
              Set one
            </Link>{" "}
            and this becomes target, actual, remaining, achievement, and the
            revenue still needed per remaining day.
          </p>
        </section>
      )}

      <div className="space-y-6">
        <ChartPanel
          title={`Revenue against expenses · ${granularity === "daily" ? "by day" : "by month"}`}
          figure={egpCompact(summary.revenueInCents)}
          caption={`Gold is revenue, claret is what the house spent. ${
            granularity === "monthly"
              ? "Grouped by month — the window is too long to read a day at a time."
              : "One point per day, gaps included."
          }`}
          isEmpty={!hasActivity}
          emptyMessage="Nothing sold and nothing spent in this window. Record an expense or take an order and the curve starts here."
          action={
            <Link
              href={`${localizePath(activeLocale, "/admin/finance/reports")}?${new URLSearchParams(
                carried as Record<string, string>,
              ).toString()}`}
              className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
            >
              Full reports →
            </Link>
          }
        >
          <FinanceChart
            series={chartSeries}
            targetValue={
              month?.revenueTargetInCents && granularity === "daily"
                ? // A monthly target across a daily chart is the pace line, not
                  // the total — comparing one day against a month's target would
                  // draw a rule the series can never approach.
                  month.revenueTargetInCents /
                  100 /
                  (monthPace(targetMonth, month.revenueTargetInCents, 0)?.daysInMonth ?? 30)
                : null
            }
          />
        </ChartPanel>

        <section className="border border-ground-border bg-ivory/2 p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
                Where the money went
              </h2>
              <p className="mt-3 font-heading text-3xl tracking-[0.1em] text-ground-accent">
                {egpCompact(summary.expenseInCents)}
              </p>
              <p className="mt-2 text-[11px] tracking-wide text-ground-muted">
                By category, as each expense was recorded. Renaming a category
                later never re-labels a closed month.
              </p>
            </div>

            <Link
              href={localizePath(activeLocale, "/admin/finance/expenses")}
              className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
            >
              Manage expenses →
            </Link>
          </div>

          {breakdown.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ground-muted">
              No expenses recorded in this window, so there is nothing to break
              down. Until there are, net profit and gross profit are the same
              number — which is almost certainly not true of the business.
            </p>
          ) : (
            <BreakdownBars rows={breakdown} totalInCents={summary.expenseInCents} />
          )}
        </section>
      </div>
    </>
  );
}
