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
 * nodes it is given and overlays the wishlist control.
 *
 * ## One filter row, two parameters
 *
 * The overview offers exactly one row of chips, and it filters by **collection**
 * — `?collection=<slug>`. That is the whole vocabulary a visitor is given here.
 *
 * `?facet=` is the second parameter and has no chips. It carries the
 * merchandising cuts that run across collections (best sellers, limited
 * editions, new arrivals), and it is entered by *arriving* from the Nav
 * quick-access column or the Footer — see `src/lib/facets.ts`. Rather than
 * printing a second row beside the first, the page names the active cut above
 * the grid with a Clear control, so a narrowed catalog is never unexplained. The
 * two compose: Noir on a best-sellers URL shows Noir best sellers.
 *
 * WHY THE PARAMETERS ARE READ FROM `window`, NOT FROM `useSearchParams`:
 * the filters have to be linkable — the Nav and the Footer point at
 * `/collections?facet=best-sellers` — but `useSearchParams` forces the subtree
 * under it to bail out to client rendering, which would strip the entire
 * product grid out of the prerendered HTML that this listing page depends on
 * for SEO. Reading the parameters after mount instead keeps the full catalog in
 * the static HTML and narrows it on hydration. Writes go through
 * `history.replaceState`, which updates the URL without a router round trip for
 * what is purely a client-side view change.
 */

export type SortKey = "featured" | "price-asc" | "price-desc";

/** The query parameter the chips write to, beside `FACET_PARAM`. */
export const COLLECTION_PARAM = "collection";

export interface CollectionGridItem {
  id: string;
  /** Product name — interpolated into the wishlist button's accessible label. */
  name: string;
  /** The sort key. Smallest currency unit, per AGENTS.md §9. */
  priceInCents: number;
  /** Parent collection — what the chip row filters on. */
  collectionSlug: string;
  /** Every merchandising cut this product belongs to — see `productFacets()`. */
  facets: readonly ProductFacet[];
  /** The server-rendered `<ProductCard>`. */
  card: ReactNode;
}

/** One filter chip: a collection and its name as stored. */
export interface CollectionOption {
  slug: string;
  label: string;
}

export interface CollectionGridProps {
  items: CollectionGridItem[];
  /**
   * The filter chips. Omitted on a single-collection page, which is already a
   * filtered view — a filter with one possible value is not one.
   */
  collections?: readonly CollectionOption[];
  /**
   * Translated names for the merchandising cuts, for the active-cut line. Always
   * passed: a `?facet=` URL can be opened on either route.
   */
  facetLabels: Readonly<Record<ProductFacet, string>>;
  /**
   * The collection description, server-rendered. It shares a bar with the sort
   * control, and the sort control's state lives here — so the bar is assembled
   * in this component from a slot rather than duplicated in the page.
   */
  description: ReactNode;
  /**
   * The server-rendered collection tab bar. Set on `/collections/[slug]`, where
   * moving between collections is navigation rather than filtering; the overview
   * passes nothing and gets the chip row above instead.
   */
  tabs?: ReactNode;
}

