/**
 * Today / yesterday / this week / this month / previous month / this year / all.
 *
 * `<SalesPeriodTabs>`'s argument with a longer vocabulary, in its own component
 * because Finance's periods are not Sales' periods — the brief asks for
 * *yesterday* and *previous month*, and widening the sales switch would have
 * changed the URLs of two working screens to serve a third.
 *
 * Like every filter on this dashboard these are links, not state: the screens
 * are `force-dynamic` server renders, so a window belongs in the URL where it
 * can be bookmarked, shared with the other person at the desk, and survive a
 * reload. Choosing a period clears a custom range — a desk that typed two dates
 * and then clicked "This month" means the month, not the month intersected with
 * whatever is still sitting in `?from=`.
 */

import Link from "next/link";

import {
  FINANCE_PERIODS,
  FINANCE_PERIOD_LABEL,
  type FinancePeriod,
} from "@/src/lib/admin/finance";

export default function FinancePeriodTabs({
  basePath,
  active,
  query = {},
  /** True while a custom range is in force, so no period reads as selected. */
  overridden = false,
}: {
  /** Already locale-prefixed. */
  basePath: string;
  active: FinancePeriod;
  query?: Record<string, string | string[] | undefined>;
  overridden?: boolean;
}) {
  function hrefFor(period: FinancePeriod): string {
    const params = new URLSearchParams();

    for (const [key, existing] of Object.entries(query)) {
      // `from` and `to` are the custom range this tab replaces, and `period` is
      // the thing being set. Everything else — channel, granularity — is
      // carried, because choosing a window should not discard a filter.
      if (key === "period" || key === "from" || key === "to") continue;
      if (existing === undefined) continue;
      params.set(key, Array.isArray(existing) ? (existing[0] ?? "") : existing);
    }

    params.set("period", period);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FINANCE_PERIODS.map((period) => {
        const isActive = !overridden && period === active;

        return (
          <Link
            key={period}
            href={hrefFor(period)}
            aria-current={isActive ? "true" : undefined}
            className={`border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 ${
              isActive
                ? "border-gold/50 bg-gold/10 text-ground-accent"
                : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"
            }`}
          >
            {FINANCE_PERIOD_LABEL[period]}
          </Link>
        );
      })}
    </div>
  );
}
