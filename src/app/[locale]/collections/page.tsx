import type { Metadata } from "next";

import CollectionView from "@/src/components/ecommerce/CollectionView";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCatalogProductCards,
  getFragranceCollections,
} from "@/src/services/products";

/**
 * ISR, 1 hour.
 *
 * AGENTS.md §8 lists `/collections` as static; an hourly revalidate keeps it
 * prerendered while letting a catalog edit land without a redeploy, matching
 * the other listing routes.
 */
export const revalidate = 3600;

const PATH = "/collections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return localeMetadata({
    locale: isLocale(locale) ? locale : "en",
    path: PATH,
    title: dict.collections.meta.title,
    description: dict.collections.meta.description,
    ogTitle: dict.collections.meta.ogTitle,
    ogDescription: dict.collections.meta.ogDescription,
  });
}

/**
 * The complete catalogue — every product the house makes.
 *
 * This page holds *everything*: the three fragrance collections plus body care,
 * home fragrance, discovery sets, and gift sets, reachable through the facet
 * chips. Those categories keep their own routes as the place to buy them — a
 * card here links back to its category page via `productHref()` — so widening
 * the listing does not create a second checkout URL for the same goods.
 *
 * The collection tab bar stays fragrance-only: it addresses `/collections/[slug]`,
 * which is a chapter of the perfume library and nothing else.
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
  const [collections, products] = await Promise.all([
    getFragranceCollections(activeLocale),
    getCatalogProductCards(activeLocale),
  ]);

  return (
    <CollectionView
      locale={activeLocale}
      collection={null}
      products={products}
      collections={collections}
    />
  );
}
