"use client";

import { Check, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatPrice, formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A saved fragrance.
 *
 * A sibling of `<ProductCard>` rather than a wrapper around it: this card adds
 * a remove control and an add-to-cart button, and needs client state for the
 * confirmation, while `<ProductCard>` is an async Server Component. The shared
 * parts are the image treatment, the note pills, and the price row.
 */

const CONFIRMATION_MS = 2500;

export interface WishlistCardProps {
  product: ProductCardData;
  locale: Locale;
  onRemove: () => void;
}

const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default function WishlistCard({
  product,
  locale,
  onRemove,
}: WishlistCardProps) {
  const dict = useDictionary();
  const { addLine } = useCart();
  const island = ltrIsland(locale);

  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clearing on unmount — and before each restart — keeps a fast double-click,
  // or a removal mid-confirmation, from leaving a stale timer behind.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isSoldOut = product.inventory === 0;

  const handleAddToCart = () => {
    addLine(product.id, 1, product.inventory);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setJustAdded(true);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRMATION_MS);
  };

  const notes = [
    product.topNotes[0],
    product.heartNotes[0],
    product.baseNotes[0],
  ].filter(Boolean);

  return (
    <article className="relative bg-surface">
      {/* Logical inset, so the control mirrors to the top-left in Arabic. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={interpolate(dict.wishlist.remove, { name: product.name })}
        className="absolute end-4 top-4 z-2 grid size-8 place-items-center border border-white/10 bg-background/70 text-ivory/50 backdrop-blur-sm transition-colors duration-300 ease-out hover:border-gold hover:text-gold focus-visible:border-gold focus-visible:text-gold focus-visible:outline-none"
      >
        <X size={13} strokeWidth={1.25} aria-hidden="true" />
      </button>

      <LocaleLink
        href={`/perfume/${product.slug}`}
        className="img-zoom block no-underline"
      >
        <div className="relative aspect-3/4 overflow-hidden bg-card">
          <Image
            src={product.primaryImage.url}
            alt={product.primaryImage.alt}
            fill
            sizes={CARD_SIZES}
            className="object-cover brightness-75"
          />
        </div>
      </LocaleLink>

      <div className="px-6 pb-8 pt-7">
        <p className="mb-2.5 text-[9px] uppercase tracking-[0.2em] text-gold/60">
          {interpolate(dict.product.collectionLabel, {
            name: product.collectionName,
          })}
        </p>

        {/* Catalog records are English in both trees. */}
        <div {...island}>
          <h2 className="mb-2 font-heading text-lg font-normal text-ivory">
            <LocaleLink
              href={`/perfume/${product.slug}`}
              className="transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
            >
              {product.name}
            </LocaleLink>
          </h2>

          {product.subtitle ? (
            <p className="mb-4 text-xs text-ivory/40">{product.subtitle}</p>
          ) : null}

          <div className="mb-5 flex flex-wrap gap-1.5">
            {notes.map((note) => (
              <span
                key={note}
                className="border border-gold/20 bg-gold/5 px-2 py-0.5 text-[9px] tracking-widest text-gold/70"
              >
                {note}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between border-t border-border pt-4">
          <span className="font-heading text-lg text-gold">
            {formatPrice(product.priceInCents)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-ivory/30">
            {formatVolume(product.volumeMl)}
          </span>
        </div>

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
              <Check size={13} strokeWidth={1.25} aria-hidden="true" />
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
