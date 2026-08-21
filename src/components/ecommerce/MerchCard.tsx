"use client";

import { Check, Heart } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A body-care or home-fragrance product, sold straight from the card.
 *
 * These goods have no detail page — there is no pyramid to unfold and no story
 * to tell at length — so the card carries the buy control itself, exactly as
 * the original design did. Cart and wishlist writes go to the
 * `localStorage`-backed stores, which persist a product id and a quantity:
 * when Clerk and Supabase land, the two handlers become Server Action calls and
 * this markup is unchanged.
 *
 * A sibling of `<ProductCard>` rather than a wrapper: that one is an async
 * Server Component whose whole surface is a link to a PDP, which is precisely
 * what does not apply here.
 */

const CONFIRMATION_MS = 2500;

export interface MerchCardProps {
  product: ProductCardData;
  locale: Locale;
  sizes?: string;
}

const DEFAULT_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default function MerchCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: MerchCardProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const { addLine } = useCart();
  const wishlist = useWishlist();
  // Product copy comes from the database — English in both trees.
  const island = ltrIsland(locale);

  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clearing on unmount, and before each restart, keeps a fast double-click
  // from leaving the button stuck in its confirmed state.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  /*
   * Derived from the store, never local: the same product's heart on
   * `/wishlist` has to agree with this one, and a returning visitor must find
   * it already filled. `isHydrated` gates it because the server render cannot
   * know what is saved.
   */
  const wishlisted = wishlist.isHydrated && wishlist.has(product.id);
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
      {product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      {/* Logical inset, so the control mirrors to the top-left in Arabic. */}
      <button
        type="button"
        aria-pressed={wishlisted}
        aria-label={interpolate(
          wishlisted ? dict.product.wishlistRemove : dict.product.wishlistAdd,
          { name: product.name },
        )}
        onClick={() => wishlist.toggle(product.id)}
        className={`absolute end-5 top-5 z-2 grid size-9 place-items-center border bg-background/70 backdrop-blur-sm transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none ${
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

      <div className="relative aspect-3/4 overflow-hidden bg-card">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover brightness-65 saturate-60"
        />
      </div>

      <div className="flex flex-1 flex-col p-7">
        <div dir="auto" className="flex flex-1 flex-col">
          <p className="eyebrow mb-2.5 text-[9px] text-gold/55">
            {product.format ?? product.collectionName}
            {product.subtitle ? ` · ${product.subtitle}` : ""}
          </p>

          {/* Latin proper noun in both trees. */}
          <h3
            {...island}
            className="mb-2.5 font-heading text-lg font-normal text-ivory"
          >
            {product.name}
          </h3>

          <p className="mb-6 flex-1 text-xs leading-loose text-ivory/40">
            {product.description}
          </p>
        </div>

        <div className="mb-5 flex items-center justify-between border-t border-border pt-4">
          <span className="font-heading text-lg tabular-nums text-gold">
            {formatPrice(product.priceInCents)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-ivory/30">
            {formatVolume(product.volumeMl)}
          </span>
        </div>

        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleAddToCart}
          className="btn-luxury w-full justify-center disabled:pointer-events-none disabled:opacity-40"
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
