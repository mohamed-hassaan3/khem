"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { formatArticleDate } from "@/src/lib/format";
import type { JournalArticle } from "@/src/types/content";

/**
 * Category tab bar + article grid.
 *
 * Filtering is client-side on purpose: driving it from `?category=` would opt
 * the route out of ISR (AGENTS.md §8 lists `/journal` as ISR 1h). The page
 * queries the articles and passes them in, so no service module crosses the
 * client boundary.
 */

export interface JournalGridProps {
  articles: JournalArticle[];
  /** Filter options, `"All"` first. Derived server-side from the records. */
  categories: string[];
}

export default function JournalGrid({ articles, categories }: JournalGridProps) {
  const allLabel = categories[0] ?? "All";
  const [activeCategory, setActiveCategory] = useState(allLabel);

  const visible = articles.filter(
    (article) =>
      activeCategory === allLabel || article.category === activeCategory,
  );

  return (
    <>
      {/* ── CATEGORY TABS ───────────────────────────── */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-350 gap-9 overflow-x-auto px-6 md:px-20">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.2em] transition-colors duration-300 ease-out ${
                activeCategory === category
                  ? "border-gold text-gold"
                  : "border-transparent text-ivory/40 hover:text-ivory/70"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* ── ARTICLE GRID ────────────────────────────── */}
      <section className="bg-background px-6 pb-24 pt-16 md:px-20 md:pb-36">
        {visible.length > 0 ? (
          <div className="mx-auto grid max-w-350 grid-cols-1 gap-0.5 bg-border sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((article) => (
              <Link
                key={article.id}
                href={`/journal/${article.slug}`}
                className="img-zoom group block bg-surface no-underline"
              >
                <div className="relative h-60 overflow-hidden">
                  <Image
                    src={article.image.url}
                    alt={article.image.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover brightness-55 saturate-60"
                  />
                </div>

                <div className="px-7 pb-9 pt-7">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="eyebrow text-[9px]">
                      {article.category}
                    </span>
                    <span className="text-[10px] tracking-wide text-ivory/25">
                      {article.readTimeMinutes} min read
                    </span>
                  </div>

                  <h3 className="mb-3 font-heading text-[17px] font-normal leading-snug tracking-wide text-ivory">
                    {article.title}
                  </h3>
                  <p className="mb-6 text-xs leading-relaxed text-ivory/40">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-heading text-[10px] tracking-[0.15em] text-gold transition-transform duration-300 ease-out group-hover:translate-x-1">
                      Read →
                    </span>
                    <time
                      dateTime={article.publishedAt}
                      className="text-[10px] tracking-wide text-ivory/25"
                    >
                      {formatArticleDate(article.publishedAt)}
                    </time>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-ivory/40">
            No essays in this category yet. Please return shortly.
          </p>
        )}
      </section>
    </>
  );
}
