import type { Metadata } from "next";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { getMissionStatements } from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

const PATH = "/about";

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
    title: dict.about.meta.title,
    description: dict.about.meta.description,
    ogTitle: dict.about.meta.ogTitle,
    ogDescription: dict.about.meta.ogDescription,
  });
}

/** Stagger step between grid children, in seconds. */
const STAGGER_STEP = 0.1;

export default async function About({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const missionStatements = await getMissionStatements(activeLocale);
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  return (
    <div className="min-h-screen">
      {/* §18's journey: black → sand → ivory → black → ivory. */}
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
          src="https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1800&h=1000&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="banner-scrim banner-scrim-column" />

        <div className="relative z-10 max-w-2xl px-4 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">{dict.about.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ground sm:text-6xl md:text-7xl lg:text-8xl">
            {dict.about.hero.headingLine1}
            <br />
            <span className="text-ground-accent">{dict.about.hero.headingLine2}</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ground-muted">
            {dict.about.hero.lede}
          </p>
        </div>
      </section>

      {/* ── FOUNDERS ────────────────────────────────── */}
      <section className="ground-sand px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 md:gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative aspect-4/5 w-full overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=700&h=800&fit=crop&auto=format"
              alt={dict.about.founders.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <p className="eyebrow mb-5">{dict.about.founders.eyebrow}</p>
            <h2 className="mb-8 font-heading text-2xl font-normal leading-snug text-ground sm:text-3xl md:text-4xl">
              {dict.about.founders.heading}
            </h2>
            <div className="gold-line mb-8" />
            <p className="mb-5 text-sm leading-loose text-ground-muted">
              {dict.about.founders.body1}
            </p>
            <p className="mb-6 md:mb-10 text-sm leading-loose text-ground-muted">
              {dict.about.founders.body2}
            </p>

            <blockquote className="border-s-2 border-gold ps-6">
              <p className="mb-3 font-heading text-base italic leading-relaxed text-ground">
                &ldquo;{dict.about.founders.quote}&rdquo;
              </p>
              <cite className="text-[11px] not-italic tracking-widest text-ground-accent/60">
                — {dict.about.founders.quoteAuthor}
              </cite>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ── MISSION & VISION ────────────────────────── */}
      <section className="ground-ivory border-y border-ground-border">
        <div className="mx-auto grid max-w-350 grid-cols-1 md:grid-cols-2">
          {missionStatements.map((item, index) => (
            <Reveal
              key={item.id}
              delay={index * STAGGER_STEP}
              className={
                index === 0
                  ? "border-b border-ground-border p-10 md:border-b-0 md:border-e md:p-20"
                  : "p-10 md:p-20"
              }
            >
              {/* Mission copy comes from the database — English only. */}
              <div {...island}>
                <p className="eyebrow mb-6">{item.label}</p>
                <h2 className="mb-7 font-heading text-2xl font-normal text-ground sm:text-3xl">
                  {item.title}
                </h2>
                <div className="gold-line mb-7" />
                <p className="text-sm leading-loose text-ground-muted">
                  {item.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="ground-sand border-t border-ground-border px-4 py-14 text-center sm:px-6 md:px-10 md:py-30 lg:px-12 xl:px-16">
        <Reveal className="mx-auto max-w-xl">
          <h2 className="mb-6 md:mb-10 font-heading text-2xl font-normal text-ground sm:text-3xl md:text-4xl">
            {dict.about.cta.heading}
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="btn btn-primary"
            >
              {dict.about.cta.primary}
            </LocaleLink>
            <LocaleLink href="/heritage" className="btn btn-outline">
              {dict.about.cta.secondary}
            </LocaleLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
