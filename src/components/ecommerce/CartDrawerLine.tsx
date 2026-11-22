"use client";

import Image from "next/image";

import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { lineTotalInCents, quantityCeiling } from "@/src/lib/cart";
import { unitPriceInCents } from "@/src/lib/pricing";
import {
  formatProductType,
  formatVolume,
  joinTokens,
} from "@/src/lib/format";
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
  /** Closes the drawer when a link is followed; absent on the `/cart` page. */
  onNavigate?: () => void;
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
    <article className="grid grid-cols-[72px_1fr] items-start gap-3.5 border-t border-ground-border py-4 first:border-t-0">
      {/* The image repeats the name link, so it is hidden from assistive tech. */}
      <LocaleLink
        href={productHref(product)}
        tabIndex={-1}
        aria-hidden="true"
        onClick={onNavigate}
        className="relative block h-23 overflow-hidden rounded-md bg-[var(--card-bg)]"
      >
        <Image
          src={product.primaryImage.url}
          alt=""
          fill
          sizes="72px"
          className="object-cover"
        />
      </LocaleLink>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            {...island}
            className="min-w-0 truncate font-heading text-sm font-normal tracking-wide text-ground"
          >
            <LocaleLink
              href={productHref(product)}
              onClick={onNavigate}
              className="transition-colors duration-300 ease-out hover:text-ground-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
            >
              {product.name}
            </LocaleLink>
          </h3>
          <span {...island} className="shrink-0 text-[13px] tabular-nums text-ground">
            {formatPrice(
              lineTotalInCents({
                priceInCents: unitPriceInCents(product),
                quantity,
              }),
            )}
          </span>
        </div>

        <p className="mt-0.5 text-[11px] text-ground-muted">
          {joinTokens(
            formatProductType(product, dict.product.concentrations),
            formatVolume(product.volumeMl),
          )}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-3">
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
            className="min-h-11 cursor-pointer px-1 text-[11px] uppercase tracking-[0.12em] text-ground-muted transition-colors duration-300 ease-out hover:text-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
          >
            {dict.cart.removeLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
