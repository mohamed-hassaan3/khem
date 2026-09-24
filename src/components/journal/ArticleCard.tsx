import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatArticleDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { readingArrow } from "@/src/lib/i18n/rtl";
import type { JournalArticle } from "@/src/types/content";

/**
 * One journal card.
 *
 * Rendered from both sides of the boundary: `<JournalGrid>` is a Client
 * Component (its category filter is client-side state) and `<RelatedArticles>`
 * is a Server Component. So this takes its copy as props rather than reaching
 * for `getDictionary()` or `useDictionary()` — either choice would have tied it
 * to one side and forked the card design in two.
 *
 * The alternative was a second card component for the related rail, which is
 * how two grids that are meant to look identical stop looking identical.
 */

export interface ArticleCardLabels {
  /** `dict.journal.read` — the link affordance. */
  read: string;
  /** `dict.common.minRead` — a template carrying `{minutes}`. */
  minRead: string;
}

export interface ArticleCardProps {
  article: JournalArticle;
  locale: Locale;
  labels: ArticleCardLabels;
  sizes?: string;
}

const DEFAULT_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default function ArticleCard({
  article,
  locale,
  labels,
  sizes = DEFAULT_SIZES,
}: ArticleCardProps) {
  return (
    <LocaleLink
      href={`/journal/${article.slug}`}
      className="card img-zoom group block overflow-hidden no-underline"
    >
      <div className="relative h-60 overflow-hidden">
        <Image
          src={article.image.url}
          alt={article.image.alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>

      <div className="px-7 pb-9 pt-7" dir="auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          {/* <span className="eyebrow text-[9px]">{article.category}</span> */}
          <span className="eyebrow text-[9px]">{article.categoryLabel}</span>
          <span className="text-[10px] tracking-wide text-ground-muted/70">
            {interpolate(labels.minRead, { minutes: article.readTimeMinutes })}
          </span>
        </div>

        <h3 className="mb-3 font-heading text-[17px] font-normal leading-snug tracking-wide text-ground">
          {article.title}
        </h3>
        <p className="mb-6 text-xs leading-relaxed text-ground-muted">
          {article.excerpt}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-[10px] tracking-[0.15em] text-ground-accent transition-transform duration-300 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
            {labels.read} {readingArrow(locale)}
          </span>
          <time
            dateTime={article.publishedAt}
            className="text-[10px] tracking-wide text-ground-muted/70"
          >
            {formatArticleDate(article.publishedAt)}
          </time>
        </div>
      </div>
    </LocaleLink>
  );
}
