import type { Metadata } from "next";
import Image from "next/image";
import { FlaskConical, Globe, Landmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import { revealStagger } from "@/src/components/animation/stagger";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { isLocale } from "@/src/lib/i18n/config";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCraftStats,
  getCraftSteps,
  getMissionStatements,
  getTimeline,
} from "@/src/services/content";

/**
 * /about — the house, the founder, and the thread from Kyphi to today.
 *
 * Built to the "KHEM — About Page Mock" canvas (`prompts/about-page-redesign.md`).
 * The repeating sections quote stored content rather than restating it, so the
 * figures, the timeline and the atelier stages read the same here as on
 * `/craftsmanship` and `/heritage`:
 *
 * | Section     | Table              | Revalidated by                |
 * | ----------- | ------------------ | ----------------------------- |
 * | Figures     | `CraftStat`        | `revalidateCraftsmanship()`   |
 * | Principles  | `MissionStatement` | `revalidateAbout()`           |
 * | Timeline    | `TimelineEvent`    | `revalidateHeritage()`        |
 * | Craft       | `CraftStep`        | `revalidateCraftsmanship()`   |
 *
 * Each of those sections disappears when its table is empty, and the section
 * numbers ("01 — The Name") count only what is shown.
 *
 * ISR, 24 hours — a backstop, not the freshness mechanism. The revalidators
 * above re-render this page on every write. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 86400;

const PATH = "/about";

const HERO_IMAGE =
  "https://res.cloudinary.com/co1xzkhf/image/upload/v1795705883/146DD9E7-D2D4-453F-80BA-FE35CD087EF1_1_102_o.jpg";
const FOUNDER_IMAGE =
  "https://res.cloudinary.com/co1xzkhf/image/upload/v1795705883/DDEB04BF-FA55-4392-965D-EECD8125196C_1_105_c.jpg";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Shared section gutters — the editorial pages' scale. */
const GUTTER = "px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16";
const SPLIT =
  "mx-auto grid max-w-7xl grid-cols-1 gap-10 md:gap-14 lg:grid-cols-2 lg:gap-20 xl:gap-24";
const H2 =
  "font-heading text-[clamp(30px,3.4vw,48px)] font-normal leading-[1.1] text-ground";

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

/** "01", or "٠١" in Arabic. */
function sectionNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    minimumIntegerDigits: 2,
  }).format(n);
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="about-eyebrow mb-5 md:mb-6">{children}</p>;
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <LocaleLink href={href} className="about-link">
      {children}
    </LocaleLink>
  );
}

