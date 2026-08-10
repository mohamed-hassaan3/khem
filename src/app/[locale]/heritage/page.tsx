import type { Metadata } from "next";
import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { getBrandValues, getTimeline } from "@/src/services/content";

/** ISR, 1 hour — editorial copy, aligned with the other content routes. */
export const revalidate = 3600;

const PATH = "/heritage";

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
    title: dict.heritage.meta.title,
    description: dict.heritage.meta.description,
    ogTitle: dict.heritage.meta.ogTitle,
    ogDescription: dict.heritage.meta.ogDescription,
  });
}

/** Stagger step between siblings, in seconds. */
const STAGGER_STEP = 0.1;

/**
 * The two halves of a timeline entry, defined once and placed on either side of
 * the rail depending on the row's parity.
 */
function TimelineYear({
  year,
  className = "",
}: {
  year: string;
  className?: string;
}) {
  return (
    <p
      className={`font-heading text-xl font-semibold text-gold ${className}`.trim()}
    >
      {year}
    </p>
  );
}

function TimelineCopy({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h3 className="mb-3 font-heading text-[15px] font-normal text-ivory">
        {title}
      </h3>
      <p className="text-[13px] leading-relaxed text-ivory/45">{description}</p>
    </>
  );
}

export default async function Heritage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, timeline, values] = await Promise.all([
    params,
    getTimeline(),
    getBrandValues(),
  ]);

  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-screen min-h-150 items-center overflow-hidden bg-black">
        <Image
          src="https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=1800&h=1000&fit=crop&auto=format"
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover brightness-30 saturate-50"
        />
        <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-background/30 rtl:bg-linear-to-l" />

        <div className="relative z-10 max-w-2xl px-6 md:px-20 lg:px-30">
          <p className="eyebrow mb-5">{dict.heritage.hero.eyebrow}</p>
          <h1 className="mb-8 font-heading text-5xl font-normal leading-none text-ivory sm:text-6xl md:text-7xl lg:text-8xl">
            {dict.heritage.hero.headingLine1}
            <br />
            <span className="text-gold">{dict.heritage.hero.headingLine2}</span>
          </h1>
          <div className="gold-line mb-8" />
          <p className="max-w-lg text-sm leading-loose text-ivory/55">
            {dict.heritage.hero.lede}
          </p>
        </div>
      </section>

      {/* ── PHILOSOPHY ──────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_2fr] lg:gap-25">
          <Reveal>
            <p className="eyebrow mb-6">{dict.heritage.philosophy.eyebrow}</p>
            <div className="section-divider mx-0 h-25" />
          </Reveal>

          <Reveal delay={STAGGER_STEP * 2}>
            <h2 className="mb-10 font-heading text-2xl font-normal leading-snug text-ivory sm:text-3xl lg:text-5xl">
              {dict.heritage.philosophy.heading}
            </h2>
            <p className="mb-6 text-sm leading-loose text-ivory/50">
              {dict.heritage.philosophy.body1}
            </p>
            <p className="text-sm leading-loose text-ivory/50">
              {dict.heritage.philosophy.body2}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── QUOTE BAND ──────────────────────────────── */}
      <section className="relative h-[60vh] min-h-100 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1762530211537-011645caef57?w=1800&h=700&fit=crop&auto=format"
          alt=""
          fill
          sizes="100vw"
          className="object-cover brightness-40 saturate-60"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 px-6 md:px-20">
          <Reveal className="text-center">
            <p className="mx-auto max-w-3xl font-heading text-lg leading-relaxed tracking-widest text-ivory sm:text-2xl md:text-4xl">
              {dict.heritage.quoteBand}
            </p>
            <div className="gold-line mx-auto mt-7" />
          </Reveal>
        </div>
      </section>

      {/* ── TIMELINE ────────────────────────────────── */}
      <section className="bg-background px-6 py-24 md:px-20 md:py-36">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-16 text-center md:mb-25">
            <p className="eyebrow mb-5">{dict.heritage.timeline.eyebrow}</p>
            <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
              {dict.heritage.timeline.heading}
            </h2>
          </Reveal>

          <div className="relative">
            {/* Rail: leading edge on mobile, centered from md up. */}
            <div
              className="absolute inset-y-0 start-1.5 w-px bg-linear-to-b from-transparent via-gold/30 to-transparent md:start-1/2 md:-translate-x-1/2 md:rtl:translate-x-1/2"
              aria-hidden="true"
            />

            <ol className="flex flex-col gap-14 md:gap-20">
              {timeline.map((event, index) => {
                // Even entries put the year before the rail and the copy after;
                // odd entries mirror it. Below `md` every entry is rail-leading.
                const yearFirst = index % 2 === 0;

                return (
                  <li key={event.id}>
                    <Reveal
                      delay={(index % 3) * STAGGER_STEP}
                      className="grid grid-cols-[auto_1fr] items-start gap-6 md:grid-cols-[1fr_60px_1fr] md:gap-8"
                    >
                      {/* Before the rail — desktop only. */}
                      <div className="hidden pt-2 text-end md:block">
                        {yearFirst ? (
                          <TimelineYear year={event.year} />
                        ) : (
                          <div {...island}>
                            <TimelineCopy
                              title={event.title}
                              description={event.description}
                            />
                          </div>
                        )}
                      </div>

                      <div
                        className="flex justify-center pt-2"
                        aria-hidden="true"
                      >
                        <span className="mt-1.5 h-3 w-3 flex-none rounded-full border-2 border-gold bg-background" />
                      </div>

                      {/* After the rail — and the only cell below `md`. */}
                      <div className="md:pt-2">
                        <div className="md:hidden">
                          <TimelineYear year={event.year} className="mb-2" />
                          <div {...island}>
                            <TimelineCopy
                              title={event.title}
                              description={event.description}
                            />
                          </div>
                        </div>
                        <div className="hidden md:block">
                          {yearFirst ? (
                            <div {...island}>
                              <TimelineCopy
                                title={event.title}
                                description={event.description}
                              />
                            </div>
                          ) : (
                            <TimelineYear year={event.year} />
                          )}
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ── VALUES ──────────────────────────────────── */}
      <section className="border-t border-border bg-surface px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto max-w-350">
          <Reveal className="mb-16 text-center md:mb-20">
            <p className="eyebrow mb-5">{dict.heritage.values.eyebrow}</p>
            <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl md:text-5xl">
              {dict.heritage.values.heading}
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <Reveal
                key={value.id}
                delay={index * STAGGER_STEP}
                className="bg-background p-10 md:p-12"
              >
                <div className="gold-line mb-8" />
                {/* Brand values come from `src/data` — English only. */}
                <div {...island}>
                  <h3 className="mb-5 font-heading text-xl font-normal text-ivory">
                    {value.title}
                  </h3>
                  <p className="text-[13px] leading-loose text-ivory/45">
                    {value.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="bg-background px-6 py-24 text-center md:px-20 md:py-30">
        <Reveal className="mx-auto max-w-xl">
          <p className="eyebrow mb-5">{dict.heritage.cta.eyebrow}</p>
          <h2 className="mb-10 font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">
            {dict.heritage.cta.heading}
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <LocaleLink
              href="/collections"
              className="btn-luxury btn-luxury-fill"
            >
              {dict.heritage.cta.primary}
            </LocaleLink>
            <LocaleLink href="/craftsmanship" className="btn-luxury">
              {dict.heritage.cta.secondary}
            </LocaleLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
