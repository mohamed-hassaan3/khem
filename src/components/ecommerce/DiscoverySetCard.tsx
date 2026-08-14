"use client";

import { Check, Heart } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";
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

const DEFAULT_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default function DiscoverySetCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: DiscoverySetCardProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const { addLine } = useCart();
  const wishlist = useWishlist();
  // Set names and contents come from `src/data` — English in both trees.
  const island = ltrIsland(locale);

  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const wishlisted = wishlist.isHydrated && wishlist.has(product.id);
  const isSoldOut = product.inventory === 0;

  const handleAddToCart = () => {
    addLine(product.id, 1, product.inventory);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setJustAdded(true);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRMATION_MS);
  };

  return (
    <article className="img-zoom relative flex flex-col bg-surface">
      {/*
       * Badge at the end of the line, wishlist at the start: the two controls
       * both want the top corner, and both insets are logical, so they swap
       * sides together in Arabic and never collide.
       */}
      {product.badge ? (
        <p
          className="absolute end-5 top-5 z-2 bg-gold px-3 py-1.5 font-heading text-[9px] font-semibold tracking-[0.2em] text-background"
          {...island}
        >
          {product.badge}
        </p>
      ) : null}

      <button
        type="button"
        aria-pressed={wishlisted}
        aria-label={interpolate(
          wishlisted ? dict.product.wishlistRemove : dict.product.wishlistAdd,
          { name: product.name },
        )}
        onClick={() => wishlist.toggle(product.id)}
        className={`absolute start-5 top-5 z-2 grid size-9 place-items-center border bg-background/70 backdrop-blur-sm transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none ${
          wishlisted ? "border-gold" : "border-white/10"
        }`}
      >
        <Heart
          size={14}
          strokeWidth={1.25}
          aria-hidden="true"
          className={wishlisted ? "fill-current text-gold" : "text-ivory/50"}
        />
      </button>

      <div className="relative aspect-square overflow-hidden bg-card">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover brightness-65 saturate-50"
        />
      </div>

      <div className="flex flex-1 flex-col p-8">
        <div {...island} className="flex flex-1 flex-col">
          {product.format ? (
            <p className="eyebrow mb-3 text-[9px]">{product.format}</p>
          ) : null}

          <h2 className="mb-5 font-heading text-xl font-normal leading-snug text-ivory sm:text-2xl">
            {product.name}
          </h2>

          <p className="mb-7 flex-1 text-xs leading-loose text-ivory/45">
            {product.description}
          </p>

          {product.includes.length > 0 ? (
            <div className="mb-8">
              <p className="eyebrow mb-3 text-[9px] text-gold/50">
                {dict.discovery.includes}
              </p>

              <ul className="list-none">
                {product.includes.map((entry) => (
                  <li
                    key={entry}
                    className="mb-2 flex items-center gap-2.5 text-[11px] tracking-wide text-ivory/50"
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

        <p className="mb-5 font-heading text-2xl tabular-nums text-gold">
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
