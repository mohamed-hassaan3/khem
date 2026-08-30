"use client";

import Image from "next/image";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A body-care or home-fragrance product, as a card.
 *
 * One buy control, in the corner, exactly as the perfume cards have: the
 * full-width button this card used to carry said the same thing twice and said
 * it differently on two halves of the same catalogue. The photograph and the
 * name are links to the detail page (`/ritual/[slug]`); the bag adds without
 * leaving the grid.
 *
 * A sibling of `<ProductCard>` rather than a wrapper, because that one is an
 * async Server Component and this one needs the dictionary on the client. What
 * they now share is their *structure*: an `<article>` with a stretched link, the
 * bag as a real sibling of that anchor in the price row, one clamped line of
 * name and two of copy, and `mt-auto` bottom-aligning the price. A shopper
 * moving between `/collections` and `/collections/body-care` should not be able
 * to tell that two components are involved.
 *
 * The photograph is no longer a separate `tabIndex={-1}` link: the stretched
 * anchor covers it, so there is exactly one link per card and nothing to
 * announce twice.
 */

export interface MerchCardProps {
  product: ProductCardData;
  locale: Locale;
  sizes?: string;
}

/* Matched to the 2 / 3 / 4 grid. See `<ProductCard>` for the reasoning. */
const DEFAULT_SIZES =
  "(min-width: 1400px) 350px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

export default function MerchCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: MerchCardProps) {
  const dict = useDictionary();
  // Product copy comes from the database — English in both trees.
  const island = ltrIsland(locale);

  /*
   * A product that cannot be bought has no business leading with "Best Seller",
   * so this takes the corner slot from both the stored badge and the flag —
   * muted rather than gold, because it is a withdrawal and not a claim. It is
   * also now the only place this card says so: the button that used to report
   * it is gone.
   */
  const isSoldOut = product.inventory === 0;

  // Same order as every other card: the stored `badge` overrides the flag.
  const flag = productFlag(product);
  const href = productHref(product);

  return (
    <article className="card img-zoom group relative flex h-full flex-col overflow-hidden">
      {isSoldOut ? (
        <ProductFlag label={dict.product.soldOut} locale={locale} tone="muted" />
      ) : product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      <div
        className={`relative aspect-4/5 overflow-hidden bg-[var(--card-bg)] ${
          isSoldOut ? "opacity-55 grayscale-[0.35]" : ""
        }`}
      >
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        {/* Format plus subtitle runs to three lines in a ~170px column and
            starts to outweigh the name; clamped on both grounds. */}
        <p
          dir="auto"
          className="eyebrow mb-1 line-clamp-1 text-[9px] sm:mb-1.5"
        >
          {product.format ?? product.collectionName}
          {product.subtitle ? ` · ${product.subtitle}` : ""}
        </p>

        {/* Latin proper noun in both trees. The stretched anchor below carries
            the destination, so this is plain text and not a second link. */}
        <h3
          {...island}
          className="mb-1 line-clamp-1 font-heading text-[13px] font-normal tracking-wide text-ground sm:text-base sm:tracking-wider"
        >
          {product.name}
        </h3>

        {/*
          Hidden on the two-up mobile grid — three lines of prose in a ~170px
          column would leave nothing else on the card visible above the fold.
        */}
        <p
          dir="auto"
          className="mb-2.5 hidden line-clamp-2 text-xs leading-relaxed tracking-wide text-ground-muted sm:block"
        >
          {product.description}
        </p>

        <div className="mt-auto" />

        <div className="flex items-end justify-between gap-2 border-t border-ground-border pt-2.5">
          <div className="min-w-0">
            <ProductPrice
              priceInCents={product.priceInCents}
              promotion={product.promotion}
              showPercent
              className="font-heading text-[13px] text-ground sm:text-sm"
            />
            <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-ground-muted sm:text-[10px]">
              {formatVolume(product.volumeMl)}
            </p>
          </div>

          <span className="relative z-2">
            <AddToBagButton
              productId={product.id}
              name={product.name}
              inventory={product.inventory}
            />
          </span>
        </div>
      </div>

      <LocaleLink
        href={href}
        aria-label={product.name}
        className="absolute inset-0 z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />
    </article>
  );
}
