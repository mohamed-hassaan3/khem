import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatArticleDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { JournalArticle } from "@/src/types/content";

/**
 * One article as a compact row — the journal index on phones.
 *
 * Takes its copy as props, like `<ArticleCard>`, so it renders on either side
 * of the client boundary.
 */

export interface ArticleRowProps {
  article: JournalArticle;
  locale: Locale;
  /** `dict.common.minRead` — a template carrying `{minutes}`. */
  minRead: string;
}

export default function ArticleRow({ article, locale, minRead }: ArticleRowProps) {
  return (
    <LocaleLink
      href={`/journal/${article.slug}`}
      className="group flex items-start gap-4 py-5 no-underline"
    >
      <div className="relative size-24 flex-none overflow-hidden bg-stone">
        <Image
          src={article.image.url}
          alt={article.image.alt}
          fill
          sizes="96px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>

      <div className="min-w-0 flex-1" dir="auto">
        <p className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[10px] tracking-wide text-ground-muted">
          <span className="eyebrow text-[9px]">{article.categoryLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{interpolate(minRead, { minutes: article.readTimeMinutes })}</span>
        </p>
        <h3 className="mb-1.5 line-clamp-3 font-heading text-[15px] font-normal leading-snug text-ground">
          {article.title}
        </h3>
        <time
          dateTime={article.publishedAt}
          className="text-[10px] tracking-wide text-ground-muted"
        >
          {formatArticleDate(article.publishedAt, locale)}
        </time>
      </div>
    </LocaleLink>
  );
}
