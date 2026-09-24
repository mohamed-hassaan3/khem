import type { Metadata } from "next";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import {
  getCraftStats,
  getCraftSteps,
  getMasterPerfumerQuote,
} from "@/src/services/content";

/**
 * ISR, 24 hours — a backstop, not the freshness mechanism.
 *
 * `revalidateCraftsmanship()` re-renders this page whenever a step, stat or
 * quote changes, so the window only has to catch what that misses.
 *
 * It was an hour, which at this site's traffic meant most requests landed past
 * the window and paid for a regeneration. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 86400;

const PATH = "/craftsmanship";

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
    title: dict.craftsmanship.meta.title,
    description: dict.craftsmanship.meta.description,
    ogTitle: dict.craftsmanship.meta.ogTitle,
    ogDescription: dict.craftsmanship.meta.ogDescription,
  });
}

/** Stagger step between grid children, in seconds. */
const STAGGER_STEP = 0.1;

export default async function Craftsmanship({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The locale is resolved before the content is fetched, because the steps,
  // stats and quote are now read in the visitor's language.
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [steps, stats, quote] = await Promise.all([
    getCraftSteps(activeLocale),
    getCraftStats(activeLocale),
    getMasterPerfumerQuote(activeLocale),
  ]);
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  return (
    <div className="min-h-screen">
      <NavGround ground="ivory" />
      {/* ── HERO ───────────────────────────────────── */}
      {/*
        The page banner, as photography rather than as a dark mode.

        Every editorial page opened on the same thing: a full-viewport image
        crushed to a fifth of its brightness under an obsidian ground. §14 is
        blunt about it — repeating that banner is what "forces every page into
        a dark visual mode", and it was doing so above the fold on six routes.

        Three changes, the same three everywhere this pattern appears.

        The height comes down from the whole viewport, so the banner introduces
        the page rather than being the page, and the first light section is
        visible without scrolling. The image runs at its own luminance with no
        filter at all. And the type is charcoal on an ivory gradient rather than
        ivory on a darkened photograph — which is what makes this one banner
        language with the collection and category banners instead of a third.

        No top padding: the banner begins at the very top of the viewport and
        its photograph continues *behind* the header, which floats over it.
        Padding here would reserve a strip of blank ground above the image — a
        header area by another name, and precisely what the floating bar exists
        to avoid.

        No top padding, and no clearance maths: the page wrapper in
        `layout.tsx` reserves `--header-h` for the whole document, so this
        banner already starts below the nav rather than behind it. The section
        is sized to its own composition and nothing else.

        This carried a `pt-20` and an inflated `min-h` while the header floated
        over the content — both existed only to keep the heading out from under
        the bar, and both are dead weight now that the bar occupies its own
        space.
      */}
      <section className="ground-ivory relative flex h-[70vh] min-h-165 items-center overflow-hidden bg-sand">
        <Image
          src="https://res.cloudinary.com/co1xzkhf/image/upload/craftsmanship-hero-banner.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="banner-scrim banner-scrim-center" />

        <div className="relative z-10 max-w-2xl px-4 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">{dict.craftsmanship.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ground sm:text-6xl md:text-7xl lg:text-8xl">
            {dict.craftsmanship.hero.headingLine1}
            <br />
            <span className="text-ground-accent">
              {dict.craftsmanship.hero.headingLine2}
            </span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ground-muted">
            {dict.craftsmanship.hero.lede}
          </p>
        </div>

        <div className="absolute bottom-12 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
          <p className="text-[9px] uppercase tracking-[0.3em] text-ground-muted/70">
            {dict.craftsmanship.hero.scrollHint}
          </p>
          <div className="h-15 w-px bg-linear-to-b from-gold/50 to-transparent" />
        </div>
      </section>

      {/* ── STAT BAND ──────────────────────────────── */}
      <section className="ground-sand border-b border-ground-border">
        <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal
              key={stat.id}
              delay={index * STAGGER_STEP}
              // Dividers by index: never on the last column of the current
              // grid, so the 2-col mobile layout leaves no dangling border.
              className={`border-ground-border px-4 py-12 text-center md:px-12 md:py-14 ${
                index % 2 === 0 ? "border-e" : index === 1 ? "lg:border-e" : ""
              } ${index < 2 ? "border-b lg:border-b-0" : ""}`}
            >
              <p className="mb-2.5 font-heading text-4xl font-semibold text-ground-accent sm:text-5xl md:text-6xl">
                {stat.value}
              </p>
              {/* Stat labels come from the database — English only. */}
              <p
                {...island}
                className="text-[11px] leading-relaxed tracking-[0.12em] text-ground-muted"
              >
                {stat.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROCESS STEPS ──────────────────────────── */}
      {steps.map((step, index) => {
        const isImageFirst = index % 2 === 0;

        return (
          <section
            key={step.id}
            className={`border-t border-ground-border ${
              /*
                §16: the craft process alternates between two *light* grounds
                now. It used to alternate obsidian and sand, so scrolling the
                page strobed dark-light-dark-light — the single clearest
                instance of the switching the redesign removes.
              */
              isImageFirst ? "ground-ivory" : "ground-sand"
            }`}
          >
            <div className="grid grid-cols-1 lg:min-h-155 lg:grid-cols-2">
              {/* Image — always first on mobile, alternating from lg. */}
              <div
                className={`img-zoom relative aspect-4/3 overflow-hidden lg:aspect-auto ${
                  isImageFirst ? "" : "lg:order-2"
                }`}
              >
                <Image
                  src={step.image.url}
                  alt={step.image.alt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <span
                  aria-hidden="true"
                  className={`absolute top-8 font-heading text-7xl font-semibold leading-none text-gold/15 md:top-10 md:text-8xl ${
                    isImageFirst ? "start-8 md:start-10" : "end-8 md:end-10"
                  }`}
                >
                  {step.number}
                </span>
              </div>

              {/* Text */}
              <div className="flex flex-col justify-center px-4 py-10 md:py-16 md:px-16 lg:py-20">
                <Reveal>
                  <p className="eyebrow mb-3">
                    {interpolate(dict.craftsmanship.steps.label, {
                      number: step.number,
                    })}
                  </p>
                  {/* Step copy comes from the database — English only. */}
                  <div {...island}>
                    <h2 className="mb-2.5 font-heading text-2xl font-normal leading-snug text-ground sm:text-3xl md:text-4xl">
                      {step.title}
                    </h2>
                    <p className="mb-8 font-heading text-sm italic tracking-wide text-ground-accent/70">
                      {step.subtitle}
                    </p>
                    <div className="gold-line mb-8" />
                    <p className="text-sm leading-loose text-ground-muted">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── MASTER PERFUMER QUOTE ──────────────────── */}
      {quote ? (
        <section className="relative min-h-100 border-t border-ground-border md:h-[60vh]">
          <Image
            src="https://res.cloudinary.com/co1xzkhf/image/upload/v1790240635/MASTER-PERFUMER-QUOTE.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover brightness-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Reveal className="max-w-3xl px-4 py-12 md:py-20 text-center md:px-20">
              <div className="gold-line mx-auto mb-9" />
              {/* The quote comes from the database — English only. */}
              <div {...island}>
                <p className="mb-7 font-heading text-xl italic leading-relaxed text-ground sm:text-2xl md:text-3xl">
                  &ldquo;{quote.quote}&rdquo;
                </p>
                <p className="mb-1.5 font-heading text-xs tracking-[0.2em] text-ground-accent">
                  {quote.author}
                </p>
                <p className="text-[11px] tracking-[0.1em] text-ground-muted">
                  {quote.authorTitle}
                </p>
              </div>
              <div className="gold-line mx-auto mt-9" />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ── CTA ────────────────────────────────────── */}
      <section className="ground-ivory border-t border-ground-border px-4 py-14 text-center sm:px-6 md:px-10 md:py-30 lg:px-12 xl:px-16">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">{dict.craftsmanship.cta.eyebrow}</p>
          <h2 className="mb-5 font-heading text-2xl font-normal text-ground sm:text-3xl md:text-4xl">
            {dict.craftsmanship.cta.heading}
          </h2>
          <p className="mb-11 text-[13px] leading-loose text-ground-muted">
            {dict.craftsmanship.cta.lede}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="btn btn-primary"
            >
              {dict.craftsmanship.cta.primary}
            </LocaleLink>
            <LocaleLink href="/ingredients" className="btn btn-outline">
              {dict.craftsmanship.cta.secondary}
            </LocaleLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
