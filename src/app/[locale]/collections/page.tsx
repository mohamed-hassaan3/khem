import type { Metadata } from "next";

import CollectionView from "@/src/components/ecommerce/CollectionView";
import { isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCollections,
  getProductCardsByCollection,
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

/** The complete catalog, across every collection. */
export default async function Collections({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, collections, products] = await Promise.all([
    params,
    getCollections(),
    getProductCardsByCollection(),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <CollectionView
      locale={activeLocale}
      collection={null}
      products={products}
      collections={collections}
    />
  );
}
