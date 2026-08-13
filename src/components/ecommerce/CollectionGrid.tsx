"use client";

import { ChevronDown, Heart } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  FACET_PARAM,
  parseFacet,
  type ProductFacet,
} from "@/src/lib/facets";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";

/**
 * Facet filter + sort control + product grid.
 *
 * Both controls are client-side on purpose: driving them from the server would
 * opt the route out of ISR (AGENTS.md §8 lists the collection pages as
 * static/ISR).
 *
 * The cards themselves are rendered on the *server* and handed over as
 * `ReactNode`s — `<ProductCard>` is an async Server Component, so re-authoring
 * its markup here would fork the card design and drag the catalog projection
 * across the client boundary. This component only filters and reorders the
 * nodes it is given and overlays the wishlist control.
 *
 * WHY THE FACET IS READ FROM `window`, NOT FROM `useSearchParams`:
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

export interface CollectionGridItem {
  id: string;
  /** Product name — interpolated into the wishlist button's accessible label. */
  name: string;
  /** The sort key. Smallest currency unit, per AGENTS.md §9. */
  priceInCents: number;
  /** Every facet this product belongs to — see `productFacets()`. */
  facets: readonly ProductFacet[];
  /** The server-rendered `<ProductCard>`. */
  card: ReactNode;
}

/** One filter chip: a facet and its already-translated label. */
export interface FacetOption {
  key: ProductFacet;
  label: string;
}

export interface CollectionGridProps {
  items: CollectionGridItem[];
  /**
   * The filter chips. Omitted on a single-collection page, which has nothing to
   * widen — the facets only make sense over the whole catalog.
   */
  facets?: readonly FacetOption[];
  /**
   * The collection description, server-rendered. It shares a bar with the sort
   * control, and the sort control's state lives here — so the bar is assembled
   * in this component from a slot rather than duplicated in the page.
   */
  description: ReactNode;
  /** The server-rendered collection tab bar, which sits below that bar. */
  tabs: ReactNode;
}

