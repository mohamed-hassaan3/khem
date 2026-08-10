import type { Metadata } from "next";
import Image from "next/image";

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
  const [{ locale }, missionStatements] = await Promise.all([
    params,
    getMissionStatements(),
  ]);

  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-screen min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1800&h=1000&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-[0.25] saturate-50"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/60 to-transparent rtl:bg-linear-to-l" />

        <div className="relative z-10 max-w-2xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">{dict.about.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-6xl md:text-7xl lg:text-8xl">
            {dict.about.hero.headingLine1}
            <br />
            <span className="text-gold">{dict.about.hero.headingLine2}</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/50">
            {dict.about.hero.lede}
          </p>
        </div>
      </section>

      {/* ── FOUNDERS ────────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative aspect-4/5 w-full overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=700&h=800&fit=crop&auto=format"
              alt={dict.about.founders.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover brightness-60 saturate-50"
            />
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <p className="eyebrow mb-5">{dict.about.founders.eyebrow}</p>
            <h2 className="mb-8 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl md:text-4xl">
              {dict.about.founders.heading}
            </h2>
            <div className="gold-line mb-8" />
            <p className="mb-5 text-sm leading-loose text-ivory/50">
              {dict.about.founders.body1}
            </p>
            <p className="mb-10 text-sm leading-loose text-ivory/50">
              {dict.about.founders.body2}
            </p>

            <blockquote className="border-s-2 border-gold ps-6">
              <p className="mb-3 font-heading text-base italic leading-relaxed text-ivory">
                &ldquo;{dict.about.founders.quote}&rdquo;
              </p>
              <cite className="text-[11px] not-italic tracking-widest text-gold/60">
                — {dict.about.founders.quoteAuthor}
              </cite>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ── MISSION & VISION ────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-350 grid-cols-1 md:grid-cols-2">
          {missionStatements.map((item, index) => (
            <Reveal
              key={item.id}
              delay={index * STAGGER_STEP}
              className={
                index === 0
                  ? "border-b border-border p-10 md:border-b-0 md:border-e md:p-20"
                  : "p-10 md:p-20"
              }
            >
              {/* Mission copy comes from `src/data` — English only. */}
              <div {...island}>
                <p className="eyebrow mb-6">{item.label}</p>
                <h2 className="mb-7 font-heading text-2xl font-normal text-ivory sm:text-3xl">
                  {item.title}
                </h2>
                <div className="gold-line mb-7" />
                <p className="text-sm leading-loose text-ivory/50">
                  {item.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="bg-background px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <h2 className="mb-10 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            {dict.about.cta.heading}
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="btn-luxury btn-luxury-fill"
            >
              {dict.about.cta.primary}
            </LocaleLink>
            <LocaleLink href="/heritage" className="btn-luxury">
              {dict.about.cta.secondary}
            </LocaleLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
