import type { Metadata } from "next";
import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import StockistBadge from "@/src/components/stockists/StockistBadge";
import StockistDirectory, {
  StockistDetails,
} from "@/src/components/stockists/StockistDirectory";
import { isLocale } from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland, type LtrIsland } from "@/src/lib/i18n/rtl";
import {
  getOpenStockists,
  getStockistRegions,
  getStockists,
  getWholesaleEmail,
} from "@/src/services/stockists";
import type { Stockist } from "@/src/types/stockist";

/**
 * ISR, 1 hour.
 *
 * AGENTS.md §8 lists `/stockists` as Static. The service layer is already
 * async against a future `Stockist` table, so an hourly window means a new
 * boutique appears without a redeploy — the same value the other content
 * routes use.
 */
export const revalidate = 3600;

const PATH = "/stockists";

/** Stagger step between grid children, in seconds. Matches `/craftsmanship`. */
const STAGGER_STEP = 0.1;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: PATH,
    title: dict.stockists.meta.title,
    description: dict.stockists.meta.description,
    ogTitle: dict.stockists.meta.ogTitle,
    ogDescription: dict.stockists.meta.ogDescription,
  });
}

export default async function Stockists({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, stockists, openStockists, regions, wholesaleEmail] =
    await Promise.all([
      params,
      getStockists(),
      getOpenStockists(),
      getStockistRegions(),
      getWholesaleEmail(),
    ]);

  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  /**
   * A lone boutique gets an editorial spread; two or more get the card grid.
   *
   * This is the one place the page reads a count, and it reads it because a
   * single card stranded in a three-column grid is two-thirds empty row — the
   * wrong container for a flagship, not a rendering detail.
   *
   * It counts *open* locations: the section's heading is "World-Class Retail
   * Partners", and a boutique that has not opened is not yet one. Announced
   * locations appear in the directory above, labelled as forthcoming.
   */
  const solo = openStockists.length === 1 ? openStockists[0] : null;

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HEADER ─────────────────────────────────── */}
      <section className="bg-background px-6 pt-24 md:px-20 md:pt-32">
        <Reveal className="mx-auto max-w-350 pb-10">
          <p className="eyebrow mb-4">{dict.stockists.hero.eyebrow}</p>
          <h1 className="font-heading text-4xl font-normal text-ivory sm:text-5xl md:text-7xl">
            {dict.stockists.hero.heading}
          </h1>
        </Reveal>
      </section>

      {/* ── REGION FILTER · MAP · DIRECTORY ─────────── */}
      <StockistDirectory
        stockists={stockists}
        regions={regions}
        locale={activeLocale}
      />

      {/* ── PARTNERS ────────────────────────────────── */}
      <section className="border-t border-border bg-background px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto max-w-350">
          <Reveal className="mb-16">
            <p className="eyebrow mb-4">{dict.stockists.partners.eyebrow}</p>
            <h2 className="font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
              {dict.stockists.partners.heading}
            </h2>
          </Reveal>

          {solo ? (
            <Reveal>
              <StockistFeature
                stockist={solo}
                island={island}
                labels={dict.stockists}
              />
            </Reveal>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {openStockists.map((stockist, index) => (
                <Reveal key={stockist.id} delay={index * STAGGER_STEP}>
                  <StockistCard
                    stockist={stockist}
                    island={island}
                    labels={dict.stockists}
                  />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── WHOLESALE ENQUIRIES ─────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">{dict.stockists.wholesale.eyebrow}</p>
          <h2 className="mb-5 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            {dict.stockists.wholesale.heading}
          </h2>
          <p className="mb-11 text-[13px] leading-loose text-ivory/40">
            {dict.stockists.wholesale.lede}
          </p>
          <a href={`mailto:${wholesaleEmail}`} className="btn-luxury">
            {dict.stockists.wholesale.cta}
          </a>
        </Reveal>
      </section>
    </div>
  );
}

/**
 * The single-location treatment: a full-bleed image beside the details.
 *
 * Same content as `<StockistCard>`, given the room a flagship warrants. The
 * page swaps between the two on count alone, so neither needs to know the
 * other exists.
 */
function StockistFeature({
  stockist,
  island,
  labels,
}: {
  stockist: Stockist;
  island: LtrIsland;
  labels: Dictionary["stockists"];
}) {
  return (
    <div className="grid grid-cols-1 bg-surface lg:grid-cols-2">
      <div className="img-zoom relative aspect-4/3 overflow-hidden lg:aspect-auto lg:min-h-125">
        <Image
          src={stockist.image.url}
          alt={stockist.image.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover brightness-55 saturate-65"
        />
      </div>

      <div className="flex flex-col justify-center px-8 py-14 md:px-14">
        <div className="mb-5">
          <StockistBadge
            label={labels.types[stockist.type]}
            type={stockist.type}
            className="text-[10px]"
          />
        </div>

        {/* Store records come from `src/data` — English only. */}
        <h3
          className="mb-2 font-heading text-2xl font-normal text-ivory md:text-3xl"
          {...island}
        >
          {stockist.name}
        </h3>
        <p
          className="text-[12px] tracking-[0.1em] text-gold/60"
          {...island}
        >
          {stockist.city}, {stockist.country}
        </p>

        <div className="gold-line my-8" />

        <StockistDetails
          stockist={stockist}
          island={island}
          labels={labels}
        />
      </div>
    </div>
  );
}

/** One partner in the multi-location grid. */
function StockistCard({
  stockist,
  island,
  labels,
}: {
  stockist: Stockist;
  island: LtrIsland;
  labels: Dictionary["stockists"];
}) {
  return (
    <article className="h-full bg-surface">
      <div className="img-zoom relative h-50 overflow-hidden">
        <Image
          src={stockist.image.url}
          alt={stockist.image.alt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover brightness-45 saturate-50"
        />
      </div>

      <div className="px-6 py-7">
        <div className="mb-3 flex items-start justify-between gap-3">
          {/* Store records come from `src/data` — English only. */}
          <h3
            className="font-heading text-[15px] font-normal text-ivory"
            {...island}
          >
            {stockist.name}
          </h3>
          <StockistBadge
            label={labels.types[stockist.type]}
            type={stockist.type}
          />
        </div>

        <p
          className="mb-2 text-[12px] tracking-[0.08em] text-gold/60"
          {...island}
        >
          {stockist.city}, {stockist.country}
        </p>
        {/* Both are nullable — rendered only when the record carries them. */}
        {stockist.address ? (
          <p
            className="mb-1 text-[11px] leading-relaxed text-ivory/35"
            {...island}
          >
            {stockist.address}
          </p>
        ) : null}
        {stockist.hours ? (
          <p className="text-[11px] text-ivory/25" {...island}>
            {stockist.hours}
          </p>
        ) : null}
      </div>
    </article>
  );
}
