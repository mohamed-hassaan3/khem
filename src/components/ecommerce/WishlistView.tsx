"use client";

import { Heart } from "lucide-react";
import { useMemo } from "react";

import EmptyState from "@/src/components/ecommerce/EmptyState";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import WishlistCard from "@/src/components/ecommerce/WishlistCard";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * Saved fragrances — the one client island on `/wishlist`.
 *
 * Resolves stored ids against the server-supplied catalog, exactly as
 * `<CartView>` does; see its notes for why the whole catalog is passed and why
 * an unresolvable id is dropped rather than rendered.
 */

export interface WishlistViewProps {
  locale: Locale;
  catalog: readonly ProductCardData[];
}

export default function WishlistView({ locale, catalog }: WishlistViewProps) {
  const dict = useDictionary();
  const { ids, isHydrated, remove } = useWishlist();

  const productsById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );

  // Newest save first — the store appends, so the display order is reversed.
  const products = useMemo(
    () =>
      [...ids]
        .reverse()
        .flatMap((id) => {
          const product = productsById.get(id);
          return product ? [product] : [];
        }),
    [ids, productsById],
  );

  const header = (
    <PageHeader
      eyebrow={dict.wishlist.eyebrow}
      heading={dict.wishlist.heading}
      meta={
        isHydrated && products.length > 0
          ? products.length === 1
            ? dict.wishlist.itemCountOne
            : interpolate(dict.wishlist.itemCount, { count: products.length })
          : undefined
      }
      metaLive
    />
  );

  // See `<CartView>`: the empty state must not flash before the store is read.
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
        {header}
        <div className="min-h-[60vh]" aria-hidden="true" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
        {header}
        <EmptyState
          icon={Heart}
          heading={dict.wishlist.empty.heading}
          body={dict.wishlist.empty.body}
          cta={dict.wishlist.empty.cta}
          href="/collections"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 text-ivory">
      {header}

      <section className="px-6 py-14 sm:px-8 lg:px-14 lg:py-20 xl:px-20">
        {/* `gap-px` over `bg-border` draws the hairline seams as the grid wraps,
            which a fixed three-column grid could not do below 1024px. */}
        <div className="mx-auto grid max-w-350 grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <WishlistCard
              key={product.id}
              product={product}
              locale={locale}
              onRemove={() => remove(product.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
