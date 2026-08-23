"use client";

import { useState } from "react";

import ArticleCard from "@/src/components/journal/ArticleCard";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
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
  const dict = useDictionary();
  const locale = useLocale();
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
        <div className="mx-auto flex max-w-350 gap-5 md:gap-9 overflow-x-auto px-4 md:px-20">
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
      <section className="bg-background px-4 pb-14 pt-10 md:px-20 md:pb-36">
        {visible.length > 0 ? (
          <div className="mx-auto grid max-w-350 grid-cols-1 gap-0.5 bg-border sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                locale={locale}
                labels={{
                  read: dict.journal.read,
                  minRead: dict.common.minRead,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 md:py-16 text-center text-sm text-ivory/40">
            {dict.journal.empty}
          </p>
        )}
      </section>
    </>
  );
}
