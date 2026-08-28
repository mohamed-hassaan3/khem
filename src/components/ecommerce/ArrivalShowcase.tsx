import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Product } from "@/src/types/catalog";

/**
 * One new arrival, given a full editorial panel — Server Component.
 *
 * The showroom register the card grids cannot reach: a large photograph inside
 * a gold hairline frame, the release index, the story, the complete pyramid,
 * and a single way forward. Two of these stack into `/new-arrival`, alternating
 * sides so the page reads as a walk past two vitrines rather than a list.
 *
 * Takes the full `Product` rather than a card projection because the story and
 * all nine notes are precisely what that projection leaves out.
 */

export interface ArrivalShowcaseProps {
  product: Product;
  locale: Locale;
  /** Zero-based position; drives the numeral and which side the image takes. */
  index: number;
  total: number;
}

const IMAGE_SIZES = "(min-width: 1024px) 58vw, 100vw";

export default async function ArrivalShowcase({
  product,
  locale,
  index,
  total,
}: ArrivalShowcaseProps) {
  const dict = await getDictionary(locale);
  // Product copy comes from the database — English in both trees.
  const island = ltrIsland(locale);

  // Even entries lead with the image; odd ones lead with the copy.
  const imageFirst = index % 2 === 0;

  const image =
    [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).find((i) => i.isPrimary) ??
    product.images[0];

  const tiers = [
    { label: dict.newArrival.notes.top, notes: product.topNotes },
    { label: dict.newArrival.notes.heart, notes: product.heartNotes },
    { label: dict.newArrival.notes.base, notes: product.baseNotes },
  ];

  return (
    <section className="border-t border-border bg-background px-4 py-12 md:px-20 md:py-28">
      <div className="mx-auto grid max-w-350 grid-cols-1 items-center gap-6 md:gap-12 lg:grid-cols-12 lg:gap-20">
        {/*
         * `lg:order-*` rather than two markup branches: the reading order in
         * the DOM stays image → copy for every entry, so a screen reader and a
         * narrow viewport get the same sequence throughout the page.
         */}
        <Reveal
          className={`lg:col-span-7 ${imageFirst ? "lg:order-1" : "lg:order-2"}`}
        >
          <div className="relative">
            {/* The hairline frame, offset behind the photograph. Decorative,
                so it is hidden from assistive technology and inset with
                logical properties to survive the RTL mirror. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3.5 -end-3.5 top-3.5 start-3.5 border border-gold/25"
            />

            <div className="img-zoom relative aspect-4/5 overflow-hidden bg-card">
              <Image
                src={image.url}
                alt={image.alt}
                fill
                quality={85}
                sizes={IMAGE_SIZES}
                className="object-cover brightness-75 saturate-75"
              />
            </div>
          </div>
        </Reveal>

        <Reveal
          delay={0.1}
          className={`lg:col-span-5 ${imageFirst ? "lg:order-2" : "lg:order-1"}`}
        >
          <p className="mb-7 font-heading text-[11px] uppercase tracking-[0.3em] text-gold/50">
            {dict.newArrival.indexLabel}{" "}
            <span dir="ltr">
              {String(index + 1).padStart(2, "0")} —{" "}
              {String(total).padStart(2, "0")}
            </span>
          </p>

          {/* The perfume name is a Latin proper noun in both trees; the
              subtitle beneath it is translated. */}
          <h2
            {...island}
            className="font-heading text-3xl font-normal leading-tight text-ivory sm:text-4xl md:text-5xl"
          >
            {product.name}
          </h2>

          {product.subtitle ? (
            <p
              dir="auto"
              className="mt-4 text-[13px] leading-loose tracking-wide text-ivory/45"
            >
              {product.subtitle}
            </p>
          ) : null}

          <div className="gold-line my-8 w-16" />

          {product.story ? (
            <p
              dir="auto"
              className="mb-6 md:mb-10 whitespace-pre-line text-[13px] leading-loose text-ivory/40"
            >
              {product.story}
            </p>
          ) : null}

          <dl className="mb-6 md:mb-10 grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
            {tiers.map((tier) => (
              <div key={tier.label} className="bg-background py-5 pe-4">
                <dt className="mb-3 font-heading text-[9px] uppercase tracking-[0.25em] text-gold/50">
                  {tier.label}
                </dt>
                <dd dir="auto" className="text-xs leading-loose text-ivory/50">
                  {tier.notes.join(" · ")}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mb-9 flex items-center gap-4 md:gap-6 border-t border-border pt-6">
            <ProductPrice
              priceInCents={product.priceInCents}
              promotion={product.promotion}
              className="font-heading text-2xl text-gold"
            />
            <span className="text-[10px] uppercase tracking-[0.2em] text-ivory/35">
              {formatVolume(product.volumeMl)}
              {product.concentration
                ? ` · ${dict.product.concentrations[product.concentration]}`
                : ""}
            </span>
          </div>

          <LocaleLink
            href={`/perfume/${product.slug}`}
            className="btn-luxury"
          >
            {dict.newArrival.cta}
          </LocaleLink>
        </Reveal>
      </div>
    </section>
  );
}
