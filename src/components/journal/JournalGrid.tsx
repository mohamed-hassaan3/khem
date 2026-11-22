"use client";

import { useState } from "react";

import ArticleCard from "@/src/components/journal/ArticleCard";
import ArticleRow from "@/src/components/journal/ArticleRow";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { JournalCategory } from "@/src/services/content";
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
  categories: JournalCategory[];
}

export default function JournalGrid({ articles, categories }: JournalGridProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const allCategory = categories[0] ?? { key: "All", label: "All" };
  const [activeCategory, setActiveCategory] = useState(allCategory.key);

  const visible = articles.filter(
    (article) =>
      activeCategory === allCategory.key || article.category === activeCategory,
  );

  return (
    <>
      {/* ── CATEGORY PILLS ──────────────────────────── */}
      {/*
       * Pills, as in the search panel: one row that scrolls sideways on a
       * phone rather than wrapping into a block above the first article.
       */}
      <div className="border-b border-ground-border">
        <div className="mx-auto flex max-w-350 gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] sm:px-6 md:px-10 lg:px-12 xl:px-16">
          {categories.map((category) => {
            const active = activeCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(category.key)}
                className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-4 font-body text-xs transition-colors duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent ${
                  active
                    ? "border-ground bg-ground text-ground-bg"
                    : "border-ground-border text-ground-muted hover:border-ground-accent hover:text-ground-accent"
                }`}
              >
                <span dir="auto">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ARTICLES ────────────────────────────────── */}
      <section className="px-4 pb-14 pt-2 sm:px-6 sm:pt-10 md:px-10 md:pb-36 lg:px-12 xl:px-16">
        {visible.length > 0 ? (
          <>
            {/*
             * Phones: ruled rows, thumbnail beside the words. A full card per
             * article was ~520px each — the index ran to 4,300px for nine
             * essays. From `sm` the card grid has the width it was made for.
             */}
            <ul className="sm:hidden">
              {visible.map((article) => (
                <li key={article.id} className="border-b border-ground-border">
                  <ArticleRow
                    article={article}
                    locale={locale}
                    minRead={dict.common.minRead}
                  />
                </li>
              ))}
            </ul>

            <div className="mx-auto hidden max-w-350 grid-cols-2 gap-0.5 bg-border sm:grid lg:grid-cols-3">
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
          </>
        ) : (
          <p className="py-10 md:py-16 text-center text-sm text-ground-muted">
            {dict.journal.empty}
          </p>
        )}
      </section>
    </>
  );
}
