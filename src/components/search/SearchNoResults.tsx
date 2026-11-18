import { SearchX } from "lucide-react";

import EmptyState from "@/src/components/ecommerce/EmptyState";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { searchHref } from "@/src/lib/search/text";
import { getFeaturedProducts, getFragranceCollections } from "@/src/services/products";

/**
 * `/search` with nothing found — never a dead end (prompts/ai-search-redesign.md).
 *
 * Three ways forward, all real links: rephrase (curated descriptions in the
 * page language), begin with a collection, or the house favourites — products
 * marked Bestseller in the admin, labelled as exactly that and never presented
 * as "similar to your search".
 *
 * With meaning-based search unavailable it falls back to the original keyword
 * copy and the popular terms, making no claim about understanding descriptions.
 */
export default async function SearchNoResults({
  locale,
  query,
  semanticSearch,
}: {
  locale: Locale;
  query: string;
  semanticSearch: boolean;
}) {
  const dict = await getDictionary(locale);

  if (!semanticSearch) {
    return (
      <section className="px-4 pb-14 pt-4 md:px-6 md:pb-24">
        <EmptyState
          icon={SearchX}
          heading={interpolate(dict.search.noResults, { query })}
          body={dict.search.noResultsHint}
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
    );
  }

  const [collections, favourites] = await Promise.all([
    getFragranceCollections(locale),
    getFeaturedProducts(locale, 4),
  ]);

  const rephrasings = dict.search.ai.examplesGroups.map((group) => group.items[0]);

  return (
    <section className="mx-auto grid max-w-350 gap-12 px-4 py-12 md:px-20 md:py-18 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-24">
      <div>
        <h2 className="font-heading text-xl leading-snug text-ground sm:text-2xl" dir="auto">
          {interpolate(dict.search.ai.noResultsHeading, { query })}
        </h2>
        <p className="mt-4 max-w-md text-[13px] leading-loose text-ground-muted">
          {dict.search.ai.noResultsBody}
        </p>

        <p className="eyebrow mb-4 mt-10">{dict.search.ai.tryDifferently}</p>
        <div className="flex flex-wrap gap-2.5">
          {rephrasings.map((phrase) => (
            <LocaleLink
              key={phrase}
              href={searchHref(phrase)}
              className="inline-flex min-h-11 items-center border border-ground-border px-4 font-body text-[13px] tracking-wide text-ground no-underline transition-all duration-400 ease-luxury-bezier hover:border-gold/50 hover:text-ground-accent"
            >
              {phrase}
            </LocaleLink>
          ))}
        </div>

        {collections.length > 0 ? (
          <>
            <p className="eyebrow mb-2 mt-12">{dict.search.ai.orCollection}</p>
            <ul className="flex flex-col">
              {collections.slice(0, 4).map((collection) => (
                <li key={collection.id} className="border-b border-ground-border first:border-t">
                  <LocaleLink
                    href={`/collections/${collection.slug}`}
                    className="group flex min-h-14 items-center justify-between gap-4 no-underline"
                  >
                    <span className="font-heading text-[15px] tracking-widest text-ground transition-colors duration-300 group-hover:text-ground-accent">
                      {collection.name}
                    </span>
                    <span aria-hidden="true" className="text-ground-accent rtl:-scale-x-100">
                      →
                    </span>
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {favourites.length > 0 ? (
        <div>
          <p className="eyebrow mb-6">{dict.search.ai.favourites}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-6">
            {favourites.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
