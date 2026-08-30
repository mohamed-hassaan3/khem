"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  FACET_ORDER,
  FACET_PARAM,
  parseFacet,
  type ProductFacet,
} from "@/src/lib/facets";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Collection filter + sort control + product grid.
 *
 * Both controls are client-side on purpose: driving them from the server would
 * opt the route out of ISR (AGENTS.md §8 lists the collection pages as
 * static/ISR).
 *
 * The cards themselves are rendered on the *server* and handed over as
 * `ReactNode`s — `<ProductCard>` is an async Server Component, so re-authoring
 * its markup here would fork the card design and drag the catalog projection
 * across the client boundary. This component only filters and reorders the
 * nodes it is given; each card carries its own bag control.
 *
 * ## One filter row, one parameter, and a line that says what it did
 *
 * The overview offers exactly one row of chips, and every chip writes
 * `?facet=`. A facet is either a collection or a merchandising cut that crosses
 * them — `src/lib/facets.ts` explains why those are one vocabulary and not two.
 * This component used to carry a second parameter, `?collection=`, for a second
 * row that never existed on the same screen; the chips it would have needed are
 * these chips, so it is gone. It also used to carry a `tabs` slot for the
 * collection bar on `/collections/[slug]`: a collection page offers no filter
 * and no navigation row at all now, so the slot went with it.
 *
 * WHY THE PARAMETER IS READ FROM `window`, NOT FROM `useSearchParams`:
 * the filter has to be linkable — the Nav and the Footer point at
 * `/collections?facet=best-sellers` — but `useSearchParams` forces the subtree
 * under it to bail out to client rendering, which would strip the entire
 * product grid out of the prerendered HTML that this listing page depends on
 * for SEO. Reading the parameter after mount instead keeps the full catalog in
 * the static HTML and narrows it on hydration. Writes go through
 * `history.replaceState`, which updates the URL without a router round trip for
 * what is purely a client-side view change.
 */

export type SortKey = "featured" | "price-asc" | "price-desc";

/**
 * `SortKey` → the dictionary key its label lives under.
 *
 * The two spellings differ (`price-asc` is a URL-shaped value, `priceAsc` a
 * dictionary key), so the state line and the `<select>` print the same string
 * through this map rather than through a second copy of the copy.
 */
const SORT_LABEL_KEY = {
  featured: "featured",
  "price-asc": "priceAsc",
  "price-desc": "priceDesc",
} as const satisfies Record<SortKey, string>;

export interface CollectionGridItem {
  id: string;
  /** Product name — interpolated into the bag button's accessible label. */
  name: string;
  /** The sort key. Smallest currency unit, per AGENTS.md §9. */
  priceInCents: number;
  /** Every facet this product belongs to — see `productFacets()`. */
  facets: readonly ProductFacet[];
  /**
   * Stock. Caps what the bag control may add — `addLine` clamps against it —
   * and at zero it disables the control rather than letting a card promise
   * something the checkout would refuse.
   */
  inventory: number;
  /** The server-rendered `<ProductCard>`. */
  card: ReactNode;
}

export interface CollectionGridProps {
  items: CollectionGridItem[];
  /**
   * Offer the chip row. The single-collection route is already a filtered view,
   * so it passes `false` — a filter whose answer is the page you are on is not
   * one.
   */
  showFacets?: boolean;
  /** Translated chip labels, keyed by facet. */
  facetLabels: Readonly<Record<ProductFacet, string>>;
  /**
   * Offer the sort control. `/collections` is the one screen that lists the
   * whole house, so reordering by price belongs there; a single collection is
   * short enough to read as it was composed, and the control only crowded the
   * bar its description shares.
   */
  showSort?: boolean;
  /**
   * The collection description, server-rendered. It shares a bar with the sort
   * control, and the sort control's state lives here — so the bar is assembled
   * in this component from a slot rather than duplicated in the page.
   */
  description: ReactNode;
}

