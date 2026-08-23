import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Reveal from "@/src/components/animation/Reveal";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import ArticleBody from "@/src/components/journal/ArticleBody";
import ArticleHero from "@/src/components/journal/ArticleHero";
import RelatedArticles from "@/src/components/journal/RelatedArticles";
import { LOCALES, isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { SITE_URL, localeMetadata } from "@/src/lib/i18n/metadata";
import { backArrow } from "@/src/lib/i18n/rtl";
import {
  getArticleBySlug,
  getArticleSlugs,
  getRelatedArticles,
} from "@/src/services/content";

/** ISR, 1 hour — AGENTS.md §8 routing matrix, same as the journal index. */
export const revalidate = 3600;

/**
 * Prerender every locale × article pair. Without it the `[slug]` segment would
 * force the route into dynamic rendering, and an essay is the most cacheable
 * thing on the site.
 */
export async function generateStaticParams() {
  const slugs = await getArticleSlugs();

  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

type RouteParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [dict, article] = await Promise.all([
    getDictionary(activeLocale),
    getArticleBySlug(slug),
  ]);

  // An unknown slug renders the 404 below; its metadata falls back to the
  // journal index rather than echoing the requested segment back into the page.
  if (!article) {
    return localeMetadata({
      locale: activeLocale,
      path: "/journal",
      title: dict.journal.meta.title,
      description: dict.journal.meta.description,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path: `/journal/${article.slug}`,
    title: article.title,
    description: article.excerpt,
    ogTitle: `${article.title} | KHEM`,
    ogDescription: article.excerpt,
    image: { url: article.image.url, alt: article.image.alt },
    article: { publishedTime: article.publishedAt, section: article.category },
  });
}

/** Journal article detail page. */
export default async function JournalArticlePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is only ever matched against stored
  // slugs, and an unknown value — or an unpublished draft, which RLS makes
  // indistinguishable from a missing row — 404s.
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const [dict, related] = await Promise.all([
    getDictionary(activeLocale),
    getRelatedArticles(article.slug),
  ]);

  /*
   * `Article` structured data. Every value is a stored string serialised by
   * `JSON.stringify`, which escapes what needs escaping — nothing an editor can
   * type reaches the page as markup.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.image.url,
    datePublished: article.publishedAt,
    articleSection: article.category,
    inLanguage: "en",
    mainEntityOfPage: `${SITE_URL}${localizePath(activeLocale, `/journal/${article.slug}`)}`,
    publisher: {
      "@type": "Organization",
      name: "KHEM Perfumes",
      url: SITE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-background text-ivory">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ArticleHero article={article} locale={activeLocale} />

      <ArticleBody article={article} locale={activeLocale} />

      {/* ── BACK TO THE JOURNAL ─────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 md:px-6 pb-14 md:pb-32">
        <Reveal>
          <LocaleLink
            href="/journal"
            className="group inline-flex items-center gap-3 font-heading text-[11px] uppercase tracking-[0.2em] text-gold no-underline"
          >
            <span
              className="inline-block transition-transform duration-300 ease-out group-hover:-translate-x-1 rtl:group-hover:translate-x-1"
              aria-hidden="true"
            >
              {backArrow(activeLocale)}
            </span>
            {dict.journal.article.backToJournal}
          </LocaleLink>
        </Reveal>
      </div>

      <RelatedArticles articles={related} locale={activeLocale} />
    </div>
  );
}
