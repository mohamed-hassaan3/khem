"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import { productFlag } from "@/src/lib/facets";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A discovery set — a `<MerchCard>` with two additions a set needs: the
 * merchandising badge and the contents list.
 *
 * Kept separate rather than folded into `<MerchCard>` behind two flags: the
 * contents list changes the card's whole vertical rhythm (square image, list
 * block, buttons pinned to the bottom of an equal-height column), which is more
 * than a variant.
 */

const CONFIRMATION_MS = 2500;

export interface DiscoverySetCardProps {
  product: ProductCardData;
  locale: Locale;
  sizes?: string;
}

/*
 * Two columns from the narrowest viewport up — no breakpoint renders this card
 * at full width any more, so the old `100vw` tail only oversized the download.
 */
const DEFAULT_SIZES = "(min-width: 1024px) 33vw, 50vw";

export default function DiscoverySetCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: DiscoverySetCardProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const { addLine } = useCart();
  // Set names and contents come from the database — English in both trees.
  const island = ltrIsland(locale);

  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isSoldOut = product.inventory === 0;

  // Same order as every other card: the stored `badge` overrides the flag.
  const flag = productFlag(product);

  const handleAddToCart = () => {
    addLine(product.id, 1, product.inventory);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setJustAdded(true);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRMATION_MS);
  };

  return (
    <article className="img-zoom relative flex flex-col bg-surface">
      {/*
       * The badge sits in the inline-**start** corner, which is where all three
       * card types put it. The end corner is left clear: `<ProductCard>` spends
       * it on the add-to-bag control, and a set carries its own buy button
       * below, so nothing should compete for the space here.
       */}
      {product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      <div className="relative aspect-square overflow-hidden bg-card">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover brightness-65 saturate-50"
        />
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-8">
        <div {...island} className="flex flex-1 flex-col">
          {product.format ? (
            <p className="eyebrow mb-2 text-[9px] sm:mb-3">{product.format}</p>
          ) : null}

          <h2 className="mb-3 font-heading text-sm font-normal leading-snug text-ivory sm:mb-5 sm:text-xl md:text-2xl">
            {product.name}
          </h2>

          {/*
            The contents list below is what sells a boxed set, so on the two-up
            mobile grid it keeps the space and the prose gives it up. The
            wrapping div holds `flex-1`, so the price and button still
            bottom-align across a row.
          */}
          <p className="mb-7 hidden flex-1 text-xs leading-loose text-ivory/45 sm:block">
            {product.description}
          </p>

          {product.includes.length > 0 ? (
            <div className="mb-5 sm:mb-8">
              <p className="eyebrow mb-2 text-[9px] text-gold/50 sm:mb-3">
                {dict.discovery.includes}
              </p>

              <ul className="list-none">
                {product.includes.map((entry) => (
                  <li
                    key={entry}
                    className="mb-1.5 flex items-center gap-2 text-[10px] tracking-wide text-ivory/50 sm:mb-2 sm:gap-2.5 sm:text-[11px]"
                  >
                    <Check
                      size={12}
                      strokeWidth={1.25}
                      aria-hidden="true"
                      className="shrink-0 text-gold"
                    />
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="mb-3 font-heading text-base tabular-nums text-gold sm:mb-5 sm:text-2xl">
          {formatPrice(product.priceInCents)}
        </p>

        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleAddToCart}
          className="btn-luxury btn-luxury-fill w-full justify-center disabled:pointer-events-none disabled:opacity-40"
        >
          {isSoldOut ? (
            dict.product.soldOut
          ) : justAdded ? (
            <>
              <Check size={14} strokeWidth={1.25} aria-hidden="true" />
              {dict.product.added}
            </>
          ) : (
            dict.product.addToCart
          )}
        </button>
      </div>
    </article>
  );
}
