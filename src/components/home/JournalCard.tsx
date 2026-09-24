import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { formatArticleDate } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { readingArrow } from "@/src/lib/i18n/rtl";
import type { JournalArticle } from "@/src/types/content";

/** Journal article card — Server Component. */

export interface JournalCardProps {
  article: JournalArticle;
  locale: Locale;
}

export default async function JournalCard({
  article,
  locale,
}: JournalCardProps) {
  const dict = await getDictionary(locale);

  return (
    <LocaleLink
      href={`/journal/${article.slug}`}
      className="img-zoom group block bg-[var(--card-bg)] no-underline"
    >
      <div className="relative h-[240px] overflow-hidden">
        <Image
          src={article.image.url}
          alt={article.image.alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="p-8">
        {/* Category and title are translated; the date is formatted by
            `formatArticleDate()` in Western digits for both trees. */}
        <div dir="auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.2em] text-ground-accent">
              {article.categoryLabel}
            </span>
            <time
              dateTime={article.publishedAt}
              className="text-[10px] tracking-wider text-ground-muted/70"
            >
              {formatArticleDate(article.publishedAt)}
            </time>
          </div>
          <h3 className="mb-5 font-heading text-base font-normal leading-snug tracking-wide text-ground">
            {article.title}
          </h3>
        </div>
        <span className="inline-block font-heading text-[10px] uppercase tracking-[0.15em] text-ground-accent transition-transform duration-300 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
          {dict.common.readMore} {readingArrow(locale)}
        </span>
      </div>
    </LocaleLink>
  );
}
