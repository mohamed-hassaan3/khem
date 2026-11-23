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
  /**
   * The search param this chip sets, when it is not the row's `param` — so
   * one row can mix filters (Orders: "New" sets `seen`, the statuses set
   * `status`). Every param named by any chip in the row is cleared first.
   */
  param?: string;
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
  const owned = new Set([param, ...chips.flatMap((chip) => (chip.param ? [chip.param] : []))]);

  function hrefFor(chip: FilterChip): string {
    const params = new URLSearchParams();

    for (const [key, existing] of Object.entries(query)) {
      // A filter change starts the list from its first page.
      if (owned.has(key) || key === "page" || existing === undefined) continue;
      params.set(key, Array.isArray(existing) ? (existing[0] ?? "") : existing);
    }

    if (chip.value.length > 0) params.set(chip.param ?? param, chip.value);

    const search = params.toString();
    return search.length > 0 ? `${basePath}?${search}` : basePath;
  }

  return (
    // One row that scrolls sideways on a phone rather than wrapping into a
    // block of pills above the list it filters.
    <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {chips.map((chip) => {
        const isActive = chip.value === active;

        return (
          <Link
            key={`${chip.param ?? param}:${chip.value || "all"}`}
            href={hrefFor(chip)}
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] no-underline transition-colors duration-300 ${
              isActive
                ? "border-ground bg-ground text-ground-bg"
                : "border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground"
            }`}
          >
            {chip.label}
            {typeof chip.count === "number" ? (
              <span className={isActive ? "text-ground-bg/70" : "text-ground-subtle"}>{chip.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
