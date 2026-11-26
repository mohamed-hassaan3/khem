import type { Metadata } from "next";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";
import EditorialHero from "@/src/components/editorial/EditorialHero";
import Reveal from "@/src/components/animation/Reveal";
import { revealStagger } from "@/src/components/animation/stagger";
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
      <EditorialHero
        image={{
          src: "https://res.cloudinary.com/co1xzkhf/image/upload/craftsmanship-hero-banner.png",
          alt: "",
        }}
        eyebrow={dict.craftsmanship.hero.eyebrow}
        lines={[
          dict.craftsmanship.hero.headingLine1,
          dict.craftsmanship.hero.headingLine2,
        ]}
        lede={dict.craftsmanship.hero.lede}
        scrim="center"
      >
        <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <p className="text-[9px] uppercase tracking-[0.3em] text-ground-muted/70">
            {dict.craftsmanship.hero.scrollHint}
          </p>
          <div className="h-15 w-px bg-linear-to-b from-gold/50 to-transparent" />
        </div>
      </EditorialHero>

      {/* ── STAT BAND ──────────────────────────────── */}
      <section className="ground-sand border-b border-ground-border">
        <div className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal
              key={stat.id}
              delay={revealStagger(index)}
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
                className={`img-zoom relative aspect-3/2 overflow-hidden sm:aspect-4/3 lg:aspect-auto ${
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
                  className={`absolute top-8 font-heading text-7xl font-semibold leading-none text-ivory/45 md:top-10 md:text-8xl ${
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
