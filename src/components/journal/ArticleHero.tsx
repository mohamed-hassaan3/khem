import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatArticleDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { JournalArticle } from "@/src/types/content";

/**
 * The article banner — Server Component.
 *
 * An exhibition plate rather than a boxed image: the photograph runs the full
 * width, is held back to about a third of its brightness, and its lower edge is
 * dissolved into `--color-background` by a gradient so the page below appears
 * to continue out of it rather than start after it.
 *
 * The image is the LCP element on this route, so it is `priority` and its box
 * is fixed in advance — nothing here may move once the photograph decodes.
 */

export interface ArticleHeroProps {
  article: JournalArticle;
  locale: Locale;
}

export default async function ArticleHero({
  article,
  locale,
}: ArticleHeroProps) {
  const dict = await getDictionary(locale);

  return (
    <header className="relative w-full overflow-hidden md:h-[70vh] md:min-h-125">
      {/*
       * Phones: the photograph as a band with the title beneath it. Over a
       * full-width photograph at 390px the floor gradient had to cover most
       * of the picture to keep a three-line title legible.
       */}
      <div className="relative aspect-4/3 w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto">
      <Image
        src={article.image.url}
        alt={article.image.alt}
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="scale-105 object-cover"
      />
      </div>

      {/* One gradient, weighted to the bottom: it dissolves the lower edge into
          the page background *and* is what makes the title legible, so the
          photograph keeps the brightness the journal index gives it rather than
          being flattened by a second flat wash. */}
      <div
        className="banner-scrim banner-scrim-base hidden md:block"
        aria-hidden="true"
      />

      <div className="relative px-4 pb-2 pt-6 md:absolute md:inset-x-0 md:bottom-0 md:px-20 md:pb-24 md:pt-0">
        <Reveal className="mx-auto max-w-350">
          <div className="max-w-4xl">
            {/* ── BREADCRUMB ──────────────────────────── */}
            <nav
              aria-label={dict.journal.article.breadcrumbLabel}
              className="mb-4 font-heading text-[10px] uppercase tracking-[0.25em] text-ground-muted md:mb-6"
            >
              <LocaleLink
                href="/journal"
                className="no-underline transition-colors duration-300 ease-out hover:text-ground-accent"
              >
                {dict.journal.article.journal}
              </LocaleLink>
              <span className="mx-3 text-ground-muted" aria-hidden="true">
                /
              </span>
              <span dir="auto">{article.categoryLabel}</span>
            </nav>

            <div dir="auto">
              <p className="eyebrow mb-3 hidden md:mb-5 md:block">{article.categoryLabel}</p>

              <h1 className="font-heading text-3xl font-normal leading-tight text-balance text-ground sm:text-5xl md:text-6xl">
                {article.title}
              </h1>
            </div>

            <div
              className="mt-5 h-px w-24 md:mt-8 bg-linear-to-r from-gold to-transparent rtl:bg-linear-to-l"
              aria-hidden="true"
            />

            {/* ── META ────────────────────────────────── */}
            <div className="mt-4 flex flex-wrap items-center gap-4 md:mt-8">
              <span className="text-[10px] tracking-widest text-ground-muted">
                {interpolate(dict.common.minRead, {
                  minutes: article.readTimeMinutes,
                })}
              </span>
              <span className="h-3 w-px bg-ground-border" aria-hidden="true" />
              <time
                dateTime={article.publishedAt}
                className="text-[10px] tracking-wide text-ground-muted"
              >
                {formatArticleDate(article.publishedAt, locale)}
              </time>
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
