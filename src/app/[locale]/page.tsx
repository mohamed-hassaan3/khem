import type { Metadata } from "next";
import Image from "next/image";

import logo from "@/public/logo/logo-transparent.webp";
import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import CollectionCard from "@/src/components/home/CollectionCard";
import CollectionSlider from "@/src/components/home/CollectionSlider";
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
    getCraftPillars(activeLocale),
    getIngredients(activeLocale),
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
    <div className="min-h-screen">
      {/*
        Declared explicitly, where the home page previously declared nothing
        and inherited the fail-safe solid header.

        The hero is the ivory editorial composition, so there is no photograph
        for the bar to obscure — but there is a full-screen field of negative
        space that the wordmark is centred in, and a bordered bar sitting on
        top of it closes the composition off. Transparent until the visitor
        scrolls is what lets the page open on the mark alone.
      */}
      <NavGround ground="ivory" />
      {/*
        ── HERO ───────────────────────────── ivory ──

        The Ivory editorial hero (§13, Option A).

        ## What went, and why

        A full-bleed Unsplash photograph at `opacity-35`, sitting under a radial
        gradient that faded to solid obsidian at the edges. Three things were
        wrong with it. It was the site's largest dark surface and the first
        thing anyone saw, so it set the whole visit's register as "dark site".
        At 35% opacity under a near-opaque wash it was not really photography
        either — it was texture, doing the work a paper ground does for free on
        ivory. And it was a 1800px `priority` image on the critical path of the
        most-visited route, which is the wrong thing to spend an LCP on when
        the composition underneath it is typographic.

        So the photograph is gone rather than recoloured. What is left is what
        the hero always actually was: the wordmark, a rule, a line of tracking,
        and two concentric circles — now drawn in charcoal and gold on ivory,
        where they read as an engraving rather than as a glow.

        This is deliberately a *composition* and not a placeholder. When a real
        KHEM campaign photograph exists it belongs here, full-bleed and
        untreated, with this type moved off it — not layered under it at a
        third of its opacity.
      */}
      <section className="ground-ivory relative flex h-svh min-h-160 items-center justify-center overflow-hidden">
        {/*
          The geometry, in charcoal rather than gold.

          Gold at 10% on obsidian was a halo; gold at 10% on ivory is invisible,
          and raising it to compensate would spend the accent budget (§9) on
          decoration. Charcoal at 8% is a drawn line on paper — the same figure,
          in the medium the page is now made of.
        */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/8 sm:h-[600px] sm:w-[600px]" />
          <div className="absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/5 sm:h-[900px] sm:w-[900px]" />
          <div className="absolute left-0 top-1/2 h-px w-20 -translate-y-1/2 bg-linear-to-r from-transparent to-gold/40" />
          <div className="absolute right-0 top-1/2 h-px w-20 -translate-y-1/2 bg-linear-to-l from-transparent to-gold/40" />
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
           *
           * The `drop-shadow` gold bloom is gone with the dark ground that
           * justified it. A glow behind charcoal type on paper is a smudge.
           */}
          <h1
            {...island}
            className="mb-4 font-heading text-6xl font-semibold leading-none tracking-[0.3em] text-ground sm:text-8xl md:text-9xl lg:text-[160px]"
          >
            KHEM
          </h1>

          <div className="mx-auto mb-5 h-px w-12 bg-linear-to-r from-transparent via-gold to-transparent" />

          {/*
           * The tagline takes the deep gold at full strength. It was
           * `text-ground-accent/80` — an 80% tint of a colour already chosen
           * for its minimum legible contrast, which on ivory falls under the
           * threshold at this size.
           */}
          <p className="mb-8 md:mb-14 font-heading text-xs uppercase tracking-[0.4em] text-ground-accent sm:text-sm">
            {dict.home.hero.tagline}
          </p>

          {/*
           * The primary action is now filled charcoal rather than an outline.
           * On obsidian an outline button was the emphatic option available;
           * on ivory §33 gives the page a real primary, and the homepage's one
           * job is to send the visitor into the collections.
           */}
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="btn btn-primary"
            >
              {dict.home.hero.exploreCollections}
            </LocaleLink>
            <LocaleLink
              href="/heritage"
              className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-muted no-underline transition-colors duration-300 hover:text-ground"
            >
              {dict.home.hero.ourStory} {arrow}
            </LocaleLink>
          </div>
        </div>

        {/*
          The scroll indicator.

          `animate-pulse` is gone. It was a continuous opacity animation on a
          decorative 60px rule, running for as long as the tab was open —
          §37/§48 name exactly this as work the page does while the visitor is
          only reading. A static gradient rule says "there is more below" just
          as well, and says it without a repainting element.
        */}
        <div
          className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
          aria-hidden="true"
        >
          <p className="text-[9px] uppercase tracking-[0.3em] text-ground-subtle">
            {dict.home.hero.scroll}
          </p>
          <div className="h-15 w-px bg-linear-to-b from-ink/30 to-transparent" />
        </div>
      </section>

      {/* ── COLLECTIONS PREVIEW ─── sand ───────────── */}
      <section className="ground-sand px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-10 md:mb-20 text-center">
            <p className="eyebrow mb-5">{dict.home.collections.eyebrow}</p>
            <h2 className="font-heading text-4xl font-normal text-ground sm:text-5xl md:text-6xl">
              {dict.home.collections.heading}
            </h2>
          </Reveal>

          {/*
            §5: a slider, not a static two-up. The cards are Server Components
            and are passed through as children — the client component owns the
            scroll track and the arrows, and never needs to know what a
            collection is.
          */}
          <Reveal>
            <CollectionSlider
              label={dict.home.collections.sliderLabel}
              previousLabel={dict.home.collections.previous}
              nextLabel={dict.home.collections.next}
            >
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
            </CollectionSlider>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURED FRAGRANCES ─── ivory ──────────── */}
      <section className="ground-ivory px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 md:mb-16 flex flex-col items-start justify-between gap-4 md:gap-6 md:flex-row md:items-end">
            <Reveal>
              <p className="eyebrow mb-4">{dict.home.essences.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ground sm:text-4xl md:text-5xl">
                {dict.home.essences.heading}
              </h2>
            </Reveal>
            <Reveal>
              {/*
               * The whole catalogue, not `/collections/signature`. The grid
               * above is `getFeaturedProducts()` — bestselling *fragrances*
               * across every collection — so a card here is often from Noir or
               * Gemstone, and a link to the Signature collection would open a
               * page missing half of what the visitor just looked at.
               */}
              <LocaleLink
                href="/collections"
                className="btn btn-outline whitespace-nowrap"
              >
                {dict.home.essences.viewAll}
              </LocaleLink>
            </Reveal>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {products.map((product, index) => (
                <Reveal
                  key={product.id}
                  delay={index * STAGGER_STEP}
                  className="h-full"
                >
                  <ProductCard product={product} locale={activeLocale} />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="py-10 md:py-16 text-center text-sm text-ground-muted">
              {dict.home.essences.empty}
            </p>
          )}
        </div>
      </section>

      {/*
        ── BRAND STORY ─── sand ─────────────────────

        Was a full-width charcoal band with the photograph crushed to 45%
        brightness and faded into it. That treatment only works if the reader
        is already in the dark — dropped into a run of light sections it is the
        exact "IVORY → CHARCOAL FULL SCREEN → IVORY" rhythm §7 rules out.

        Sand instead: the story is the heritage register, which is what sand is
        for, and the photograph now runs at its own luminance with the copy
        beside rather than on top of it.
      */}
      <section className="ground-sand border-t border-ground-border">
        <div className="grid min-h-[700px] grid-cols-1 lg:grid-cols-2">
          <div className="relative min-h-[400px] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=900&h=900&fit=crop&auto=format"
              alt={dict.home.story.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            {/* Fades toward the copy column, which swaps sides under RTL. */}
            {/*
              The seam between photograph and copy, in sand rather than
              charcoal. It exists to stop the image ending on a hard vertical
              edge, so it has to fade to the colour of the column beside it.
            */}
            <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-transparent to-sand lg:block rtl:bg-linear-to-l" />
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-16 lg:p-24">
            <Reveal>
              <p className="eyebrow mb-6">{dict.home.story.eyebrow}</p>
              <h2 className="mb-8 font-heading text-3xl font-normal leading-tight text-ground sm:text-4xl lg:text-5xl">
                {dict.home.story.headingLine1}
                <br />
                {dict.home.story.headingLine2}
              </h2>
              <div className="mb-8 h-px w-12 gold-line" />
              <p className="mb-6 text-sm leading-relaxed text-ground-muted">
                {dict.home.story.body1}
              </p>
              <p className="mb-6 md:mb-10 text-sm leading-relaxed text-ground-muted">
                {dict.home.story.body2}
              </p>
              <div>
                <LocaleLink
                  href="/heritage"
                  className="inline-block btn btn-outline"
                >
                  {dict.home.story.cta}
                </LocaleLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/*
        ── CRAFTSMANSHIP ─── ivory ──────────────────

        §16: the craft section reads as detail, process and precision, and the
        mood is calm and tactile. That is a light register — the four pillars
        are a specimen sheet, and a specimen sheet is printed, not backlit.

        The hairline grid is what carries the structure here, which is why the
        cells keep their `gap-px` over a ruled background: on ivory the rules
        are visible as rules rather than as the gaps between dark boxes.
      */}
      <section className="ground-ivory border-t border-ground-border px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 md:mb-24 text-center">
            <p className="eyebrow mb-5">{dict.home.craft.eyebrow}</p>
            <h2 className="mb-6 font-heading text-4xl font-normal text-ground sm:text-5xl md:text-6xl">
              {dict.home.craft.heading}
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-ground-muted">
              {dict.home.craft.lede}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-px bg-ground-border sm:grid-cols-2 lg:grid-cols-4">
            {craftPillars.map((pillar, index) => (
              <Reveal
                key={pillar.id}
                className="ground-ivory p-6 sm:p-10 md:p-12"
                delay={index * STAGGER_STEP}
              >
                <p className="mb-8 font-heading text-xs tracking-[0.2em] text-ground-subtle">
                  {pillar.number}
                </p>
                <div className="mb-7 h-px w-10 gold-line " />
                <div {...island}>
                  <h3 className="mb-4 font-heading text-base font-normal tracking-wide text-ground">
                    {pillar.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-ground-muted">
                    {pillar.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10 md:mt-16 text-center">
            <LocaleLink
              href="/craftsmanship"
              className="inline-block btn btn-outline"
            >
              {dict.home.craft.cta}
            </LocaleLink>
          </Reveal>
        </div>
      </section>

      {/*
        ── HERO FEATURE PERFUME ─────────────────────

        The one section on this page that still reads dark, and it is a
        photograph rather than a ground: a single bottle, full-bleed, with the
        copy in the left third.

        §17's argument, applied to the homepage — drama comes from photography
        and composition, not from painting the page. It survives because the
        darkness here is *the image*, bounded by the light sections above and
        below it, and because one such band in a page of eleven is a
        punctuation mark rather than an alternation.

        The image runs at `opacity-70` rather than `opacity-50`, and the scrim
        that carries the type is narrower: the bottle is the point.
      */}
      {featuredProduct ? (
        <section className="ground-obsidian relative h-[80vh] min-h-[600px] overflow-hidden bg-ink">
          {featuredImage ? (
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt}
              fill
              sizes="100vw"
              className="object-cover opacity-70"
            />
          ) : null}
          <div className="absolute inset-0 bg-linear-to-r from-ink/90 via-ink/45 to-transparent rtl:bg-linear-to-l" />
          <div className="absolute inset-0 flex items-center px-4 md:px-20 lg:px-32">
            <Reveal className="max-w-lg">
              <p className="eyebrow mb-5">{dict.home.featured.eyebrow}</p>
              <h2
                {...island}
                className="mb-8 font-heading text-5xl font-normal leading-tight text-ground sm:text-6xl md:text-7xl"
              >
                {featuredProduct.name}
              </h2>
              <p
                {...island}
                className="mb-8 text-xs leading-relaxed text-ground-muted sm:text-sm"
              >
                {featuredProduct.story ?? featuredProduct.description}
              </p>
              <div className="mb-6 md:mb-10 flex flex-wrap gap-4" {...island}>
                {featuredNotes.map((note) => (
                  <span
                    key={note}
                    className="border border-ground-accent/30 bg-ground-accent/10 px-3 py-1 text-[10px] uppercase tracking-widest text-ground-accent"
                  >
                    {note}
                  </span>
                ))}
              </div>
              <LocaleLink
                href={`/perfume/${featuredProduct.slug}`}
                className="btn btn-primary"
              >
                {interpolate(dict.home.featured.cta, {
                  name: featuredProduct.name,
                })}
              </LocaleLink>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── INGREDIENTS ─── sand ───────────────────── */}
      <section className="ground-sand overflow-hidden border-t border-ground-border py-14 md:py-36">
        <div className="mx-auto mb-10 md:mb-16 max-w-7xl px-4 md:px-20">
          <Reveal className="flex flex-col items-start justify-between gap-4 md:gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">{dict.home.ingredients.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ground sm:text-4xl md:text-5xl">
                {dict.home.ingredients.heading}
              </h2>
            </div>
            <LocaleLink
              href="/ingredients"
              className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent/70 no-underline transition-colors hover:text-ground-accent"
            >
              {dict.home.ingredients.viewAll} {arrow}
            </LocaleLink>
          </Reveal>
        </div>

        {/* Horizontal scroll rail */}
        <div className="flex gap-0.5 overflow-x-auto pb-4 ps-4 md:ps-20">
          {ingredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              locale={activeLocale}
            />
          ))}
        </div>
      </section>

      {/* ── JOURNAL PREVIEW ─── ivory ──────────────── */}
      <section className="ground-ivory border-t border-ground-border px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-10 md:mb-16 flex flex-col items-start justify-between gap-4 md:gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">{dict.home.journal.eyebrow}</p>
              <h2 className="font-heading text-3xl font-normal text-ground sm:text-4xl md:text-5xl">
                {dict.home.journal.heading}
              </h2>
            </div>
            <LocaleLink
              href="/journal"
              className="btn btn-outline"
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

      {/* ── TESTIMONIALS ─── ivory ─────────────────── */}
      <section className="ground-ivory border-t border-ground-border px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="gold-line mx-auto mb-8 md:mb-12" />
          <div {...island}>
            <TestimonialCarousel testimonials={testimonials} />
          </div>
          <div className="gold-line mx-auto mt-8 md:mt-12" />
        </div>
      </section>

      {/*
        ── NEWSLETTER ─── sand ──────────────────────

        The last section before the charcoal footer, so it is the transition
        §21 asks for: sand steps the page down toward the footer's charcoal
        instead of dropping into it from ivory.

        The diagonal `from-surface to-background` gradient is gone. It was two
        near-identical near-blacks, so it cost a gradient and read as a flat
        fill; sand needs no help being distinct from the ivory above it.
      */}
      <section className="ground-sand border-y border-ground-border px-4 py-14 sm:px-6 md:px-10 md:py-24 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="eyebrow mb-5">{dict.home.newsletter.eyebrow}</p>
            <h2 className="mb-4 font-heading text-3xl font-normal text-ground sm:text-4xl">
              {dict.home.newsletter.heading}
            </h2>
            <p className="mb-8 md:mb-12 text-xs leading-relaxed text-ground-muted sm:text-sm">
              {dict.home.newsletter.lede}
            </p>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