export default function CollectionGrid({
  items,
  collections,
  facetLabels,
  description,
  tabs,
}: CollectionGridProps) {
  const dict = useDictionary();
  const [sort, setSort] = useState<SortKey>("featured");
  const [collection, setCollection] = useState<string | null>(null);
  const [facet, setFacet] = useState<ProductFacet | null>(null);

  /**
   * Wishlist membership comes from the shared store, so a heart filled here is
   * the same heart filled on the product page and the same entry listed on
   * `/wishlist`. State is persisted to `localStorage`; there is no `Wishlist`
   * table and no Clerk session yet, and when both land this becomes a Server
   * Action call with the button below unchanged.
   */
  const wishlist = useWishlist();

  /**
   * Only collections with something in them are offered — the `<MerchGrid>`
   * rule: a chip that filters to nothing is a dead affordance, and an emptied
   * collection should take its chip with it rather than wait for a code change.
   */
  const available = useMemo(() => {
    if (!collections) return [];
    const present = new Set(items.map((item) => item.collectionSlug));
    return collections.filter((option) => present.has(option.slug));
  }, [collections, items]);

  /*
   * Adopt both parameters on mount, and again whenever the visitor uses the Back
   * button — `history.replaceState` below does not fire `popstate` itself, but
   * arriving here from a Nav link that carried a cut does. An unrecognised value
   * resolves to `null` on either parameter, so a mistyped URL shows the whole
   * catalog rather than an empty grid.
   */
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);

      const slug = params.get(COLLECTION_PARAM);
      setCollection(
        available.some((option) => option.slug === slug) ? slug : null,
      );

      setFacet(parseFacet(params.get(FACET_PARAM)));
    };

    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
    // `available` is derived from the props; a catalog edit re-validates the slug.
  }, [available]);

  /** One writer for both parameters, so the URL never disagrees with the view. */
  const writeParam = (param: string, value: string | null) => {
    const url = new URL(window.location.href);

    if (value === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, value);
    }

    window.history.replaceState(null, "", url);
  };

  const selectCollection = (next: string | null) => {
    setCollection(next);
    writeParam(COLLECTION_PARAM, next);
  };

  const clearFacet = () => {
    setFacet(null);
    writeParam(FACET_PARAM, null);
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (collection === null || item.collectionSlug === collection) &&
          (facet === null || item.facets.includes(facet)),
      ),
    [items, collection, facet],
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

      {/* ── COLLECTION TABS (single-collection route) ── */}
      {tabs}

      {/* ── COLLECTION FILTER (overview) ────────────── */}
      {available.length > 0 ? (
        <nav
          aria-label={dict.collections.filterByCollection}
          className="border-b border-border bg-surface"
        >
          <div className="mx-auto flex max-w-350 items-center gap-2.5 overflow-x-auto px-6 py-4 md:px-20">
            <FilterChip
              label={dict.collections.tabAll}
              isActive={collection === null}
              onSelect={() => selectCollection(null)}
            />

            {available.map((option) => (
              <FilterChip
                key={option.slug}
                /*
                 * Collection names are translated database columns since
                 * `0007_i18n_content.sql`, so which direction a label runs is a
                 * runtime fact about the row — `dir="auto"` resolves it from the
                 * text that actually rendered.
                 */
                label={option.label}
                isActive={collection === option.slug}
                onSelect={() => selectCollection(option.slug)}
              />
            ))}
          </div>
        </nav>
      ) : null}

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="bg-background px-6 pb-24 pt-16 md:px-20 md:pb-36">
        {/*
         * The active merchandising cut. It has no chip of its own — it was
         * entered from the Nav or the Footer — so without this line a visitor
         * would face a catalog that is quietly two thirds shorter than it should
         * be, with nothing to press to widen it.
         */}
        {facet !== null ? (
          <div className="mx-auto mb-10 flex max-w-350 items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-ivory/35">
            <span className="text-gold/70">{facetLabels[facet]}</span>

            <button
              type="button"
              onClick={clearFacet}
              className="cursor-pointer border-b border-transparent pb-0.5 uppercase tracking-[0.2em] transition-colors duration-300 ease-out hover:border-gold/50 hover:text-gold focus-visible:border-gold focus-visible:text-gold focus-visible:outline-none"
            >
              {dict.collections.clearFilter}
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
            key={`${collection ?? "all"}-${facet ?? "all"}-${sort}`}
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
 * A bordered pill rather than the underlined tab used on the single-collection
 * route: the pill reads as a control that acts on the grid in place, which is
 * exactly what it does, while an underlined tab reads as a destination.
 *
 * `dir="auto"` on the label: collection names come from the database, and the
 * Arabic tree renders Arabic names where a row has them and the English
 * fallback where it does not.
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
          ? "border-gold/70 bg-gold/10 text-gold"
          : "border-white/10 text-ivory/40 hover:border-gold/40 hover:text-ivory/70"
      }`}
    >
      {label}
    </button>
  );
}
