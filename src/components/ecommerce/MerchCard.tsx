"use client";

import Image from "next/image";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import { useFormatPrice } from "@/src/providers/currency-provider";
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
 * A sibling of `<ProductCard>` rather than a wrapper: that one is an async
 * Server Component whose *whole surface* is a link to the detail page, which
 * this card's format filter and its own layout do not want. What the two share
 * is `<AddToBagButton>` and `<ProductFlag>`, overlaid on the same two corners
 * of both, resolved in the same order.
 */

export interface MerchCardProps {
  product: ProductCardData;
  locale: Locale;
  sizes?: string;
}

/*
 * Two columns from the narrowest viewport up, so no breakpoint renders this
 * card at full width — the old `100vw` tail had phones fetching an image at
 * twice the resolution the slot uses.
 */
const DEFAULT_SIZES = "(min-width: 1024px) 33vw, 50vw";

export default function MerchCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: MerchCardProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
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
    <article className="img-zoom relative flex flex-col bg-surface">
      {isSoldOut ? (
        <ProductFlag label={dict.product.soldOut} locale={locale} tone="muted" />
      ) : product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      {/*
       * The same corner bag the perfume cards carry, so one gesture means the
       * same thing everywhere in the catalogue. The flag sits at the inline
       * start and the bag at the inline end, so the two corners never meet, in
       * either direction.
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

      <div className="flex flex-1 flex-col p-3.5 sm:p-7">
        <div dir="auto" className="flex flex-1 flex-col">
          {/* Format plus subtitle runs to three lines in a ~170px column and
              starts to outweigh the name; two is the cap on phones only. */}
          <p className="eyebrow mb-1.5 line-clamp-2 text-[9px] text-gold/55 sm:mb-2.5 sm:line-clamp-none">
            {product.format ?? product.collectionName}
            {product.subtitle ? ` · ${product.subtitle}` : ""}
          </p>

          {/* Latin proper noun in both trees. The heading carries the link, so
              the photograph above can stay out of the tab order. */}
          <h3
            {...island}
            className="mb-1.5 font-heading text-[13px] font-normal sm:mb-2.5 sm:text-lg"
          >
            <LocaleLink
              href={href}
              className="text-ivory no-underline transition-colors duration-300 ease-out hover:text-gold focus-visible:text-gold focus-visible:outline-none"
            >
              {product.name}
            </LocaleLink>
          </h3>

          {/*
            Hidden on the two-up mobile grid — three lines of prose in a ~170px
            column would leave nothing else on the card visible above the fold.
            The wrapping div keeps `flex-1`, so the price row still
            bottom-aligns across a row of cards with names of different lengths.
          */}
          <p className="mb-6 hidden flex-1 text-xs leading-loose text-ivory/40 sm:block">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 sm:pt-4">
          <span className="font-heading text-[13px] tabular-nums text-gold sm:text-lg">
            {formatPrice(product.priceInCents)}
          </span>
          <span className="text-[9px] uppercase tracking-[0.1em] text-ivory/30 sm:text-[10px]">
            {formatVolume(product.volumeMl)}
          </span>
        </div>
      </div>
    </article>
  );
}