export default async function About({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale: Locale = isLocale(locale) ? locale : "en";

  const [dict, missionStatements, timeline, craftSteps, craftStats] =
    await Promise.all([
      getDictionary(activeLocale),
      getMissionStatements(activeLocale),
      getTimeline(activeLocale),
      getCraftSteps(activeLocale),
      getCraftStats(activeLocale),
    ]);
  const t = dict.about;

  // Number only the sections that render, so an empty table never leaves a gap.
  let counter = 0;
  const next = (label: string) =>
    `${sectionNumber(++counter, activeLocale)} — ${label}`;

  const nameEyebrow = next(t.name.eyebrow);
  const founderEyebrow = next(t.founders.eyebrow);
  const principlesEyebrow =
    missionStatements.length > 0 ? next(t.principles.eyebrow) : "";
  const timelineEyebrow = timeline.length > 0 ? next(t.timeline.eyebrow) : "";
  const craftEyebrow = craftSteps.length > 0 ? next(t.craft.eyebrow) : "";
  const visitEyebrow = next(t.visit.eyebrow);

  const principleCols =
    missionStatements.length >= 3
      ? "md:grid-cols-2 lg:grid-cols-3"
      : missionStatements.length === 2
        ? "md:grid-cols-2"
        : "";

  const visitCards: {
    icon: LucideIcon;
    title: string;
    body: string;
    link: string;
    href: string;
  }[] = [
    {
      icon: Landmark,
      title: t.visit.boutiqueTitle,
      body: dict.footer.boutiqueAddress,
      link: t.visit.boutiqueLink,
      href: "/stockists",
    },
    {
      icon: FlaskConical,
      title: t.visit.consultationTitle,
      body: t.visit.consultationBody,
      link: t.visit.consultationLink,
      href: "/contact",
    },
    {
      icon: Globe,
      title: t.visit.stockistsTitle,
      body: t.visit.stockistsBody,
      link: t.visit.stockistsLink,
      href: "/stockists",
    },
  ];

  return (
    <div className="min-h-screen">
      <NavGround ground="ivory" />

      {/* ── HERO ─────────────────────────────────────── */}
      <section className={`ground-ivory ${GUTTER} pt-10 pb-14 md:pt-24 md:pb-28`}>
        <div className={`${SPLIT} items-center`}>
          <div>
            <Eyebrow>{t.hero.eyebrow}</Eyebrow>
            <h1 className="font-heading text-[clamp(38px,5.4vw,76px)] font-normal uppercase leading-[1.04] tracking-[0.02em] text-ground">
              {t.hero.headingLine1}
              <br />
              <span className="text-ground-accent">{t.hero.headingLine2}</span>
            </h1>
            <div aria-hidden="true" className="about-rule my-8 md:my-9" />
            <p className="max-w-130 text-base leading-[1.75] text-ground-muted md:text-lg">
              {t.hero.lede}
            </p>
            <div className="mt-10 flex flex-wrap gap-3.5 md:mt-11">
              <a href="#story" className="btn btn-primary">
                {t.hero.primary}
              </a>
              <LocaleLink href="/collections" className="btn btn-outline">
                {t.hero.secondary}
              </LocaleLink>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-ground-border pt-7 text-xs text-ground-muted md:mt-14">
              <div>
                <dt className="about-meta-label mb-1.5">{t.hero.foundedLabel}</dt>
                <dd>{t.hero.foundedValue}</dd>
              </div>
              <div>
                <dt className="about-meta-label mb-1.5">{t.hero.taglineLabel}</dt>
                <dd>{t.hero.taglineValue}</dd>
              </div>
            </dl>
          </div>

          <figure className="about-zoom relative aspect-4/5 w-full overflow-hidden rounded-[2px] bg-background">
            <Image
              src={HERO_IMAGE}
              alt={t.hero.imageAlt}
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 1280px) 600px, (min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </figure>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="ground-sand overflow-hidden border-y border-ground-border py-5"
      >
        <div className="about-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="about-marquee-run">
              {t.marquee.map((word) => (
                <span key={word} className="contents">
                  <span>{word}</span>
                  <span className="text-gold">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── 01 THE NAME ──────────────────────────────── */}
      <section
        id="story"
        className={`ground-sand ${GUTTER} scroll-mt-(--header-h) py-18 md:py-36`}
      >
        <div className={`${SPLIT} items-start`}>
          <Reveal>
            <Eyebrow>{nameEyebrow}</Eyebrow>
            <h2 className="font-heading text-[clamp(56px,9vw,136px)] font-normal uppercase leading-[0.95] tracking-[0.04em] text-ground">
              {t.name.word}
            </h2>
            <p className="mt-4 font-heading text-sm uppercase tracking-[0.24em] text-ground-muted md:text-base">
              {t.name.subtitle}
            </p>
          </Reveal>
          <Reveal delay={0.12} className="lg:pt-3">
            <p className="mb-5 text-xl font-light leading-normal text-ground md:text-[26px]">
              {t.name.lead}
            </p>
            <p className="text-base leading-[1.8] text-ground-muted">{t.name.body}</p>
            <div className="mt-9">
              <TextLink href="/heritage">{t.name.link}</TextLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FIGURES (CraftStat) ──────────────────────── */}
      {craftStats.length > 0 && (
        <section className={`ground-ivory ${GUTTER} py-4 md:py-12`}>
          <h2 className="sr-only">{t.facts.heading}</h2>
          <Reveal className="mx-auto max-w-7xl">
            <dl className="about-facts">
              {craftStats.map((stat) => (
                <div key={stat.id} className="about-fact">
                  <dt className="order-2 mt-3.5 text-[13px] leading-relaxed text-ground-muted">
                    {stat.label}
                  </dt>
                  <dd className="order-1 font-heading text-[clamp(36px,4vw,56px)] leading-none text-ground">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>
      )}

      {/* ── FOUNDER ──────────────────────────────────── */}
      <section
        className={`ground-ivory ${GUTTER} border-t border-ground-border py-16 md:py-32`}
      >
        <div className={`${SPLIT} items-center`}>
          <Reveal className="about-zoom relative aspect-4/5 w-full overflow-hidden rounded-[2px] border border-ground-border bg-stone">
            <Image
              src={FOUNDER_IMAGE}
              alt={t.founders.imageAlt}
              fill
              sizes="(min-width: 1280px) 600px, (min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </Reveal>

          <Reveal delay={0.12}>
            <Eyebrow>{founderEyebrow}</Eyebrow>
            <h2 className="mb-2 font-heading text-[clamp(32px,3.6vw,52px)] font-normal leading-[1.1] tracking-[0.02em] text-ground">
              {t.founders.heading}
            </h2>
            <p className="mb-8 text-[13px] tracking-[0.06em] text-ground-subtle">
              {t.founders.role}
            </p>
            <p className="mb-4.5 text-base leading-[1.8] text-ground-muted">
              {t.founders.body1}
            </p>
            <p className="text-base leading-[1.8] text-ground-muted">{t.founders.body2}</p>

            <figure className="mt-11 border-t border-gold pt-8">
              <blockquote>
                <p className="font-heading text-[clamp(20px,2vw,28px)] leading-[1.45] text-ground">
                  &ldquo;{t.founders.quote}&rdquo;
                </p>
              </blockquote>
              <figcaption className="about-meta-label mt-4.5 text-ground-accent!">
                {t.founders.quoteAuthor}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ── PRINCIPLES (MissionStatement) ────────────── */}
      {missionStatements.length > 0 && (
        <section
          className={`ground-ivory ${GUTTER} border-t border-ground-border py-14 md:py-28`}
        >
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6 md:mb-14">
              <div>
                <Eyebrow>{principlesEyebrow}</Eyebrow>
                <h2 className={H2}>{t.principles.heading}</h2>
              </div>
              <p className="max-w-95 text-[15px] leading-[1.75] text-ground-muted">
                {t.principles.lede}
              </p>
            </Reveal>

            <div className={`grid grid-cols-1 gap-6 ${principleCols}`}>
              {missionStatements.map((item, index) => (
                <Reveal
                  key={item.id}
                  as="article"
                  delay={revealStagger(index)}
                  className="about-card bg-stone px-7 pt-9 pb-10 md:px-8 md:pt-10 md:pb-11"
                >
                  <p className="font-heading text-[13px] tracking-[0.2em] text-ground-accent">
                    {ROMAN[index] ?? index + 1} · {item.label}
                  </p>
                  <h3 className="mt-12 mb-3.5 font-heading text-[21px] font-normal tracking-[0.04em] text-ground md:mt-14">
                    {item.title}
                  </h3>
                  <p className="text-[15px] leading-[1.75] text-ground-muted">{item.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TIMELINE (TimelineEvent) ─────────────────── */}
      {timeline.length > 0 && (
        <section className={`ground-sand ${GUTTER} py-16 md:py-32`}>
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 max-w-160 md:mb-16">
              <Eyebrow>{timelineEyebrow}</Eyebrow>
              <h2 className={H2}>{t.timeline.heading}</h2>
            </Reveal>

            <ol className="about-timeline">
              {timeline.map((event, index) => (
                <Reveal
                  key={event.id}
                  as="li"
                  delay={revealStagger(index)}
                  className="about-tl-item"
                >
                  <span aria-hidden="true" className="about-tl-marker" />
                  <p className="mb-3 font-heading text-xs uppercase tracking-[0.22em] text-ground-accent">
                    {event.year}
                  </p>
                  <h3 className="mb-2.5 font-heading text-xl font-normal text-ground">
                    {event.title}
                  </h3>
                  <p className="text-sm leading-[1.7] text-ground-muted">{event.description}</p>
                </Reveal>
              ))}
            </ol>

            <div className="mt-12 md:mt-14">
              <TextLink href="/heritage">{t.timeline.link}</TextLink>
            </div>
          </div>
        </section>
      )}

      {/* ── CRAFT (CraftStep) ────────────────────────── */}
      {craftSteps.length > 0 && (
        <section className={`ground-ivory ${GUTTER} py-16 md:py-32`}>
          <div className="mx-auto max-w-7xl">
            <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6 md:mb-14">
              <div>
                <Eyebrow>{craftEyebrow}</Eyebrow>
                <h2 className={H2}>{t.craft.heading}</h2>
              </div>
              <TextLink href="/craftsmanship">{t.craft.link}</TextLink>
            </Reveal>

            <ol className="grid grid-cols-1 border-t border-ground-border md:grid-cols-2 lg:grid-cols-3">
              {craftSteps.map((step, index) => (
                <Reveal
                  key={step.id}
                  as="li"
                  delay={revealStagger(index)}
                  className="border-b border-ground-border py-8 pe-8 md:py-9"
                >
                  <p className="font-heading text-[13px] tracking-[0.16em] text-ground-accent">
                    {step.number}
                  </p>
                  <h3 className="mt-5 mb-2.5 font-heading text-[19px] font-normal text-ground">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-[1.7] text-ground-muted">{step.subtitle}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── THE PROMISE ──────────────────────────────── */}
      <section className="ground-charcoal relative flex min-h-105 items-center overflow-hidden md:min-h-130">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 520"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          <g className="text-gold" strokeOpacity="0.24">
            <path d="M0 470 L720 90 L1440 470" />
            <path d="M180 470 L720 185 L1260 470" />
            <path d="M360 470 L720 280 L1080 470" />
            <path d="M0 470 H1440" />
          </g>
        </svg>
        <Reveal className={`relative w-full ${GUTTER} py-20 text-center md:py-24`}>
          <p className="about-eyebrow mb-7 text-gold!">{t.promise.eyebrow}</p>
          <h2 className="mx-auto max-w-225 font-heading text-[clamp(34px,5vw,72px)] font-normal uppercase leading-[1.1] tracking-[0.03em] text-ivory">
            {t.promise.heading}
          </h2>
          <p className="mx-auto mt-7 max-w-130 text-base leading-[1.8] text-dim">
            {t.promise.lede}
          </p>
        </Reveal>
      </section>

      {/* ── VISIT ────────────────────────────────────── */}
      <section className={`ground-ivory ${GUTTER} py-16 md:py-30`}>
        <div className="mx-auto max-w-7xl">
          <Reveal className="mb-12 text-center md:mb-14">
            <Eyebrow>{visitEyebrow}</Eyebrow>
            <h2 className={H2}>{t.visit.heading}</h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {visitCards.map(({ icon: Icon, title, body, link, href }, index) => (
              <Reveal
                key={title}
                as="article"
                delay={revealStagger(index)}
                className="about-card flex flex-col px-7 py-8 md:px-8 md:py-9"
              >
                <Icon aria-hidden="true" size={28} strokeWidth={1.25} className="text-ground-accent" />
                <h3 className="mt-7 mb-2.5 font-heading text-[19px] font-normal text-ground">
                  {title}
                </h3>
                <p className="mb-7 flex-1 whitespace-pre-line text-sm leading-[1.7] text-ground-muted">
                  {body}
                </p>
                <div>
                  <TextLink href={href}>{link}</TextLink>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section
        className={`ground-sand ${GUTTER} border-t border-ground-border py-18 text-center md:py-34`}
      >
        <Reveal className="mx-auto max-w-2xl">
          <Image
            src="/logo/logo-transparent.svg"
            alt=""
            width={62}
            height={72}
            className="mx-auto mb-8 h-18 w-auto"
          />
          <h2 className="font-heading text-[clamp(34px,4.4vw,64px)] font-normal uppercase leading-[1.05] tracking-[0.04em] text-ground">
            {t.cta.heading}
          </h2>
          <p className="mx-auto mt-5 max-w-115 text-base leading-[1.75] text-ground-muted">
            {t.cta.lede}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3.5 sm:flex-row md:mt-11">
            <LocaleLink href="/collections" className="btn btn-primary">
              {t.cta.primary}
            </LocaleLink>
            <LocaleLink href="/heritage" className="btn btn-outline">
              {t.cta.secondary}
            </LocaleLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
