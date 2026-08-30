"use client";

import Image from "next/image";

import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { lineTotalInCents, quantityCeiling } from "@/src/lib/cart";
import { unitPriceInCents } from "@/src/lib/pricing";
import { formatProductType, formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * One line in the cart panel.
 *
 * A sibling of `<CartLine>`, not a variant of it. That component lays a
 * 120px thumbnail beside a two-column row of name, price, stepper, and remove
 * — a shape that needs the full width of the `/cart` grid and has nowhere to
 * go in a 400px panel. The data contract and the price arithmetic are shared
 * (`lineTotalInCents`, `quantityCeiling`); only the arrangement differs.
 *
 * Like `<CartLine>` it takes the *resolved* catalog record rather than the
 * stored line: the persisted bag holds an id and a quantity, so every string
 * printed here arrives from the server projection and is always current.
 */

export interface CartDrawerLineProps {
  product: ProductCardData;
  quantity: number;
  locale: Locale;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  /** Closes the panel — a product link inside a modal must not leave it open. */
  onNavigate: () => void;
}

export default function CartDrawerLine({
  product,
  quantity,
  locale,
  onQuantityChange,
  onRemove,
  onNavigate,
}: CartDrawerLineProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  // Catalog records are English in both trees.
  const island = ltrIsland(locale);

  const maxQuantity = quantityCeiling(product.inventory);

  return (
    <article className="grid grid-cols-[72px_1fr] items-start gap-4 border-b border-ground-border py-6 last:border-b-0">
      {/* `tabIndex={-1}` and an empty alt: the name below is the same
          destination, and a panel this narrow cannot afford to announce it
          twice. */}
      <LocaleLink
        href={productHref(product)}
        tabIndex={-1}
        aria-hidden="true"
        onClick={onNavigate}
        className="relative block aspect-3/4 overflow-hidden bg-[var(--card-bg)]"
      >
        <Image
          src={product.primaryImage.url}
          alt=""
          fill
          sizes="72px"
          className="object-cover brightness-75"
        />
      </LocaleLink>

      <div className="min-w-0">
        <h3
          {...island}
          className="mb-1 truncate font-heading text-sm font-normal tracking-wide text-ground"
        >
          <LocaleLink
            href={productHref(product)}
            onClick={onNavigate}
            className="transition-colors duration-300 ease-out hover:text-ground-accent focus-visible:text-ground-accent focus-visible:outline-none"
          >
            {product.name}
          </LocaleLink>
        </h3>

        {/* Translated in both trees, so no LTR island — the bidi algorithm
            places the Latin volume token correctly inside the Arabic run. */}
        <p className="mb-4 text-[10px] tracking-[0.1em] text-ground-muted">
          {formatProductType(product, dict.product.concentrations)} ·{" "}
          {formatVolume(product.volumeMl)}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <QuantityStepper
            value={quantity}
            max={maxQuantity}
            onChange={onQuantityChange}
            decreaseLabel={dict.product.decreaseQuantity}
            increaseLabel={dict.product.increaseQuantity}
          />

          <span
            {...island}
            className="font-heading text-sm tabular-nums text-ground-accent"
          >
            {formatPrice(
              lineTotalInCents({
                priceInCents: unitPriceInCents(product),
                quantity,
              }),
            )}
          </span>
        </div>

        {/*
         * A text control rather than the trash glyph `<CartLine>` uses: at this
         * width the icon would sit alone under the stepper reading as an
         * ornament, and the word is unambiguous in a panel that has no other
         * destructive action.
         */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={interpolate(dict.cart.remove, { name: product.name })}
          className="mt-3 cursor-pointer font-heading text-[10px] uppercase tracking-[0.15em] text-ground-muted/70 transition-colors duration-300 ease-out hover:text-ground-muted focus-visible:text-ground-accent focus-visible:outline-none"
        >
          {dict.cart.removeLabel}
        </button>
      </div>
    </article>
  );
}