export default function CollectionGrid({
  items,
  facets,
  description,
  tabs,
}: CollectionGridProps) {
  const dict = useDictionary();
  const [sort, setSort] = useState<SortKey>("featured");
  const [facet, setFacet] = useState<ProductFacet | null>(null);

  /**
   * Wishlist membership comes from the shared store, so a heart filled here is
   * the same heart filled on the product page and the same entry listed on
   * `/wishlist`. State is persisted to `localStorage`; there is no `Wishlist`
   * table and no Clerk session yet, and when both land this becomes a Server
   * Action call with the button below unchanged.
   */
  const wishlist = useWishlist();

  /*
   * Adopt `?facet=` on mount, and again whenever the visitor uses the Back
   * button — `history.replaceState` below does not fire `popstate` itself, but
   * arriving here from a Nav link that carried a facet does. An unrecognised
   * value parses to `null`, so a mistyped URL shows the whole catalog rather
   * than an empty grid.
   */
  useEffect(() => {
    const read = () =>
      setFacet(
        parseFacet(new URLSearchParams(window.location.search).get(FACET_PARAM)),
      );

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
   * Only facets with something in them are offered — the `<MerchGrid>` rule: a
   * chip that filters to nothing is a dead affordance, and an emptied category
   * should take its chip with it rather than wait for a code change.
   */
  const available = useMemo(() => {
    if (!facets) return [];
    const present = new Set(items.flatMap((item) => item.facets));
    return facets.filter((option) => present.has(option.key));
  }, [facets, items]);

  const filtered = useMemo(
    () =>
      facet === null
        ? items
        : items.filter((item) => item.facets.includes(facet)),
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
      <section className="border-b border-border bg-background px-6 py-10 md:px-20">
        <div className="mx-auto flex max-w-350 flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {description}

          <div className="flex items-center gap-5">
            <label
              htmlFor="collection-sort"
              className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ivory/35"
            >
              {dict.collections.sortBy}
            </label>

            <div className="relative">
              <select
                id="collection-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="cursor-pointer appearance-none border border-white/10 bg-white/4 px-4 py-2.5 pe-9 font-heading text-[11px] tracking-[0.1em] text-ivory transition-colors duration-300 ease-out hover:border-gold/50 focus-visible:border-gold focus-visible:outline-none"
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
                className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gold/60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── COLLECTION TABS ─────────────────────────── */}
      {tabs}

      {/* ── FACET CHIPS ─────────────────────────────── */}
      {available.length > 0 ? (
        <nav
          aria-label={dict.collections.filterLabel}
          className="border-b border-border bg-surface"
        >
          <div className="mx-auto flex max-w-350 items-center gap-2.5 overflow-x-auto px-6 py-4 md:px-20">
            <FacetChip
              label={dict.collections.facetAll}
              isActive={facet === null}
              onSelect={() => selectFacet(null)}
            />

            {available.map((option) => (
              <FacetChip
                key={option.key}
                label={option.label}
                isActive={facet === option.key}
                onSelect={() => selectFacet(option.key)}
              />
            ))}
          </div>
        </nav>
      ) : null}

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="bg-background px-6 pb-24 pt-16 md:px-20 md:pb-36">
        {sorted.length > 0 ? (
          /*
           * Keyed on the view, so React remounts the grid and `.khem-fade`
           * replays on every facet or sort change.
           *
           * This is deliberately a fade and not a spinner. `filtered` and
           * `sorted` above are `useMemo` over an in-memory array — they resolve
           * in the same tick as the click, so a loading indicator here would
           * need an invented delay to ever be seen. The fade marks the change
           * honestly without slowing it down.
           *
           * It also covers the one real seam on this route: the facet is read
           * from the URL after mount (see the header comment on why it cannot
           * come from `useSearchParams`), so a visit to
           * `/collections?facet=best-sellers` paints the full catalog from the
           * static HTML and narrows on hydration. The narrowing now animates
           * in as a filter being applied rather than reading as a glitch.
           */
          <div
            key={`${facet ?? "all"}-${sort}`}
            className="khem-fade mx-auto grid max-w-350 grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3"
          >
            {sorted.map((item) => {
              // Gated on hydration: the server render cannot know what is
              // saved, so the heart stays unfilled until the store is read.
              const isSaved = wishlist.isHydrated && wishlist.has(item.id);

              return (
                <div key={item.id} className="relative">
                  {/*
                   * Logical inset (`end-5`), so the control mirrors to the
                   * top-left of the card on the Arabic tree.
                   */}
                  <button
                    type="button"
                    aria-pressed={isSaved}
                    aria-label={interpolate(
                      isSaved
                        ? dict.collections.wishlistRemove
                        : dict.collections.wishlistAdd,
                      { name: item.name },
                    )}
                    onClick={() => wishlist.toggle(item.id)}
                    className="absolute end-5 top-5 z-2 grid size-9 place-items-center border border-white/10 bg-background/70 backdrop-blur-sm transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none"
                  >
                    <Heart
                      size={14}
                      strokeWidth={1.25}
                      aria-hidden="true"
                      className={
                        isSaved ? "fill-current text-gold" : "text-ivory/50"
                      }
                    />
                  </button>

                  {item.card}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-ivory/40">
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
 * A bordered pill rather than the underlined tab used above it: the two rows
 * sit adjacent, and giving them the same treatment would read as one bar with
 * two active items.
 */
function FacetChip({
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
      className={`shrink-0 cursor-pointer whitespace-nowrap border px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ease-out focus-visible:border-gold focus-visible:outline-none ${
        isActive
          ? "border-gold/70 bg-gold/10 text-gold"
          : "border-white/10 text-ivory/40 hover:border-gold/40 hover:text-ivory/70"
      }`}
    >
      {label}
    </button>
  );
}
