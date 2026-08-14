"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";

import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { lineTotalInCents, quantityCeiling } from "@/src/lib/cart";
import { formatProductType, formatVolume } from "@/src/lib/format";
import { productHref } from "@/src/lib/routes";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * One line in the shopping bag.
 *
 * Takes the resolved catalog record, not the stored line: the persisted cart
 * holds only an id and a quantity, so price, name, and image arrive here from
 * the server-fetched projection and are always current.
 */

export interface CartLineProps {
  product: ProductCardData;
  quantity: number;
  locale: Locale;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartLine({
  product,
  quantity,
  locale,
  onQuantityChange,
  onRemove,
}: CartLineProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const island = ltrIsland(locale);

  const maxQuantity = quantityCeiling(product.inventory);

  return (
    <article className="grid grid-cols-[88px_1fr] items-start gap-5 border-b border-border py-7 sm:grid-cols-[120px_1fr] sm:gap-7">
      <LocaleLink
        href={productHref(product)}
        className="img-zoom relative block aspect-3/4 overflow-hidden bg-surface"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={product.primaryImage.url}
          alt=""
          fill
          sizes="120px"
          className="object-cover brightness-75"
        />
      </LocaleLink>

      <div>
        <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-gold/60">
              {interpolate(dict.product.collectionLabel, {
                name: product.collectionName,
              })}
            </p>
            {/* Catalog records are English in both trees. */}
            <h2 className="font-heading text-base font-normal tracking-wide text-ivory sm:text-lg" {...island}>
              <LocaleLink
                href={productHref(product)}
                className="transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
              >
                {product.name}
              </LocaleLink>
            </h2>
          </div>

          <span className="font-heading text-base tabular-nums text-gold sm:text-lg" {...island}>
            {formatPrice(lineTotalInCents({ priceInCents: product.priceInCents, quantity }))}
          </span>
        </div>

        {/* Translated in both trees — no LTR island; the bidi algorithm places
            the Latin volume token correctly inside the Arabic run. */}
        <p className="mb-5 text-[11px] tracking-[0.1em] text-ivory/35">
          {formatProductType(product, dict.product.concentrations)} ·{" "}
          {formatVolume(product.volumeMl)}
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <QuantityStepper
            value={quantity}
            max={maxQuantity}
            onChange={onQuantityChange}
            decreaseLabel={dict.product.decreaseQuantity}
            increaseLabel={dict.product.increaseQuantity}
          />

          <button
            type="button"
            onClick={onRemove}
            aria-label={interpolate(dict.cart.remove, { name: product.name })}
            className="inline-flex items-center gap-2 font-heading text-[11px] tracking-[0.1em] text-ivory/25 transition-colors duration-300 ease-out hover:text-ivory/60 focus-visible:text-gold focus-visible:outline-none"
          >
            <Trash2 size={13} strokeWidth={1.25} aria-hidden="true" />
            {dict.cart.removeLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
