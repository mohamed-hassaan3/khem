import Reveal from "@/src/components/animation/Reveal";
import ArticleCard from "@/src/components/journal/ArticleCard";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import type { JournalArticle } from "@/src/types/content";

/**
 * "Continue Reading" — Server Component.
 *
 * The journal's answer to `<RelatedProducts>`, down to the section skeleton, so
 * the foot of an article and the foot of a product page are recognisably the
 * same page furniture. Which essays appear is decided in Postgres by
 * `related_articles()` — cosine distance over the pgvector embeddings, with an
 * editorial fallback — and this component only lays them out.
 */

export interface RelatedArticlesProps {
  articles: JournalArticle[];
  locale: Locale;
}

const CARD_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default async function RelatedArticles({
  articles,
  locale,
}: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  const dict = await getDictionary(locale);

  return (
    <section className="border-t border-border px-4 py-14 md:px-20 md:py-32">
      <div className="mx-auto max-w-350">
        <Reveal className="mb-10 md:mb-16 text-center">
          <p className="eyebrow mb-4">{dict.journal.article.related.eyebrow}</p>
          <h2 className="font-heading text-3xl font-normal text-ivory sm:text-4xl">
            {dict.journal.article.related.heading}
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              locale={locale}
              labels={{
                read: dict.journal.read,
                minRead: dict.common.minRead,
              }}
              sizes={CARD_SIZES}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
