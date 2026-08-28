import Image from "next/image";

import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * Product card — Server Component.
 *
 * Takes the narrow `ProductCardData` projection rather than a full `Product`, so
 * the list query never has to over-select.
 *
 * Kind-agnostic since `/collections` began listing the whole catalog: the link
 * comes from `productHref()`, so a body oil in that grid opens `/ritual/…` and a
 * gift set its category page — where each can actually be bought — instead of a
 * `/perfume/…` URL that would 404.
 */

export interface ProductCardProps {
  product: ProductCardData;
  locale: Locale;
  /** Drives the `sizes` hint; the grid is 2 → 2 → 4 columns. */
  sizes?: string;
}

/*
 * Two columns start at the narrowest viewport, so there is no width at which a
 * card fills the screen — the `100vw` tail this used to carry made every phone
 * fetch an image at twice the resolution it renders.
 */
const DEFAULT_SIZES = "(min-width: 1024px) 25vw, 50vw";

export default async function ProductCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
}: ProductCardProps) {
  const dict = await getDictionary(locale);

  /*
   * One note per tier, top → heart → base. Pyramids are three deep in the data;
   * printing all nine would bury the card's name and price under pills. The
   * full pyramid is the product detail page's job.
   */
  const notes = [
    product.topNotes[0],
    product.heartNotes[0],
    product.baseNotes[0],
  ].filter(Boolean);

  /*
   * Non-fragrance goods have no pyramid, so the pill row would collapse to an
   * empty gap in the middle of the card. Their format line — "Room Spray",
   * "3 × 30 ML Flacons" — takes the same slot instead.
   */
  const pills = notes.length > 0 ? notes : product.format ? [product.format] : [];

  /*
   * One badge, resolved in the same order on all three card types: the stored
   * free-text `badge` is a merchandiser's deliberate override and wins, then
   * the merchandising flag `productFlag()` resolves, so a card never has to.
   */
  const flag = productFlag(product);

  /*
   * A product that cannot be bought has no business leading with "Best Seller",
   * so this takes the corner slot from both the stored badge and the flag —
   * muted rather than gold, because it is a withdrawal and not a claim.
   */
  const isSoldOut = product.inventory === 0;

  return (
    <LocaleLink
      href={productHref(product)}
      className="img-zoom group relative block overflow-hidden bg-surface no-underline"
    >
      {isSoldOut ? (
        <ProductFlag label={dict.product.soldOut} locale={locale} tone="muted" />
      ) : /*
           A running campaign outranks both the stored badge and the facet flag,
           and only when it carries a label: a promotion the house set without
           naming is a quiet price change, and inventing "SALE" for it would be
           the card saying something the merchandiser deliberately did not.
         */
      product.promotion?.label ? (
        <ProductFlag label={product.promotion.label} locale={locale} tone="campaign" />
      ) : product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      {/*
        Sold stock is dimmed and drained the way a museum dims a piece that is
        not currently on show. Only the image: the name, price, and pills below
        stay at full legibility, because the card is still a link worth reading.
      */}
      <div
        className={`relative aspect-3/4 overflow-hidden bg-card ${
          isSoldOut ? "opacity-55 grayscale-[0.35]" : ""
        }`}
      >
        {/*
          The cross-fade. Both frames are `fill` inside one aspect-ratio box, so
          the swap is opacity alone — the card's height is fixed by the box and
          nothing in the grid can shift. Graded identically (`brightness-75`) so
          the transition reads as one continuous image rather than the lights
          coming up. 700ms sits just inside the 800ms `img-zoom` scale both
          frames share, so the swap settles while the zoom is still running.
        */}
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className={`object-cover brightness-75 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            product.hoverImage ? "group-hover:opacity-0" : ""
          }`}
        />
        {product.hoverImage ? (
          /*
            `alt=""` and aria-hidden: this is the same product from a second
            angle, and a screen reader must not hear the flacon described twice.
          */
          <Image
            src={product.hoverImage.url}
            alt=""
            aria-hidden="true"
            fill
            sizes={sizes}
            className="object-cover opacity-0 brightness-75 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
          />
        ) : null}
      </div>

      <div className="p-3 sm:p-6">
        <p className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-gold/60 sm:mb-2">
          {interpolate(dict.product.collectionLabel, {
            name: product.collectionName,
          })}
        </p>
        {/*
          The perfume name is a proper noun and stays Latin in both trees, so it
          keeps a real LTR island. Subtitle and notes are translated, and take
          `dir="auto"` instead: an untranslated row falls back to English, and
          only the rendered text can decide which way that runs.
        */}
        <h3
          {...ltrIsland(locale)}
          className="mb-1 font-heading text-[13px] font-normal tracking-wide text-ivory sm:text-base sm:tracking-wider"
        >
          {product.name}
        </h3>
        {product.subtitle ? (
          /*
            Hidden on the two-up mobile grid: in a ~170px column the subtitle
            wraps to three lines and pushes the price below the fold of the
            card. The name and price are what a phone browser is scanning for.
          */
          <p
            dir="auto"
            className="mb-4 hidden text-xs tracking-wide text-ivory/40 sm:block"
          >
            {product.subtitle}
          </p>
        ) : null}

        {/*
          One pill on a phone, three from `sm` up. Done by hiding the 2nd and
          3rd children rather than slicing the array, so the markup stays a
          single row — a `sm:hidden` short row plus a `hidden sm:flex` full one
          would ship the same notes to the DOM twice.
        */}
        <div
          dir="auto"
          className="mb-2.5 flex flex-wrap gap-1.5 sm:mb-4 [&>*:nth-child(n+2)]:hidden sm:[&>*:nth-child(n+2)]:inline-block"
        >
          {pills.map((note) => (
            <span
              key={note}
              className="border border-gold/20 bg-gold/5 px-2 py-0.5 text-[9px] tracking-widest text-gold/70"
            >
              {note}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <ProductPrice
            priceInCents={product.priceInCents}
            promotion={product.promotion}
            showPercent
            className="font-heading text-[13px] text-gold sm:text-sm"
          />
          <span className="text-[9px] uppercase tracking-[0.15em] text-ivory/40 sm:text-[10px]">
            {formatVolume(product.volumeMl)}
          </span>
        </div>
      </div>
    </LocaleLink>
  );
}
