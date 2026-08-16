import type { Metadata } from "next";

import Reveal from "@/src/components/animation/Reveal";
import ArrivalShowcase from "@/src/components/ecommerce/ArrivalShowcase";
import NewArrivalHero from "@/src/components/ecommerce/NewArrivalHero";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getNewArrivals } from "@/src/services/products";

/** ISR, 1 hour — a catalog listing page, matching `/collections`. */
export const revalidate = 3600;

const PATH = "/new-arrival";

/**
 * The hero photograph belongs to the page, not to a product: neither flacon
 * should stand in for both, so this is texture rather than a bottle — dark
 * marble, the surface the showcase panels sit on. One of the vetted Unsplash
 * ids; every image URL is a vetted host in `next.config.ts`.
 */
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1800&h=1200&fit=crop&auto=format";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return localeMetadata({
    locale: activeLocale,
    path: PATH,
    title: dict.newArrival.meta.title,
    description: dict.newArrival.meta.description,
    ogTitle: dict.newArrival.meta.ogTitle,
    ogDescription: dict.newArrival.meta.ogDescription,
  });
}

/**
 * New arrivals — the showroom.
 *
 * A page of two products rather than a grid of many, so each one gets a full
 * editorial panel. Membership is the `NEW_ARRIVAL` tag on the catalog row: a
 * merchandiser retires an arrival by removing the tag, and this route needs no
 * edit. An empty result renders the empty state rather than 404ing — "nothing
 * new this season" is a true answer, not a missing page.
 */
export default async function NewArrivalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, arrivals] = await Promise.all([params, getNewArrivals()]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  const count =
    arrivals.length === 1
      ? dict.newArrival.countOne
      : interpolate(dict.newArrival.count, { count: arrivals.length });

  return (
    <div className="min-h-screen bg-background text-ivory">
      <NewArrivalHero
        eyebrow={dict.newArrival.eyebrow}
        titleLead={dict.newArrival.titleLead}
        titleAccent={dict.newArrival.titleAccent}
        description={dict.newArrival.description}
        count={count}
        imageUrl={HERO_IMAGE}
        imageAlt={dict.newArrival.heroImageAlt}
      />

      {arrivals.length === 0 ? (
        <p className="px-6 py-32 text-center text-[13px] leading-loose text-ivory/35">
          {dict.newArrival.empty}
        </p>
      ) : (
        arrivals.map((product, index) => (
          <ArrivalShowcase
            key={product.id}
            product={product}
            locale={activeLocale}
            index={index}
            total={arrivals.length}
          />
        ))
      )}

      {/* ── CLOSING BAND ────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-5">{dict.newArrival.closing.eyebrow}</p>

          <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl">
            {dict.newArrival.closing.heading}
          </h2>

          <div className="gold-line mx-auto my-8 w-16" />

          <p className="mb-10 text-[13px] leading-loose text-ivory/40">
            {dict.newArrival.closing.body}
          </p>

          {/* The whole catalogue, unfiltered — the band offers what this page
              is *not* showing, so filtering it to these same two products
              would be a link back to where the visitor already is. */}
          <LocaleLink href="/collections" className="btn-luxury">
            {dict.newArrival.closing.cta}
          </LocaleLink>
        </Reveal>
      </section>
    </div>
  );
}
