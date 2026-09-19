import type { Metadata } from "next";

import CollectionView from "@/src/components/ecommerce/CollectionView";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { getCatalogProductCards, getMerchPage } from "@/src/services/products";

/**
 * ISR, 1 hour.
 *
 * AGENTS.md §8 lists `/collections` as static; a daily revalidate keeps it
 * prerendered while letting a catalog edit land without a redeploy, matching
 * the other listing routes. A catalog edit does not wait for it —
 * `revalidateCollection()` and `revalidateCategory()` re-render this page on
 * the write — so the window is only a backstop.
 */
export const revalidate = 86400;

const PATH = "/collections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const [dict, page] = await Promise.all([
    getDictionary(activeLocale),
    getMerchPage(activeLocale, "all-collections"),
  ]);

  return localeMetadata({
    locale: activeLocale,
    path: PATH,
    title: page?.name ?? dict.collections.meta.title,
    description: page?.description ?? dict.collections.meta.description,
    ogTitle: page?.name ?? dict.collections.meta.ogTitle,
    ogDescription: page?.description ?? dict.collections.meta.ogDescription,
  });
}

/**
 * The complete catalogue — every product the house makes.
 *
 * This page holds *everything*: the three fragrance collections plus body care,
 * home fragrance, discovery sets, and gift sets. Each collection keeps its own
 * page under `/collections/[slug]` as the place to buy from — a card here links
 * back to it via `productHref()` — so widening the listing does not create a
 * second checkout URL for the same goods.
 *
 * It offers one filter row and one parameter. Every chip writes `?facet=`,
 * whether it names a collection or a merchandising cut that crosses all of them
 * (best sellers, new arrivals): from the visitor's side those
 * are one gesture, so they are one vocabulary. See `src/lib/facets.ts`.
 */
export default async function Collections({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout has already rejected any segment that is not a real locale.
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // Fetched after the locale, which now decides what comes back.
  const [products, page] = await Promise.all([
    getCatalogProductCards(activeLocale),
    getMerchPage(activeLocale, "all-collections"),
  ]);

  /*
   * No collection list is fetched: the chips come from `FACET_ORDER` and their
   * labels from the dictionary, so the overview needs the products and nothing
   * else. The tab bar that did need the list belongs to `[slug]`.
   */
  return (
    <CollectionView
      locale={activeLocale}
      collection={null}
      products={products}
      overviewPage={page}
      countsEverything
    />
  );
}
