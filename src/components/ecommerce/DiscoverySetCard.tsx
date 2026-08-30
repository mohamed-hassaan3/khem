"use client";

import { Check } from "lucide-react";
import Image from "next/image";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { productHref } from "@/src/lib/routes";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * A discovery set — a `<MerchCard>` with two additions a set needs: the
 * merchandising badge and the contents list.
 *
 * Kept separate rather than folded into `<MerchCard>` behind two flags: the
 * contents list changes the card's whole vertical rhythm (square image, list
 * block, price pinned to the bottom of an equal-height column), which is more
 * than a variant.
 *
 * ## The full-width "Add to Cart" is gone
 *
 * §9: the words leave every product card and the bag icon takes their place.
 * This was the last card in the catalogue still carrying a text button, and it
 * was also the last one where "add to bag" meant something visibly different
 * from what it means on the other two.
 *
 * The transient "Added ✓" state went with it. That state existed because a
 * full-width button had somewhere to report and nothing else did; the shared
 * control opens the cart panel instead, and the panel *is* the confirmation.
 *
 * ## A link, at last
 *
 * This was the one card in the catalogue with no stretched anchor, because
 * discovery and gift sets had no detail page to point at. They have
 * `/set/[slug]` now, so it carries the same anchor `<MerchCard>` and
 * `<ProductCard>` do, built from the same `productHref()`.
 *
 * The contents list stays on the card even though the detail page prints it
 * properly now: it is what distinguishes one box from another in a grid, and a
 * shopper comparing two sets should not have to open both. The card lists; the
 * page explains.
 *
 * As the old note here predicted, this component and `<MerchCard>` are now very
 * hard to justify keeping apart — the contents block and the square crop are
 * the only differences left. That merge is deliberately **not** part of this
 * change: doing it in the same pass would make a card regression
 * indistinguishable from a routing one.
 */

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
  // Set names and contents come from the database — English in both trees.
  const island = ltrIsland(locale);

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
        className={`relative aspect-square overflow-hidden bg-[var(--card-bg)] ${
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

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-5">
        <div {...island} className="flex min-w-0 flex-1 flex-col">
          {product.format ? (
            <p className="eyebrow mb-1.5 line-clamp-1 text-[9px] sm:mb-2">
              {product.format}
            </p>
          ) : null}

          <h3 className="mb-1 line-clamp-2 font-heading text-[13px] font-normal leading-snug tracking-wide text-ground sm:text-base">
            {product.name}
          </h3>

          {/*
            The contents list below is what sells a boxed set, so on the two-up
            mobile grid it keeps the space and the prose gives it up.
          */}
          <p className="mb-4 hidden line-clamp-2 text-xs leading-relaxed tracking-wide text-ground-muted sm:block">
            {product.description}
          </p>

          {product.includes.length > 0 ? (
            <div className="mb-4">
              <p className="eyebrow mb-2 text-[9px]">
                {dict.discovery.includes}
              </p>

              <ul className="list-none">
                {product.includes.map((entry) => (
                  <li
                    key={entry}
                    className="mb-1.5 flex items-center gap-2 text-[10px] tracking-wide text-ground-muted sm:text-[11px]"
                  >
                    <Check
                      size={12}
                      strokeWidth={1.25}
                      aria-hidden="true"
                      className="shrink-0 text-ground-accent"
                    />
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-auto" />

        <div className="flex items-end justify-between gap-2 border-t border-ground-border pt-2.5">
          <ProductPrice
            priceInCents={product.priceInCents}
            promotion={product.promotion}
            showPercent
            className="font-heading text-[13px] text-ground sm:text-sm"
          />

          <AddToBagButton
            productId={product.id}
            name={product.name}
            inventory={product.inventory}
          />
        </div>
      </div>

      {/*
        The stretched anchor, matching `<MerchCard>` exactly — `z-1`, so the bag
        control and the price sit above it and stay independently clickable.
        `aria-label` carries the product name because the link itself is empty.
      */}
      <LocaleLink
        href={href}
        aria-label={product.name}
        className="absolute inset-0 z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />
    </article>
  );
}
