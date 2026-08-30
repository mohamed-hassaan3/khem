/**
 * 7 / 30 / 90 days, as links rather than state.
 *
 * A Server Component holding three `<Link>`s. The window lives in the URL, so
 * a desk can bookmark "the last quarter", a reload keeps the view, and the
 * pages stay `force-dynamic` server renders with no client state to hydrate.
 *
 * Every other search param is carried across, so switching the range on a
 * filtered order list does not silently clear the filter.
 */

import Link from "next/link";

import { SALES_RANGES, type SalesRange } from "@/src/services/admin/analytics";

export default function RangeTabs({
  basePath,
  active,
  query = {},
}: {
  /** Already locale-prefixed by the caller. */
  basePath: string;
  active: SalesRange;
  query?: Record<string, string | string[] | undefined>;
}) {
  function hrefFor(range: SalesRange): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (key === "range" || value === undefined) continue;
      params.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
    }

    params.set("range", String(range));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="inline-flex border border-ground-border">
      {SALES_RANGES.map((range) => {
        const isActive = range === active;

        return (
          <Link
            key={range}
            href={hrefFor(range)}
            aria-current={isActive ? "true" : undefined}
            className={`border-e border-ground-border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 last:border-e-0 ${
              isActive
                ? "bg-gold/10 text-ground-accent"
                : "text-ground-muted hover:text-ground"
            }`}
          >
            {range}d
          </Link>
        );
      })}
    </div>
  );
}
