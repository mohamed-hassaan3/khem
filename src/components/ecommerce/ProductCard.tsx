import Image from "next/image";

import Price from "@/src/components/ecommerce/Price";
import LocaleLink from "@/src/components/i18n/LocaleLink";
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
 * comes from `productHref()`, so a gift set or a body oil in that grid opens its
 * category page — where it can actually be bought — instead of a `/perfume/…`
 * URL that would 404.
 */

export interface ProductCardProps {
  product: ProductCardData;
  locale: Locale;
  /** Drives the `sizes` hint; the grid is 1 → 2 → 4 columns. */
  sizes?: string;
}

const DEFAULT_SIZES =
  "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";

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

  return (
    <LocaleLink
      href={productHref(product)}
      className="img-zoom group relative block overflow-hidden bg-surface no-underline"
    >
      <div className="relative aspect-3/4 overflow-hidden bg-card">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className="object-cover brightness-75"
        />
      </div>

      <div className="p-6">
        <p className="mb-2 text-[9px] uppercase tracking-[0.2em] text-gold/60">
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
          className="mb-1 font-heading text-base font-normal tracking-wider text-ivory"
        >
          {product.name}
        </h3>
        {product.subtitle ? (
          <p dir="auto" className="mb-4 text-xs tracking-wide text-ivory/40">
            {product.subtitle}
          </p>
        ) : null}

        <div dir="auto" className="mb-4 flex flex-wrap gap-1.5">
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
          <Price
            cents={product.priceInCents}
            className="font-heading text-sm text-gold"
          />
          <span className="text-[10px] uppercase tracking-[0.15em] text-ivory/40">
            {formatVolume(product.volumeMl)}
          </span>
        </div>
      </div>
    </LocaleLink>
  );
}
