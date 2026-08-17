import type { Metadata } from "next";
import Image from "next/image";

import logo from "@/public/logo/logo-transparent.svg";
import Reveal from "@/src/components/animation/Reveal";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import CollectionCard from "@/src/components/home/CollectionCard";
import IngredientCard from "@/src/components/home/IngredientCard";
import JournalCard from "@/src/components/home/JournalCard";
import NewsletterForm from "@/src/components/home/NewsletterForm";
import TestimonialCarousel from "@/src/components/home/TestimonialCarousel";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland, readingArrow } from "@/src/lib/i18n/rtl";
import {
  getCraftPillars,
  getIngredients,
  getLatestArticles,
  getTestimonials,
} from "@/src/services/content";
import {
  getFeaturedCollections,
  getFeaturedProduct,
  getFeaturedProducts,
} from "@/src/services/products";

/** ISR, 1 hour — AGENTS.md §8 routing matrix. */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: "/",
    title: dict.home.meta.title,
    description: dict.home.meta.description,
  });
}

/** Roman ordinals for the collection cards. */
const COLLECTION_ORDINALS = ["I", "II", "III", "IV"] as const;

/** Stagger step between grid children, in seconds. */
const STAGGER_STEP = 0.1;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout has already rejected any segment that is not a real locale.
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // Fetched after the locale, which decides which language comes back.
  const [
    collections,
    products,
    featuredProduct,
    craftPillars,
    ingredients,
    articles,
    testimonials,
  ] = await Promise.all([
    getFeaturedCollections(activeLocale),
    getFeaturedProducts(activeLocale),
    getFeaturedProduct(activeLocale),
    getCraftPillars(),
    getIngredients(),
    getLatestArticles(),
    getTestimonials(),
  ]);
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);
  const arrow = readingArrow(activeLocale);

  const featuredNotes = featuredProduct
    ? [
        ...featuredProduct.topNotes,
        ...featuredProduct.heartNotes,
        ...featuredProduct.baseNotes,
      ]
    : [];
  const featuredImage =
    featuredProduct?.images.find((image) => !image.isPrimary) ??
    featuredProduct?.images[0];

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-screen min-h-200 items-center justify-center overflow-hidden bg-background">
        <Image
          src="https://images.unsplash.com/photo-1779878603885-f211807da45e?w=1800&h=1100&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-gold)_4%,transparent)_0%,_color-mix(in_srgb,var(--color-background)_70%,transparent)_60%,_var(--color-background)_100%)]" />

        {/* Decorative geometric lines */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/10 sm:h-[600px] sm:w-[600px]" />
          <div className="absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/5 sm:h-[900px] sm:w-[900px]" />
          <div className="absolute left-0 top-1/2 h-px w-20 -translate-y-1/2 bg-linear-to-r from-transparent to-gold/30" />
          <div className="absolute right-0 top-1/2 h-px w-20 -translate-y-1/2 bg-linear-to-l from-transparent to-gold/30" />
        </div>

        <div className="relative z-10 px-4 text-center">
          <div className="mb-7 flex justify-center">
            <Image src={logo} width={40} height={40} alt="KHEM" priority />
          </div>

          {/*
           * The wordmark is Latin in both locales, so it is an LTR island: the
           * RTL rule in `globals.css` would otherwise strip the 0.3em tracking
           * the mark is built on, and `lang="en"` keeps screen readers from
           * announcing it in an Arabic voice.
           */}
          <h1
            {...island}
            className="mb-4 font-heading text-6xl font-semibold leading-none tracking-[0.3em] text-ivory drop-shadow-[0_0_120px_color-mix(in_srgb,var(--color-gold)_15%,transparent)] sm:text-8xl md:text-9xl lg:text-[160px]"
          >
            KHEM
          </h1>

          <div className="mx-auto mb-5 h-px w-12 bg-linear-to-r from-transparent via-gold to-transparent" />

          <p className="mb-14 font-heading text-xs uppercase tracking-[0.4em] text-gold/80 sm:text-sm">
            {dict.home.hero.tagline}
          </p>

          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="border border-gold/40 px-8 py-3.5 font-heading text-[11px] uppercase tracking-[0.2em] text-ivory no-underline transition-all duration-300 ease-out hover:border-gold hover:bg-gold/10"
            >
              {dict.home.hero.exploreCollections}
            </LocaleLink>
            <LocaleLink
              href="/heritage"
              className="font-heading text-[11px] uppercase tracking-[0.2em] text-ivory/50 no-underline transition-colors duration-300 hover:text-ivory"
            >
              {dict.home.hero.ourStory} {arrow}
            </LocaleLink>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
          aria-hidden="true"
        >
          <p className="text-[9px] uppercase tracking-[0.3em] text-ivory/30">
            {dict.home.hero.scroll}
          </p>
          <div className="h-15 w-px animate-pulse bg-linear-to-b from-gold/50 to-transparent" />
        </div>
      </section>

      {/* ── COLLECTIONS PREVIEW ─────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-20 text-center">
            <p className="eyebrow mb-5">{dict.home.collections.eyebrow}</p>
            <h2 className="font-heading text-4xl font-normal text-ivory sm:text-5xl md:text-6xl">
              {dict.home.collections.heading}
            </h2>
          </Reveal>

          <Reveal className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
            {collections.map((collection, index) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                ordinal={interpolate(dict.home.collections.ordinal, {
                  ordinal: COLLECTION_ORDINALS[index] ?? index + 1,
                })}
                tone={collection.slug === "noir" ? "dark" : "standard"}
                locale={activeLocale}
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── FEATURED FRAGRANCES ─────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <Reveal>
              <p className="eyebrow mb-4">{dict.home.essences.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
                {dict.home.essences.heading}
              </h2>
            </Reveal>
            <Reveal>
              <LocaleLink
                href="/collections"
                className="whitespace-nowrap border border-gold/40 px-8 py-3 font-heading text-[11px] uppercase tracking-[0.2em] text-ivory no-underline transition-all duration-300 ease-out hover:border-gold hover:bg-gold/10"
              >
                {dict.home.essences.viewAll}
              </LocaleLink>
            </Reveal>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-0.5 bg-border sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product, index) => (
                <Reveal key={product.id} delay={index * STAGGER_STEP}>
                  <ProductCard product={product} locale={activeLocale} />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-ivory/40">
              {dict.home.essences.empty}
            </p>
          )}
        </div>
      </section>

      {/* ── BRAND STORY ─────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="grid min-h-[700px] grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-[400px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=900&h=900&fit=crop&auto=format"
              alt={dict.home.story.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover brightness-[0.45] saturate-[0.7]"
            />
            {/* Fades toward the copy column, which swaps sides under RTL. */}
            <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-transparent to-surface lg:block rtl:bg-linear-to-l" />
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-16 lg:p-24">
            <Reveal>
              <p className="eyebrow mb-6">{dict.home.story.eyebrow}</p>
              <h2 className="mb-8 font-heading text-3xl font-normal leading-tight text-ivory sm:text-4xl lg:text-5xl">
                {dict.home.story.headingLine1}
                <br />
                {dict.home.story.headingLine2}
              </h2>
              <div className="mb-8 h-px w-12 gold-line" />
              <p className="mb-6 text-sm leading-relaxed text-ivory/60">
                {dict.home.story.body1}
              </p>
              <p className="mb-10 text-sm leading-relaxed text-ivory/60">
                {dict.home.story.body2}
              </p>
              <div>
                <LocaleLink
                  href="/heritage"
                  className="inline-block border border-gold/40 px-8 py-3.5 font-heading text-[11px] uppercase tracking-[0.2em] text-ivory no-underline transition-all duration-300 ease-out hover:border-gold hover:bg-gold/10"
                >
                  {dict.home.story.cta}
                </LocaleLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CRAFTSMANSHIP ───────────────────────────── */}
      <section className="border-t border-border bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-24 text-center">
            <p className="eyebrow mb-5">{dict.home.craft.eyebrow}</p>
            <h2 className="mb-6 font-heading text-4xl font-normal text-ivory sm:text-5xl md:text-6xl">
              {dict.home.craft.heading}
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-ivory/40">
              {dict.home.craft.lede}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {craftPillars.map((pillar, index) => (
              <Reveal
                key={pillar.id}
                className="bg-background p-10 md:p-12"
                delay={index * STAGGER_STEP}
              >
                <p className="mb-8 font-heading text-xs tracking-[0.2em] text-gold/40">
                  {pillar.number}
                </p>
                <div className="mb-7 h-px w-10 gold-line " />
                <div {...island}>
                  <h3 className="mb-4 font-heading text-base font-normal tracking-wide text-ivory">
                    {pillar.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-ivory/40">
                    {pillar.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-16 text-center">
            <LocaleLink
              href="/craftsmanship"
              className="inline-block border border-gold/40 px-8 py-3.5 font-heading text-[11px] uppercase tracking-[0.2em] text-ivory no-underline transition-all duration-300 ease-out hover:border-gold hover:bg-gold/10"
            >
              {dict.home.craft.cta}
            </LocaleLink>
          </Reveal>
        </div>
      </section>

      {/* ── HERO FEATURE PERFUME ─────────────────────── */}
      {featuredProduct ? (
        <section className="relative h-[80vh] min-h-[600px] overflow-hidden bg-black">
          {featuredImage ? (
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt}
              fill
              sizes="100vw"
              className="object-cover opacity-50"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/50 to-transparent rtl:bg-linear-to-l" />
          <div className="absolute inset-0 flex items-center px-6 md:px-20 lg:px-32">
            <Reveal className="max-w-lg">
              <p className="eyebrow mb-5">{dict.home.featured.eyebrow}</p>
              <h2
                {...island}
                className="mb-8 font-heading text-5xl font-normal leading-tight text-ivory sm:text-6xl md:text-7xl"
              >
                {featuredProduct.name}
              </h2>
              <p
                {...island}
                className="mb-8 text-xs leading-relaxed text-ivory/60 sm:text-sm"
              >
                {featuredProduct.story ?? featuredProduct.description}
              </p>
              <div className="mb-10 flex flex-wrap gap-4" {...island}>
                {featuredNotes.map((note) => (
                  <span
                    key={note}
                    className="border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-widest text-gold"
                  >
                    {note}
                  </span>
                ))}
              </div>
              <LocaleLink
                href={`/perfume/${featuredProduct.slug}`}
                className="inline-block bg-gold px-8 py-3.5 font-heading text-[11px] uppercase tracking-[0.2em] text-background no-underline transition-all duration-300 ease-out hover:bg-champagne"
              >
                {interpolate(dict.home.featured.cta, {
                  name: featuredProduct.name,
                })}
              </LocaleLink>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── INGREDIENTS ─────────────────────────────── */}
      <section className="overflow-hidden border-t border-border bg-background py-24 md:py-36">
        <div className="mx-auto mb-16 max-w-7xl px-6 md:px-20">
          <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">{dict.home.ingredients.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
                {dict.home.ingredients.heading}
              </h2>
            </div>
            <LocaleLink
              href="/ingredients"
              className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold/70 no-underline transition-colors hover:text-gold"
            >
              {dict.home.ingredients.viewAll} {arrow}
            </LocaleLink>
          </Reveal>
        </div>

        {/* Horizontal scroll rail */}
        <div className="flex gap-0.5 overflow-x-auto pb-4 ps-6 md:ps-20">
          {ingredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              locale={activeLocale}
            />
          ))}
        </div>
      </section>

      {/* ── JOURNAL PREVIEW ─────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">{dict.home.journal.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
                {dict.home.journal.heading}
              </h2>
            </div>
            <LocaleLink
              href="/journal"
              className="border border-gold/40 px-8 py-3.5 font-heading text-[11px] uppercase tracking-[0.2em] text-ivory no-underline transition-all duration-300 ease-out hover:border-gold hover:bg-gold/10"
            >
              {dict.home.journal.cta}
            </LocaleLink>
          </Reveal>

          <div className="grid grid-cols-1 gap-0.5 bg-border md:grid-cols-3">
            {articles.map((article, index) => (
              <Reveal key={article.id} delay={index * STAGGER_STEP}>
                <JournalCard article={article} locale={activeLocale} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────── */}
      <section className="border-t border-border bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <div className="gold-line mx-auto mb-12" />
          <div {...island}>
            <TestimonialCarousel testimonials={testimonials} />
          </div>
          <div className="gold-line mx-auto mt-12" />
        </div>
      </section>

      {/* ── NEWSLETTER ──────────────────────────────── */}
      <section className="border-y border-gold/10 bg-linear-to-br from-surface to-background px-6 py-24 md:px-20">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="eyebrow mb-5">{dict.home.newsletter.eyebrow}</p>
            <h2 className="mb-4 font-heading text-3xl font-normal text-ivory sm:text-4xl">
              {dict.home.newsletter.heading}
            </h2>
            <p className="mb-12 text-xs leading-relaxed text-ivory/40 sm:text-sm">
              {dict.home.newsletter.lede}
            </p>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
