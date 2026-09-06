/**
 * Today / this week / this month / this year / all time.
 *
 * `<FilterChips>`'s argument, in its own component because these tabs also have
 * to *clear* a custom range: a desk that typed two dates and then clicked "This
 * month" means the month, not the month intersected with whatever is still
 * sitting in `?from=`. Dropping both is the only reading that is not a
 * surprise.
 *
 * Links rather than state, like every other filter on this dashboard: the
 * screens are `force-dynamic` server renders, so a window belongs in the URL
 * where it can be bookmarked, shared with the other person at the desk, and
 * survive a reload.
 */

import Link from "next/link";

import {
  SALES_PERIODS,
  SALES_PERIOD_LABEL,
  type SalesPeriod,
} from "@/src/lib/admin/sales";

export default function SalesPeriodTabs({
  basePath,
  active,
  query = {},
  /** True while a custom range is in force, so no period reads as selected. */
  overridden = false,
}: {
  /** Already locale-prefixed. */
  basePath: string;
  active: SalesPeriod;
  query?: Record<string, string | string[] | undefined>;
  overridden?: boolean;
}) {
  function hrefFor(period: SalesPeriod): string {
    const params = new URLSearchParams();

    for (const [key, existing] of Object.entries(query)) {
      // `from` and `to` are the custom range this tab replaces, and `period` is
      // the thing being set. Everything else — channel, product, search — is
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
      {SALES_PERIODS.map((period) => {
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
            {SALES_PERIOD_LABEL[period]}
          </Link>
        );
      })}
    </div>
  );
}
