import Image from "next/image";
import Link from "next/link";

import { formatArticleDate } from "@/src/lib/format";
import type { JournalArticle } from "@/src/types/content";

/** Journal article card — Server Component. */

export interface JournalCardProps {
  article: JournalArticle;
}

export default function JournalCard({ article }: JournalCardProps) {
  return (
    <Link
      href={`/journal/${article.slug}`}
      className="img-zoom group block bg-background no-underline"
    >
      <div className="relative h-[240px] overflow-hidden">
        <Image
          src={article.image.url}
          alt={article.image.alt}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover brightness-[0.6] saturate-[0.7]"
        />
      </div>
      <div className="p-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] text-gold">
            {article.category}
          </span>
          <time
            dateTime={article.publishedAt}
            className="text-[10px] tracking-wider text-ivory/30"
          >
            {formatArticleDate(article.publishedAt)}
          </time>
        </div>
        <h3 className="mb-5 font-heading text-base font-normal leading-snug tracking-wide text-ivory">
          {article.title}
        </h3>
        <span className="inline-block font-heading text-[10px] uppercase tracking-[0.15em] text-gold transition-transform duration-300 ease-out group-hover:translate-x-1">
          Read More →
        </span>
      </div>
    </Link>
  );
}