export default function CollectionGrid({
  items,
  showFacets = false,
  facetLabels,
  showSort = false,
  description,
}: CollectionGridProps) {
  const dict = useDictionary();
  const [sort, setSort] = useState<SortKey>("featured");
  const [facet, setFacet] = useState<ProductFacet | null>(null);

  /**
   * Only facets with something behind them are offered — the `<MerchGrid>`
   * rule: a chip that filters to nothing is a dead affordance, and an emptied
   * collection should take its chip with it rather than wait for a code change.
   * `FACET_ORDER` supplies the order, so the row reads the same on every visit
   * whatever the catalog happens to hold.
   */
  const available = useMemo(() => {
    if (!showFacets) return [];
    const present = new Set(items.flatMap((item) => item.facets));
    return FACET_ORDER.filter((option) => present.has(option));
  }, [showFacets, items]);

  /*
   * Adopt the parameter on mount, and again whenever the visitor uses the Back
   * button — `history.replaceState` below does not fire `popstate` itself, but
   * arriving here from a Nav link that carried a cut does. An unrecognised value
   * resolves to `null`, so a mistyped URL shows the whole catalog rather than an
   * empty grid.
   */
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setFacet(parseFacet(params.get(FACET_PARAM)));
    };

    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const selectFacet = (next: ProductFacet | null) => {
    setFacet(next);

    const url = new URL(window.location.href);

    if (next === null) {
      url.searchParams.delete(FACET_PARAM);
    } else {
      url.searchParams.set(FACET_PARAM, next);
    }

    window.history.replaceState(null, "", url);
  };

  /**
   * One control for both pieces of state.
   *
   * The line it sits on names the filter and the sort together, so a Clear that
   * dropped only the filter would leave half of what it just described in
   * place.
   */
  const clearAll = () => {
    setSort("featured");
    selectFacet(null);
  };

  const isFiltered = facet !== null;
  const isSorted = sort !== "featured";

  const filtered = useMemo(
    () =>
      items.filter((item) => facet === null || item.facets.includes(facet)),
    [items, facet],
  );

  const sorted = useMemo(() => {
    // A copy: the prop array belongs to the caller.
    const next = [...filtered];

    if (sort === "price-asc") {
      next.sort((a, b) => a.priceInCents - b.priceInCents);
    } else if (sort === "price-desc") {
      next.sort((a, b) => b.priceInCents - a.priceInCents);
    }

    return next;
  }, [filtered, sort]);

  return (
    <>
      {/* ── DESCRIPTION + SORT BAR ──────────────────── */}
      <section className="border-b border-ground-border px-4 py-10 sm:px-6 md:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto flex max-w-350 flex-col gap-4 md:gap-6 md:flex-row md:items-center md:justify-between">
          {description}

          {showSort ? (
            <div className="flex items-center gap-5">
              <label
                htmlFor="collection-sort"
                className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ground-muted"
              >
                {dict.collections.sortBy}
              </label>

              <div className="relative">
                <select
                  id="collection-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="cursor-pointer appearance-none border border-ground-border bg-stone px-4 py-2.5 pe-9 font-heading text-[11px] tracking-[0.1em] text-ground transition-colors duration-300 ease-out hover:border-gold/50 focus-visible:border-gold focus-visible:outline-none"
                >
                  <option value="featured">
                    {dict.collections.sortOptions.featured}
                  </option>
                  <option value="price-asc">
                    {dict.collections.sortOptions.priceAsc}
                  </option>
                  <option value="price-desc">
                    {dict.collections.sortOptions.priceDesc}
                  </option>
                </select>

                <ChevronDown
                  size={14}
                  strokeWidth={1.25}
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ground-accent/60"
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── FACET FILTER (overview) ─────────────────── */}
      {available.length > 0 ? (
        /*
         * Pinned under the fixed 5rem header while the grid scrolls beneath it.
         * The catalogue is long enough that the chips left the viewport within
         * one flick, and a filter you have to scroll back to the top to reach is
         * a filter that gets used once. `z-30` keeps it under every overlay the
         * app can raise over it — the header is `z-1000`, its scrim `z-998`, the
         * drawers `z-1001` — and the header's own blurred fill is what stops the
         * cards from reading through it.
         */
        <nav
          aria-label={dict.collections.filterLabel}
          /*
             A veil over the page's own ground, not a fixed obsidian one. This
             bar sticks under the header on a shop page that is now ivory; at
             `--color-surface` it painted a dark band across it.
           */
          className="sticky top-[var(--header-h)] z-30 border-b border-ground-border bg-ground-bg"
        >
          {/* One scrolling strip at every width — never a second line. */}
          <div className="mx-auto flex max-w-350 items-center gap-2.5 overflow-x-auto px-4 py-4 sm:px-6 md:px-10 lg:px-12 xl:px-16">
            <FilterChip
              label={dict.collections.tabAll}
              isActive={facet === null}
              onSelect={() => selectFacet(null)}
            />

            {available.map((option) => (
              <FilterChip
                key={option}
                label={facetLabels[option]}
                isActive={facet === option}
                onSelect={() => selectFacet(option)}
              />
            ))}
          </div>
        </nav>
      ) : null}

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="px-4 pb-14 pt-10 sm:px-6 md:px-10 lg:px-12 xl:px-16 md:pb-36">
        {/*
         * What the visitor is looking at, in words.
         *
         * Both halves of this view can be *arrived* at rather than chosen — a
         * `?facet=` URL someone shared, a sort left set from earlier in the
         * visit — and a catalogue that is quietly two thirds shorter than it
         * should be, in an order nobody remembers picking, is the one thing this
         * page must not do silently. The chips say which one is pressed; this
         * says what that means, and offers the way back.
         *
         * Plain type rather than a second row of controls: the chips above are
         * the controls, and duplicating them here would be two places to press
         * for one result.
         */}
        {showFacets && (isFiltered || isSorted) ? (
          <div className="mx-auto mb-6 md:mb-10 flex max-w-350 flex-wrap items-center gap-x-3 gap-y-2 text-[11px] tracking-wide text-ground-muted">
            {isFiltered ? (
              <span>
                {interpolate(dict.collections.activeState.filteredBy, {
                  name: facetLabels[facet],
                })}
              </span>
            ) : null}

            {isFiltered && isSorted ? (
              <span aria-hidden="true" className="text-ground-muted/60">
                ·
              </span>
            ) : null}

            {isSorted ? (
              <span>
                {interpolate(dict.collections.activeState.sortedBy, {
                  name: dict.collections.sortOptions[SORT_LABEL_KEY[sort]],
                })}
              </span>
            ) : null}

            <button
              type="button"
              onClick={clearAll}
              className="cursor-pointer border-b border-transparent pb-0.5 uppercase tracking-[0.2em] transition-colors duration-300 ease-out hover:border-gold/50 hover:text-ground-accent focus-visible:border-gold focus-visible:text-ground-accent focus-visible:outline-none"
            >
              {dict.collections.activeState.clear}
            </button>
          </div>
        ) : null}

        {sorted.length > 0 ? (
          /*
           * Keyed on the view, so React remounts the grid and `.khem-fade`
           * replays on every collection, cut, or sort change.
           *
           * This is deliberately a fade and not a spinner. `filtered` and
           * `sorted` above are `useMemo` over an in-memory array — they resolve
           * in the same tick as the click, so a loading indicator here would
           * need an invented delay to ever be seen. The fade marks the change
           * honestly without slowing it down.
           *
           * It also covers the one real seam on this route: both parameters are
           * read from the URL after mount (see the header comment on why they
           * cannot come from `useSearchParams`), so a visit to
           * `/collections?facet=best-sellers` paints the full catalog from the
           * static HTML and narrows on hydration. The narrowing now animates
           * in as a filter being applied rather than reading as a glitch.
           */
          <div
            key={`${facet ?? "all"}-${sort}`}
            className="khem-fade mx-auto grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 max-w-350"
          >
            {/*
              The cards are their own grid items now. This used to wrap each one
              in a `relative` div so `<AddToBagButton>` could be overlaid on top
              — the card was a single anchor and could not contain a button. It
              is an `<article>` with a stretched link now and carries its own
              bag, so the wrapper, the import, and the chance of a grid
              forgetting to add one are all gone.
            */}
            {sorted.map((item) => (
              <div key={item.id} className="h-full">
                {item.card}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 md:py-16 text-center text-sm text-ground-muted">
            {dict.collections.empty}
          </p>
        )}
      </section>
    </>
  );
}

/**
 * One filter chip.
 *
 * A bordered pill rather than the underlined tab used on the single-collection
 * route: the pill reads as a control that acts on the grid in place, which is
 * exactly what it does, while an underlined tab reads as a destination.
 *
 * `dir="auto"` on the label: the labels are translated dictionary copy, so the
 * Arabic tree runs them right-to-left inside an otherwise shared row.
 */
function FilterChip({
  label,
  isActive,
  onSelect,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      dir="auto"
      className={`shrink-0 cursor-pointer whitespace-nowrap border px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ease-out focus-visible:border-gold focus-visible:outline-none ${
        isActive
          ? "border-gold/70 bg-gold/10 text-ground-accent"
          : "border-ground-border text-ground-muted hover:border-ground-accent/40 hover:text-ground-muted"
      }`}
    >
      {label}
    </button>
  );
}
