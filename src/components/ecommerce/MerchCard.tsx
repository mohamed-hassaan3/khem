"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A body-care or home-fragrance product, sold straight from the card.
 *
 * The card still carries the buy control itself, as the original design did:
 * these goods now *have* a detail page (`/ritual/[slug]`), but reaching it
 * should be an offer, not a toll on the way to the bag. So the photograph and
 * the name are links and everything else is unchanged — one click still adds.
 *
 * Cart writes go to the `localStorage`-backed store, which persists a product
 * id and a quantity: when the bag moves to Supabase the handler becomes a
 * Server Action call and this markup is unchanged.
 *
 * A sibling of `<ProductCard>` rather than a wrapper: that one is an async
 * Server Component whose *whole surface* is a link to the detail page, which
 * would swallow the buy button if it were reused here. What the two do share is
 * `<AddToBagButton>`, overlaid on the same corner of both.
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

  const isSoldOut = product.inventory === 0;

  // Same order as every other card: the stored `badge` overrides the flag.
  const flag = productFlag(product);
  const href = productHref(product);

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

      {/*
       * The same corner bag the perfume cards carry, so one gesture means the
       * same thing everywhere in the catalogue. It does not replace the
       * full-width button below — that one is this card's primary control and
       * reports its own confirmation — it adds the one-tap path the grids had
       * and this card did not. The flag sits at `start-5 top-5` and the bag at
       * `end-5 top-5`, so the two corners never meet, in either direction.
       */}
      <AddToBagButton
        productId={product.id}
        name={product.name}
        inventory={product.inventory}
      />

      {/* `tabIndex={-1}` and an empty alt: this is the same destination as the
          name below it, and a screen reader announcing the link twice — once as
          the photograph, once as the heading — is noise, not navigation. */}
      <LocaleLink
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-3/4 overflow-hidden bg-card"
      >
        <Image
          src={product.primaryImage.url}
          alt=""
          fill
          sizes={sizes}
          className="object-cover brightness-65 saturate-60"
        />
      </LocaleLink>

      <div className="flex flex-1 flex-col p-7">
        <div dir="auto" className="flex flex-1 flex-col">
          <p className="eyebrow mb-2.5 text-[9px] text-gold/55">
            {product.format ?? product.collectionName}
            {product.subtitle ? ` · ${product.subtitle}` : ""}
          </p>

          {/* Latin proper noun in both trees. The heading carries the link, so
              the photograph above can stay out of the tab order. */}
          <h3 {...island} className="mb-2.5 font-heading text-lg font-normal">
            <LocaleLink
              href={href}
              className="text-ivory no-underline transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
            >
              {product.name}
            </LocaleLink>
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
