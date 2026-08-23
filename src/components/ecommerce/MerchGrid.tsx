"use client";

import { useMemo, useState } from "react";

import Reveal from "@/src/components/animation/Reveal";
import MerchCard from "@/src/components/ecommerce/MerchCard";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * The product grid for the body care and home fragrance collections, with an
 * optional format filter.
 *
 * The filter values are **derived from the products themselves** — the original
 * home-fragrance page shipped six hardcoded English buttons (Candles,
 * Diffusers, Incense, Gift Sets) that filtered nothing and named goods that do
 * not exist. Here the bar lists the distinct `format` values actually present,
 * and hides itself entirely below two of them, so today's single-product
 * category shows no dead affordance and tomorrow's second format brings the bar
 * back with no code change.
 *
 * Filtering is client-side on the `<CollectionGrid>` precedent: a `?type=`
 * search param would opt the route out of ISR.
 */

export interface MerchGridProps {
  items: readonly ProductCardData[];
  locale: Locale;
  /** Empty-state copy for this category. */
  emptyLabel: string;
  /** Offer the format filter. `/body-care` does not. */
  showFilters?: boolean;
}

/** Sentinel for "no filter applied" — never a real `format` value. */
const ALL = "__all__";

export default function MerchGrid({
  items,
  locale,
  emptyLabel,
  showFilters = false,
}: MerchGridProps) {
  const dict = useDictionary();
  // Format labels are catalog data — English in both trees.
  const island = ltrIsland(locale);

  const formats = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      if (item.format !== null) seen.add(item.format);
    }
    return [...seen];
  }, [items]);

  const [active, setActive] = useState<string>(ALL);

  const visible = useMemo(
    () => (active === ALL ? items : items.filter((i) => i.format === active)),
    [items, active],
  );

  const showBar = showFilters && formats.length > 1;

  return (
    <>
      {showBar ? (
        <nav
          aria-label={dict.homeFragrance.filterLabel}
          className="border-b border-border bg-surface"
        >
          <div className="mx-auto flex max-w-350 gap-5 md:gap-9 overflow-x-auto px-4 md:px-20">
            <FilterTab
              label={dict.homeFragrance.filterAll}
              isActive={active === ALL}
              onSelect={() => setActive(ALL)}
            />

            {formats.map((format) => (
              <FilterTab
                key={format}
                label={format}
                isActive={active === format}
                onSelect={() => setActive(format)}
                island={island}
              />
            ))}
          </div>
        </nav>
      ) : null}

      <section className="bg-background px-4 py-12 md:px-20 md:pb-32">
        <div className="mx-auto max-w-350">
          {visible.length === 0 ? (
            <p className="py-14 md:py-24 text-center text-[13px] leading-loose text-ivory/35">
              {emptyLabel}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-3">
              {visible.map((product, index) => (
                <Reveal key={product.id} delay={(index % 3) * 0.1}>
                  <MerchCard product={product} locale={locale} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** One tab in the format bar. Styling mirrors `<CollectionView>`'s tabs. */
function FilterTab({
  label,
  isActive,
  onSelect,
  island,
}: {
  label: string;
  isActive: boolean;
  onSelect: () => void;
  island?: ReturnType<typeof ltrIsland>;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.2em] transition-colors duration-300 ease-out focus-visible:text-gold focus-visible:outline-none ${
        isActive
          ? "border-gold text-gold"
          : "border-transparent text-ivory/40 hover:text-ivory/70"
      }`}
      {...island}
    >
      {label}
    </button>
  );
}
