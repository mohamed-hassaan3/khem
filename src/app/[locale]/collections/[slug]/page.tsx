import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CollectionView from "@/src/components/ecommerce/CollectionView";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCollectionBySlug,
  getCollections,
  getProductCardsByCollection,
} from "@/src/services/products";

/** ISR, 10 minutes — AGENTS.md §8 routing matrix. */
export const revalidate = 600;

/**
 * Prerender every locale × collection pair. Without it the `[slug]` segment
 * would force the route into dynamic rendering.
 */
export async function generateStaticParams() {
  const collections = await getCollections();

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
    getCollectionBySlug(slug),
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

  // The segment is untrusted input: it is only ever matched against seeded
  // slugs, and an unknown value 404s rather than reaching the page.
  const [collection, collections] = await Promise.all([
    getCollectionBySlug(slug),
    getCollections(),
  ]);

  if (!collection) notFound();

  const products = await getProductCardsByCollection(collection.slug);

  return (
    <CollectionView
      locale={isLocale(locale) ? locale : "en"}
      collection={collection}
      products={products}
      collections={collections}
    />
  );
}
