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
  /**
   * `row`: the home page's phone layout (Stage 2 D4), a 120px image beside the
   * category, date and title. `card` (default) is the rail card.
   */
  layout?: "card" | "row";
}

export default async function JournalCard({
  article,
  locale,
  layout = "card",
}: JournalCardProps) {
  const dict = await getDictionary(locale);

  if (layout === "row") {
    return (
      <LocaleLink
        href={`/journal/${article.slug}`}
        className="grid grid-cols-[120px_1fr] items-center gap-3.5 text-ground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
      >
        <div className="relative h-30 overflow-hidden rounded-md bg-sand">
          <Image
            src={article.image.url}
            alt={article.image.alt}
            fill
            sizes="120px"
            className="object-cover"
          />
        </div>
        <div dir="auto" className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.2em] text-ground-accent">
            {article.categoryLabel} ·{" "}
            <time dateTime={article.publishedAt}>
              {formatArticleDate(article.publishedAt, locale)}
            </time>
          </p>
          <h3 className="mt-1.5 line-clamp-3 font-heading text-sm font-normal leading-snug text-ground">
            {article.title}
          </h3>
        </div>
      </LocaleLink>
    );
  }

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
              {formatArticleDate(article.publishedAt, locale)}
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
