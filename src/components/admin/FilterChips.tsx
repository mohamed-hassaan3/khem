/**
 * A row of filters that are links, not state.
 *
 * The same argument as `RangeTabs`: the dashboard's list screens are
 * `force-dynamic` server renders, so a filter belongs in the URL where it can
 * be bookmarked, shared with the other person at the desk, and survive a
 * reload. A client-side filter would also mean fetching every row and hiding
 * most of them, which is what the query is for.
 *
 * Other params are carried across so choosing a status does not silently
 * discard the range or the search term.
 */

import Link from "next/link";

export interface FilterChip {
  /** The value written to the param — empty string clears it. */
  value: string;
  label: string;
  count?: number;
}

export default function FilterChips({
  basePath,
  param,
  active,
  chips,
  query = {},
}: {
  /** Already locale-prefixed. */
  basePath: string;
  param: string;
  active: string;
  chips: readonly FilterChip[];
  query?: Record<string, string | string[] | undefined>;
}) {
  function hrefFor(value: string): string {
    const params = new URLSearchParams();

    for (const [key, existing] of Object.entries(query)) {
      if (key === param || existing === undefined) continue;
      params.set(key, Array.isArray(existing) ? (existing[0] ?? "") : existing);
    }

    if (value.length > 0) params.set(param, value);

    const search = params.toString();
    return search.length > 0 ? `${basePath}?${search}` : basePath;
  }

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {chips.map((chip) => {
        const isActive = chip.value === active;

        return (
          <Link
            key={chip.value || "all"}
            href={hrefFor(chip.value)}
            aria-current={isActive ? "true" : undefined}
            className={`border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 ${
              isActive
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border text-ivory/35 hover:border-gold/30 hover:text-ivory"
            }`}
          >
            {chip.label}
            {typeof chip.count === "number" ? (
              <span className="ms-2 text-ivory/25">{chip.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
