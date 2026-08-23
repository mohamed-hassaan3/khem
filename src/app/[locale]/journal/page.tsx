import type { Metadata } from "next";
import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import JournalGrid from "@/src/components/journal/JournalGrid";
import { formatArticleDate } from "@/src/lib/format";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland, readingArrow } from "@/src/lib/i18n/rtl";
import {
  getFeaturedArticle,
  getJournalArticles,
  getJournalCategories,
} from "@/src/services/content";

/** ISR, 1 hour — AGENTS.md §8 routing matrix. */
export const revalidate = 3600;

const PATH = "/journal";

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
    title: dict.journal.meta.title,
    description: dict.journal.meta.description,
    ogTitle: dict.journal.meta.ogTitle,
    ogDescription: dict.journal.meta.ogDescription,
  });
}

export default async function Journal({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, articles, featured, categories] = await Promise.all([
    params,
    getJournalArticles(),
    getFeaturedArticle(),
    getJournalCategories(),
  ]);

  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);
  const island = ltrIsland(activeLocale);

  const rest = articles.filter((article) => article.id !== featured?.id);

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HEADER ─────────────────────────────────── */}
      <section className="bg-background px-4 pt-14 md:px-20 md:pt-32">
        <Reveal className="mx-auto max-w-350 pb-12">
          <p className="eyebrow mb-4">{dict.journal.eyebrow}</p>
          <h1 className="font-heading text-4xl font-normal text-ivory sm:text-6xl md:text-7xl">
            {dict.journal.heading}
          </h1>
        </Reveal>
      </section>

      {/* ── FEATURED ARTICLE ────────────────────────── */}
      {featured ? (
        <section className="bg-background px-4 pb-10 md:pb-16 md:px-20">
          <Reveal className="mx-auto max-w-350">
            <LocaleLink
              href={`/journal/${featured.slug}`}
              className="img-zoom group grid grid-cols-1 gap-0.5 bg-surface no-underline lg:grid-cols-2"
            >
              <div className="relative h-75 overflow-hidden lg:h-125">
                <Image
                  src={featured.image.url}
                  alt={featured.image.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover brightness-60 saturate-70"
                />
              </div>

              <div className="flex flex-col justify-center p-8 md:p-15">
                {/* Article metadata and copy come from the database — English only. */}
                <div className="mb-7 flex flex-wrap items-center gap-4" {...island}>
                  <span className="eyebrow">{featured.category}</span>
                  <span className="h-3 w-px bg-ivory/15" aria-hidden="true" />
                  <span className="text-[10px] tracking-widest text-ivory/30">
                    {interpolate(dict.common.minRead, {
                      minutes: featured.readTimeMinutes,
                    })}
                  </span>
                  <span className="h-3 w-px bg-ivory/15" aria-hidden="true" />
                  <time
                    dateTime={featured.publishedAt}
                    className="text-[10px] tracking-wide text-ivory/30"
                  >
                    {formatArticleDate(featured.publishedAt)}
                  </time>
                </div>

                <span className="mb-5 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/60">
                  <span aria-hidden="true">✦</span> {dict.journal.featured}
                </span>

                <div {...island}>
                  <h2 className="mb-6 font-heading text-xl font-normal leading-snug text-ivory sm:text-2xl md:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mb-9 text-sm leading-loose text-ivory/50">
                    {featured.excerpt}
                  </p>
                </div>

                <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-gold transition-transform duration-300 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                  {dict.journal.readArticle} {readingArrow(activeLocale)}
                </span>
              </div>
            </LocaleLink>
          </Reveal>
        </section>
      ) : null}

      {/* ── CATEGORY FILTER + GRID ──────────────────── */}
      <JournalGrid articles={rest} categories={categories} />
    </div>
  );
}
