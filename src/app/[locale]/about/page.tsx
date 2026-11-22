import type { Metadata } from "next";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";
import EditorialHero from "@/src/components/editorial/EditorialHero";
import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { getMissionStatements } from "@/src/services/content";

/**
 * ISR, 24 hours — a backstop, not the freshness mechanism.
 *
 * `revalidateAbout()` re-renders this page whenever a mission statement
 * changes, so the window only has to catch what that misses.
 *
 * It was an hour, which at this site's traffic meant most requests landed past
 * the window and paid for a regeneration. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 86400;

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
      <EditorialHero
        image={{
          src: "https://res.cloudinary.com/co1xzkhf/image/upload/v1790357791/About-KHEM-banner.jpg",
          alt: "",
        }}
        eyebrow={dict.about.hero.eyebrow}
        lines={[dict.about.hero.headingLine1, dict.about.hero.headingLine2]}
        lede={dict.about.hero.lede}
      />

      {/* ── FOUNDERS ────────────────────────────────── */}
      <section className="ground-sand px-4 py-14 sm:px-6 md:px-10 md:py-36 lg:px-12 xl:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 md:gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative aspect-4/5 w-full overflow-hidden">
            <Image
              src="https://res.cloudinary.com/co1xzkhf/image/upload/v1790357882/KHEM_profile.jpg"
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
                {dict.about.founders.quoteAuthor}
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
            <LocaleLink href="/collections" className="btn btn-primary">
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
