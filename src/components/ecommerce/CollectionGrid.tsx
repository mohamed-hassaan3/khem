"use client";

import { ChevronDown, Heart } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Sort control + product grid.
 *
 * Sorting is client-side on purpose: driving it from `?sort=` would opt the
 * route out of ISR (AGENTS.md §8 lists the collection pages as static/ISR).
 *
 * The cards themselves are rendered on the *server* and handed over as
 * `ReactNode`s — `<ProductCard>` is an async Server Component, so re-authoring
 * its markup here would fork the card design and drag the catalog projection
 * across the client boundary. This component only reorders the nodes it is
 * given and overlays the wishlist control.
 */

export type SortKey = "featured" | "price-asc" | "price-desc";

export interface CollectionGridItem {
  id: string;
  /** Product name — interpolated into the wishlist button's accessible label. */
  name: string;
  /** The sort key. Smallest currency unit, per AGENTS.md §9. */
  priceInCents: number;
  /** The server-rendered `<ProductCard>`. */
  card: ReactNode;
}

export interface CollectionGridProps {
  items: CollectionGridItem[];
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
  description,
  tabs,
}: CollectionGridProps) {
  const dict = useDictionary();
  const [sort, setSort] = useState<SortKey>("featured");

  /**
   * Wishlist membership is in-memory and per-session — the same behaviour the
   * page had before. There is no `Wishlist` service and no Clerk session yet;
   * when both land, this becomes a Server Action call and the button below is
   * unchanged.
   */
  const [wishlist, setWishlist] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => {
    // A copy: the prop array belongs to the caller.
    const next = [...items];

    if (sort === "price-asc") {
      next.sort((a, b) => a.priceInCents - b.priceInCents);
    } else if (sort === "price-desc") {
      next.sort((a, b) => b.priceInCents - a.priceInCents);
    }

    return next;
  }, [items, sort]);

  const toggleWishlist = (id: string) => {
    setWishlist((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

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

      {/* ── PRODUCT GRID ────────────────────────────── */}
      <section className="bg-background px-6 pb-24 pt-16 md:px-20 md:pb-36">
        {sorted.length > 0 ? (
          <div className="mx-auto grid max-w-350 grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((item) => {
              const isSaved = wishlist.has(item.id);

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
                    onClick={() => toggleWishlist(item.id)}
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
