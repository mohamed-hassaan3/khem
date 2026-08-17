import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CollectionView from "@/src/components/ecommerce/CollectionView";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getFragranceCollectionBySlug,
  getFragranceCollections,
  getProductCardsByCollection,
} from "@/src/services/products";

/** ISR, 10 minutes — AGENTS.md §8 routing matrix. */
export const revalidate = 600;

/**
 * Prerender every locale × collection pair. Without it the `[slug]` segment
 * would force the route into dynamic rendering.
 */
export async function generateStaticParams() {
  // Slugs only; they are identical in both trees, so the locale is
  // immaterial here and the default keeps the query cache warm.
  const collections = await getFragranceCollections("en");

  return LOCALES.flatMap((locale) =>
    collections.map((collection) => ({ locale, slug: collection.slug })),
  );
}

type RouteParams = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [dict, collection] = await Promise.all([
    getDictionary(activeLocale),
    getFragranceCollectionBySlug(activeLocale, slug),
  ]);

  // An unknown slug renders the 404 below; its metadata falls back to the
  // overview's rather than echoing the requested segment back into the page.
  if (!collection) {
    return localeMetadata({
      locale: activeLocale,
      path: "/collections",
      title: dict.collections.meta.title,
      description: dict.collections.meta.description,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path: `/collections/${collection.slug}`,
    title: collection.name,
    description: collection.description,
    ogTitle: `${collection.name} | KHEM`,
    ogDescription: collection.description,
  });
}

/** One collection's fragrances. */
export default async function CollectionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is only ever matched against seeded
  // slugs, and an unknown value 404s rather than reaching the page.
  const [collection, collections] = await Promise.all([
    getFragranceCollectionBySlug(activeLocale, slug),
    getFragranceCollections(activeLocale),
  ]);

  if (!collection) notFound();

  const products = await getProductCardsByCollection(activeLocale, collection.slug);

  return (
    <CollectionView
      locale={activeLocale}
      collection={collection}
      products={products}
      collections={collections}
    />
  );
}
