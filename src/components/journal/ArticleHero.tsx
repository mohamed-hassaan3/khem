import Image from "next/image";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatArticleDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
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
  const island = ltrIsland(locale);

  return (
    <header className="relative h-[70vh] min-h-125 w-full overflow-hidden">
      <Image
        src={article.image.url}
        alt={article.image.alt}
        fill
        priority
        sizes="100vw"
        className="scale-105 object-cover"
      />

      {/* One gradient, weighted to the bottom: it dissolves the lower edge into
          the page background *and* is what makes the title legible, so the
          photograph keeps the brightness the journal index gives it rather than
          being flattened by a second flat wash. */}
      <div
        className="banner-scrim banner-scrim-base"
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 px-4 pb-10 md:px-20 md:pb-24">
        <Reveal className="mx-auto max-w-350">
          <div className="max-w-4xl">
            {/* ── BREADCRUMB ──────────────────────────── */}
            <nav
              aria-label={dict.journal.article.breadcrumbLabel}
              className="mb-6 font-heading text-[10px] uppercase tracking-[0.25em] text-ground-muted"
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
              <span {...island}>{article.category}</span>
            </nav>

            <div {...island}>
              <p className="eyebrow mb-5">{article.category}</p>

              <h1 className="font-heading text-3xl font-normal leading-tight text-balance text-ground sm:text-5xl md:text-6xl">
                {article.title}
              </h1>
            </div>

            <div
              className="mt-8 h-px w-24 bg-linear-to-r from-gold to-transparent rtl:bg-linear-to-l"
              aria-hidden="true"
            />

            {/* ── META ────────────────────────────────── */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="text-[10px] tracking-widest text-ground-muted">
                {interpolate(dict.common.minRead, {
                  minutes: article.readTimeMinutes,
                })}
              </span>
              <span className="h-3 w-px bg-ivory/15" aria-hidden="true" />
              <time
                dateTime={article.publishedAt}
                className="text-[10px] tracking-wide text-ground-muted"
              >
                {formatArticleDate(article.publishedAt)}
              </time>
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
