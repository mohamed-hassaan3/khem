import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";

import EmptyState from "@/src/components/ecommerce/EmptyState";
import NavGround from "@/src/components/NavGround";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import SearchForm from "@/src/components/search/SearchForm";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { RESULTS_LIMIT, SEARCH_PARAM } from "@/src/lib/search/config";
import { isSearchable, normalizeQuery, searchHref } from "@/src/lib/search/text";
import { isAutomatedAgent } from "@/src/lib/search/privacy";
import { searchCatalog } from "@/src/services/search";
import { recordSearch } from "@/src/services/search-log";

/**
 * `/search` — the canonical results page.
 *
 * The overlay panel is a shortcut to this; this is the surface that is
 * linkable, shareable, back-button-correct, and functional without JavaScript.
 *
 * Dynamic by nature — it reads `searchParams`, so there is nothing to
 * revalidate.
 */

const PATH = "/search";

const CARD_SIZES = "(min-width: 1024px) 33vw, 50vw";

/** `?q=a&q=b` is a crafted URL, not a use case — the first value wins. */
function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([
    params,
    searchParams.then((resolved) => normalizeQuery(firstValue(resolved.q))),
  ]);
  const dict = await getDictionary(locale);

  const base = localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: PATH,
    title: query
      ? interpolate(dict.search.meta.titleWithQuery, { query })
      : dict.search.meta.title,
    description: dict.search.meta.description,
    ogTitle: dict.search.meta.ogTitle,
    ogDescription: dict.search.meta.ogDescription,
  });

  return {
    ...base,
    /*
     * Query URLs must not enter the index. Every one of them is a thin,
     * near-duplicate view of a catalog already covered by `/collections`, and
     * anyone can mint an unlimited number of them by editing the address bar —
     * including ones carrying text KHEM would not choose to publish. `follow`
     * stays on so the products linked from here still accrue their signals.
     */
    robots: { index: false, follow: true },
  };
}

export default async function Search({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ locale }, resolvedParams] = await Promise.all([params, searchParams]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  const query = normalizeQuery(firstValue(resolvedParams[SEARCH_PARAM]));
  const searchable = isSearchable(query);
  const { products, mode } = searchable
    ? await searchCatalog(activeLocale, query, { limit: RESULTS_LIMIT })
    : { products: [], mode: "lexical" as const };

  /*
   * Search tracking — prompts/search-tracking.md. This page is the *committed*
   * search (Enter, a popular-search chip, a shared link); the overlay's
   * as-you-type suggestions are never recorded. Prefetches and automated
   * agents are skipped, and the write happens in `after()`, once the page has
   * been sent, so it can neither slow nor break the search. Nothing that
   * identifies the visitor is read for storage — the user agent is only
   * checked here, in memory.
   */
  if (searchable) {
    const requestHeaders = await headers();
    const isPrefetch =
      requestHeaders.get("next-router-prefetch") !== null ||
      requestHeaders.get("purpose") === "prefetch";

    if (!isPrefetch && !isAutomatedAgent(requestHeaders.get("user-agent"))) {
      const resultCount = products.length;
      after(() =>
        recordSearch({ query, locale: activeLocale, resultCount, mode }),
      );
    }
  }

  const count = products.length;
  const meta = isSearchable(query)
    ? count === 0
      ? dict.search.resultCountNone
      : count === 1
        ? dict.search.resultCountOne
        : interpolate(dict.search.resultCount, { count })
    : undefined;

  return (
    <div className="ground-ivory min-h-screen">
      <NavGround ground="ivory" />
      {/*
       * The query is visitor-typed text of unknown script — `dir="auto"` on the
       * heading lets an English query keep its LTR run inside the Arabic page
       * without wrapping it in an island the dictionary copy must not get.
       */}
      <PageHeader
        eyebrow={dict.search.eyebrow}
        heading={query || dict.search.headingEmpty}
        headingDir={query ? "auto" : undefined}
        meta={meta}
      />

      <SearchForm defaultValue={query} />

      {count > 0 ? (
        <section className="mx-auto max-w-350 px-4 py-10 md:py-16 md:px-20">
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={activeLocale}
                sizes={CARD_SIZES}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="px-4 md:px-6 pb-14 md:pb-24 pt-4">
          <EmptyState
            icon={SearchX}
            heading={
              isSearchable(query)
                ? interpolate(dict.search.noResults, { query })
                : dict.search.emptyPrompt
            }
            body={
              isSearchable(query)
                ? dict.search.noResultsHint
                : dict.search.emptyPromptBody
            }
            cta={dict.search.browseCta}
            href="/collections"
          />

          <div className="mx-auto max-w-md text-center">
            <p className="eyebrow mb-5">{dict.search.popular}</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {dict.search.popularTerms.map(({ label, term }) => (
                <LocaleLink
                  key={term}
                  href={searchHref(term)}
                  className="border border-ground-border px-4 py-2 font-body text-[11px] tracking-[0.15em] text-ground-muted no-underline transition-all duration-400 ease-luxury-bezier hover:border-gold/50 hover:text-ground-accent"
                >
                  {label}
                </LocaleLink>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
